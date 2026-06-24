import { describe, expect, it } from 'vitest';
import { Array as YArray, Doc, Map as YMap, applyUpdate, encodeStateAsUpdate } from 'yjs';
import type { NotionPageData, NotionSchema } from '../notion-page/types';
import { buildInitialDataSourceProperties } from './domain';
import { WorkspaceYjsStore } from './workspaceYjs';

function createStore(onRoom?: (room: string) => void, persisted: Map<string, Doc> = new Map()) {
  return new WorkspaceYjsStore((room, document) => {
    onRoom?.(room);
    const source = persisted.get(room) ?? new Doc();
    persisted.set(room, source);
    applyUpdate(document, encodeStateAsUpdate(source));
    const persist = (update: Uint8Array) => applyUpdate(source, update);
    document.on('update', persist);
    return { destroy() { document.off('update', persist); } };
  });
}

function createLegacyDataSource(sourceSchema: NotionSchema, sourcePages: NotionPageData[]): Doc {
  const document = new Doc();
  const definitions = document.getMap<string>('schema-definitions');
  const definitionOrder = document.getArray<string>('schema-order');
  const pages = document.getMap<YMap<unknown>>('pages');
  const pageOrder = document.getArray<string>('page-order');
  sourceSchema.properties.forEach((definition) => definitions.set(definition.id, JSON.stringify(definition)));
  definitionOrder.push(sourceSchema.properties.map((definition) => definition.id));
  sourcePages.forEach((item) => {
    const row = new YMap<unknown>();
    const properties = new YMap<unknown>();
    Object.entries(item.properties).forEach(([id, value]) => properties.set(id, value));
    row.set('title', item.title);
    row.set('createdTime', item.createdTime);
    row.set('lastEditedTime', item.lastEditedTime);
    row.set('properties', properties);
    row.set('viewRanks', new YMap<number>());
    pages.set(item.id, row);
  });
  pageOrder.push(sourcePages.map((item) => item.id));
  return document;
}

const schema: NotionSchema = {
  properties: [
    { id: 'status', name: 'Status', type: 'status', options: [{ id: 'todo', name: 'Todo', color: 'gray' }], groups: [] },
    { id: 'due', name: 'Due', type: 'date', includeTime: true, timezone: 'America/Sao_Paulo' },
    { id: 'score', name: 'Score', type: 'text' },
  ],
};

const page: NotionPageData = {
  id: 'page-1', title: 'Page', properties: { status: 'todo', due: null, score: '42' }, content: null,
  createdTime: '2026-06-21T00:00:00.000Z', lastEditedTime: '2026-06-21T00:00:00.000Z',
};

