import { describe, expect, it } from 'vitest';
import type { NotionPageData } from '../notion-page/types';
import { executeViewQuery } from './viewQuery';

const pages: NotionPageData[] = [
  { id: 'b', title: 'Beta', properties: { score: 2, tags: ['blue'] }, content: null, createdTime: '2026-01-02', lastEditedTime: '2026-01-02' },
  { id: 'a', title: 'Alpha', properties: { score: 10, tags: ['red', 'blue'] }, content: null, createdTime: '2026-01-01', lastEditedTime: '2026-01-03' },
  { id: 'c', title: 'Gamma', properties: { score: null, tags: [] }, content: null, createdTime: '2026-01-03', lastEditedTime: '2026-01-01' },
];

describe('executeViewQuery', () => {
  it('evaluates nested AND/OR filters', () => {
    const result = executeViewQuery(pages, { filter: { type: 'group', operator: 'and', filters: [
      { type: 'condition', propertyId: 'tags', operator: 'contains', value: 'blue' },
      { type: 'group', operator: 'or', filters: [
        { type: 'condition', propertyId: 'score', operator: 'greater_than', value: 5 },
        { type: 'condition', propertyId: 'title', operator: 'equals', value: 'Beta' },
      ] },
    ] } });
    expect(result.map((page) => page.id)).toEqual(['b', 'a']);
  });

  it('applies multiple stable sorts and keeps empty values last', () => {
    const result = executeViewQuery(pages, { sorts: [
      { propertyId: 'score', direction: 'descending' },
      { propertyId: 'title', direction: 'ascending' },
    ] });
    expect(result.map((page) => page.id)).toEqual(['a', 'b', 'c']);
  });
});
