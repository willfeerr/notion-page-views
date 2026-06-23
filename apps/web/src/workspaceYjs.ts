import { Array as YArray, Doc, Map as YMap } from 'yjs';
import type { SerializedEditorState } from 'lexical';
import type { NotionPageData, NotionSchema, PropertyDefinition, StoredPropertyValue } from '../notion-page/types';
import { getPlainTextPreview } from '../notion-page/editor/getPlainTextPreview';
import {
  DEFAULT_TIMEZONE, convertPropertyValue, emptyValueFor, type BoardResource,
  type CalendarResource, type WorkspaceResource,
} from './domain';
import { ROOM_NAMES } from './yjs/model';

export interface WorkspaceState {
  schema: NotionSchema;
  pages: NotionPageData[];
  resources?: WorkspaceResource[];
  /** Schema resolved from the owning database for each page. */
  pageSchemas?: Record<string, NotionSchema>;
}

export interface RoomProvider { destroy(): void; }
export type RoomProviderFactory = (room: string, document: Doc) => RoomProvider;

type ResourceInput = {
  id: string; databaseId?: string; type: 'board' | 'calendar'; title: string; pageIds: string[]; propertyIds?: string[];
  statusPropertyId?: string; datePropertyId?: string; timezone?: string;
  defaultView?: CalendarResource['defaultView']; visibleHours?: CalendarResource['visibleHours'];
};

interface ResourceReference {
  id: string;
  type: WorkspaceResource['type'];
  databaseId: string;
}

interface DatabaseReference {
  id: string;
  title: string;
}

interface DatabaseRoom {
  id: string;
  document: Doc;
  provider: RoomProvider;
  definitions: YMap<string>;
  definitionOrder: YArray<string>;
  pages: YMap<YMap<unknown>>;
  pageOrder: YArray<string>;
  onTransaction: () => void;
}

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

function safeJson<T>(value: string | undefined): T | null {
  if (!value) return null;
  try { return JSON.parse(value) as T; } catch { return null; }
}

function hasDateValue(value: StoredPropertyValue): boolean {
  if (typeof value === 'string') return /^\d{4}-\d{2}-\d{2}/.test(value);
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && 'start' in value && value.start);
}

function inferredDatabaseId(resource: Pick<ResourceInput, 'id'>): string {
  if (resource.id === 'board-roadmap' || resource.id === 'calendar-product') return 'roadmap';
  return 'db-' + resource.id;
}

function defaultResources(schema: NotionSchema, pages: NotionPageData[]): WorkspaceResource[] {
  const status = schema.properties.find((property) => property.type === 'status');
  const date = schema.properties.find((property) => property.type === 'date');
  const propertyIds = schema.properties.map((property) => property.id);
  const resources: WorkspaceResource[] = [];
  if (status) resources.push({
    id: 'board-roadmap', databaseId: 'roadmap', type: 'board', title: 'Roadmap de produto',
    pageIds: pages.map((page) => page.id), propertyIds, statusPropertyId: status.id,
  });
  if (date) resources.push({
    id: 'calendar-product', databaseId: 'roadmap', type: 'calendar', title: 'Calendario de produto',
    pageIds: pages.filter((page) => hasDateValue(page.properties[date.id])).map((page) => page.id),
    propertyIds, datePropertyId: date.id, timezone: date.timezone || DEFAULT_TIMEZONE,
    defaultView: 'month', visibleHours: { from: 7, to: 21 },
  });
  return resources;
}

function normalizeResource(resource: ResourceInput, schema: NotionSchema): WorkspaceResource | null {
  const propertyIds = resource.propertyIds?.filter((id) => schema.properties.some((property) => property.id === id))
    ?? schema.properties.map((property) => property.id);
  const databaseId = resource.databaseId ?? inferredDatabaseId(resource);
  if (resource.type === 'board') {
    const statusPropertyId = resource.statusPropertyId ?? schema.properties.find((property) => property.type === 'status')?.id;
    return statusPropertyId ? { ...resource, databaseId, type: 'board', propertyIds, statusPropertyId } as BoardResource : null;
  }
  const datePropertyId = resource.datePropertyId ?? schema.properties.find((property) => property.type === 'date')?.id;
  if (!datePropertyId) return null;
  return {
    ...resource, databaseId, type: 'calendar', propertyIds, datePropertyId,
    timezone: resource.timezone ?? DEFAULT_TIMEZONE,
    defaultView: resource.defaultView ?? 'month',
    visibleHours: resource.visibleHours ?? { from: 7, to: 21 },
  } as CalendarResource;
}

