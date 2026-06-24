import { describe, expect, it } from 'vitest';
import type { PropertyDefinition } from '../notion-page/types';
import { defaultPropertyValue, PROPERTY_REGISTRY } from './propertyRegistry';

describe('property registry', () => {
  it('allocates deterministic unique IDs and user audit defaults', () => {
    const unique: PropertyDefinition = { id: 'uid', name: 'ID', type: 'unique_id', prefix: 'TASK' };
    const author: PropertyDefinition = { id: 'author', name: 'Created by', type: 'created_by' };
    expect(defaultPropertyValue(unique, { pageId: '12345678-abcd' })).toBe('TASK-12345678');
    expect(defaultPropertyValue(author, { userId: 'william' })).toBe('william');
    expect(PROPERTY_REGISTRY.unique_id.readOnly).toBe(true);
  });

  it('uses arrays for files and relation values', () => {
    expect(defaultPropertyValue({ id: 'files', name: 'Files', type: 'files' })).toEqual([]);
    expect(defaultPropertyValue({ id: 'relation', name: 'Relation', type: 'relation', targetDataSourceId: 'target' })).toEqual([]);
  });
});
