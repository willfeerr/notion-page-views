import { describe, expect, it } from 'vitest';
import type { NotionPageData, NotionSchema } from '../notion-page/types';
import { capturePageTemplate, instantiatePageTemplate } from './pageTemplates';

const schema: NotionSchema = { properties: [
  { id: 'status', name: 'Status', type: 'status', options: [{ id: 'todo', name: 'A fazer', color: 'gray' }, { id: 'done', name: 'Concluído', color: 'green' }], groups: [] },
  { id: 'brief', name: 'Brief', type: 'text' },
  { id: 'uid', name: 'ID', type: 'unique_id', prefix: 'TASK' },
  { id: 'created', name: 'Criado', type: 'created_time' },
  { id: 'edited', name: 'Editado', type: 'last_edited_time' },
] };
const page: NotionPageData = {
  id: 'old-page', title: 'Pauta padrão', icon: '📝', coverUrl: 'https://example.com/cover.jpg',
  properties: { status: 'done', brief: 'Estrutura inicial', uid: 'TASK-OLD', created: 'old', edited: 'old' },
  content: null, createdTime: 'old', lastEditedTime: 'old',
};

describe('database page templates', () => {
  it('captures only editable properties', () => {
    const template = capturePageTemplate('Pauta', page, schema, '2026-06-24T00:00:00.000Z');
    expect(template.properties).toEqual({ status: 'done', brief: 'Estrutura inicial' });
    expect(template.properties).not.toHaveProperty('uid');
  });

  it('creates a new page and regenerates identity and audit fields', () => {
    const template = capturePageTemplate('Pauta', page, schema);
    const created = instantiatePageTemplate({
      schema, template, pageId: 'new-page-id', userId: 'will', now: '2026-06-25T10:00:00.000Z',
      overrides: { status: 'todo' },
    });
    expect(created).toMatchObject({ id: 'new-page-id', title: 'Pauta padrão', icon: '📝', createdTime: '2026-06-25T10:00:00.000Z' });
    expect(created.properties).toMatchObject({ status: 'todo', brief: 'Estrutura inicial', uid: 'TASK-NEW-PAGE', created: '2026-06-25T10:00:00.000Z', edited: '2026-06-25T10:00:00.000Z' });
  });
});
