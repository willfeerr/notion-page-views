import { describe, expect, it } from 'vitest';
import { buildProperty } from './domain';

const relation = buildProperty('relation', 'Board');

describe('relation cardinality', () => {
  it('creates relation properties as many by default', () => {
    expect(relation).toMatchObject({
      type: 'relation',
      name: 'Board',
      targetDataSourceId: 'standalone',
      cardinality: 'many',
      multiple: true,
    });
  });
});