describe('WorkspaceYjsStore', () => {
  it('migrates schema and values in one transaction', () => {
    const store = createStore();
    store.initialize({ schema, pages: [page] });
    let changes = 0;
    const unsubscribe = store.subscribe(() => { changes += 1; });
    store.applySchema('roadmap', { ...schema, properties: schema.properties.map((property) => property.id === 'score' ? { id: 'score', name: 'Score', type: 'number' } : property) });
    expect(store.read().pages[0].properties.score).toBe(42);
    expect(changes).toBeGreaterThanOrEqual(2);
    unsubscribe();
  });

  it('restores a property value when the same property is removed and added again', () => {
    const store = createStore();
    store.initialize({ schema, pages: [page] });
    store.applySchema('roadmap', {
      properties: schema.properties.filter((property) => property.id !== 'score'),
    });
    expect(store.read().pages[0].properties).not.toHaveProperty('score');

    store.applySchema('roadmap', schema);
    expect(store.read().pages[0].properties.score).toBe('42');
  });

  it('seeds board and calendar with independent configuration', () => {
    const store = createStore();
    store.initialize({ schema, pages: [page] });
    const resources = store.read().resources ?? [];
    expect(resources.find((resource) => resource.type === 'board')).toMatchObject({ statusPropertyId: 'status' });
    expect(resources.find((resource) => resource.type === 'calendar')).toMatchObject({ datePropertyId: 'due', timezone: 'America/Sao_Paulo' });
  });

  it('creates a board with independent pages, properties and grouping status', () => {
    const persisted = new Map<string, Doc>();
    const store = createStore(undefined, persisted);
    store.initialize({ schema, pages: [page] });
    const boardStatus: NotionSchema['properties'][number] = {
      id: 'status-new-board', name: 'New board status', type: 'status',
      options: [{ id: 'new-todo', name: 'Todo', color: 'gray' }], groups: [],
    };
    const boardDefinitions = buildInitialDataSourceProperties(boardStatus);
    store.createResource({
      id: 'board-new', databaseId: 'database-new', dataSourceId: 'source-new', type: 'board', title: 'New board', pageIds: [],
      propertyIds: boardDefinitions.map((property) => property.id), statusPropertyId: boardStatus.id,
    }, boardDefinitions);

    const resources = store.read().resources ?? [];
    const original = resources.find((resource) => resource.id === 'board-roadmap');
    const created = resources.find((resource) => resource.id === 'board-new');
    expect(created).toMatchObject({
      databaseId: 'database-new', dataSourceId: 'source-new', pageIds: [], statusPropertyId: 'status-new-board',
    });
    expect(store.read().dataSourceSchemas?.['source-new'].properties.map((property) => property.type)).toEqual([
      'status', 'created_time', 'last_edited_time',
    ]);
    expect(original?.pageIds).toEqual(['page-1']);
    expect(original?.propertyIds).not.toContain('status-new-board');

    store.destroy();
    const restored = createStore(undefined, persisted);
    restored.initialize({ schema, pages: [page] });
    expect(restored.read().resources?.find((resource) => resource.id === 'board-new')).toMatchObject({
      databaseId: 'database-new', dataSourceId: 'source-new', title: 'New board',
    });
  });

  it('keeps newly inserted pages independent until explicitly linked', () => {
    const store = createStore();
    store.initialize({ schema, pages: [page] });
    store.insertPage({ ...page, id: 'independent', title: 'Independent page' });
    expect(store.read().resources?.every((resource) => !resource.pageIds.includes('independent'))).toBe(true);
  });

  it('gives standalone pages private schemas without leaking properties', () => {
    const store = createStore();
    store.initialize({ schema, pages: [page] });
    store.insertPage({ ...page, id: 'private-a', properties: {} });
    store.insertPage({ ...page, id: 'private-b', properties: {} });
    const privateSchema: NotionSchema = {
      properties: [{ id: 'private-note', name: 'Note', type: 'text' }],
    };
    store.applyPageSchema('private-a', privateSchema);

    const state = store.read();
    expect(state.pageSchemas?.['private-a']).toEqual(privateSchema);
    expect(state.pageSchemas?.['private-b']).toEqual({ properties: [] });
    expect(state.pages.find((item) => item.id === 'private-a')?.properties).toHaveProperty('private-note');
    expect(state.pages.find((item) => item.id === 'private-b')?.properties).not.toHaveProperty('private-note');
  });

  it('moves a standalone page into a board database and back', () => {
    const store = createStore();
    store.initialize({ schema, pages: [page] });
    store.insertPage({ ...page, id: 'standalone', properties: {} });
    store.linkPage('board-roadmap', 'standalone');
    store.updateProperty('standalone', 'status', 'todo');

    let state = store.read();
    expect(state.resources?.find((resource) => resource.id === 'board-roadmap')?.pageIds).toContain('standalone');
    expect(state.pages.find((item) => item.id === 'standalone')?.properties.status).toBe('todo');

    store.unlinkPage('board-roadmap', 'standalone');
    state = store.read();
    expect(state.resources?.find((resource) => resource.id === 'board-roadmap')?.pageIds).not.toContain('standalone');
    expect(state.pages.find((item) => item.id === 'standalone')?.properties.status).toBe('todo');
  });

  it('persists and resumes each phase of a page move', () => {
    const persisted = new Map<string, Doc>();
    const first = createStore(undefined, persisted);
    first.initialize({ schema, pages: [page] });
    first.insertPage({ ...page, id: 'resumable', properties: {} });
    const operation = first.prepareMove('resumable', 'roadmap');
    expect(operation?.status).toBe('prepared');
    expect(first.advanceMove(operation!.id)?.status).toBe('staged');
    first.destroy();

    const second = createStore(undefined, persisted);
    second.initialize({ schema, pages: [page] });
    expect(second.advanceMove(operation!.id)?.status).toBe('committed');
    second.destroy();

    const third = createStore(undefined, persisted);
    third.initialize({ schema, pages: [page] });
    expect(third.advanceMove(operation!.id)?.status).toBe('cleaned');
    expect(third.read().ownership?.resumable).toMatchObject({ dataSourceId: 'roadmap', version: 2 });
    expect(third.read().moveOperations?.find((item) => item.id === operation!.id)?.status).toBe('cleaned');
  });

  it('maps compatible properties, archives unmatched values and supports undo', () => {
    const store = createStore();
    store.initialize({ schema, pages: [page] });
    const targetSchema: NotionSchema = {
      properties: [
        { id: 'target-score', name: 'Score', type: 'number' },
        { id: 'target-note', name: 'Note', type: 'text' },
      ],
    };
    store.createResource({
      id: 'target-calendar', databaseId: 'target-db', dataSourceId: 'target-source', type: 'calendar',
      title: 'Target', pageIds: [], propertyIds: ['target-note'], datePropertyId: 'target-note',
      timezone: 'America/Sao_Paulo', defaultView: 'month', visibleHours: { from: 8, to: 18 },
    }, targetSchema.properties);

    const operation = store.prepareMove('page-1', 'target-source');
    expect(operation?.propertyMapping).toContainEqual({
      sourcePropertyId: 'score', targetPropertyId: 'target-score', conversion: 'convert',
    });
    expect(operation?.propertyMapping).toContainEqual({ sourcePropertyId: 'status', conversion: 'archive' });
    expect(store.commitMove(operation!.id)?.status).toBe('cleaned');
    expect(store.read().pages.find((item) => item.id === 'page-1')?.properties).toMatchObject({ 'target-score': 42 });

    expect(store.undoMove(operation!.id)?.status).toBe('undone');
    expect(store.read().ownership?.['page-1']).toMatchObject({ dataSourceId: 'roadmap', version: 3 });
    expect(store.read().pages.find((item) => item.id === 'page-1')?.properties).toMatchObject(page.properties);
  });

  it('lets only one concurrent move commit from the same ownership version', () => {
    const store = createStore();
    store.initialize({ schema, pages: [page] });
    const status = schema.properties[0];
    store.createResource({
      id: 'other-board', databaseId: 'other-db', dataSourceId: 'other-source', type: 'board', title: 'Other',
      pageIds: [], propertyIds: [status.id], statusPropertyId: status.id,
    }, [status]);
    store.createResource({
      id: 'third-board', databaseId: 'third-db', dataSourceId: 'third-source', type: 'board', title: 'Third',
      pageIds: [], propertyIds: [status.id], statusPropertyId: status.id,
    }, [status]);
    const first = store.prepareMove('page-1', 'other-source')!;
    const second = store.prepareMove('page-1', 'third-source')!;
    store.advanceMove(first.id);
    store.advanceMove(second.id);
    expect(store.advanceMove(first.id)?.status).toBe('committed');
    expect(store.advanceMove(second.id)?.status).toBe('conflicted');
    expect(store.commitMove(first.id)?.status).toBe('cleaned');
    expect(store.read().ownership?.['page-1'].dataSourceId).toBe('other-source');
  });

  it('stores relations without moving pages and removes dangling references', () => {
    const store = createStore();
    store.initialize({ schema, pages: [page] });
    const targetStatus = { id: 'target-status', name: 'Status', type: 'status' as const, options: [], groups: [] };
    store.createResource({
      id: 'relation-target-board', databaseId: 'relation-target-db', dataSourceId: 'relation-target',
      type: 'board', title: 'Relation target', pageIds: [], propertyIds: [targetStatus.id], statusPropertyId: targetStatus.id,
    }, [targetStatus]);
    store.insertPage({ ...page, id: 'related-page', title: 'Related', properties: {} }, undefined, 'relation-target');
    store.applySchema('roadmap', {
      properties: [...schema.properties, {
        id: 'relation', name: 'Related page', type: 'relation', targetDataSourceId: 'relation-target', multiple: true,
      }],
    });

    store.updateProperty('page-1', 'relation', ['related-page', 'missing-page']);
    expect(store.read().pages.find((item) => item.id === 'page-1')?.properties.relation).toEqual(['related-page']);
    expect(store.read().ownership?.['page-1'].dataSourceId).toBe('roadmap');
    expect(store.read().ownership?.['related-page'].dataSourceId).toBe('relation-target');

    store.deletePage('related-page');
    expect(store.read().pages.find((item) => item.id === 'page-1')?.properties.relation).toEqual([]);
  });

  it('keeps pages and schemas isolated between newly created databases', () => {
    const store = createStore();
    store.initialize({ schema, pages: [page] });
    const isolatedStatus: NotionSchema['properties'][number] = {
      id: 'isolated-status', name: 'Isolated status', type: 'status',
      options: [{ id: 'isolated-todo', name: 'Todo', color: 'gray' }], groups: [],
    };
    store.createResource({
      id: 'isolated-board', databaseId: 'isolated-db', dataSourceId: 'isolated-source', type: 'board', title: 'Isolated',
      pageIds: [], propertyIds: [isolatedStatus.id], statusPropertyId: isolatedStatus.id,
    }, [isolatedStatus]);
    store.insertPage({
      ...page, id: 'isolated-page', properties: { [isolatedStatus.id]: 'isolated-todo' },
    }, undefined, 'isolated-source');

    const state = store.read();
    const original = state.resources?.find((resource) => resource.id === 'board-roadmap');
    const isolated = state.resources?.find((resource) => resource.id === 'isolated-board');
    expect(original?.pageIds).toEqual(['page-1']);
    expect(isolated?.pageIds).toEqual(['isolated-page']);
    expect(original?.propertyIds).not.toContain(isolatedStatus.id);
    expect(isolated?.propertyIds).toEqual([isolatedStatus.id]);
  });

  it('migrates a legacy custom view into its own versioned database', () => {
    const workspace = new Doc();
    workspace.getMap<string>('resource-references').set('legacy-board', JSON.stringify({ id: 'legacy-board', type: 'board' }));
    workspace.getArray<string>('resource-order').push(['legacy-board']);

    const view = new Doc();
    const resource = view.getMap<unknown>('resource');
    resource.set('type', 'board');
    resource.set('title', 'Legacy board');
    resource.set('statusPropertyId', 'status');
    const pageIds = new YArray<string>();
    pageIds.push(['page-1']);
    resource.set('pageIds', pageIds);
    const propertyIds = new YArray<string>();
    propertyIds.push(['status']);
    resource.set('propertyIds', propertyIds);

    const persisted = new Map<string, Doc>([
      ['workspace:notion-pages-lab', workspace],
      ['view:legacy-board', view],
    ]);
    const store = createStore(undefined, persisted);
    store.initialize({ schema, pages: [page] });

    expect(store.read().resources?.find((item) => item.id === 'legacy-board')).toMatchObject({
      databaseId: 'db-legacy-board',
      dataSourceId: 'db-legacy-board',
      pageIds: ['page-1'],
      propertyIds: ['status'],
      statusPropertyId: 'status',
    });
  });

  it('opens independent workspace, database and view rooms', () => {
    const rooms: string[] = [];
    const store = createStore((room) => rooms.push(room));
    store.initialize({ schema, pages: [page] });
    expect(rooms).toContain('workspace:notion-pages-lab');
    expect(rooms).toContain('database:roadmap:v1');
    expect(rooms).toContain('datasource:roadmap:v1');
    expect(rooms).toContain('view:board-roadmap');
    expect(rooms).toContain('view:calendar-product');
  });

  it('keeps two views on one data source sharing rows but not view configuration', () => {
    const store = createStore();
    store.initialize({ schema, pages: [page] });
    store.createResource({
      id: 'calendar-shared', databaseId: 'roadmap', dataSourceId: 'roadmap', type: 'calendar',
      title: 'Shared calendar', pageIds: [], propertyIds: ['due'], datePropertyId: 'due',
      timezone: 'America/Sao_Paulo', defaultView: 'week', visibleHours: { from: 8, to: 18 },
    });

    store.updateResource('calendar-shared', { defaultView: 'agenda' });
    const resources = store.read().resources ?? [];
    expect(resources.find((item) => item.id === 'calendar-shared')?.pageIds).toEqual(['page-1']);
    expect(resources.find((item) => item.id === 'board-roadmap')?.pageIds).toEqual(['page-1']);
    expect(resources.find((item) => item.id === 'calendar-shared')).toMatchObject({ defaultView: 'agenda' });
    expect(resources.find((item) => item.id === 'calendar-product')).toMatchObject({ defaultView: 'month' });
  });

  it('persists generic filter, sort, grouping and projection per view', () => {
    const persisted = new Map<string, Doc>();
    const store = createStore(undefined, persisted);
    store.initialize({ schema, pages: [page] });
    store.updateResource('board-roadmap', {
      filter: { type: 'group', operator: 'and', filters: [{ type: 'condition', propertyId: 'score', operator: 'is_not_empty' }] },
      sorts: [{ propertyId: 'score', direction: 'descending' }],
      group: { propertyId: 'status' },
      subgroup: { propertyId: 'due' },
      projection: { propertyIds: ['status', 'score'], openMode: 'side_peek', cardPreview: 'cover' },
    });
    store.destroy();

    const restored = createStore(undefined, persisted);
    restored.initialize({ schema, pages: [page] });
    expect(restored.read().resources?.find((item) => item.id === 'board-roadmap')).toMatchObject({
      sorts: [{ propertyId: 'score', direction: 'descending' }],
      group: { propertyId: 'status' },
      subgroup: { propertyId: 'due' },
      projection: { propertyIds: ['status', 'score'], openMode: 'side_peek', cardPreview: 'cover' },
    });
  });

  it('persists table, list, gallery and timeline as views of one data source', () => {
    const persisted = new Map<string, Doc>();
    const store = createStore(undefined, persisted);
    store.initialize({ schema, pages: [page] });
    store.createResource({ id: 'table-shared', databaseId: 'roadmap', dataSourceId: 'roadmap', type: 'table', title: 'Table', pageIds: [], propertyIds: ['status', 'score'] });
    store.createResource({ id: 'list-shared', databaseId: 'roadmap', dataSourceId: 'roadmap', type: 'list', title: 'List', pageIds: [], propertyIds: ['score'] });
    store.createResource({ id: 'gallery-shared', databaseId: 'roadmap', dataSourceId: 'roadmap', type: 'gallery', title: 'Gallery', pageIds: [], propertyIds: ['status'] });
    store.createResource({ id: 'timeline-shared', databaseId: 'roadmap', dataSourceId: 'roadmap', type: 'timeline', title: 'Timeline', pageIds: [], propertyIds: ['due'], datePropertyId: 'due', timezone: 'America/Sao_Paulo' });
    expect(store.read().resources?.filter((item) => item.id.endsWith('-shared')).every((item) => item.pageIds.includes('page-1'))).toBe(true);
    store.destroy();

    const restored = createStore(undefined, persisted);
    restored.initialize({ schema, pages: [page] });
    expect(restored.read().resources?.filter((item) => item.id.endsWith('-shared')).map((item) => item.type)).toEqual([
      'table', 'list', 'gallery', 'timeline',
    ]);
  });

  it('migrates database v2 to data source v1 idempotently without losing values', () => {
    const schemaWithAudit: NotionSchema = {
      properties: [
        ...schema.properties,
        { id: 'createdTime', name: 'Criado em', type: 'created_time' },
        { id: 'editedTime', name: 'Editado em', type: 'last_edited_time' },
      ],
    };
    const workspace = new Doc();
    workspace.getMap<string>('resource-references').set('board-roadmap', JSON.stringify({
      id: 'board-roadmap', type: 'board', databaseId: 'roadmap',
    }));
    workspace.getArray<string>('resource-order').push(['board-roadmap']);
    workspace.getMap<string>('database-references').set('roadmap', JSON.stringify({ id: 'roadmap', title: 'Roadmap' }));
    workspace.getArray<string>('database-order').push(['roadmap']);

    const view = new Doc();
    const resource = view.getMap<unknown>('resource');
    resource.set('type', 'board');
    resource.set('databaseId', 'roadmap');
    resource.set('title', 'Roadmap');
    resource.set('statusPropertyId', 'status');
    const propertyIds = new YArray<string>();
    propertyIds.push(['status', 'due', 'score']);
    resource.set('propertyIds', propertyIds);

    const persisted = new Map<string, Doc>([
      ['workspace:notion-pages-lab', workspace],
      ['database:roadmap:v2', createLegacyDataSource(schema, [page])],
      ['view:board-roadmap', view],
    ]);
    const first = createStore(undefined, persisted);
    first.initialize({ schema: schemaWithAudit, pages: [page] });
    const firstState = first.read();
    first.destroy();

    const second = createStore(undefined, persisted);
    second.initialize({ schema: schemaWithAudit, pages: [page] });
    const secondState = second.read();
    expect(secondState.pages).toEqual(firstState.pages);
    expect(secondState.pages).toHaveLength(1);
    expect(secondState.pages[0].properties).toMatchObject({
      ...page.properties,
      createdTime: page.createdTime,
      editedTime: page.lastEditedTime,
    });
    expect(secondState.dataSourceSchemas?.roadmap.properties.map((property) => property.type)).toEqual([
      'status', 'date', 'text', 'created_time', 'last_edited_time',
    ]);
    expect(secondState.ownership?.['page-1']).toMatchObject({ dataSourceId: 'roadmap', version: 1 });
    expect(secondState.dataSources).toEqual([{ id: 'roadmap', databaseId: 'roadmap', title: 'Roadmap' }]);
  });
});
