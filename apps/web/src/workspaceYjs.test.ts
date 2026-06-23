import { describe, expect, it } from 'vitest';
import { Array as YArray, Doc, applyUpdate, encodeStateAsUpdate } from 'yjs';
import type { NotionPageData, NotionSchema } from '../notion-page/types';
import { WorkspaceYjsStore } from './workspaceYjs';

function createStore(onRoom?: (room: string) => void, persisted: Map<string, Doc> = new Map()) {
  return new WorkspaceYjsStore((room, document) => {
    onRoom?.(room);
    const source = persisted.get(room);
    if (source) applyUpdate(document, encodeStateAsUpdate(source));
    return { destroy() {} };
  });
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

  it('seeds board and calendar with independent configuration', () => {
    const store = createStore();
    store.initialize({ schema, pages: [page] });
    const resources = store.read().resources ?? [];
    expect(resources.find((resource) => resource.type === 'board')).toMatchObject({ statusPropertyId: 'status' });
    expect(resources.find((resource) => resource.type === 'calendar')).toMatchObject({ datePropertyId: 'due', timezone: 'America/Sao_Paulo' });
  });

  it('creates a board with independent pages, properties and grouping status', () => {
    const store = createStore();
    store.initialize({ schema, pages: [page] });
    const boardStatus: NotionSchema['properties'][number] = {
      id: 'status-new-board', name: 'New board status', type: 'status',
      options: [{ id: 'new-todo', name: 'Todo', color: 'gray' }], groups: [],
    };
    store.createResource({
      id: 'board-new', databaseId: 'database-new', type: 'board', title: 'New board', pageIds: [],
      propertyIds: [boardStatus.id], statusPropertyId: boardStatus.id,
    }, [boardStatus]);

    const resources = store.read().resources ?? [];
    const original = resources.find((resource) => resource.id === 'board-roadmap');
    const created = resources.find((resource) => resource.id === 'board-new');
    expect(created).toMatchObject({
      databaseId: 'database-new', pageIds: [], propertyIds: ['status-new-board'], statusPropertyId: 'status-new-board',
    });
    expect(original?.pageIds).toEqual(['page-1']);
    expect(original?.propertyIds).not.toContain('status-new-board');
  });

  it('keeps newly inserted pages independent until explicitly linked', () => {
    const store = createStore();
    store.initialize({ schema, pages: [page] });
    store.insertPage({ ...page, id: 'independent', title: 'Independent page' });
    expect(store.read().resources?.every((resource) => !resource.pageIds.includes('independent'))).toBe(true);
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
    expect(state.pages.find((item) => item.id === 'standalone')?.properties).toEqual({});
  });

  it('keeps pages and schemas isolated between newly created databases', () => {
    const store = createStore();
    store.initialize({ schema, pages: [page] });
    const isolatedStatus: NotionSchema['properties'][number] = {
      id: 'isolated-status', name: 'Isolated status', type: 'status',
      options: [{ id: 'isolated-todo', name: 'Todo', color: 'gray' }], groups: [],
    };
    store.createResource({
      id: 'isolated-board', databaseId: 'isolated-db', type: 'board', title: 'Isolated',
      pageIds: [], propertyIds: [isolatedStatus.id], statusPropertyId: isolatedStatus.id,
    }, [isolatedStatus]);
    store.insertPage({
      ...page, id: 'isolated-page', properties: { [isolatedStatus.id]: 'isolated-todo' },
    }, undefined, 'isolated-db');

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
    expect(rooms).toContain('database:roadmap:v2');
    expect(rooms).toContain('view:board-roadmap');
    expect(rooms).toContain('view:calendar-product');
  });
});
