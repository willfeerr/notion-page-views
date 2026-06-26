import { describe, expect, it } from 'vitest';
import { Doc, applyUpdate, encodeStateAsUpdate } from 'yjs';
import type { NotionPageData, NotionSchema } from '../notion-page/types';
import type { WorkspaceResource } from './domain';
import { WorkspaceYjsStore } from './workspaceYjs';

function createStore(persisted: Map<string, Doc> = new Map()) {
  return new WorkspaceYjsStore((room, document) => {
    const source = persisted.get(room) ?? new Doc();
    persisted.set(room, source);
    applyUpdate(document, encodeStateAsUpdate(source));
    const persist = (update: Uint8Array) => applyUpdate(source, update);
    document.on('update', persist);
    return { destroy() { document.off('update', persist); } };
  });
}

const schema: NotionSchema = {
  properties: [
    { id: 'status', name: 'Status', type: 'status', options: [{ id: 'todo', name: 'Todo', color: 'gray' }], groups: [] },
    { id: 'note', name: 'Note', type: 'text' },
  ],
};

const page: NotionPageData = {
  id: 'page-1',
  title: 'Page',
  properties: { status: 'todo', note: 'original' },
  content: null,
  createdTime: '2026-06-21T00:00:00.000Z',
  lastEditedTime: '2026-06-21T00:00:00.000Z',
};

describe('WorkspaceYjsStore ownership index', () => {
  it('keeps initialization idempotent without duplicating containers, data sources or ownership', () => {
    const store = createStore();
    store.initialize({ schema, pages: [page] });
    const first = store.read();

    store.initialize({ schema, pages: [page] });
    const second = store.read();

    expect(second.databases).toEqual(first.databases);
    expect(second.dataSources).toEqual(first.dataSources);
    expect(second.ownership).toEqual(first.ownership);
    expect(second.resources?.map((resource) => resource.id)).toEqual(first.resources?.map((resource) => resource.id));
  });

  it('derives new view membership from the owning data source instead of persisted pageIds', () => {
    const store = createStore();
    store.initialize({ schema, pages: [page] });

    store.createResource({
      id: 'table-roadmap',
      databaseId: 'roadmap',
      dataSourceId: 'roadmap',
      type: 'table',
      title: 'Roadmap table',
      pageIds: [],
      propertyIds: ['status', 'note'],
    });

    const table = store.read().resources?.find((resource) => resource.id === 'table-roadmap');
    expect(table?.pageIds).toEqual(['page-1']);
    expect(table?.propertyIds).toEqual(['status', 'note']);
  });

  it('shares rows across views of the same data source without sharing view configuration', () => {
    const store = createStore();
    store.initialize({ schema, pages: [page] });

    store.createResource({
      id: 'list-roadmap',
      databaseId: 'roadmap',
      dataSourceId: 'roadmap',
      type: 'list',
      title: 'Roadmap list',
      pageIds: ['ignored-by-view'],
      propertyIds: ['note'],
      projection: { propertyIds: ['note'], openMode: 'side_peek', cardPreview: 'none' },
    });
    store.updateResource('list-roadmap', {
      sorts: [{ propertyId: 'note', direction: 'descending' }],
      projection: { propertyIds: ['note'], openMode: 'center_peek', cardPreview: 'none' },
    } as Partial<WorkspaceResource>);

    const resources = store.read().resources ?? [];
    const board = resources.find((resource) => resource.id === 'board-roadmap');
    const list = resources.find((resource) => resource.id === 'list-roadmap');

    expect(board?.pageIds).toEqual(['page-1']);
    expect(list?.pageIds).toEqual(['page-1']);
    expect(board?.propertyIds).toEqual(['status', 'note']);
    expect(list?.propertyIds).toEqual(['note']);
    expect(board?.sorts).toBeUndefined();
    expect(list?.sorts).toEqual([{ propertyId: 'note', direction: 'descending' }]);
    expect(board?.projection?.openMode).toBe('full_page');
    expect(list?.projection?.openMode).toBe('center_peek');
  });
});
