import { describe, expect, it } from 'vitest';
import type { NotionPageData, NotionSchema } from '../notion-page/types';
import { WorkspaceYjsStore } from './workspaceYjs';

function createStore(onRoom?: (room: string) => void) {
  return new WorkspaceYjsStore((room) => {
    onRoom?.(room);
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
    store.applySchema({ ...schema, properties: schema.properties.map((property) => property.id === 'score' ? { id: 'score', name: 'Score', type: 'number' } : property) });
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
      id: 'board-new', type: 'board', title: 'New board', pageIds: [],
      propertyIds: [boardStatus.id], statusPropertyId: boardStatus.id,
    }, [boardStatus]);

    const resources = store.read().resources ?? [];
    const original = resources.find((resource) => resource.id === 'board-roadmap');
    const created = resources.find((resource) => resource.id === 'board-new');
    expect(created).toMatchObject({
      pageIds: [], propertyIds: ['status-new-board'], statusPropertyId: 'status-new-board',
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

  it('opens independent workspace, database and view rooms', () => {
    const rooms: string[] = [];
    const store = createStore((room) => rooms.push(room));
    store.initialize({ schema, pages: [page] });
    expect(rooms).toContain('workspace:notion-pages-lab');
    expect(rooms).toContain('database:roadmap');
    expect(rooms).toContain('view:board-roadmap');
    expect(rooms).toContain('view:calendar-product');
  });
});
