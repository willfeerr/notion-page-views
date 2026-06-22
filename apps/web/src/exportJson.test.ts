import { describe, expect, it } from 'vitest';
import type { SerializedEditorState } from 'lexical';
import type { NotionPageData, NotionSchema } from '../notion-page/types';
import { pageExport, workspaceExport } from './exportJson';

describe('page export', () => {
  it('exports stable property IDs and searchable body text', () => {
    const schema: NotionSchema = { properties: [{ id: 'tag', name: 'Tag', type: 'select', options: [{ id: 'one', name: 'One', color: 'blue' }] }] };
    const content = { root: { type: 'root', version: 1, children: [{ type: 'paragraph', version: 1, children: [{ type: 'text', version: 1, text: 'Indexed body' }] }] } } as unknown as SerializedEditorState;
    const page: NotionPageData = { id: 'p', title: 'Title', properties: { tag: 'one' }, content, createdTime: 'a', lastEditedTime: 'b' };
    const exported = pageExport(page, schema);
    expect(exported.index.searchableText).toContain('Indexed body');
    expect(exported.index.properties.tag).toMatchObject({ name: 'Tag', value: 'one', displayValue: 'One' });
  });

  it('creates a complete workspace index including independent pages and resources', () => {
    const schema: NotionSchema = { properties: [] };
    const page: NotionPageData = { id: 'p', title: 'Independent page', properties: {}, content: null, createdTime: 'a', lastEditedTime: 'b' };
    const exported = workspaceExport([{ id: 'board', type: 'board', title: 'Roadmap', pageIds: [], propertyIds: [], statusPropertyId: 'status' }], [page], schema);
    expect(exported.index.pages[0]?.searchableText).toBe('Independent page');
    expect(exported.index.resources[0]).toMatchObject({ id: 'board', type: 'board', title: 'Roadmap' });
  });
});
