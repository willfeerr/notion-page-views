import { describe, expect, it } from 'vitest';
import type { NotionPageData, NotionSchema } from '../notion-page/types';
import { materializeComputedProperties } from './computedProperties';

function page(id: string, title: string, properties: NotionPageData['properties']): NotionPageData {
  return {
    id,
    title,
    properties,
    content: null,
    createdTime: '2026-06-21T00:00:00.000Z',
    lastEditedTime: '2026-06-21T00:00:00.000Z',
  };
}

describe('inverse relation projection', () => {
  it('materializes the inverse side without mutating the source snapshot', () => {
    const sourceSchema: NotionSchema = {
      properties: [{
        id: 'board',
        name: 'Board',
        type: 'relation',
        targetDataSourceId: 'boards',
        cardinality: 'many',
        multiple: true,
        inversePropertyId: 'tasks',
      }],
    };
    const targetSchema: NotionSchema = {
      properties: [
        {
          id: 'tasks',
          name: 'Tasks',
          type: 'relation',
          targetDataSourceId: 'tasks',
          cardinality: 'many',
          multiple: true,
          inversePropertyId: 'board',
        },
        {
          id: 'task-count',
          name: 'Task count',
          type: 'rollup',
          relationPropertyId: 'tasks',
          calculation: 'count',
        },
      ],
    };
    const pages = [
      page('task-1', 'Task 1', { board: ['board-1'] }),
      page('board-1', 'Board 1', { tasks: [] }),
    ];

    const materialized = materializeComputedProperties(pages, {
      'task-1': sourceSchema,
      'board-1': targetSchema,
    });

    expect(materialized.find((item) => item.id === 'task-1')?.properties.board).toEqual(['board-1']);
    expect(materialized.find((item) => item.id === 'board-1')?.properties.tasks).toEqual(['task-1']);
    expect(materialized.find((item) => item.id === 'board-1')?.properties['task-count']).toBe(1);
    expect(pages.find((item) => item.id === 'board-1')?.properties.tasks).toEqual([]);
  });

  it('respects one-page cardinality on the inverse side', () => {
    const sourceSchema: NotionSchema = {
      properties: [{
        id: 'board',
        name: 'Board',
        type: 'relation',
        targetDataSourceId: 'boards',
        cardinality: 'many',
        multiple: true,
        inversePropertyId: 'primary-task',
      }],
    };
    const targetSchema: NotionSchema = {
      properties: [{
        id: 'primary-task',
        name: 'Primary task',
        type: 'relation',
        targetDataSourceId: 'tasks',
        cardinality: 'one',
        multiple: false,
        inversePropertyId: 'board',
      }],
    };

    const materialized = materializeComputedProperties([
      page('task-1', 'Task 1', { board: ['board-1'] }),
      page('task-2', 'Task 2', { board: ['board-1'] }),
      page('board-1', 'Board 1', { 'primary-task': [] }),
    ], {
      'task-1': sourceSchema,
      'task-2': sourceSchema,
      'board-1': targetSchema,
    });

    expect(materialized.find((item) => item.id === 'board-1')?.properties['primary-task']).toEqual(['task-1']);
  });
});
