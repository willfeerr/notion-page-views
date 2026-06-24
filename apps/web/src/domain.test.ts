import { describe, expect, it } from 'vitest';
import type { PropertyDefinition } from '../notion-page/types';
import { buildInitialDataSourceProperties, convertPropertyValue, normalizeDateValue } from './domain';

describe('property migrations', () => {
  it('keeps a valid status and applies the fallback only to removed options', () => {
    const previous: PropertyDefinition = {
      id: 'status', name: 'Status', type: 'status',
      options: [{ id: 'todo', name: 'Todo', color: 'gray' }, { id: 'done', name: 'Done', color: 'green' }],
      groups: [],
    };
    const next: PropertyDefinition = {
      ...previous,
      options: [{ id: 'done', name: 'Done', color: 'green' }],
    };
    expect(convertPropertyValue(next, previous, 'done', 'done')).toBe('done');
    expect(convertPropertyValue(next, previous, 'todo', 'done')).toBe('done');
  });

  it('converts text to number without resetting valid data', () => {
    const previous: PropertyDefinition = { id: 'score', name: 'Score', type: 'text' };
    const next: PropertyDefinition = { id: 'score', name: 'Score', type: 'number' };
    expect(convertPropertyValue(next, previous, '12,5')).toBe(12.5);
  });
});

describe('date normalization', () => {
  it('preserves time, range and timezone', () => {
    expect(normalizeDateValue({ start: '2026-06-21T09:30', end: '2026-06-21T11:00', allDay: false }, 'America/Sao_Paulo')).toEqual({
      start: '2026-06-21T09:30', end: '2026-06-21T11:00', allDay: false, timezone: 'America/Sao_Paulo',
    });
  });
});

describe('data source defaults', () => {
  it('includes created and last edited audit properties for a new board', () => {
    const primary: PropertyDefinition = {
      id: 'status', name: 'Status', type: 'status', options: [], groups: [],
    };
    expect(buildInitialDataSourceProperties(primary).map((property) => property.type)).toEqual([
      'status', 'created_time', 'last_edited_time',
    ]);
  });
});
