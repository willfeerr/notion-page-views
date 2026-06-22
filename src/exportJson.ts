import type { SerializedEditorState, SerializedLexicalNode } from 'lexical';
import type { NotionPageData, NotionSchema, StoredPropertyValue } from '../notion-page/types';
import type { WorkspaceResource } from './workspaceYjs';

type TextNode = SerializedLexicalNode & { children?: TextNode[]; text?: string };

function plainText(content: SerializedEditorState | null): string {
  if (!content) return '';
  const parts: string[] = [];
  const walk = (node: TextNode) => {
    if (typeof node.text === 'string') parts.push(node.text);
    node.children?.forEach(walk);
  };
  walk(content.root as TextNode);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function displayPropertyValue(schema: NotionSchema, propertyId: string, value: StoredPropertyValue): string {
  const definition = schema.properties.find((property) => property.id === propertyId);
  if (!definition || value === null || value === undefined) return '';
  if ((definition.type === 'select' || definition.type === 'status') && typeof value === 'string') {
    return definition.options.find((option) => option.id === value)?.name ?? value;
  }
  if (definition.type === 'multi_select' && Array.isArray(value)) {
    return value.map((id) => definition.options.find((option) => option.id === id)?.name ?? id).join(', ');
  }
  if (definition.type === 'person' && Array.isArray(value)) {
    return value.map((id) => definition.people.find((person) => person.id === id)?.name ?? id).join(', ');
  }
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return Object.values(value).filter(Boolean).join(' - ');
  return String(value);
}

export function pageExport(page: NotionPageData, schema: NotionSchema) {
  const text = plainText(page.content);
  const propertyText = Object.entries(page.properties).map(([id, value]) => displayPropertyValue(schema, id, value)).filter(Boolean);
  return {
    kind: 'page',
    version: 1,
    exportedAt: new Date().toISOString(),
    page,
    schema,
    index: {
      id: page.id,
      title: page.title,
      text,
      searchableText: [page.title, text, ...propertyText].join(' ').replace(/\s+/g, ' ').trim(),
      properties: Object.fromEntries(schema.properties.map((definition) => [definition.name, page.properties[definition.id] ?? null])),
      createdTime: page.createdTime,
      lastEditedTime: page.lastEditedTime,
    },
  };
}

export function resourceExport(resource: WorkspaceResource, pages: NotionPageData[], schema: NotionSchema) {
  const resourcePages = pages.filter((page) => resource.pageIds.includes(page.id));
  return {
    kind: resource.type,
    version: 1,
    exportedAt: new Date().toISOString(),
    resource,
    schema,
    pages: resourcePages.map((page) => pageExport(page, schema)),
    index: resourcePages.map((page) => pageExport(page, schema).index),
  };
}

export function downloadJson(name: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${name.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'export'}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
