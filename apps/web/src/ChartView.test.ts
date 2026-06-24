import { describe, expect, it } from 'vitest';
import type { NotionPageData, NotionSchema } from '../notion-page/types';
import type { ChartResource } from './domain';
import { buildChartSeries } from './ChartView';

const schema: NotionSchema = { properties: [
  { id: 'status', name: 'Status', type: 'status', options: [{ id: 'todo', name: 'A fazer', color: 'gray' }, { id: 'done', name: 'Concluído', color: 'green' }], groups: [] },
  { id: 'score', name: 'Pontos', type: 'number' },
] };
const pages: NotionPageData[] = [
  { id: '1', title: 'A', properties: { status: 'todo', score: 2 }, content: null, createdTime: '2026-01-01', lastEditedTime: '2026-01-01' },
  { id: '2', title: 'B', properties: { status: 'todo', score: 4 }, content: null, createdTime: '2026-01-01', lastEditedTime: '2026-01-01' },
  { id: '3', title: 'C', properties: { status: 'done', score: 9 }, content: null, createdTime: '2026-01-01', lastEditedTime: '2026-01-01' },
];
const resource: ChartResource = {
  id: 'chart', databaseId: 'db', dataSourceId: 'source', type: 'chart', title: 'Pontos', pageIds: pages.map((page) => page.id),
  propertyIds: ['status', 'score'], chartType: 'bar', groupPropertyId: 'status', valuePropertyId: 'score', aggregation: 'sum',
};

describe('buildChartSeries', () => {
  it('groups option IDs by label and sums numeric values', () => {
    expect(buildChartSeries(resource, schema, pages)).toEqual([
      { label: 'A fazer', value: 6 }, { label: 'Concluído', value: 9 },
    ]);
  });

  it('calculates count and average', () => {
    expect(buildChartSeries({ ...resource, aggregation: 'count' }, schema, pages)[0].value).toBe(2);
    expect(buildChartSeries({ ...resource, aggregation: 'average' }, schema, pages)[0].value).toBe(3);
  });
});
