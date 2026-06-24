import type { PropertyDefinition, PropertyType, StoredPropertyValue } from '../notion-page/types';

export interface PropertyAdapter {
  type: PropertyType;
  readOnly: boolean;
  defaultValue: (definition: PropertyDefinition, context?: { pageId?: string; userId?: string }) => StoredPropertyValue;
  serialize: (value: StoredPropertyValue) => StoredPropertyValue;
  compare: (left: StoredPropertyValue, right: StoredPropertyValue) => number;
}

function defaultValue(definition: PropertyDefinition, context?: { pageId?: string; userId?: string }): StoredPropertyValue {
  if (definition.type === 'checkbox') return false;
  if (definition.type === 'multi_select' || definition.type === 'person' || definition.type === 'relation' || definition.type === 'files') return [];
  if (definition.type === 'unique_id') return context?.pageId ? `${definition.prefix ?? 'PAGE'}-${context.pageId.slice(0, 8).toUpperCase()}` : null;
  if (definition.type === 'created_by' || definition.type === 'last_edited_by') return context?.userId ?? null;
  return null;
}

function compare(left: StoredPropertyValue, right: StoredPropertyValue): number {
  if (left == null) return right == null ? 0 : 1;
  if (right == null) return -1;
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return String(left).localeCompare(String(right), 'pt-BR', { numeric: true, sensitivity: 'base' });
}

const READ_ONLY = new Set<PropertyType>(['created_time', 'last_edited_time', 'unique_id', 'created_by', 'last_edited_by', 'formula', 'rollup']);

export const PROPERTY_REGISTRY = Object.fromEntries(([
  'text', 'number', 'select', 'multi_select', 'status', 'date', 'person', 'checkbox', 'url', 'email', 'phone',
  'relation', 'files', 'unique_id', 'created_by', 'last_edited_by', 'place', 'formula', 'rollup', 'created_time', 'last_edited_time',
] satisfies PropertyType[]).map((type) => [type, {
  type,
  readOnly: READ_ONLY.has(type),
  defaultValue,
  serialize: (value: StoredPropertyValue) => value,
  compare,
}])) as Record<PropertyType, PropertyAdapter>;

export function defaultPropertyValue(definition: PropertyDefinition, context?: { pageId?: string; userId?: string }): StoredPropertyValue {
  return PROPERTY_REGISTRY[definition.type].defaultValue(definition, context);
}
