import { describe, expect, it } from 'vitest';
import { Doc } from 'yjs';
import type { NotionPageData, NotionSchema } from '../notion-page/types';
import { WorkspaceYjsStore } from './workspaceYjs';

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
    const doc = new Doc();
    const store = new WorkspaceYjsStore(doc);
    store.initialize({ schema, pages: [page] });
    let changes = 0;
    const unsubscribe = store.subscribe(() => { changes += 1; });
    store.applySchema({ ...schema, properties: schema.properties.map((property) => property.id === 'score' ? { id: 'score', name: 'Score', type: 'number' } : property) });
    expect(store.read().pages[0].properties.score).toBe(42);
    expect(changes).toBe(2);
    unsubscribe();
  });

  it('seeds board and calendar with independent configuration', () => {
    const store = new WorkspaceYjsStore(new Doc());
    store.initialize({ schema, pages: [page] });
    const resources = store.read().resources ?? [];
    expect(resources.find((resource) => resource.type === 'board')).toMatchObject({ statusPropertyId: 'status' });
    expect(resources.find((resource) => resource.type === 'calendar')).toMatchObject({ datePropertyId: 'due', timezone: 'America/Sao_Paulo' });
  });

  it('keeps newly inserted pages independent until explicitly linked', () => {
    const store = new WorkspaceYjsStore(new Doc());
    store.initialize({ schema, pages: [page] });
    store.insertPage({ ...page, id: 'independent', title: 'Independent page' });
    expect(store.read().resources?.every((resource) => !resource.pageIds.includes('independent'))).toBe(true);
  });
});