function writeResource(map: YMap<unknown>, resource: WorkspaceResource): void {
  map.set('type', resource.type);
  map.set('databaseId', resource.databaseId);
  map.set('title', resource.title);
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
  map.delete('pageIds');
}

function readStoredResource(id: string, map: YMap<unknown>, databaseId: string): WorkspaceResource | null {
  const type = map.get('type');
  const storedPages = map.get('pageIds');
  const storedProperties = map.get('propertyIds');
  const base = {
    id,
    databaseId: String(map.get('databaseId') ?? databaseId),
    title: String(map.get('title') ?? 'Sem titulo'),
    pageIds: storedPages instanceof YArray ? storedPages.toArray() as string[] : [],
    propertyIds: storedProperties instanceof YArray ? storedProperties.toArray() as string[] : [],
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
  map.set('viewRanks', new YMap<number>());
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

function roomSchema(room: DatabaseRoom): NotionSchema {
  const ids = room.definitionOrder.toArray();
  const ordered = ids.map((id) => room.definitions.get(id)).filter((value): value is string => Boolean(value));
  const unordered = [...room.definitions.entries()].filter(([id]) => !ids.includes(id)).map(([, value]) => value);
  return {
    properties: [...ordered, ...unordered].flatMap((value) => {
      const parsed = safeJson<PropertyDefinition>(value);
      return parsed ? [parsed] : [];
    }),
  };
}

function roomPageIds(room: DatabaseRoom): string[] {
  const ids = room.pageOrder.toArray();
  return [...ids.filter((id) => room.pages.has(id)), ...[...room.pages.keys()].filter((id) => !ids.includes(id))];
}

function roomPages(room: DatabaseRoom, content: Map<string, SerializedEditorState | null>): NotionPageData[] {
  return roomPageIds(room).flatMap((id) => {
    const map = room.pages.get(id);
    return map ? [readPage(id, map, content.get(id) ?? null)] : [];
  });
}

function replaceDatabase(room: DatabaseRoom, state: Pick<WorkspaceState, 'schema' | 'pages'>): void {
  room.document.transact(() => {
    room.definitions.clear();
    state.schema.properties.forEach((definition) => room.definitions.set(definition.id, JSON.stringify(definition)));
    replaceArray(room.definitionOrder, state.schema.properties.map((definition) => definition.id));
    room.pages.clear();
    state.pages.forEach((page) => room.pages.set(page.id, createPageMap(page)));
    replaceArray(room.pageOrder, state.pages.map((page) => page.id));
  }, 'database-replace');
}

/** Coordinates workspace references, independent database documents, view documents and page content documents. */
export class WorkspaceYjsStore {
  private readonly workspaceDocument = new Doc();
  private readonly workspaceProvider: RoomProvider;
  private readonly references = this.workspaceDocument.getMap<string>('resource-references');
  private readonly resourceOrder = this.workspaceDocument.getArray<string>('resource-order');
  private readonly databaseReferences = this.workspaceDocument.getMap<string>('database-references');
  private readonly databaseOrder = this.workspaceDocument.getArray<string>('database-order');
  private readonly databaseRooms = new Map<string, DatabaseRoom>();
  private readonly resourceRooms = new Map<string, ResourceRoom>();
  private readonly initialContent = new Map<string, SerializedEditorState | null>();
  private readonly listeners = new Set<(state: WorkspaceState) => void>();
  private readonly contentTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private readonly createProvider: RoomProviderFactory) {
    this.workspaceProvider = createProvider(ROOM_NAMES.workspace, this.workspaceDocument);
    this.workspaceDocument.on('afterTransaction', this.handleWorkspaceTransaction);
  }

  private handleWorkspaceTransaction = (): void => {
    this.syncRooms();
    this.publish();
  };

  private publish = (): void => {
    const state = this.read();
    this.listeners.forEach((listener) => listener(state));
  };

  initialize(seed: WorkspaceState): void {
    seed.pages.forEach((page) => this.initialContent.set(page.id, page.content));
    if (!this.references.size) this.initializeFresh(seed);
    else if (!this.databaseReferences.size || this.readReferences().some((reference) => !reference.databaseId)) this.migrateLegacy(seed);
    else {
      this.syncRooms(seed);
      this.publish();
    }
  }

  private initializeFresh(seed: WorkspaceState): void {
    const migrated = seed.resources?.map((resource) => normalizeResource(resource, seed.schema))
      .filter((resource): resource is WorkspaceResource => Boolean(resource)) ?? [];
    const resources = migrated.length ? migrated : defaultResources(seed.schema, seed.pages);
    this.seedDatabases(resources, seed);
    resources.forEach((resource) => this.ensureResourceRoom(resource));
    this.workspaceDocument.transact(() => {
      resources.forEach((resource) => this.references.set(resource.id, JSON.stringify({
        id: resource.id, type: resource.type, databaseId: resource.databaseId,
      })));
      replaceArray(this.resourceOrder, resources.map((resource) => resource.id));
    }, 'workspace-seed');
    this.publish();
  }

  private migrateLegacy(seed: WorkspaceState): void {
    const legacyDocument = new Doc();
    const legacyProvider = this.createProvider(ROOM_NAMES.legacyDatabase, legacyDocument);
    const legacyRoom: DatabaseRoom = {
      id: 'legacy',
      document: legacyDocument,
      provider: legacyProvider,
      definitions: legacyDocument.getMap<string>('schema-definitions'),
      definitionOrder: legacyDocument.getArray<string>('schema-order'),
      pages: legacyDocument.getMap<YMap<unknown>>('pages'),
      pageOrder: legacyDocument.getArray<string>('page-order'),
      onTransaction: () => undefined,
    };
    const legacyState = legacyRoom.definitions.size || legacyRoom.pages.size
      ? { schema: roomSchema(legacyRoom), pages: roomPages(legacyRoom, this.initialContent) }
      : { schema: seed.schema, pages: seed.pages };
    const seedResources = seed.resources?.map((resource) => normalizeResource(resource, legacyState.schema))
      .filter((resource): resource is WorkspaceResource => Boolean(resource)) ?? [];
    const references = this.readReferences();
    const resources = references.flatMap((reference) => {
      const seedFallback = seedResources.find((resource) => resource.id === reference.id)
        ?? defaultResources(legacyState.schema, legacyState.pages).find((resource) => resource.type === reference.type)
        ?? this.fallbackResource(reference, legacyState.schema);
      const fallback = {
        ...seedFallback,
        id: reference.id,
        databaseId: reference.databaseId || inferredDatabaseId(reference),
      } as WorkspaceResource;
      const room = this.ensureResourceRoom(fallback);
      const stored = readStoredResource(reference.id, room.resource, reference.databaseId || inferredDatabaseId(reference));
      return stored ? [{ ...stored, databaseId: reference.databaseId || inferredDatabaseId(reference) } as WorkspaceResource] : [];
    });

    this.seedDatabases(resources, legacyState);
    const referencedPages = new Set(resources.flatMap((resource) => resource.pageIds));
    const standalonePages = legacyState.pages.filter((page) => !referencedPages.has(page.id));
    if (standalonePages.length) this.ensureDatabaseRoom('standalone', { schema: { properties: [] }, pages: standalonePages }, 'Paginas independentes');

    resources.forEach((resource) => {
      const room = this.resourceRooms.get(resource.id);
      room?.document.transact(() => writeResource(room.resource, resource), 'view-v2-migration');
    });
    this.workspaceDocument.transact(() => {
      resources.forEach((resource) => this.references.set(resource.id, JSON.stringify({
        id: resource.id, type: resource.type, databaseId: resource.databaseId,
      })));
      replaceArray(this.resourceOrder, resources.map((resource) => resource.id));
    }, 'workspace-v2-migration');
    legacyProvider.destroy();
    legacyDocument.destroy();
    this.publish();
  }

  private seedDatabases(resources: WorkspaceResource[], state: Pick<WorkspaceState, 'schema' | 'pages'>): void {
    const groups = new Map<string, WorkspaceResource[]>();
    resources.forEach((resource) => groups.set(resource.databaseId, [...(groups.get(resource.databaseId) ?? []), resource]));
    groups.forEach((views, databaseId) => {
      const pageIds = new Set(views.flatMap((view) => view.pageIds));
      const propertyIds = new Set(views.flatMap((view) => view.propertyIds));
      const pages = state.pages.filter((page) => pageIds.has(page.id));
      const properties = state.schema.properties.filter((property) => propertyIds.has(property.id));
      this.ensureDatabaseRoom(databaseId, { schema: { properties }, pages }, views[0]?.title ?? databaseId);
    });
    const referencedPages = new Set(resources.flatMap((resource) => resource.pageIds));
    const standalone = state.pages.filter((page) => !referencedPages.has(page.id));
    if (standalone.length) this.ensureDatabaseRoom('standalone', { schema: { properties: [] }, pages: standalone }, 'Paginas independentes');
  }

  private fallbackResource(reference: ResourceReference, schema: NotionSchema): WorkspaceResource {
    const databaseId = reference.databaseId || inferredDatabaseId(reference);
    if (reference.type === 'board') {
      const status = schema.properties.find((property) => property.type === 'status');
      return {
        id: reference.id, databaseId, type: 'board', title: 'Board', pageIds: [],
        propertyIds: status ? [status.id] : [], statusPropertyId: status?.id ?? 'status',
      };
    }
    const date = schema.properties.find((property) => property.type === 'date');
    return {
      id: reference.id, databaseId, type: 'calendar', title: 'Calendario', pageIds: [],
      propertyIds: date ? [date.id] : [], datePropertyId: date?.id ?? 'date',
      timezone: DEFAULT_TIMEZONE, defaultView: 'month', visibleHours: { from: 7, to: 21 },
    };
  }

  subscribe(listener: (state: WorkspaceState) => void): () => void {
    this.listeners.add(listener);
    listener(this.read());
    return () => this.listeners.delete(listener);
  }

  private readReferences(): ResourceReference[] {
    const ids = this.resourceOrder.toArray();
    const ordered = ids.map((id) => this.references.get(id)).filter((value): value is string => Boolean(value));
    const unordered = [...this.references.entries()].filter(([id]) => !ids.includes(id)).map(([, value]) => value);
    return [...ordered, ...unordered].flatMap((value) => {
      const parsed = safeJson<Partial<ResourceReference>>(value);
      if (!parsed?.id || !parsed.type) return [];
      return [{ id: parsed.id, type: parsed.type, databaseId: parsed.databaseId ?? '' }];
    });
  }

  private readDatabaseReferences(): DatabaseReference[] {
    const ids = this.databaseOrder.toArray();
    const ordered = ids.map((id) => this.databaseReferences.get(id)).filter((value): value is string => Boolean(value));
    const unordered = [...this.databaseReferences.entries()].filter(([id]) => !ids.includes(id)).map(([, value]) => value);
    return [...ordered, ...unordered].flatMap((value) => {
      const parsed = safeJson<DatabaseReference>(value);
      return parsed?.id ? [parsed] : [];
    });
  }

  read(): WorkspaceState {
    const rooms = [...this.databaseRooms.values()];
    const schemas = rooms.map(roomSchema);
    const pages = rooms.flatMap((room) => roomPages(room, this.initialContent));
    const pageSchemas = Object.fromEntries(rooms.flatMap((room) => {
      const databaseSchema = roomSchema(room);
      return roomPageIds(room).map((pageId) => [pageId, databaseSchema]);
    }));
    const propertyIds = new Set<string>();
    const schema: NotionSchema = {
      properties: schemas.flatMap((item) => item.properties).filter((property) => {
        if (propertyIds.has(property.id)) return false;
        propertyIds.add(property.id);
        return true;
      }),
    };
    return { schema, pages, resources: this.readResources(), pageSchemas };
  }

  private readResources(): WorkspaceResource[] {
    return this.readReferences().flatMap((reference) => {
      const viewRoom = this.resourceRooms.get(reference.id);
      const databaseRoom = this.databaseRooms.get(reference.databaseId);
      if (!viewRoom || !databaseRoom) return [];
      const stored = readStoredResource(reference.id, viewRoom.resource, reference.databaseId);
      if (!stored) return [];
      const pageIds = this.orderedPageIds(databaseRoom, reference.id);
      const propertyIds = stored.propertyIds.length ? stored.propertyIds : roomSchema(databaseRoom).properties.map((property) => property.id);
      return [{ ...stored, databaseId: reference.databaseId, pageIds, propertyIds } as WorkspaceResource];
    });
  }

  private orderedPageIds(room: DatabaseRoom, viewId: string): string[] {
    const ids = roomPageIds(room);
    const baseIndex = new Map(ids.map((id, index) => [id, index * 1024]));
    return [...ids].sort((left, right) => {
      const leftRanks = room.pages.get(left)?.get('viewRanks');
      const rightRanks = room.pages.get(right)?.get('viewRanks');
      const leftRank = leftRanks instanceof YMap && typeof leftRanks.get(viewId) === 'number'
        ? leftRanks.get(viewId) as number : baseIndex.get(left) ?? 0;
      const rightRank = rightRanks instanceof YMap && typeof rightRanks.get(viewId) === 'number'
        ? rightRanks.get(viewId) as number : baseIndex.get(right) ?? 0;
      return leftRank - rightRank;
    });
  }

  private ensureDatabaseRoom(id: string, seed?: Pick<WorkspaceState, 'schema' | 'pages'>, title = id): DatabaseRoom {
    const existing = this.databaseRooms.get(id);
    if (existing) return existing;
    const document = new Doc();
    const provider = this.createProvider(ROOM_NAMES.database(id), document);
    const room: DatabaseRoom = {
      id,
      document,
      provider,
      definitions: document.getMap<string>('schema-definitions'),
      definitionOrder: document.getArray<string>('schema-order'),
      pages: document.getMap<YMap<unknown>>('pages'),
      pageOrder: document.getArray<string>('page-order'),
      onTransaction: () => this.publish(),
    };
    this.databaseRooms.set(id, room);
    if (seed && !room.definitions.size && !room.pages.size) replaceDatabase(room, seed);
    document.on('afterTransaction', room.onTransaction);
    if (!this.databaseReferences.has(id)) this.workspaceDocument.transact(() => {
      this.databaseReferences.set(id, JSON.stringify({ id, title }));
      this.databaseOrder.push([id]);
    }, 'database-reference-create');
    return room;
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

  private syncRooms(seed?: WorkspaceState): void {
    this.readDatabaseReferences().forEach((reference) => this.ensureDatabaseRoom(reference.id, undefined, reference.title));
    const schema = seed?.schema ?? this.read().schema;
    this.readReferences().forEach((reference) => {
      if (reference.databaseId) this.ensureDatabaseRoom(reference.databaseId);
      const fallback = seed?.resources?.find((resource) => resource.id === reference.id);
      const normalized = fallback ? normalizeResource(fallback, schema) : null;
      this.ensureResourceRoom(normalized ?? this.fallbackResource(reference, schema));
    });
    const activeViews = new Set(this.readReferences().map((reference) => reference.id));
    [...this.resourceRooms.keys()].forEach((id) => { if (!activeViews.has(id)) this.disposeResourceRoom(id); });
  }

  replaceAll(state: WorkspaceState): void {
    this.initialContent.clear();
    state.pages.forEach((page) => this.initialContent.set(page.id, page.content));
    [...this.resourceRooms.keys()].forEach((id) => this.disposeResourceRoom(id));
    [...this.databaseRooms.keys()].forEach((id) => this.disposeDatabaseRoom(id));
    this.workspaceDocument.transact(() => {
      this.references.clear();
      this.resourceOrder.delete(0, this.resourceOrder.length);
      this.databaseReferences.clear();
      this.databaseOrder.delete(0, this.databaseOrder.length);
    }, 'workspace-reset');
    this.initializeFresh({ schema: state.schema, pages: state.pages });
  }

  applySchema(databaseId: string, schema: NotionSchema, fallbackByPropertyId: Record<string, StoredPropertyValue> = {}): void {
    const room = this.databaseRooms.get(databaseId);
    if (!room) return;
    const previous = new Map<string, PropertyDefinition>();
    room.definitions.forEach((value, id) => {
      const parsed = safeJson<PropertyDefinition>(value);
      if (parsed) previous.set(id, parsed);
    });
    room.document.transact(() => {
      const nextIds = new Set(schema.properties.map((definition) => definition.id));
      [...room.definitions.keys()].forEach((id) => { if (!nextIds.has(id)) room.definitions.delete(id); });
      schema.properties.forEach((definition) => room.definitions.set(definition.id, JSON.stringify(definition)));
      replaceArray(room.definitionOrder, schema.properties.map((definition) => definition.id));
      room.pages.forEach((page) => {
        const properties = page.get('properties');
        if (!(properties instanceof YMap)) return;
        [...properties.keys()].forEach((id) => { if (!nextIds.has(id)) properties.delete(id); });
        schema.properties.forEach((definition) => properties.set(definition.id, convertPropertyValue(
          definition, previous.get(definition.id), properties.get(definition.id), fallbackByPropertyId[definition.id],
        )));
      });
    }, 'schema-change');
    this.resourceRooms.forEach((view, viewId) => {
      const reference = this.readReferences().find((item) => item.id === viewId);
      if (reference?.databaseId !== databaseId) return;
      const propertyIds = view.resource.get('propertyIds');
      if (propertyIds instanceof YArray) view.document.transact(() => {
        replaceArray(propertyIds, propertyIds.toArray().filter((id) => schema.properties.some((property) => property.id === id)) as string[]);
      }, 'view-schema-change');
    });
  }

  applyPageSchema(pageId: string, schema: NotionSchema, fallbackByPropertyId: Record<string, StoredPropertyValue> = {}): void {
    const source = this.findPageRoom(pageId);
    const sourceMap = source?.pages.get(pageId);
    if (!source || !sourceMap) return;
    if (source.id !== 'standalone') {
      this.applySchema(source.id, schema, fallbackByPropertyId);
      return;
    }

    const databaseId = 'page-properties-' + pageId;
    const page = readPage(pageId, sourceMap, this.initialContent.get(pageId) ?? null);
    page.properties = Object.fromEntries(schema.properties.map((definition) => [
      definition.id,
      page.properties[definition.id] ?? fallbackByPropertyId[definition.id] ?? emptyValueFor(definition),
    ]));
    const target = this.ensureDatabaseRoom(databaseId, { schema, pages: [] }, page.title || 'Propriedades da pagina');
    target.document.transact(() => {
      target.pages.set(pageId, createPageMap(page));
      if (!target.pageOrder.toArray().includes(pageId)) target.pageOrder.push([pageId]);
    }, 'page-properties-create');
    source.document.transact(() => {
      source.pages.delete(pageId);
      const index = source.pageOrder.toArray().indexOf(pageId);
      if (index >= 0) source.pageOrder.delete(index, 1);
    }, 'page-properties-detach-standalone');
  }

  insertPage(page: NotionPageData, afterPageId?: string, databaseId = 'standalone'): void {
    this.initialContent.set(page.id, page.content);
    const room = this.ensureDatabaseRoom(databaseId, { schema: { properties: [] }, pages: [] }, databaseId === 'standalone' ? 'Paginas independentes' : databaseId);
    room.document.transact(() => {
      room.pages.set(page.id, createPageMap(page));
      const ids = room.pageOrder.toArray();
      const afterIndex = afterPageId ? ids.indexOf(afterPageId) : -1;
      room.pageOrder.insert(afterIndex >= 0 ? afterIndex + 1 : ids.length, [page.id]);
    }, 'page-create');
  }

  createResource(resource: WorkspaceResource, definitions: PropertyDefinition[] = []): void {
    const database = this.ensureDatabaseRoom(resource.databaseId, { schema: { properties: definitions }, pages: [] }, resource.title);
    if (definitions.length && database.definitions.size) database.document.transact(() => {
      definitions.forEach((definition) => {
        if (!database.definitions.has(definition.id)) {
          database.definitions.set(definition.id, JSON.stringify(definition));
          database.definitionOrder.push([definition.id]);
        }
      });
    }, 'resource-schema-create');
    this.ensureResourceRoom(resource);
    this.workspaceDocument.transact(() => {
      this.references.set(resource.id, JSON.stringify({
        id: resource.id, type: resource.type, databaseId: resource.databaseId,
      }));
      if (!this.resourceOrder.toArray().includes(resource.id)) this.resourceOrder.push([resource.id]);
    }, 'resource-create');
  }

  linkPage(resourceId: string, pageId: string): void {
    const resource = this.readResources().find((item) => item.id === resourceId);
    if (!resource || resource.pageIds.includes(pageId)) return;
    const source = this.findPageRoom(pageId);
    const target = this.databaseRooms.get(resource.databaseId);
    const sourceMap = source?.pages.get(pageId);
    if (!source || !target || !sourceMap) return;
    const sourcePage = readPage(pageId, sourceMap, this.initialContent.get(pageId) ?? null);
    const targetSchema = roomSchema(target);
    sourcePage.properties = Object.fromEntries(targetSchema.properties.map((definition) => [
      definition.id, sourcePage.properties[definition.id] ?? emptyValueFor(definition),
    ]));
    target.document.transact(() => {
      target.pages.set(pageId, createPageMap(sourcePage));
      if (!target.pageOrder.toArray().includes(pageId)) target.pageOrder.push([pageId]);
    }, 'page-move-target');
    source.document.transact(() => {
      source.pages.delete(pageId);
      const index = source.pageOrder.toArray().indexOf(pageId);
      if (index >= 0) source.pageOrder.delete(index, 1);
    }, 'page-move-source');
  }

  unlinkPage(resourceId: string, pageId: string): void {
    const resource = this.readResources().find((item) => item.id === resourceId);
    if (!resource?.pageIds.includes(pageId)) return;
    const source = this.databaseRooms.get(resource.databaseId);
    const sourceMap = source?.pages.get(pageId);
    if (!source || !sourceMap) return;
    const page = readPage(pageId, sourceMap, this.initialContent.get(pageId) ?? null);
    const databaseId = 'page-properties-' + pageId;
    const target = this.ensureDatabaseRoom(databaseId, { schema: roomSchema(source), pages: [] }, page.title || 'Propriedades da pagina');
    target.document.transact(() => {
      target.pages.set(pageId, createPageMap(page));
      if (!target.pageOrder.toArray().includes(pageId)) target.pageOrder.push([pageId]);
    }, 'page-unlink-target');
    source.document.transact(() => {
      source.pages.delete(pageId);
      const index = source.pageOrder.toArray().indexOf(pageId);
      if (index >= 0) source.pageOrder.delete(index, 1);
    }, 'page-unlink-source');
  }

  updateResource(resourceId: string, patch: Partial<WorkspaceResource>): void {
    const room = this.resourceRooms.get(resourceId);
    if (!room) return;
    room.document.transact(() => {
      Object.entries(patch).forEach(([key, value]) => {
        if (key === 'id' || key === 'type' || key === 'pageIds' || value === undefined) return;
        const current = room.resource.get(key);
        if (key === 'propertyIds' && current instanceof YArray && Array.isArray(value)) replaceArray(current, value as string[]);
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
    const reference = this.readReferences().find((item) => item.id === resourceId);
    const room = reference ? this.databaseRooms.get(reference.databaseId) : null;
    if (!room) return;
    room.document.transact(() => this.writePageRank(room, resourceId, pageId, overPageId), 'resource-reorder-page');
  }

  moveBoardPage(resourceId: string, pageId: string, propertyId: string, statusId: StoredPropertyValue, beforePageId?: string): void {
    const reference = this.readReferences().find((item) => item.id === resourceId);
    const room = reference ? this.databaseRooms.get(reference.databaseId) : null;
    const page = room?.pages.get(pageId);
    const properties = page?.get('properties');
    if (!room || !(page instanceof YMap) || !(properties instanceof YMap)) return;
    room.document.transact(() => {
      properties.set(propertyId, statusId);
      page.set('lastEditedTime', new Date().toISOString());
      if (beforePageId && beforePageId !== pageId) this.writePageRank(room, resourceId, pageId, beforePageId);
    }, 'board-card-move');
  }

  private writePageRank(room: DatabaseRoom, viewId: string, pageId: string, beforePageId: string): void {
    const ids = this.orderedPageIds(room, viewId).filter((id) => id !== pageId);
    const target = ids.indexOf(beforePageId);
    if (target < 0) return;
    ids.splice(target, 0, pageId);
    const index = ids.indexOf(pageId);
    const effective = (id: string, fallbackIndex: number) => {
      const ranks = room.pages.get(id)?.get('viewRanks');
      const rank = ranks instanceof YMap ? ranks.get(viewId) : undefined;
      return typeof rank === 'number' ? rank : fallbackIndex * 1024;
    };
    const previous = index > 0 ? effective(ids[index - 1], index - 1) : -1024;
    const next = index < ids.length - 1 ? effective(ids[index + 1], index + 1) : previous + 2048;
    if (Math.abs(next - previous) < 0.000001) {
      ids.forEach((id, order) => this.setRank(room.pages.get(id), viewId, order * 1024));
    } else this.setRank(room.pages.get(pageId), viewId, (previous + next) / 2);
  }

  private setRank(page: YMap<unknown> | undefined, viewId: string, rank: number): void {
    if (!page) return;
    const current = page.get('viewRanks');
    const ranks = current instanceof YMap ? current as YMap<number> : new YMap<number>();
    if (!(current instanceof YMap)) page.set('viewRanks', ranks);
    ranks.set(viewId, rank);
  }

  deletePage(pageId: string): void {
    this.initialContent.delete(pageId);
    const room = this.findPageRoom(pageId);
    if (!room) return;
    room.document.transact(() => {
      room.pages.delete(pageId);
      const index = room.pageOrder.toArray().indexOf(pageId);
      if (index >= 0) room.pageOrder.delete(index, 1);
    }, 'page-delete');
  }

  updatePage(id: string, patch: Partial<NotionPageData>): void {
    if (patch.content !== undefined) this.updatePageContent(id, patch.content);
    const room = this.findPageRoom(id);
    const map = room?.pages.get(id);
    if (!room || !map) return;
    room.document.transact(() => {
      writePageFields(map, patch);
      if (patch.properties) {
        const properties = map.get('properties');
        if (properties instanceof YMap) Object.entries(patch.properties).forEach(([key, value]) => properties.set(key, value));
      }
    }, 'page-change');
  }

  updatePageContent(id: string, content: SerializedEditorState | null): void {
    this.initialContent.set(id, content);
    const existing = this.contentTimers.get(id);
    if (existing) clearTimeout(existing);
    this.contentTimers.set(id, setTimeout(() => {
      this.contentTimers.delete(id);
      const room = this.findPageRoom(id);
      const page = room?.pages.get(id);
      if (!room || !page) { this.publish(); return; }
      const preview = getPlainTextPreview(content, 240);
      const now = new Date().toISOString();
      const edited = roomSchema(room).properties.find((definition) => definition.type === 'last_edited_time');
      room.document.transact(() => {
        page.set('contentPreview', preview);
        page.set('lastEditedTime', now);
        const properties = page.get('properties');
        if (edited && properties instanceof YMap) properties.set(edited.id, now);
      }, 'page-content-change');
    }, 250));
  }

  updateProperty(pageId: string, propertyId: string, value: StoredPropertyValue): void {
    const room = this.findPageRoom(pageId);
    const page = room?.pages.get(pageId);
    const properties = page?.get('properties');
    if (!room || !(page instanceof YMap) || !(properties instanceof YMap)) return;
    room.document.transact(() => {
      if (!valuesEqual(properties.get(propertyId), value)) properties.set(propertyId, value);
      page.set('lastEditedTime', new Date().toISOString());
    }, 'property-change');
  }

  private findPageRoom(pageId: string): DatabaseRoom | undefined {
    return [...this.databaseRooms.values()].find((room) => room.pages.has(pageId));
  }

  private disposeResourceRoom(id: string): void {
    const room = this.resourceRooms.get(id);
    if (!room) return;
    room.document.off('afterTransaction', room.onTransaction);
    room.provider.destroy();
    room.document.destroy();
    this.resourceRooms.delete(id);
  }

  private disposeDatabaseRoom(id: string): void {
    const room = this.databaseRooms.get(id);
    if (!room) return;
    room.document.off('afterTransaction', room.onTransaction);
    room.provider.destroy();
    room.document.destroy();
    this.databaseRooms.delete(id);
  }

  destroy(): void {
    this.contentTimers.forEach((timer) => clearTimeout(timer));
    [...this.resourceRooms.keys()].forEach((id) => this.disposeResourceRoom(id));
    [...this.databaseRooms.keys()].forEach((id) => this.disposeDatabaseRoom(id));
    this.workspaceDocument.off('afterTransaction', this.handleWorkspaceTransaction);
    this.workspaceProvider.destroy();
    this.workspaceDocument.destroy();
    this.listeners.clear();
  }
}
