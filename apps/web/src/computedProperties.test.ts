import { describe, expect, it } from 'vitest';
import type { NotionPageData, NotionSchema } from '../notion-page/types';
import { materializeComputedProperties } from './computedProperties';

const schema: NotionSchema = { properties: [
  { id: 'score', name: 'Score', type: 'number' },
  { id: 'relation', name: 'Relation', type: 'relation', targetDataSourceId: 'target' },
  { id: 'double', name: 'Double', type: 'formula', expression: { kind: 'operation', operator: 'multiply', left: { kind: 'property', propertyId: 'score' }, right: { kind: 'literal', value: 2 } } },
  { id: 'total', name: 'Total', type: 'rollup', relationPropertyId: 'relation', targetPropertyId: 'score', calculation: 'sum' },
] };

const page = (id: string, score: number, relation: string[] = []): NotionPageData => ({ id, title: id, properties: { score, relation }, content: null, createdTime: '', lastEditedTime: '' });

describe('computed properties', () => {
  it('evaluates formula AST and relation rollups without storing code', () => {
    const result = materializeComputedProperties([page('source', 3, ['a', 'b']), page('a', 4), page('b', 6)], {
      source: schema, a: schema, b: schema,
    });
    expect(result.find((item) => item.id === 'source')?.properties).toMatchObject({ double: 6, total: 10 });
  });
});
