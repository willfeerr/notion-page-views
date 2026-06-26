import { describe, expect, it } from 'vitest';
import type { NotionPageData, NotionSchema } from '../notion-page/types';
import { WorkspaceYjsStore } from './workspaceYjs';

function createStore() {
  return new WorkspaceYjsStore(() => ({ destroy() {} }));
}

const schema: NotionSchema = {
  properties: [
    {
      id: 'status',
      name: 'Status',
      type: 'status',
      options: [
        { id: 'todo', name: 'Todo', color: 'gray' },
        { id: 'doing', name: 'Doing', color: 'blue' },
      ],
      groups: [],
    },
    { id: 'note', name: 'Note', type: 'text' },
  ],
};

const pages: NotionPageData[] = [
  {
    id: 'page-1',
    title: 'First',
    properties: { status: 'todo', note: 'first' },
    content: null,
    createdTime: '2026-06-21T00:00:00.000Z',
    lastEditedTime: '2026-06-21T00:00:00.000Z',
  },
  {
    id: 'page-2',
    title: 'Second',
    properties: { status: 'todo', note: 'second' },
    content: null,
    createdTime: '2026-06-21T00:00:00.000Z',
    lastEditedTime: '2026-06-21T00:00:00.000Z',
  },
];

describe('board DND transaction', () => {
  it('updates grouping property and per-view rank together without changing ownership', () => {
    const store = createStore();
    store.initialize({ schema, pages });

    store.moveBoardPage('board-roadmap', 'page-2', 'status', 'doing', 'page-1');

    const state = store.read();
    const board = state.resources?.find((resource) => resource.id === 'board-roadmap');
    const moved = state.pages.find((page) => page.id === 'page-2');

    expect(moved?.properties.status).toBe('doing');
    expect(board?.pageIds).toEqual(['page-2', 'page-1']);
    expect(state.ownership?.['page-2']).toMatchObject({ dataSourceId: 'roadmap' });
    expect(state.moveOperations).toEqual([]);
  });
});
