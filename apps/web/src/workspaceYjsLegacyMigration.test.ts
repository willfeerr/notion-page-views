import { describe, expect, it } from 'vitest';
import { Array as YArray, Doc, Map as YMap, applyUpdate, encodeStateAsUpdate } from 'yjs';
import type { NotionPageData, NotionSchema } from '../notion-page/types';
import type { WorkspaceResource } from './domain';
import { WorkspaceYjsStore } from './workspaceYjs';
import { ROOM_NAMES } from './yjs/model';

function createStore(persisted: Map<string, Doc>) {
  return new WorkspaceYjsStore((room, document) => {
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

function createLegacyWorkspace(resource: WorkspaceResource): Doc {
  const document = new Doc();
  const references = document.getMap<string>('resource-references');
  const resourceOrder = document.getArray<string>('resource-order');
  const databaseReferences = document.getMap<string>('database-references');
  const databaseOrder = document.getArray<string>('database-order');

  references.set(resource.id, JSON.stringify({
    id: resource.id,
    type: resource.type,
    databaseId: resource.databaseId,
    dataSourceId: resource.dataSourceId,
  }));
  resourceOrder.push([resource.id]);
  databaseReferences.set(resource.databaseId, JSON.stringify({ id: resource.databaseId, title: resource.title }));
  databaseOrder.push([resource.databaseId]);

  return document;
}

const schema: NotionSchema = {
  properties: [
    { id: 'status', name: 'Status', type: 'status', options: [{ id: 'todo', name: 'Todo', color: 'gray' }], groups: [] },
    { id: 'score', name: 'Score', type: 'text' },
  ],
};

const page: NotionPageData = {
  id: 'page-1',
  title: 'Legacy page',
  properties: { status: 'todo', score: '42' },
  content: null,
  createdTime: '2026-06-21T00:00:00.000Z',
  lastEditedTime: '2026-06-21T00:00:00.000Z',
};

const roadmapBoard: WorkspaceResource = {
  id: 'board-roadmap',
  databaseId: 'roadmap',
  dataSourceId: 'roadmap',
  type: 'board',
  title: 'Roadmap',
  pageIds: ['page-1'],
  propertyIds: ['status', 'score'],
  statusPropertyId: 'status',
};

describe('legacy Data Source migration', () => {
  it('copies database:{id}:v2 into datasource:{id}:v1 once and reads membership from ownership', () => {
    const persisted = new Map<string, Doc>();
    persisted.set(ROOM_NAMES.workspace, createLegacyWorkspace(roadmapBoard));
    persisted.set(ROOM_NAMES.legacyDataSource('roadmap'), createLegacyDataSource(schema, [page]));

    const first = createStore(persisted);
    first.initialize({ schema, pages: [], resources: [roadmapBoard] });
    const firstState = first.read();

    expect(firstState.dataSources).toEqual([{ id: 'roadmap', databaseId: 'roadmap', title: 'Roadmap' }]);
    expect(firstState.dataSourceSchemas?.roadmap).toEqual(schema);
    expect(firstState.ownership?.['page-1']).toMatchObject({ dataSourceId: 'roadmap' });
    expect(firstState.resources?.find((resource) => resource.id === 'board-roadmap')?.pageIds).toEqual(['page-1']);
    expect(firstState.pages.find((item) => item.id === 'page-1')?.properties).toMatchObject(page.properties);
    first.destroy();

    const second = createStore(persisted);
    second.initialize({ schema, pages: [], resources: [roadmapBoard] });
    const secondState = second.read();

    expect(secondState.dataSources).toEqual(firstState.dataSources);
    expect(secondState.ownership).toEqual(firstState.ownership);
    expect(secondState.resources?.find((resource) => resource.id === 'board-roadmap')?.pageIds).toEqual(['page-1']);
    expect(secondState.pages.map((item) => item.id)).toEqual(['page-1']);
  });
});
