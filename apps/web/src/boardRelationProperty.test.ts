import { describe, expect, it } from 'vitest';
import type { NotionPageData, NotionSchema } from '../notion-page/types';
import { WorkspaceYjsStore } from './workspaceYjs';

function createStore() {
  return new WorkspaceYjsStore(() => ({ destroy() {} }));
}

const schema: NotionSchema = {
  properties: [
    { id: 'status', name: 'Status', type: 'status', options: [{ id: 'todo', name: 'Todo', color: 'gray' }], groups: [] },
    { id: 'due', name: 'Due', type: 'date', includeTime: true, timezone: 'America/Sao_Paulo' },
  ],
};

const page: NotionPageData = {
  id: 'page-1',
  title: 'Page',
  properties: { status: 'todo', due: null },
  content: null,
  createdTime: '2026-06-21T00:00:00.000Z',
  lastEditedTime: '2026-06-21T00:00:00.000Z',
};

describe('board relation property', () => {
  it('stores a Board link as a normal relation property without moving page ownership', () => {
    const store = createStore();
    store.initialize({ schema, pages: [page] });

    const targetStatus: NotionSchema['properties'][number] = {
      id: 'target-status',
      name: 'Status',
      type: 'status',
      options: [{ id: 'target-todo', name: 'Todo', color: 'gray' }],
      groups: [],
    };

    store.createResource({
      id: 'target-board',
      databaseId: 'target-database',
      dataSourceId: 'target-source',
      type: 'board',
      title: 'Target board',
      pageIds: [],
      propertyIds: [targetStatus.id],
      statusPropertyId: targetStatus.id,
    }, [targetStatus]);
    store.insertPage({
      ...page,
      id: 'target-card',
      title: 'Target card',
      properties: { [targetStatus.id]: 'target-todo' },
    }, undefined, 'target-source');

    store.applySchema('roadmap', {
      properties: [
        ...schema.properties,
        {
          id: 'board-relation',
          name: 'Board',
          type: 'relation',
          targetDataSourceId: 'target-source',
          cardinality: 'many',
          multiple: true,
        },
      ],
    });

    store.updateProperty('page-1', 'board-relation', ['target-card']);
    const state = store.read();
    const sourcePage = state.pages.find((item) => item.id === 'page-1');
    const targetPage = state.pages.find((item) => item.id === 'target-card');

    expect(sourcePage?.properties['board-relation']).toEqual(['target-card']);
    expect(targetPage?.title).toBe('Target card');
    expect(state.ownership?.['page-1']).toMatchObject({ dataSourceId: 'roadmap' });
    expect(state.ownership?.['target-card']).toMatchObject({ dataSourceId: 'target-source' });
    expect(state.resources?.find((resource) => resource.id === 'board-roadmap')?.pageIds).toEqual(['page-1']);
    expect(state.resources?.find((resource) => resource.id === 'target-board')?.pageIds).toEqual(['target-card']);
    expect(state.moveOperations).toEqual([]);
  });

  it('drops relation values that point outside the configured target data source', () => {
    const store = createStore();
    store.initialize({ schema, pages: [page] });
    store.applySchema('roadmap', {
      properties: [
        ...schema.properties,
        {
          id: 'board-relation',
          name: 'Board',
          type: 'relation',
          targetDataSourceId: 'missing-source',
          cardinality: 'many',
          multiple: true,
        },
      ],
    });

    store.updateProperty('page-1', 'board-relation', ['page-1', 'missing-page']);
    expect(store.read().pages.find((item) => item.id === 'page-1')?.properties['board-relation']).toEqual([]);
  });
});
