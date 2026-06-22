import { Array as YArray, Doc, Map as YMap } from 'yjs';
import type { NotionPageData, NotionSchema, PropertyDefinition, StoredPropertyValue } from '../notion-page/types';
import {
  DEFAULT_TIMEZONE, convertPropertyValue, type BoardResource,
  type CalendarResource, type WorkspaceResource,
} from './domain';

export interface WorkspaceState {
  schema: NotionSchema;
  pages: NotionPageData[];
  resources?: WorkspaceResource[];
}

type ResourceInput = {
  id: string; type: 'board' | 'calendar'; title: string; pageIds: string[]; propertyIds?: string[];
  statusPropertyId?: string; datePropertyId?: string; timezone?: string;
  defaultView?: CalendarResource['defaultView']; visibleHours?: CalendarResource['visibleHours'];
};

function replaceArray<T>(array: YArray<T>, values: T[]): void {
  if (array.length) array.delete(0, array.length);
  if (values.length) array.insert(0, values);
}

function defaultResources(schema: NotionSchema, pages: NotionPageData[]): WorkspaceResource[] {
  const status = schema.properties.find((property) => property.type === 'status');
  const date = schema.properties.find((property) => property.type === 'date');
  const propertyIds = schema.properties.map((property) => property.id);
  const resources: WorkspaceResource[] = [];
  if (status) {
    resources.push({
      id: 'board-roadmap', type: 'board', title: 'Roadmap de produto',
      pageIds: pages.map((page) => page.id), propertyIds, statusPropertyId: status.id,
    });
  }
  if (date) {
    resources.push({
      id: 'calendar-product', type: 'calendar', title: 'Calendario de produto',
      pageIds: pages.filter((page) => hasDateValue(page.properties[date.id])).map((page) => page.id),
      propertyIds, datePropertyId: date.id, timezone: date.timezone || DEFAULT_TIMEZONE,
      defaultView: 'month', visibleHours: { from: 7, to: 21 },
    });
  }
  return resources;
}

function normalizeResource(resource: ResourceInput, schema: NotionSchema): WorkspaceResource | null {
  const propertyIds = resource.propertyIds?.filter((id) => schema.properties.some((property) => property.id === id))
    ?? schema.properties.map((property) => property.id);
  if (resource.type === 'board') {
    const statusPropertyId = resource.statusPropertyId
      ?? schema.properties.find((property) => property.type === 'status')?.id;
    if (!statusPropertyId) return null;
    return { ...resource, type: 'board', propertyIds, statusPropertyId } as BoardResource;
  }
  const datePropertyId = resource.datePropertyId
    ?? schema.properties.find((property) => property.type === 'date')?.id;
  if (!datePropertyId) return null;
  return {
    ...resource, type: 'calendar', propertyIds, datePropertyId,
    timezone: resource.timezone ?? DEFAULT_TIMEZONE,
    defaultView: resource.defaultView ?? 'month',
    visibleHours: resource.visibleHours ?? { from: 7, to: 21 },
  } as CalendarResource;
}

function createResourceMap(resource: WorkspaceResource): YMap<unknown> {
  const map = new YMap<unknown>();
  map.set('type', resource.type);
  map.set('title', resource.title);
  const pageIds = new YArray<string>();
  pageIds.insert(0, resource.pageIds);
  map.set('pageIds', pageIds);
  const propertyIds = new YArray<string>();
  propertyIds.insert(0, resource.propertyIds);
  map.set('propertyIds', propertyIds);
  if (resource.type === 'board') map.set('statusPropertyId', resource.statusPropertyId);
  else {
    map.set('datePropertyId', resource.datePropertyId);
    map.set('timezone', resource.timezone);
    map.set('defaultView', resource.defaultView);
    map.set('visibleHours', resource.visibleHours);
  }
  return map;
}

