import { Array as YArray, Doc, Map as YMap } from 'yjs';
import type { SerializedEditorState } from 'lexical';
import type { NotionPageData, NotionSchema, PropertyDefinition, StoredPropertyValue } from '../notion-page/types';
import { getPlainTextPreview } from '../notion-page/editor/getPlainTextPreview';
import {
  DEFAULT_TIMEZONE, convertPropertyValue, type BoardResource,
  type CalendarResource, type WorkspaceResource,
} from './domain';
import { ROOM_NAMES } from './yjs/model';

export interface WorkspaceState {
  schema: NotionSchema;
  pages: NotionPageData[];
  resources?: WorkspaceResource[];
}

export interface RoomProvider { destroy(): void; }
export type RoomProviderFactory = (room: string, document: Doc) => RoomProvider;

type ResourceInput = {
  id: string; type: 'board' | 'calendar'; title: string; pageIds: string[]; propertyIds?: string[];
  statusPropertyId?: string; datePropertyId?: string; timezone?: string;
  defaultView?: CalendarResource['defaultView']; visibleHours?: CalendarResource['visibleHours'];
};

interface ResourceReference { id: string; type: WorkspaceResource['type']; }
interface ResourceRoom {
  document: Doc;
  provider: RoomProvider;
  resource: YMap<unknown>;
  onTransaction: () => void;
}

