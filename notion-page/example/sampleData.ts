import type { SerializedEditorState } from 'lexical';
import type { NotionSchema, NotionPageData, PersonOption } from '../types';

export const PEOPLE: PersonOption[] = [
  { id: 'p1', name: 'Marina Souza', avatarColor: 'purple' },
  { id: 'p2', name: 'Felipe Andrade', avatarColor: 'blue' },
  { id: 'p3', name: 'Renata Lima', avatarColor: 'green' },
];

/**
 * Example schema: this is what you'd normally load from your own backend
 * (one schema shared by every page in a board/database).
 */
export const sampleSchema: NotionSchema = {
  properties: [
    {
      id: 'status',
      name: 'Status',
      type: 'status',
      options: [
        { id: 'todo', name: 'A fazer', color: 'gray' },
        { id: 'doing', name: 'Em andamento', color: 'blue' },
        { id: 'done', name: 'Concluído', color: 'green' },
      ],
      groups: [
        { id: 'g-todo', name: 'A fazer', color: 'gray', optionIds: ['todo'] },
        { id: 'g-doing', name: 'Em andamento', color: 'blue', optionIds: ['doing'] },
        { id: 'g-done', name: 'Concluído', color: 'green', optionIds: ['done'] },
      ],
    },
    {
      id: 'priority',
      name: 'Prioridade',
      type: 'select',
      options: [
        { id: 'low', name: 'Baixa', color: 'gray' },
        { id: 'medium', name: 'Média', color: 'yellow' },
        { id: 'high', name: 'Alta', color: 'orange' },
        { id: 'urgent', name: 'Urgente', color: 'red' },
      ],
    },
    {
      id: 'tags',
      name: 'Tags',
      type: 'multi_select',
      options: [
        { id: 'design', name: 'Design', color: 'pink' },
        { id: 'frontend', name: 'Frontend', color: 'blue' },
        { id: 'backend', name: 'Backend', color: 'purple' },
        { id: 'bug', name: 'Bug', color: 'red' },
      ],
    },
    { id: 'assignee', name: 'Responsável', type: 'person', people: PEOPLE },
    { id: 'due', name: 'Prazo', type: 'date' },
    { id: 'reviewed', name: 'Revisado?', type: 'checkbox' },
    { id: 'createdTime', name: 'Criado em', type: 'created_time' },
    { id: 'editedTime', name: 'Editado em', type: 'last_edited_time' },
  ],
};

/** Properties shown on the compact board card — the rest stay in the full page view. */
export const cardPropertyIds = ['status', 'priority', 'tags', 'assignee', 'due'];