function readResource(id: string, map: YMap<unknown>): WorkspaceResource | null {
  const type = map.get('type');
  const title = String(map.get('title') ?? 'Sem titulo');
  const pageIds = map.get('pageIds');
  const propertyIds = map.get('propertyIds');
  const base = {
    id, title,
    pageIds: pageIds instanceof YArray ? pageIds.toArray() as string[] : [],
    propertyIds: propertyIds instanceof YArray ? propertyIds.toArray() as string[] : [],
  };
  if (type === 'board') {
    const statusPropertyId = map.get('statusPropertyId');
    return typeof statusPropertyId === 'string' ? { ...base, type, statusPropertyId } : null;
  }
  if (type === 'calendar') {
    const datePropertyId = map.get('datePropertyId');
    if (typeof datePropertyId !== 'string') return null;
    return {
      ...base, type, datePropertyId,
      timezone: String(map.get('timezone') ?? DEFAULT_TIMEZONE),
      defaultView: (map.get('defaultView') as CalendarResource['defaultView']) ?? 'month',
      visibleHours: (map.get('visibleHours') as CalendarResource['visibleHours']) ?? { from: 7, to: 21 },
    };
  }
  return null;
}

function hasDateValue(value: StoredPropertyValue): boolean {
  if (typeof value === 'string') return /^\d{4}-\d{2}-\d{2}/.test(value);
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && 'start' in value && value.start);
}

function createPageMap(page: NotionPageData): YMap<unknown> {
  const map = new YMap<unknown>();
  const properties = new YMap<StoredPropertyValue>();
  Object.entries(page.properties).forEach(([key, value]) => properties.set(key, value));
  map.set('properties', properties);
  writePageFields(map, page);
  return map;
}

function writePageFields(map: YMap<unknown>, page: Partial<NotionPageData>): void {
  const scalarFields: Array<keyof Omit<NotionPageData, 'properties'>> = [
    'icon', 'coverUrl', 'coverPosition', 'title', 'content', 'createdTime', 'lastEditedTime',
  ];
  scalarFields.forEach((field) => {
    if (field in page) map.set(field, page[field] ?? null);
  });
}

function readPage(id: string, map: YMap<unknown>): NotionPageData {
  const properties = map.get('properties');
  const propertyValues = properties instanceof YMap ? properties.toJSON() : {};
  return {
    id,
    icon: map.get('icon') as string | null | undefined,
    coverUrl: map.get('coverUrl') as string | null | undefined,
    coverPosition: map.get('coverPosition') as number | undefined,
    title: (map.get('title') as string | undefined) ?? 'Sem titulo',
    properties: propertyValues,
    content: (map.get('content') as NotionPageData['content']) ?? null,
    createdTime: (map.get('createdTime') as string | undefined) ?? new Date().toISOString(),
    lastEditedTime: (map.get('lastEditedTime') as string | undefined) ?? new Date().toISOString(),
  };
}

export class WorkspaceYjsStore {
  private readonly definitions: YMap<string>;
  private readonly definitionOrder: YArray<string>;
  private readonly pageMaps: YMap<YMap<unknown>>;
  private readonly pageOrder: YArray<string>;
  private readonly resources: YMap<unknown>;
  private readonly resourceOrder: YArray<string>;

  constructor(private readonly document: Doc) {
    this.definitions = document.getMap<string>('schema-definitions');
    this.definitionOrder = document.getArray<string>('schema-order');
    this.pageMaps = document.getMap<YMap<unknown>>('pages');
    this.pageOrder = document.getArray<string>('page-order');
    this.resources = document.getMap<unknown>('resources');
    this.resourceOrder = document.getArray<string>('resource-order');
  }

  initialize(seed: WorkspaceState): void {
    if (!this.definitions.size && !this.pageMaps.size) this.replaceAll(seed);
    const state = this.read();
    const existing = [...this.resources.entries()];
    const migrated = existing.map(([id, value]) => {
      if (value instanceof YMap) return readResource(id, value);
      if (typeof value !== 'string') return null;
      try {
        return normalizeResource(JSON.parse(value) as ResourceInput, state.schema);
      } catch { return null; }
    }).filter((resource): resource is WorkspaceResource => Boolean(resource));
    const next = migrated.length ? migrated : defaultResources(state.schema, state.pages);
    this.document.transact(() => {
      this.resources.clear();
      next.forEach((resource) => this.resources.set(resource.id, createResourceMap(resource)));
      replaceArray(this.resourceOrder, next.map((resource) => resource.id));
    }, existing.length ? 'resource-migrate' : 'resource-seed');
  }

  subscribe(listener: (state: WorkspaceState) => void): () => void {
    const publish = () => listener(this.read());
    this.document.on('afterTransaction', publish);
    publish();
    return () => this.document.off('afterTransaction', publish);
  }

