import type {
  DateRangeValue, NotionSchema, PersonOption, PropertyDefinition,
  PropertyType, StoredPropertyValue,
} from '../notion-page/types';

export const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

export interface ResourceBase {
  id: string;
  databaseId: string;
  dataSourceId: string;
  title: string;
  /** Derived from the data source ownership index; never persisted by a view. */
  pageIds: string[];
  /** Properties visible in this view. */
  propertyIds: string[];
}

export interface BoardResource extends ResourceBase {
  type: 'board';
  statusPropertyId: string;
}

export interface CalendarResource extends ResourceBase {
  type: 'calendar';
  datePropertyId: string;
  timezone: string;
  defaultView: 'day' | 'workweek' | 'week' | 'month' | 'year' | 'agenda' | 'gantt';
  visibleHours: { from: number; to: number };
}

export type WorkspaceResource = BoardResource | CalendarResource;

export interface DatabaseContainer {
  id: string;
  title: string;
  dataSourceIds: string[];
  viewIds: string[];
}

export interface DataSourceReference {
  id: string;
  databaseId: string;
  title: string;
}

export interface PageOwnership {
  pageId: string;
  dataSourceId: string;
  version: number;
}

export interface SerializedRowSnapshot {
  page: {
    id: string;
    title: string;
    properties: Record<string, StoredPropertyValue>;
  };
  schema: NotionSchema;
}

export interface PropertyMapping {
  sourcePropertyId: string;
  targetPropertyId?: string;
  conversion: 'direct' | 'convert' | 'archive';
}

export interface MoveOperation {
  id: string;
  pageId: string;
  sourceDataSourceId: string;
  targetDataSourceId: string;
  expectedParentVersion: number;
  propertyMapping: PropertyMapping[];
  sourceSnapshot: SerializedRowSnapshot;
  status: 'prepared' | 'staged' | 'committed' | 'cleaned';
}

export function createId(prefix: string): string {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

export function isDateRangeValue(value: StoredPropertyValue): value is DateRangeValue {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && 'start' in value);
}

export function normalizeDateValue(value: StoredPropertyValue, timezone = DEFAULT_TIMEZONE): DateRangeValue | null {
  if (typeof value === 'string' && value) {
    return { start: value, end: value, allDay: value.length <= 10, timezone };
  }
  if (!isDateRangeValue(value) || !value.start) return null;
  return {
    start: value.start,
    end: value.end || value.start,
    allDay: value.allDay ?? value.start.length <= 10,
    timezone: value.timezone || timezone,
  };
}

export function buildProperty(type: PropertyType, name?: string, people: PersonOption[] = []): PropertyDefinition {
  const id = createId('prop');
  if (type === 'select') return { id, name: name ?? 'Select', type, options: [] };
  if (type === 'multi_select') return { id, name: name ?? 'Multi-select', type, options: [] };
  if (type === 'status') {
    const todoId = createId('status');
    const doingId = createId('status');
    const doneId = createId('status');
    return {
      id, name: name ?? 'Status', type,
      options: [
        { id: todoId, name: 'A fazer', color: 'gray' },
        { id: doingId, name: 'Em andamento', color: 'blue' },
        { id: doneId, name: 'Concluido', color: 'green' },
      ],
      groups: [
        { id: createId('group'), name: 'A fazer', color: 'gray', optionIds: [todoId] },
        { id: createId('group'), name: 'Em andamento', color: 'blue', optionIds: [doingId] },
        { id: createId('group'), name: 'Concluido', color: 'green', optionIds: [doneId] },
      ],
    };
  }
  if (type === 'person') return { id, name: name ?? 'Pessoa', type, people, multiple: true };
  if (type === 'date') return { id, name: name ?? 'Data', type, includeTime: true, timezone: DEFAULT_TIMEZONE };
  return { id, name: name ?? type, type } as PropertyDefinition;
}

export function emptyValueFor(definition: PropertyDefinition): StoredPropertyValue {
  if (definition.type === 'checkbox') return false;
  if (definition.type === 'multi_select' || definition.type === 'person') return [];
  return null;
}

export function convertPropertyValue(
  definition: PropertyDefinition,
  previous: PropertyDefinition | undefined,
  value: StoredPropertyValue,
  fallback?: StoredPropertyValue,
): StoredPropertyValue {
  if (fallback !== undefined && (value === null || value === undefined)) return fallback;
  if (!previous) return emptyValueFor(definition);
  if (previous.type !== definition.type) {
    if (definition.type === 'text' || definition.type === 'url' || definition.type === 'email' || definition.type === 'phone') {
      if (value === null || value === undefined) return null;
      if (isDateRangeValue(value)) return [value.start, value.end].filter(Boolean).join(' - ');
      return Array.isArray(value) ? value.join(', ') : String(value);
    }
    if (definition.type === 'number') {
      const parsed = typeof value === 'number' ? value : Number(String(value ?? '').replace(',', '.'));
      return Number.isFinite(parsed) ? parsed : null;
    }
    if (definition.type === 'checkbox') return Boolean(value);
    if (definition.type === 'multi_select') return typeof value === 'string' && definition.options.some((option) => option.id === value) ? [value] : [];
    if ((definition.type === 'select' || definition.type === 'status') && Array.isArray(value)) {
      return value.find((id) => definition.options.some((option) => option.id === id)) ?? null;
    }
    if (definition.type === 'date') return normalizeDateValue(value, definition.timezone) ?? null;
    return emptyValueFor(definition);
  }
  if (definition.type === 'select' || definition.type === 'status') {
    return typeof value === 'string' && definition.options.some((option) => option.id === value) ? value : fallback ?? null;
  }
  if (definition.type === 'multi_select') {
    const validIds = new Set(definition.options.map((option) => option.id));
    return Array.isArray(value) ? value.filter((id) => validIds.has(id)) : [];
  }
  if (definition.type === 'person') {
    const validIds = new Set(definition.people.map((person) => person.id));
    const selected = Array.isArray(value) ? value.filter((id) => validIds.has(id)) : [];
    return definition.multiple === false ? selected.slice(0, 1) : selected;
  }
  if (definition.type === 'checkbox') return Boolean(value);
  if (definition.type === 'number') return typeof value === 'number' ? value : null;
  if (definition.type === 'date') return normalizeDateValue(value, definition.timezone);
  return value;
}

export function schemaForResource(schema: NotionSchema, resource?: WorkspaceResource): NotionSchema {
  if (!resource?.propertyIds?.length) return schema;
  const ids = new Set(resource.propertyIds);
  return { properties: schema.properties.filter((property) => ids.has(property.id)) };
}
