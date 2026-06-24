import type { DatabasePageTemplate, NotionPageData, NotionSchema, StoredPropertyValue } from '../notion-page/types';
import { createId } from './domain';
import { defaultPropertyValue, PROPERTY_REGISTRY } from './propertyRegistry';

export function capturePageTemplate(name: string, page: NotionPageData, schema: NotionSchema, now = new Date().toISOString()): DatabasePageTemplate {
  const properties = Object.fromEntries(schema.properties
    .filter((definition) => !PROPERTY_REGISTRY[definition.type].readOnly)
    .map((definition) => [definition.id, structuredClone(page.properties[definition.id])]));
  return {
    id: createId('template'), name, title: page.title, icon: page.icon,
    coverUrl: page.coverUrl, coverPosition: page.coverPosition,
    properties, content: page.content ? structuredClone(page.content) : null,
    createdAt: now, updatedAt: now,
  };
}

export function instantiatePageTemplate({ schema, template, pageId, userId, now, overrides = {} }: {
  schema: NotionSchema;
  template?: DatabasePageTemplate;
  pageId: string;
  userId?: string;
  now: string;
  overrides?: Record<string, StoredPropertyValue>;
}): NotionPageData {
  const properties = Object.fromEntries(schema.properties.map((definition) => {
    const captured = template && !PROPERTY_REGISTRY[definition.type].readOnly && definition.id in template.properties
      ? structuredClone(template.properties[definition.id])
      : defaultPropertyValue(definition, { pageId, userId });
    return [definition.id, definition.id in overrides ? overrides[definition.id] : captured];
  }));
  schema.properties.forEach((definition) => {
    if (definition.type === 'created_time' || definition.type === 'last_edited_time') properties[definition.id] = now;
  });
  return {
    id: pageId,
    icon: template?.icon ?? '📄',
    coverUrl: template?.coverUrl ?? null,
    coverPosition: template?.coverPosition,
    title: template?.title || 'Sem titulo',
    properties,
    content: template?.content ? structuredClone(template.content) : null,
    createdTime: now,
    lastEditedTime: now,
  };
}