const draftPageContent: SerializedEditorState = {
  root: {
    children: [
      {
        children: [
          {
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: 'Esboço inicial — ainda levantando requisitos com o time de suporte.',
            type: 'text',
            version: 1,
          },
        ],
        direction: null,
        format: '',
        indent: 0,
        type: 'paragraph',
        version: 1,
      },
    ],
    direction: null,
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
} as unknown as SerializedEditorState;

const richPageContent: SerializedEditorState = {
  root: {
    children: [
      {
        children: [{ detail: 0, format: 0, mode: 'normal', style: '', text: 'Lançamento da v2.0', type: 'text', version: 1 }],
        direction: null,
        format: '',
        indent: 0,
        type: 'heading',
        version: 1,
        tag: 'h1',
      },
      {
        children: [
          {
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: 'Plano de lançamento da nova versão do dashboard, com foco em performance e no novo sistema de permissões por equipe.',
            type: 'text',
            version: 1,
          },
        ],
        direction: null,
        format: '',
        indent: 0,
        type: 'paragraph',
        version: 1,
      },
      {
        children: [{ detail: 0, format: 0, mode: 'normal', style: '', text: 'Escopo', type: 'text', version: 1 }],
        direction: null,
        format: '',
        indent: 0,
        type: 'heading',
        version: 1,
        tag: 'h2',
      },
      {
        children: [
          {
            children: [{ detail: 0, format: 0, mode: 'normal', style: '', text: 'Refatorar o módulo de autenticação', type: 'text', version: 1 }],
            direction: null,
            format: '',
            indent: 0,
            type: 'listitem',
            version: 1,
            value: 1,
          },
          {
            children: [{ detail: 0, format: 0, mode: 'normal', style: '', text: 'Novo sistema de permissões por equipe', type: 'text', version: 1 }],
            direction: null,
            format: '',
            indent: 0,
            type: 'listitem',
            version: 1,
            value: 2,
          },
          {
            children: [{ detail: 0, format: 0, mode: 'normal', style: '', text: 'Otimizar consultas do dashboard principal', type: 'text', version: 1 }],
            direction: null,
            format: '',
            indent: 0,
            type: 'listitem',
            version: 1,
            value: 3,
          },
        ],
        direction: null,
        format: '',
        indent: 0,
        type: 'list',
        version: 1,
        listType: 'bullet',
        start: 1,
        tag: 'ul',
      },
      {
        children: [{ detail: 0, format: 0, mode: 'normal', style: '', text: 'Performance não é feature, é pré-requisito.', type: 'text', version: 1 }],
        direction: null,
        format: '',
        indent: 0,
        type: 'quote',
        version: 1,
      },
      {
        children: [
          {
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: 'Revisão com o time de produto agendada para a próxima sexta.',
            type: 'text',
            version: 1,
          },
        ],
        direction: null,
        format: '',
        indent: 0,
        type: 'paragraph',
        version: 1,
      },
    ],
    direction: null,
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
} as unknown as SerializedEditorState;

export const samplePages: NotionPageData[] = [
  {
    id: 'page-1',
    icon: '🔍',
    coverUrl: null,
    title: 'Pesquisa com usuários',
    properties: {
      status: 'todo',
      priority: 'medium',
      tags: ['design'],
      assignee: ['p3'],
      due: null,
      reviewed: false,
      createdTime: '2026-06-08T10:00:00.000Z',
      editedTime: '2026-06-08T10:00:00.000Z',
    },
    content: draftPageContent,
    createdTime: '2026-06-08T10:00:00.000Z',
    lastEditedTime: '2026-06-08T10:00:00.000Z',
  },
  {
    id: 'page-2',
    icon: '🚀',
    coverUrl: null,
    title: 'Lançamento da v2.0',
    properties: {
      status: 'doing',
      priority: 'high',
      tags: ['frontend', 'backend'],
      assignee: ['p1', 'p2'],
      due: { start: '2026-06-23', end: '2026-06-27' },
      reviewed: false,
      createdTime: '2026-06-01T09:00:00.000Z',
      editedTime: '2026-06-16T14:30:00.000Z',
    },
    content: richPageContent,
    createdTime: '2026-06-01T09:00:00.000Z',
    lastEditedTime: '2026-06-16T14:30:00.000Z',
  },
  {
    id: 'page-3',
    icon: '🐛',
    coverUrl: null,
    title: 'Corrigir bug de paginação',
    properties: {
      status: 'done',
      priority: 'urgent',
      tags: ['bug'],
      assignee: ['p2'],
      due: '2026-06-10',
      reviewed: true,
      createdTime: '2026-06-05T11:00:00.000Z',
      editedTime: '2026-06-11T16:00:00.000Z',
    },
    content: null,
    createdTime: '2026-06-05T11:00:00.000Z',
    lastEditedTime: '2026-06-11T16:00:00.000Z',
  },
  {
    id: 'page-4',
    icon: '🎨',
    coverUrl: null,
    title: 'Redesenhar onboarding',
    properties: {
      status: 'doing',
      priority: 'medium',
      tags: ['design'],
      assignee: ['p3'],
      due: '2026-06-29',
      reviewed: false,
      createdTime: '2026-06-12T08:30:00.000Z',
      editedTime: '2026-06-15T09:00:00.000Z',
    },
    content: null,
    createdTime: '2026-06-12T08:30:00.000Z',
    lastEditedTime: '2026-06-15T09:00:00.000Z',
  },
];