  read(): WorkspaceState {
    const orderedDefinitions = this.definitionOrder.toArray()
      .map((id) => this.definitions.get(id))
      .filter((definition): definition is string => Boolean(definition))
      .map((definition) => JSON.parse(definition) as NotionSchema['properties'][number]);
    const unorderedDefinitions = [...this.definitions.entries()]
      .filter(([id]) => !this.definitionOrder.toArray().includes(id))
      .map(([, definition]) => JSON.parse(definition) as NotionSchema['properties'][number]);
    const ids = this.pageOrder.toArray();
    const orderedPages = ids
      .map((id) => {
        const map = this.pageMaps.get(id);
        return map ? readPage(id, map) : null;
      })
      .filter((page): page is NotionPageData => Boolean(page));
    const unorderedPages = [...this.pageMaps.entries()]
      .filter(([id]) => !ids.includes(id))
      .map(([id, map]) => readPage(id, map));
    const resourceIds = this.resourceOrder.toArray();
    const orderedResources = resourceIds.map((id) => {
      const resource = this.resources.get(id);
      return resource instanceof YMap ? readResource(id, resource) : null;
    }).filter((resource): resource is WorkspaceResource => Boolean(resource));
    const unorderedResources = [...this.resources.entries()].filter(([id]) => !resourceIds.includes(id)).map(([id, resource]) => resource instanceof YMap ? readResource(id, resource) : null).filter((resource): resource is WorkspaceResource => Boolean(resource));
    return { schema: { properties: [...orderedDefinitions, ...unorderedDefinitions] }, pages: [...orderedPages, ...unorderedPages], resources: [...orderedResources, ...unorderedResources] };
  }

  replaceAll(state: WorkspaceState): void {
    this.document.transact(() => {
      this.definitions.clear();
      state.schema.properties.forEach((definition) => this.definitions.set(definition.id, JSON.stringify(definition)));
      replaceArray(this.definitionOrder, state.schema.properties.map((definition) => definition.id));
      this.pageMaps.clear();
      state.pages.forEach((page) => this.pageMaps.set(page.id, createPageMap(page)));
      replaceArray(this.pageOrder, state.pages.map((page) => page.id));
      const resources = state.resources?.map((resource) => normalizeResource(resource, state.schema)).filter((resource): resource is WorkspaceResource => Boolean(resource))
        ?? defaultResources(state.schema, state.pages);
      this.resources.clear();
      resources.forEach((resource) => this.resources.set(resource.id, createResourceMap(resource)));
      replaceArray(this.resourceOrder, resources.map((resource) => resource.id));
    }, 'workspace-replace');
  }

  applySchema(schema: NotionSchema, fallbackByPropertyId: Record<string, StoredPropertyValue> = {}): void {
    this.document.transact(() => {
      const previous = new Map<string, PropertyDefinition>();
      this.definitions.forEach((definition, id) => {
        try { previous.set(id, JSON.parse(definition) as PropertyDefinition); } catch { /* ignore corrupt legacy entry */ }
      });
      const nextIds = new Set(schema.properties.map((definition) => definition.id));
      [...this.definitions.keys()].forEach((id) => { if (!nextIds.has(id)) this.definitions.delete(id); });
      schema.properties.forEach((definition) => this.definitions.set(definition.id, JSON.stringify(definition)));
      replaceArray(this.definitionOrder, schema.properties.map((definition) => definition.id));
      this.pageMaps.forEach((page) => {
        const properties = page.get('properties');
        if (!(properties instanceof YMap)) return;
        [...properties.keys()].forEach((id) => { if (!nextIds.has(id)) properties.delete(id); });
        schema.properties.forEach((definition) => {
          properties.set(definition.id, convertPropertyValue(
            definition, previous.get(definition.id), properties.get(definition.id), fallbackByPropertyId[definition.id],
          ));
        });
      });
      this.resources.forEach((value) => {
        if (!(value instanceof YMap)) return;
        const propertyIds = value.get('propertyIds');
        if (!(propertyIds instanceof YArray)) return;
        replaceArray(propertyIds, propertyIds.toArray().filter((id) => nextIds.has(id)) as string[]);
      });
    }, 'schema-change');
  }

  insertPage(page: NotionPageData, afterPageId?: string): void {
    this.document.transact(() => {
      this.pageMaps.set(page.id, createPageMap(page));
      const ids = this.pageOrder.toArray();
      const afterIndex = afterPageId ? ids.indexOf(afterPageId) : -1;
      this.pageOrder.insert(afterIndex >= 0 ? afterIndex + 1 : ids.length, [page.id]);
    }, 'page-create');
  }