function sameArray<T>(left: T[], right: T[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function replaceArray<T>(array: YArray<T>, values: T[]): void {
  if (sameArray(array.toArray(), values)) return;
  if (array.length) array.delete(0, array.length);
  if (values.length) array.insert(0, values);
}

function valuesEqual(left: unknown, right: unknown): boolean {
  return left === right || JSON.stringify(left) === JSON.stringify(right);
}

function hasDateValue(value: StoredPropertyValue): boolean {
  if (typeof value === 'string') return /^\d{4}-\d{2}-\d{2}/.test(value);
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && 'start' in value && value.start);
}

function defaultResources(schema: NotionSchema, pages: NotionPageData[]): WorkspaceResource[] {
  const status = schema.properties.find((property) => property.type === 'status');
  const date = schema.properties.find((property) => property.type === 'date');
  const propertyIds = schema.properties.map((property) => property.id);
  const resources: WorkspaceResource[] = [];
  if (status) resources.push({
    id: 'board-roadmap', type: 'board', title: 'Roadmap de produto',
    pageIds: pages.map((page) => page.id), propertyIds, statusPropertyId: status.id,
  });
  if (date) resources.push({
    id: 'calendar-product', type: 'calendar', title: 'Calendario de produto',
    pageIds: pages.filter((page) => hasDateValue(page.properties[date.id])).map((page) => page.id),
    propertyIds, datePropertyId: date.id, timezone: date.timezone || DEFAULT_TIMEZONE,
    defaultView: 'month', visibleHours: { from: 7, to: 21 },
  });
  return resources;
}

function normalizeResource(resource: ResourceInput, schema: NotionSchema): WorkspaceResource | null {
  const propertyIds = resource.propertyIds?.filter((id) => schema.properties.some((property) => property.id === id))
    ?? schema.properties.map((property) => property.id);
  if (resource.type === 'board') {
    const statusPropertyId = resource.statusPropertyId ?? schema.properties.find((property) => property.type === 'status')?.id;
    return statusPropertyId ? { ...resource, type: 'board', propertyIds, statusPropertyId } as BoardResource : null;
  }
  const datePropertyId = resource.datePropertyId ?? schema.properties.find((property) => property.type === 'date')?.id;
  if (!datePropertyId) return null;
  return {
    ...resource, type: 'calendar', propertyIds, datePropertyId,
    timezone: resource.timezone ?? DEFAULT_TIMEZONE,
    defaultView: resource.defaultView ?? 'month',
    visibleHours: resource.visibleHours ?? { from: 7, to: 21 },
  } as CalendarResource;
}

function writeResource(map: YMap<unknown>, resource: WorkspaceResource): void {
  map.set('type', resource.type);
  map.set('title', resource.title);
  const pageIds = map.get('pageIds');
  const pages = pageIds instanceof YArray ? pageIds as YArray<string> : new YArray<string>();
  if (!(pageIds instanceof YArray)) map.set('pageIds', pages);
  replaceArray(pages, resource.pageIds);
  const propertyIds = map.get('propertyIds');
  const properties = propertyIds instanceof YArray ? propertyIds as YArray<string> : new YArray<string>();
  if (!(propertyIds instanceof YArray)) map.set('propertyIds', properties);
  replaceArray(properties, resource.propertyIds);
  if (resource.type === 'board') map.set('statusPropertyId', resource.statusPropertyId);
  else {
    map.set('datePropertyId', resource.datePropertyId);
    map.set('timezone', resource.timezone);
    map.set('defaultView', resource.defaultView);
    map.set('visibleHours', resource.visibleHours);
  }
}

function readResource(id: string, map: YMap<unknown>): WorkspaceResource | null {
  const type = map.get('type');
  const pageIds = map.get('pageIds');
  const propertyIds = map.get('propertyIds');
  const base = {
    id, title: String(map.get('title') ?? 'Sem titulo'),
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

function createPageMap(page: NotionPageData): YMap<unknown> {
  const map = new YMap<unknown>();
  const properties = new YMap<StoredPropertyValue>();
  Object.entries(page.properties).forEach(([key, value]) => properties.set(key, value));
  map.set('properties', properties);
  writePageFields(map, { ...page, contentPreview: page.contentPreview ?? getPlainTextPreview(page.content, 240) });
  return map;
}

function writePageFields(map: YMap<unknown>, page: Partial<NotionPageData>): void {
  const scalarFields: Array<keyof Omit<NotionPageData, 'id' | 'properties' | 'content'>> = [
    'icon', 'coverUrl', 'coverPosition', 'title', 'contentPreview', 'createdTime', 'lastEditedTime',
  ];
  scalarFields.forEach((field) => {
    if (!(field in page)) return;
    const value = page[field] ?? null;
    if (!valuesEqual(map.get(field), value)) map.set(field, value);
  });
}

function readPage(id: string, map: YMap<unknown>, content: SerializedEditorState | null): NotionPageData {
  const properties = map.get('properties');
  return {
    id,
    icon: map.get('icon') as string | null | undefined,
    coverUrl: map.get('coverUrl') as string | null | undefined,
    coverPosition: map.get('coverPosition') as number | undefined,
    title: (map.get('title') as string | undefined) ?? 'Sem titulo',
    properties: properties instanceof YMap ? properties.toJSON() : {},
    content,
    contentPreview: (map.get('contentPreview') as string | undefined) ?? '',
    createdTime: (map.get('createdTime') as string | undefined) ?? new Date().toISOString(),
    lastEditedTime: (map.get('lastEditedTime') as string | undefined) ?? new Date().toISOString(),
  };
}

/** Stable facade over independent workspace, database and view Y.Docs. */
export class WorkspaceYjsStore {
  private readonly workspaceDocument = new Doc();
  private readonly databaseDocument = new Doc();
  private readonly workspaceProvider: RoomProvider;
  private readonly databaseProvider: RoomProvider;
  private readonly references = this.workspaceDocument.getMap<string>('resource-references');
  private readonly resourceOrder = this.workspaceDocument.getArray<string>('resource-order');
  private readonly definitions = this.databaseDocument.getMap<string>('schema-definitions');
  private readonly definitionOrder = this.databaseDocument.getArray<string>('schema-order');
  private readonly pageMaps = this.databaseDocument.getMap<YMap<unknown>>('pages');
  private readonly pageOrder = this.databaseDocument.getArray<string>('page-order');
  private readonly resourceRooms = new Map<string, ResourceRoom>();
  private readonly initialContent = new Map<string, SerializedEditorState | null>();
  private readonly listeners = new Set<(state: WorkspaceState) => void>();
  private readonly contentTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private readonly createProvider: RoomProviderFactory) {
    this.workspaceProvider = createProvider(ROOM_NAMES.workspace, this.workspaceDocument);
    this.databaseProvider = createProvider(ROOM_NAMES.database, this.databaseDocument);
    this.workspaceDocument.on('afterTransaction', this.handleWorkspaceTransaction);
    this.databaseDocument.on('afterTransaction', this.publish);
  }

  private handleWorkspaceTransaction = (): void => { this.syncResourceRooms(); this.publish(); };
  private publish = (): void => {
    const state = this.read();
    this.listeners.forEach((listener) => listener(state));
  };

  initialize(seed: WorkspaceState): void {
    seed.pages.forEach((page) => this.initialContent.set(page.id, page.content));
    if (!this.definitions.size && !this.pageMaps.size) this.replaceDatabase(seed);
    const schema = this.readSchema();
    const migratedResources = seed.resources?.map((resource) => normalizeResource(resource, schema))
      .filter((resource): resource is WorkspaceResource => Boolean(resource)) ?? [];
    const resources = migratedResources.length ? migratedResources : defaultResources(schema, seed.pages);
    if (!this.references.size) {
      resources.forEach((resource) => this.ensureResourceRoom(resource));
      this.workspaceDocument.transact(() => {
        resources.forEach((resource) => this.references.set(resource.id, JSON.stringify({ id: resource.id, type: resource.type })));
        replaceArray(this.resourceOrder, resources.map((resource) => resource.id));
      }, 'workspace-seed');
    } else this.syncResourceRooms(resources);
    this.publish();
  }

  subscribe(listener: (state: WorkspaceState) => void): () => void {
    this.listeners.add(listener);
    listener(this.read());
    return () => this.listeners.delete(listener);
  }

  private readSchema(): NotionSchema {
    const ids = this.definitionOrder.toArray();
    const ordered = ids.map((id) => this.definitions.get(id)).filter((value): value is string => Boolean(value));
    const unordered = [...this.definitions.entries()].filter(([id]) => !ids.includes(id)).map(([, value]) => value);
    return { properties: [...ordered, ...unordered].map((value) => JSON.parse(value) as PropertyDefinition) };
  }

  read(): WorkspaceState {
    const schema = this.readSchema();
    const ids = this.pageOrder.toArray();
    const ordered = ids.map((id) => {
      const map = this.pageMaps.get(id);
      return map ? readPage(id, map, this.initialContent.get(id) ?? null) : null;
    }).filter((page): page is NotionPageData => Boolean(page));
    const unordered = [...this.pageMaps.entries()].filter(([id]) => !ids.includes(id))
      .map(([id, map]) => readPage(id, map, this.initialContent.get(id) ?? null));
    return { schema, pages: [...ordered, ...unordered], resources: this.readResources() };
  }

  private readReferences(): ResourceReference[] {
    const ids = this.resourceOrder.toArray();
    const values = ids.map((id) => this.references.get(id)).filter((value): value is string => Boolean(value));
    const unordered = [...this.references.entries()].filter(([id]) => !ids.includes(id)).map(([, value]) => value);
    return [...values, ...unordered].map((value) => JSON.parse(value) as ResourceReference);
  }

  private readResources(): WorkspaceResource[] {
    return this.readReferences().flatMap((reference) => {
      const room = this.resourceRooms.get(reference.id);
      const resource = room ? readResource(reference.id, room.resource) : null;
      return resource ? [resource] : [];
    });
  }

  private ensureResourceRoom(resource: WorkspaceResource): ResourceRoom {
    const existing = this.resourceRooms.get(resource.id);
    if (existing) return existing;
    const document = new Doc();
    const provider = this.createProvider(ROOM_NAMES.view(resource.id), document);
    const map = document.getMap<unknown>('resource');
    if (!map.has('type')) document.transact(() => writeResource(map, resource), 'view-seed');
    const onTransaction = () => this.publish();
    document.on('afterTransaction', onTransaction);
    const room = { document, provider, resource: map, onTransaction };
    this.resourceRooms.set(resource.id, room);
    return room;
  }

  private syncResourceRooms(seed: WorkspaceResource[] = []): void {
    const schema = this.readSchema();
    const references = this.readReferences();
    const active = new Set(references.map((reference) => reference.id));
    references.forEach((reference) => {
      const fallback = seed.find((resource) => resource.id === reference.id)
        ?? defaultResources(schema, this.read().pages).find((resource) => resource.type === reference.type);
      if (fallback) this.ensureResourceRoom({ ...fallback, id: reference.id });
    });
    [...this.resourceRooms.keys()].forEach((id) => { if (!active.has(id)) this.disposeResourceRoom(id); });
  }

  private disposeResourceRoom(id: string): void {
    const room = this.resourceRooms.get(id);
    if (!room) return;
    room.document.off('afterTransaction', room.onTransaction);
    room.provider.destroy();
    room.document.destroy();
    this.resourceRooms.delete(id);
  }

  private replaceDatabase(state: WorkspaceState): void {
    this.databaseDocument.transact(() => {
      this.definitions.clear();
      state.schema.properties.forEach((definition) => this.definitions.set(definition.id, JSON.stringify(definition)));
      replaceArray(this.definitionOrder, state.schema.properties.map((definition) => definition.id));
      this.pageMaps.clear();
      state.pages.forEach((page) => this.pageMaps.set(page.id, createPageMap(page)));
      replaceArray(this.pageOrder, state.pages.map((page) => page.id));
    }, 'database-replace');
  }

  replaceAll(state: WorkspaceState): void {
    this.initialContent.clear();
    state.pages.forEach((page) => this.initialContent.set(page.id, page.content));
    this.replaceDatabase(state);
    const migratedResources = state.resources?.map((resource) => normalizeResource(resource, state.schema))
      .filter((resource): resource is WorkspaceResource => Boolean(resource)) ?? [];
    const resources = migratedResources.length ? migratedResources : defaultResources(state.schema, state.pages);
    resources.forEach((resource) => {
      const room = this.ensureResourceRoom(resource);
      room.document.transact(() => writeResource(room.resource, resource), 'view-replace');
    });
    this.workspaceDocument.transact(() => {
      this.references.clear();
      resources.forEach((resource) => this.references.set(resource.id, JSON.stringify({ id: resource.id, type: resource.type })));
      replaceArray(this.resourceOrder, resources.map((resource) => resource.id));
    }, 'workspace-replace');
  }

  applySchema(schema: NotionSchema, fallbackByPropertyId: Record<string, StoredPropertyValue> = {}): void {
    const previous = new Map<string, PropertyDefinition>();
    this.definitions.forEach((value, id) => { try { previous.set(id, JSON.parse(value) as PropertyDefinition); } catch { /* ignore */ } });
    this.databaseDocument.transact(() => {
      const nextIds = new Set(schema.properties.map((definition) => definition.id));
      [...this.definitions.keys()].forEach((id) => { if (!nextIds.has(id)) this.definitions.delete(id); });
      schema.properties.forEach((definition) => {
        const value = JSON.stringify(definition);
        if (this.definitions.get(definition.id) !== value) this.definitions.set(definition.id, value);
      });
      replaceArray(this.definitionOrder, schema.properties.map((definition) => definition.id));
      this.pageMaps.forEach((page) => {
        const properties = page.get('properties');
        if (!(properties instanceof YMap)) return;
        [...properties.keys()].forEach((id) => { if (!nextIds.has(id)) properties.delete(id); });
        schema.properties.forEach((definition) => properties.set(definition.id, convertPropertyValue(
          definition, previous.get(definition.id), properties.get(definition.id), fallbackByPropertyId[definition.id],
        )));
      });
    }, 'schema-change');
    const nextIds = new Set(schema.properties.map((definition) => definition.id));
    this.resourceRooms.forEach((room) => {
      const propertyIds = room.resource.get('propertyIds');
      if (propertyIds instanceof YArray) room.document.transact(() => replaceArray(propertyIds, propertyIds.toArray().filter((id) => nextIds.has(id)) as string[]), 'view-schema-change');
    });
  }

  insertPage(page: NotionPageData, afterPageId?: string): void {
    this.initialContent.set(page.id, page.content);
    this.databaseDocument.transact(() => {
      this.pageMaps.set(page.id, createPageMap(page));
      const ids = this.pageOrder.toArray();
      const afterIndex = afterPageId ? ids.indexOf(afterPageId) : -1;
      this.pageOrder.insert(afterIndex >= 0 ? afterIndex + 1 : ids.length, [page.id]);
    }, 'page-create');
  }

  createResource(resource: WorkspaceResource, definitions: PropertyDefinition[] = []): void {
    if (definitions.length) this.databaseDocument.transact(() => {
      definitions.forEach((definition) => { this.definitions.set(definition.id, JSON.stringify(definition)); this.definitionOrder.push([definition.id]); });
    }, 'resource-schema-create');
    this.ensureResourceRoom(resource);
    this.workspaceDocument.transact(() => {
      this.references.set(resource.id, JSON.stringify({ id: resource.id, type: resource.type }));
      this.resourceOrder.push([resource.id]);
    }, 'resource-create');
  }

  private resourcePageIds(resourceId: string): YArray<string> | null {
    const value = this.resourceRooms.get(resourceId)?.resource.get('pageIds');
    return value instanceof YArray ? value as YArray<string> : null;
  }

  linkPage(resourceId: string, pageId: string, afterPageId?: string): void {
    const room = this.resourceRooms.get(resourceId);
    const pageIds = this.resourcePageIds(resourceId);
    if (!room || !pageIds || pageIds.toArray().includes(pageId)) return;
    room.document.transact(() => {
      const ids = pageIds.toArray();
      const afterIndex = afterPageId ? ids.indexOf(afterPageId) : -1;
      pageIds.insert(afterIndex >= 0 ? afterIndex + 1 : ids.length, [pageId]);
    }, 'resource-link-page');
  }

  unlinkPage(resourceId: string, pageId: string): void {
    const room = this.resourceRooms.get(resourceId);
    const pageIds = this.resourcePageIds(resourceId);
    const index = pageIds?.toArray().indexOf(pageId) ?? -1;
    if (room && pageIds && index >= 0) room.document.transact(() => pageIds.delete(index, 1), 'resource-unlink-page');
  }

  updateResource(resourceId: string, patch: Partial<WorkspaceResource>): void {
    const room = this.resourceRooms.get(resourceId);
    if (!room) return;
    room.document.transact(() => {
      Object.entries(patch).forEach(([key, value]) => {
        if (key === 'id' || key === 'type' || value === undefined) return;
        const current = room.resource.get(key);
        if ((key === 'pageIds' || key === 'propertyIds') && current instanceof YArray && Array.isArray(value)) replaceArray(current, value as string[]);
        else if (!valuesEqual(current, value)) room.resource.set(key, value);
      });
    }, 'resource-change');
  }

  deleteResource(resourceId: string): void {
    this.workspaceDocument.transact(() => {
      this.references.delete(resourceId);
      const index = this.resourceOrder.toArray().indexOf(resourceId);
      if (index >= 0) this.resourceOrder.delete(index, 1);
    }, 'resource-delete');
  }

  reorderResourcePage(resourceId: string, pageId: string, overPageId: string): void {
    const room = this.resourceRooms.get(resourceId);
    const pageIds = this.resourcePageIds(resourceId);
    if (!room || !pageIds) return;
    const ids = pageIds.toArray();
    const from = ids.indexOf(pageId);
    const to = ids.indexOf(overPageId);
    if (from < 0 || to < 0 || from === to) return;
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    room.document.transact(() => replaceArray(pageIds, ids), 'resource-reorder-page');
  }

  deletePage(pageId: string): void {
    this.initialContent.delete(pageId);
    this.databaseDocument.transact(() => {
      this.pageMaps.delete(pageId);
      const index = this.pageOrder.toArray().indexOf(pageId);
      if (index >= 0) this.pageOrder.delete(index, 1);
    }, 'page-delete');
    this.resourceRooms.forEach((room, resourceId) => this.unlinkPage(resourceId, pageId));
  }

  updatePage(id: string, patch: Partial<NotionPageData>): void {
    if (patch.content !== undefined) this.updatePageContent(id, patch.content);
    const map = this.pageMaps.get(id);
    if (!map) return;
    this.databaseDocument.transact(() => {
      writePageFields(map, patch);
      if (patch.properties) {
        const properties = map.get('properties');
        if (properties instanceof YMap) Object.entries(patch.properties).forEach(([key, value]) => {
          if (!valuesEqual(properties.get(key), value)) properties.set(key, value);
        });
      }
    }, 'page-change');
  }

  updatePageContent(id: string, content: SerializedEditorState | null): void {
    this.initialContent.set(id, content);
    const existing = this.contentTimers.get(id);
    if (existing) clearTimeout(existing);
    this.contentTimers.set(id, setTimeout(() => {
      this.contentTimers.delete(id);
      const page = this.pageMaps.get(id);
      if (!page) { this.publish(); return; }
      const preview = getPlainTextPreview(content, 240);
      const now = new Date().toISOString();
      const edited = this.readSchema().properties.find((definition) => definition.type === 'last_edited_time');
      this.databaseDocument.transact(() => {
        page.set('contentPreview', preview);
        page.set('lastEditedTime', now);
        const properties = page.get('properties');
        if (edited && properties instanceof YMap) properties.set(edited.id, now);
      }, 'page-content-change');
    }, 250));
  }

  updateProperty(pageId: string, propertyId: string, value: StoredPropertyValue): void {
    const page = this.pageMaps.get(pageId);
    const properties = page?.get('properties');
    if (!(page instanceof YMap) || !(properties instanceof YMap)) return;
    this.databaseDocument.transact(() => {
      if (!valuesEqual(properties.get(propertyId), value)) properties.set(propertyId, value);
      page.set('lastEditedTime', new Date().toISOString());
    }, 'property-change');
  }

  destroy(): void {
    this.contentTimers.forEach((timer) => clearTimeout(timer));
    [...this.resourceRooms.keys()].forEach((id) => this.disposeResourceRoom(id));
    this.workspaceDocument.off('afterTransaction', this.handleWorkspaceTransaction);
    this.databaseDocument.off('afterTransaction', this.publish);
    this.workspaceProvider.destroy();
    this.databaseProvider.destroy();
    this.workspaceDocument.destroy();
    this.databaseDocument.destroy();
    this.listeners.clear();
  }
}