  createResource(resource: WorkspaceResource, definitions: PropertyDefinition[] = []): void {
    this.document.transact(() => {
      definitions.forEach((definition) => {
        this.definitions.set(definition.id, JSON.stringify(definition));
        this.definitionOrder.push([definition.id]);
      });
      this.resources.set(resource.id, createResourceMap(resource));
      this.resourceOrder.push([resource.id]);
    }, 'resource-create');
  }

  linkPage(resourceId: string, pageId: string, afterPageId?: string): void {
    const resource = this.resources.get(resourceId);
    const pageIds = resource instanceof YMap ? resource.get('pageIds') : null;
    if (!(pageIds instanceof YArray) || pageIds.toArray().includes(pageId)) return;
    this.document.transact(() => {
      const ids = pageIds.toArray();
      const afterIndex = afterPageId ? ids.indexOf(afterPageId) : -1;
      pageIds.insert(afterIndex >= 0 ? afterIndex + 1 : ids.length, [pageId]);
    }, 'resource-link-page');
  }

  unlinkPage(resourceId: string, pageId: string): void {
    const resource = this.resources.get(resourceId);
    const pageIds = resource instanceof YMap ? resource.get('pageIds') : null;
    if (!(pageIds instanceof YArray)) return;
    const index = pageIds.toArray().indexOf(pageId);
    if (index >= 0) this.document.transact(() => pageIds.delete(index, 1), 'resource-unlink-page');
  }

  updateResource(resourceId: string, patch: Partial<WorkspaceResource>): void {
    const resource = this.resources.get(resourceId);
    if (!(resource instanceof YMap)) return;
    this.document.transact(() => {
      Object.entries(patch).forEach(([key, value]) => {
        if (key === 'id' || key === 'type' || value === undefined) return;
        const current = resource.get(key);
        if ((key === 'pageIds' || key === 'propertyIds') && current instanceof YArray && Array.isArray(value)) replaceArray(current, value as string[]);
        else resource.set(key, value);
      });
    }, 'resource-change');
  }

  deleteResource(resourceId: string): void {
    this.document.transact(() => {
      this.resources.delete(resourceId);
      const index = this.resourceOrder.toArray().indexOf(resourceId);
      if (index >= 0) this.resourceOrder.delete(index, 1);
    }, 'resource-delete');
  }

  reorderResourcePage(resourceId: string, pageId: string, overPageId: string): void {
    const resource = this.resources.get(resourceId);
    const pageIds = resource instanceof YMap ? resource.get('pageIds') : null;
    if (!(pageIds instanceof YArray)) return;
    const ids = pageIds.toArray() as string[];
    const from = ids.indexOf(pageId);
    const to = ids.indexOf(overPageId);
    if (from < 0 || to < 0 || from === to) return;
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    this.document.transact(() => replaceArray(pageIds, ids), 'resource-reorder-page');
  }

  deletePage(pageId: string): void {
    this.document.transact(() => {
      this.pageMaps.delete(pageId);
      const pageIndex = this.pageOrder.toArray().indexOf(pageId);
      if (pageIndex >= 0) this.pageOrder.delete(pageIndex, 1);
      this.resources.forEach((resource) => {
        if (!(resource instanceof YMap)) return;
        const pageIds = resource.get('pageIds');
        if (!(pageIds instanceof YArray)) return;
        const index = pageIds.toArray().indexOf(pageId);
        if (index >= 0) pageIds.delete(index, 1);
      });
    }, 'page-delete');
  }

  updatePage(id: string, patch: Partial<NotionPageData>): void {
    const map = this.pageMaps.get(id);
    if (!map) return;
    this.document.transact(() => {
      writePageFields(map, patch);
      if (patch.properties) {
        const properties = map.get('properties');
        if (properties instanceof YMap) {
          Object.entries(patch.properties).forEach(([key, value]) => properties.set(key, value));
        }
      }
    }, 'page-change');
  }

  updateProperty(pageId: string, propertyId: string, value: StoredPropertyValue): void {
    const page = this.pageMaps.get(pageId);
    const properties = page?.get('properties');
    if (!(page instanceof YMap) || !(properties instanceof YMap)) return;
    this.document.transact(() => {
      properties.set(propertyId, value);
      page.set('lastEditedTime', new Date().toISOString());
    }, 'property-change');
  }
}
