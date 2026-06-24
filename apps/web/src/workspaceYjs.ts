import { Array as YArray, Doc, Map as YMap } from 'yjs';
import type { SerializedEditorState } from 'lexical';
import type { NotionPageData, NotionSchema, PropertyDefinition, StoredPropertyValue } from '../notion-page/types';
import { getPlainTextPreview } from '../notion-page/editor/getPlainTextPreview';
import {
  DEFAULT_TIMEZONE, convertPropertyValue, emptyValueFor, type BoardResource,
  type CalendarResource, type DatabaseContainer, type DataSourceReference,
  type PageOwnership, type WorkspaceResource,
} from './domain';
import { ROOM_NAMES } from './yjs/model';

export interface WorkspaceSeed {
  schema: NotionSchema;
  pages: NotionPageData[];
  resources?: WorkspaceResource[];
}

export interface WorkspaceState {
  pages: NotionPageData[];
  resources?: WorkspaceResource[];
  databases?: DatabaseContainer[];
  dataSources?: DataSourceReference[];
  ownership?: Record<string, PageOwnership>;
  /** Schema resolved from the owning data source for each page. */
  pageSchemas?: Record<string, NotionSchema>;
  dataSourceSchemas?: Record<string, NotionSchema>;
}

export interface RoomProvider { destroy(): void; }
export type RoomProviderFactory = (room: string, document: Doc) => RoomProvider;

type ResourceInput = {
  id: string; databaseId?: string; dataSourceId?: string; type: 'board' | 'calendar'; title: string; pageIds: string[]; propertyIds?: string[];
  statusPropertyId?: string; datePropertyId?: string; timezone?: string;
  defaultView?: CalendarResource['defaultView']; visibleHours?: CalendarResource['visibleHours'];
};

interface ResourceReference {
  id: string;
  type: WorkspaceResource['type'];
  databaseId: string;
  dataSourceId: string;
}

interface DataSourceRoom {
  id: string;
  document: Doc;
  provider: RoomProvider;
  definitions: YMap<string>;
  definitionOrder: YArray<string>;
  pages: YMap<YMap<unknown>>;
  pageOrder: YArray<string>;
  onTransaction: () => void;
}

interface DatabaseContainerRoom {
  id: string;
  document: Doc;
  provider: RoomProvider;
  metadata: YMap<unknown>;
  dataSourceIds: YArray<string>;
  viewIds: YArray<string>;
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
    id: 'board-roadmap', databaseId: 'roadmap', dataSourceId: 'roadmap', type: 'board', title: 'Roadmap de produto',
    pageIds: pages.map((page) => page.id), propertyIds, statusPropertyId: status.id,
  });
  if (date) resources.push({
    id: 'calendar-product', databaseId: 'roadmap', dataSourceId: 'roadmap', type: 'calendar', title: 'Calendario de produto',
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
  const dataSourceId = resource.dataSourceId ?? databaseId;
  if (resource.type === 'board') {
    const statusPropertyId = resource.statusPropertyId ?? schema.properties.find((property) => property.type === 'status')?.id;
    return statusPropertyId ? { ...resource, databaseId, dataSourceId, type: 'board', propertyIds, statusPropertyId } as BoardResource : null;
  }
  const datePropertyId = resource.datePropertyId ?? schema.properties.find((property) => property.type === 'date')?.id;
  if (!datePropertyId) return null;
  return {
    ...resource, databaseId, dataSourceId, type: 'calendar', propertyIds, datePropertyId,
    timezone: resource.timezone ?? DEFAULT_TIMEZONE,
    defaultView: resource.defaultView ?? 'month',
    visibleHours: resource.visibleHours ?? { from: 7, to: 21 },
  } as CalendarResource;
}

function writeResource(map: YMap<unknown>, resource: WorkspaceResource): void {
  map.set('type', resource.type);
  map.set('databaseId', resource.databaseId);
  map.set('dataSourceId', resource.dataSourceId);
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

function readStoredResource(id: string, map: YMap<unknown>, databaseId: string, dataSourceId = databaseId): WorkspaceResource | null {
  const type = map.get('type');
  const storedPages = map.get('pageIds');
  const storedProperties = map.get('propertyIds');
  const base = {
    id,
    databaseId: String(map.get('databaseId') ?? databaseId),
    dataSourceId: String(map.get('dataSourceId') ?? dataSourceId),
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

function roomSchema(room: DataSourceRoom): NotionSchema {
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

function physicalPageIds(room: DataSourceRoom): string[] {
  const ids = room.pageOrder.toArray();
  return [...ids.filter((id) => room.pages.has(id)), ...[...room.pages.keys()].filter((id) => !ids.includes(id))];
}

function roomPages(room: DataSourceRoom, pageIds: string[], content: Map<string, SerializedEditorState | null>): NotionPageData[] {
  return pageIds.flatMap((id) => {
    const map = room.pages.get(id);
    return map ? [readPage(id, map, content.get(id) ?? null)] : [];
  });
}

function replaceDataSource(room: DataSourceRoom, state: Pick<WorkspaceSeed, 'schema' | 'pages'>): void {
  room.document.transact(() => {
    room.definitions.clear();
    state.schema.properties.forEach((definition) => room.definitions.set(definition.id, JSON.stringify(definition)));
    replaceArray(room.definitionOrder, state.schema.properties.map((definition) => definition.id));
    room.pages.clear();
    state.pages.forEach((page) => room.pages.set(page.id, createPageMap(page)));
    replaceArray(room.pageOrder, state.pages.map((page) => page.id));
  }, 'data-source-replace');
}

/** Coordinates containers, data sources, ownership, views and independent page content documents. */
export class WorkspaceYjsStore {
  private readonly workspaceDocument = new Doc();
  private readonly workspaceProvider: RoomProvider;
  private readonly references = this.workspaceDocument.getMap<string>('resource-references');
  private readonly resourceOrder = this.workspaceDocument.getArray<string>('resource-order');
  private readonly databaseReferences = this.workspaceDocument.getMap<string>('database-references');
  private readonly databaseOrder = this.workspaceDocument.getArray<string>('database-order');
  private readonly dataSourceReferences = this.workspaceDocument.getMap<string>('data-source-references');
  private readonly dataSourceOrder = this.workspaceDocument.getArray<string>('data-source-order');
  private readonly pageOwnership = this.workspaceDocument.getMap<string>('page-ownership');
  private readonly migrations = this.workspaceDocument.getMap<string>('migrations');
  private readonly databaseRooms = new Map<string, DatabaseContainerRoom>();
  private readonly dataSourceRooms = new Map<string, DataSourceRoom>();
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

  initialize(seed: WorkspaceSeed): void {
    seed.pages.forEach((page) => this.initialContent.set(page.id, page.content));
    if (!this.references.size) this.initializeFresh(seed);
    else if (!this.databaseReferences.size || this.readReferences().some((reference) => !reference.databaseId)) this.migrateLegacy(seed);
    else if (!this.dataSourceReferences.size || !this.migrations.has('database-v2-to-datasource-v1')) this.migrateVersionedDataSources(seed);
    else {
      this.syncRooms(seed);
      this.publish();
    }
  }

  private initializeFresh(seed: WorkspaceSeed): void {
    const migrated = seed.resources?.map((resource) => normalizeResource(resource, seed.schema))
      .filter((resource): resource is WorkspaceResource => Boolean(resource)) ?? [];
    const resources = migrated.length ? migrated : defaultResources(seed.schema, seed.pages);
    this.seedDataSources(resources, seed);
    resources.forEach((resource) => this.ensureResourceRoom(resource));
    this.workspaceDocument.transact(() => {
      resources.forEach((resource) => this.references.set(resource.id, JSON.stringify({
        id: resource.id, type: resource.type, databaseId: resource.databaseId, dataSourceId: resource.dataSourceId,
      })));
      replaceArray(this.resourceOrder, resources.map((resource) => resource.id));
      this.migrations.set('database-v2-to-datasource-v1', new Date().toISOString());
    }, 'workspace-seed');
    this.publish();
  }

  private migrateLegacy(seed: WorkspaceSeed): void {
    const legacyDocument = new Doc();
    const legacyProvider = this.createProvider(ROOM_NAMES.legacyDatabase, legacyDocument);
    const legacyRoom: DataSourceRoom = {
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
      ? { schema: roomSchema(legacyRoom), pages: roomPages(legacyRoom, physicalPageIds(legacyRoom), this.initialContent) }
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
        dataSourceId: reference.dataSourceId || reference.databaseId || inferredDatabaseId(reference),
      } as WorkspaceResource;
      const room = this.ensureResourceRoom(fallback);
      const databaseId = reference.databaseId || inferredDatabaseId(reference);
      const dataSourceId = reference.dataSourceId || databaseId;
      const stored = readStoredResource(reference.id, room.resource, databaseId, dataSourceId);
      return stored ? [{ ...stored, databaseId, dataSourceId } as WorkspaceResource] : [];
    });

    this.seedDataSources(resources, legacyState);
    const referencedPages = new Set(resources.flatMap((resource) => resource.pageIds));
    const standalonePages = legacyState.pages.filter((page) => !referencedPages.has(page.id));
    if (standalonePages.length) this.ensureDataSourceRoom('standalone', { schema: { properties: [] }, pages: standalonePages }, 'standalone', 'Paginas independentes');

    resources.forEach((resource) => {
      const room = this.resourceRooms.get(resource.id);
      room?.document.transact(() => writeResource(room.resource, resource), 'view-v2-migration');
    });
    this.workspaceDocument.transact(() => {
      resources.forEach((resource) => this.references.set(resource.id, JSON.stringify({
        id: resource.id, type: resource.type, databaseId: resource.databaseId, dataSourceId: resource.dataSourceId,
      })));
      replaceArray(this.resourceOrder, resources.map((resource) => resource.id));
    }, 'workspace-v2-migration');
    legacyProvider.destroy();
    legacyDocument.destroy();
    this.migrations.set('legacy-to-datasource-v1', new Date().toISOString());
    this.migrations.set('database-v2-to-datasource-v1', new Date().toISOString());
    this.publish();
  }

  private migrateVersionedDataSources(seed: WorkspaceSeed): void {
    const seedResources = seed.resources?.map((resource) => normalizeResource(resource, seed.schema))
      .filter((resource): resource is WorkspaceResource => Boolean(resource)) ?? [];
    const references = this.readDatabaseReferences();

    references.forEach((reference) => {
      const legacyDocument = new Doc();
      const legacyProvider = this.createProvider(ROOM_NAMES.legacyDataSource(reference.id), legacyDocument);
      const legacyRoom: DataSourceRoom = {
        id: reference.id,
        document: legacyDocument,
        provider: legacyProvider,
        definitions: legacyDocument.getMap<string>('schema-definitions'),
        definitionOrder: legacyDocument.getArray<string>('schema-order'),
        pages: legacyDocument.getMap<YMap<unknown>>('pages'),
        pageOrder: legacyDocument.getArray<string>('page-order'),
        onTransaction: () => undefined,
      };
      const relatedViews = seedResources.filter((resource) => resource.dataSourceId === reference.id || resource.databaseId === reference.id);
      const relatedPageIds = new Set(relatedViews.flatMap((resource) => resource.pageIds));
      const relatedPropertyIds = new Set(relatedViews.flatMap((resource) => resource.propertyIds));
      const fallback = {
        schema: {
          properties: seed.schema.properties.filter((property) => !relatedPropertyIds.size || relatedPropertyIds.has(property.id)),
        },
        pages: seed.pages.filter((item) => !relatedPageIds.size || relatedPageIds.has(item.id)),
      };
      const source = legacyRoom.definitions.size || legacyRoom.pages.size
        ? { schema: roomSchema(legacyRoom), pages: roomPages(legacyRoom, physicalPageIds(legacyRoom), this.initialContent) }
        : fallback;
      this.ensureDataSourceRoom(reference.id, source, reference.id, reference.title);
      legacyProvider.destroy();
      legacyDocument.destroy();
    });

    this.workspaceDocument.transact(() => {
      this.readReferences().forEach((reference) => {
        const dataSourceId = reference.dataSourceId || reference.databaseId;
        this.references.set(reference.id, JSON.stringify({ ...reference, dataSourceId }));
        const container = this.databaseRooms.get(reference.databaseId);
        if (container && !container.viewIds.toArray().includes(reference.id)) container.viewIds.push([reference.id]);
        const view = this.resourceRooms.get(reference.id);
        if (view && !view.resource.has('dataSourceId')) view.resource.set('dataSourceId', dataSourceId);
      });
      this.migrations.set('database-v2-to-datasource-v1', new Date().toISOString());
    }, 'database-v2-to-datasource-v1');
    this.syncRooms(seed);
    this.publish();
  }

  private seedDataSources(resources: WorkspaceResource[], state: Pick<WorkspaceSeed, 'schema' | 'pages'>): void {
    const groups = new Map<string, WorkspaceResource[]>();
    resources.forEach((resource) => groups.set(resource.dataSourceId, [...(groups.get(resource.dataSourceId) ?? []), resource]));
    groups.forEach((views, dataSourceId) => {
      const pageIds = new Set(views.flatMap((view) => view.pageIds));
      const propertyIds = new Set(views.flatMap((view) => view.propertyIds));
      const pages = state.pages.filter((page) => pageIds.has(page.id));
      const properties = state.schema.properties.filter((property) => propertyIds.has(property.id));
      const owner = views[0];
      this.ensureDataSourceRoom(dataSourceId, { schema: { properties }, pages }, owner?.databaseId ?? dataSourceId, owner?.title ?? dataSourceId);
    });
    const referencedPages = new Set(resources.flatMap((resource) => resource.pageIds));
    const standalone = state.pages.filter((page) => !referencedPages.has(page.id));
    if (standalone.length) this.ensureDataSourceRoom('standalone', { schema: { properties: [] }, pages: standalone }, 'standalone', 'Paginas independentes');
  }

  private fallbackResource(reference: ResourceReference, schema: NotionSchema): WorkspaceResource {
    const databaseId = reference.databaseId || inferredDatabaseId(reference);
    const dataSourceId = reference.dataSourceId || databaseId;
    if (reference.type === 'board') {
      const status = schema.properties.find((property) => property.type === 'status');
      return {
        id: reference.id, databaseId, dataSourceId, type: 'board', title: 'Board', pageIds: [],
        propertyIds: status ? [status.id] : [], statusPropertyId: status?.id ?? 'status',
      };
    }
    const date = schema.properties.find((property) => property.type === 'date');
    return {
      id: reference.id, databaseId, dataSourceId, type: 'calendar', title: 'Calendario', pageIds: [],
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
      const databaseId = parsed.databaseId ?? '';
      return [{ id: parsed.id, type: parsed.type, databaseId, dataSourceId: parsed.dataSourceId ?? databaseId }];
    });
  }

  private readDatabaseReferences(): Array<Pick<DatabaseContainer, 'id' | 'title'>> {
    const ids = this.databaseOrder.toArray();
    const ordered = ids.map((id) => this.databaseReferences.get(id)).filter((value): value is string => Boolean(value));
    const unordered = [...this.databaseReferences.entries()].filter(([id]) => !ids.includes(id)).map(([, value]) => value);
    return [...ordered, ...unordered].flatMap((value) => {
      const parsed = safeJson<Pick<DatabaseContainer, 'id' | 'title'>>(value);
      return parsed?.id ? [parsed] : [];
    });
  }

  private readDataSourceReferences(): DataSourceReference[] {
    const ids = this.dataSourceOrder.toArray();
    const ordered = ids.map((id) => this.dataSourceReferences.get(id)).filter((value): value is string => Boolean(value));
    const unordered = [...this.dataSourceReferences.entries()].filter(([id]) => !ids.includes(id)).map(([, value]) => value);
    return [...ordered, ...unordered].flatMap((value) => {
      const parsed = safeJson<DataSourceReference>(value);
      return parsed?.id && parsed.databaseId ? [parsed] : [];
    });
  }

  private readOwnership(pageId: string): PageOwnership | null {
    return safeJson<PageOwnership>(this.pageOwnership.get(pageId));
  }

  private ownedPageIds(room: DataSourceRoom): string[] {
    return physicalPageIds(room).filter((pageId) => this.readOwnership(pageId)?.dataSourceId === room.id);
  }

  private setOwnership(pageId: string, dataSourceId: string): void {
    const current = this.readOwnership(pageId);
    if (current?.dataSourceId === dataSourceId) return;
    this.pageOwnership.set(pageId, JSON.stringify({
      pageId,
      dataSourceId,
      version: (current?.version ?? 0) + 1,
    } satisfies PageOwnership));
  }

  read(): WorkspaceState {
    const rooms = [...this.dataSourceRooms.values()];
    const pages = rooms.flatMap((room) => roomPages(room, this.ownedPageIds(room), this.initialContent));
    const pageSchemas = Object.fromEntries(rooms.flatMap((room) => {
      const dataSourceSchema = roomSchema(room);
      return this.ownedPageIds(room).map((pageId) => [pageId, dataSourceSchema]);
    }));
    const dataSourceSchemas = Object.fromEntries(rooms.map((room) => [room.id, roomSchema(room)]));
    const ownership = Object.fromEntries([...this.pageOwnership.entries()].flatMap(([pageId, value]) => {
      const parsed = safeJson<PageOwnership>(value);
      return parsed ? [[pageId, parsed]] : [];
    }));
    const databases = this.readDatabaseReferences().map((reference) => {
      const room = this.databaseRooms.get(reference.id);
      return {
        ...reference,
        dataSourceIds: room?.dataSourceIds.toArray() ?? [],
        viewIds: room?.viewIds.toArray() ?? [],
      };
    });
    return {
      pages, resources: this.readResources(), pageSchemas, dataSourceSchemas,
      databases, dataSources: this.readDataSourceReferences(), ownership,
    };
  }

  private readResources(): WorkspaceResource[] {
    return this.readReferences().flatMap((reference) => {
      const viewRoom = this.resourceRooms.get(reference.id);
      const dataSourceRoom = this.dataSourceRooms.get(reference.dataSourceId);
      if (!viewRoom || !dataSourceRoom) return [];
      const stored = readStoredResource(reference.id, viewRoom.resource, reference.databaseId, reference.dataSourceId);
      if (!stored) return [];
      const pageIds = this.orderedPageIds(dataSourceRoom, reference.id);
      const propertyIds = stored.propertyIds.length ? stored.propertyIds : roomSchema(dataSourceRoom).properties.map((property) => property.id);
      return [{ ...stored, databaseId: reference.databaseId, dataSourceId: reference.dataSourceId, pageIds, propertyIds } as WorkspaceResource];
    });
  }

  private orderedPageIds(room: DataSourceRoom, viewId: string): string[] {
    const ids = this.ownedPageIds(room);
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

  private ensureDatabaseRoom(id: string, title = id, dataSourceId?: string, viewId?: string): DatabaseContainerRoom {
    const existing = this.databaseRooms.get(id);
    if (existing) {
      existing.document.transact(() => {
        if (dataSourceId && !existing.dataSourceIds.toArray().includes(dataSourceId)) existing.dataSourceIds.push([dataSourceId]);
        if (viewId && !existing.viewIds.toArray().includes(viewId)) existing.viewIds.push([viewId]);
      }, 'database-reference-update');
      return existing;
    }
    const document = new Doc();
    const provider = this.createProvider(ROOM_NAMES.database(id), document);
    const room: DatabaseContainerRoom = {
      id,
      document,
      provider,
      metadata: document.getMap<unknown>('database'),
      dataSourceIds: document.getArray<string>('data-source-ids'),
      viewIds: document.getArray<string>('view-ids'),
      onTransaction: () => this.publish(),
    };
    this.databaseRooms.set(id, room);
    document.transact(() => {
      if (!room.metadata.has('title')) room.metadata.set('title', title);
      if (dataSourceId && !room.dataSourceIds.toArray().includes(dataSourceId)) room.dataSourceIds.push([dataSourceId]);
      if (viewId && !room.viewIds.toArray().includes(viewId)) room.viewIds.push([viewId]);
    }, 'database-seed');
    document.on('afterTransaction', room.onTransaction);
    if (!this.databaseReferences.has(id)) this.workspaceDocument.transact(() => {
      this.databaseReferences.set(id, JSON.stringify({ id, title }));
      this.databaseOrder.push([id]);
    }, 'database-reference-create');
    return room;
  }

  private ensureDataSourceRoom(
    id: string,
    seed?: Pick<WorkspaceSeed, 'schema' | 'pages'>,
    databaseId = id,
    title = id,
  ): DataSourceRoom {
    const existing = this.dataSourceRooms.get(id);
    if (existing) return existing;
    const document = new Doc();
    const provider = this.createProvider(ROOM_NAMES.dataSource(id), document);
    const room: DataSourceRoom = {
      id,
      document,
      provider,
      definitions: document.getMap<string>('schema-definitions'),
      definitionOrder: document.getArray<string>('schema-order'),
      pages: document.getMap<YMap<unknown>>('pages'),
      pageOrder: document.getArray<string>('page-order'),
      onTransaction: () => this.publish(),
    };
    this.dataSourceRooms.set(id, room);
    if (seed && !room.definitions.size && !room.pages.size) replaceDataSource(room, seed);
    document.on('afterTransaction', room.onTransaction);
    this.ensureDatabaseRoom(databaseId, title, id);
    this.workspaceDocument.transact(() => {
      if (!this.dataSourceReferences.has(id)) {
        this.dataSourceReferences.set(id, JSON.stringify({ id, databaseId, title } satisfies DataSourceReference));
        this.dataSourceOrder.push([id]);
      }
      physicalPageIds(room).forEach((pageId) => {
        if (!this.readOwnership(pageId)) this.setOwnership(pageId, id);
      });
    }, 'data-source-reference-create');
    return room;
  }

  private ensureResourceRoom(resource: WorkspaceResource): ResourceRoom {
    const existing = this.resourceRooms.get(resource.id);
    if (existing) {
      if (!existing.resource.has('dataSourceId')) {
        existing.document.transact(() => existing.resource.set('dataSourceId', resource.dataSourceId), 'view-data-source-migration');
      }
      return existing;
    }
    const document = new Doc();
    const provider = this.createProvider(ROOM_NAMES.view(resource.id), document);
    const map = document.getMap<unknown>('resource');
    if (!map.has('type')) document.transact(() => writeResource(map, resource), 'view-seed');
    else if (!map.has('dataSourceId')) document.transact(() => map.set('dataSourceId', resource.dataSourceId), 'view-data-source-migration');
    const onTransaction = () => this.publish();
    document.on('afterTransaction', onTransaction);
    const room = { document, provider, resource: map, onTransaction };
    this.resourceRooms.set(resource.id, room);
    return room;
  }

  private syncRooms(seed?: WorkspaceSeed): void {
    this.readDatabaseReferences().forEach((reference) => this.ensureDatabaseRoom(reference.id, reference.title));
    this.readDataSourceReferences().forEach((reference) => this.ensureDataSourceRoom(
      reference.id, undefined, reference.databaseId, reference.title,
    ));
    const schema = seed?.schema ?? {
      properties: [...this.dataSourceRooms.values()].flatMap((room) => roomSchema(room).properties),
    };
    this.readReferences().forEach((reference) => {
      if (reference.databaseId) this.ensureDatabaseRoom(reference.databaseId, reference.databaseId, reference.dataSourceId, reference.id);
      if (reference.dataSourceId) this.ensureDataSourceRoom(reference.dataSourceId, undefined, reference.databaseId);
      const fallback = seed?.resources?.find((resource) => resource.id === reference.id);
      const normalized = fallback ? normalizeResource(fallback, schema) : null;
      this.ensureResourceRoom(normalized ?? this.fallbackResource(reference, schema));
    });
    const activeViews = new Set(this.readReferences().map((reference) => reference.id));
    [...this.resourceRooms.keys()].forEach((id) => { if (!activeViews.has(id)) this.disposeResourceRoom(id); });
  }

  replaceAll(state: WorkspaceSeed): void {
    this.initialContent.clear();
    state.pages.forEach((page) => this.initialContent.set(page.id, page.content));
    [...this.resourceRooms.keys()].forEach((id) => this.disposeResourceRoom(id));
    [...this.databaseRooms.keys()].forEach((id) => this.disposeDatabaseRoom(id));
    [...this.dataSourceRooms.keys()].forEach((id) => this.disposeDataSourceRoom(id));
    this.workspaceDocument.transact(() => {
      this.references.clear();
      this.resourceOrder.delete(0, this.resourceOrder.length);
      this.databaseReferences.clear();
      this.databaseOrder.delete(0, this.databaseOrder.length);
      this.dataSourceReferences.clear();
      this.dataSourceOrder.delete(0, this.dataSourceOrder.length);
      this.pageOwnership.clear();
      this.migrations.clear();
    }, 'workspace-reset');
    this.initializeFresh({ schema: state.schema, pages: state.pages });
  }

  applySchema(dataSourceId: string, schema: NotionSchema, fallbackByPropertyId: Record<string, StoredPropertyValue> = {}): void {
    const room = this.dataSourceRooms.get(dataSourceId);
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
        const storedArchive = page.get('archivedProperties');
        const archived = storedArchive instanceof YMap
          ? storedArchive as YMap<StoredPropertyValue>
          : new YMap<StoredPropertyValue>();
        if (!(storedArchive instanceof YMap)) page.set('archivedProperties', archived);
        [...properties.keys()].forEach((id) => {
          if (nextIds.has(id)) return;
          archived.set(id, properties.get(id));
          properties.delete(id);
        });
        schema.properties.forEach((definition) => {
          const restored = !previous.has(definition.id) && archived.has(definition.id)
            ? archived.get(definition.id)
            : properties.get(definition.id);
          const nextValue = previous.has(definition.id)
            ? convertPropertyValue(definition, previous.get(definition.id), restored, fallbackByPropertyId[definition.id])
            : restored ?? fallbackByPropertyId[definition.id] ?? emptyValueFor(definition);
          properties.set(definition.id, nextValue);
          archived.delete(definition.id);
        });
      });
    }, 'schema-change');
    this.resourceRooms.forEach((view, viewId) => {
      const reference = this.readReferences().find((item) => item.id === viewId);
      if (reference?.dataSourceId !== dataSourceId) return;
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
    const dataSourceId = databaseId;
    const page = readPage(pageId, sourceMap, this.initialContent.get(pageId) ?? null);
    page.properties = Object.fromEntries(schema.properties.map((definition) => [
      definition.id,
      page.properties[definition.id] ?? fallbackByPropertyId[definition.id] ?? emptyValueFor(definition),
    ]));
    const target = this.ensureDataSourceRoom(dataSourceId, { schema, pages: [] }, databaseId, page.title || 'Propriedades da pagina');
    target.document.transact(() => {
      target.pages.set(pageId, createPageMap(page));
      if (!target.pageOrder.toArray().includes(pageId)) target.pageOrder.push([pageId]);
    }, 'page-properties-create');
    this.workspaceDocument.transact(() => this.setOwnership(pageId, dataSourceId), 'page-properties-ownership-commit');
    source.document.transact(() => {
      source.pages.delete(pageId);
      const index = source.pageOrder.toArray().indexOf(pageId);
      if (index >= 0) source.pageOrder.delete(index, 1);
    }, 'page-properties-detach-standalone');
  }

  insertPage(page: NotionPageData, afterPageId?: string, dataSourceId = 'standalone'): void {
    this.initialContent.set(page.id, page.content);
    const reference = this.readDataSourceReferences().find((item) => item.id === dataSourceId);
    const databaseId = reference?.databaseId ?? dataSourceId;
    const room = this.ensureDataSourceRoom(
      dataSourceId,
      { schema: { properties: [] }, pages: [] },
      databaseId,
      dataSourceId === 'standalone' ? 'Paginas independentes' : dataSourceId,
    );
    room.document.transact(() => {
      room.pages.set(page.id, createPageMap(page));
      const ids = room.pageOrder.toArray();
      const afterIndex = afterPageId ? ids.indexOf(afterPageId) : -1;
      room.pageOrder.insert(afterIndex >= 0 ? afterIndex + 1 : ids.length, [page.id]);
    }, 'page-create');
    this.workspaceDocument.transact(() => this.setOwnership(page.id, dataSourceId), 'page-create-ownership');
  }

  createResource(resource: WorkspaceResource, definitions: PropertyDefinition[] = []): void {
    const dataSource = this.ensureDataSourceRoom(
      resource.dataSourceId,
      { schema: { properties: definitions }, pages: [] },
      resource.databaseId,
      resource.title,
    );
    this.ensureDatabaseRoom(resource.databaseId, resource.title, resource.dataSourceId, resource.id);
    if (definitions.length && dataSource.definitions.size) dataSource.document.transact(() => {
      definitions.forEach((definition) => {
        if (!dataSource.definitions.has(definition.id)) {
          dataSource.definitions.set(definition.id, JSON.stringify(definition));
          dataSource.definitionOrder.push([definition.id]);
        }
      });
    }, 'resource-schema-create');
    this.ensureResourceRoom(resource);
    this.workspaceDocument.transact(() => {
      this.references.set(resource.id, JSON.stringify({
        id: resource.id, type: resource.type, databaseId: resource.databaseId, dataSourceId: resource.dataSourceId,
      }));
      if (!this.resourceOrder.toArray().includes(resource.id)) this.resourceOrder.push([resource.id]);
    }, 'resource-create');
  }

  linkPage(resourceId: string, pageId: string): void {
    const resource = this.readResources().find((item) => item.id === resourceId);
    if (!resource || resource.pageIds.includes(pageId)) return;
    const source = this.findPageRoom(pageId);
    const target = this.dataSourceRooms.get(resource.dataSourceId);
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
    this.workspaceDocument.transact(() => this.setOwnership(pageId, target.id), 'page-move-ownership-commit');
    source.document.transact(() => {
      source.pages.delete(pageId);
      const index = source.pageOrder.toArray().indexOf(pageId);
      if (index >= 0) source.pageOrder.delete(index, 1);
    }, 'page-move-source');
  }

  unlinkPage(resourceId: string, pageId: string): void {
    const resource = this.readResources().find((item) => item.id === resourceId);
    if (!resource?.pageIds.includes(pageId)) return;
    const source = this.dataSourceRooms.get(resource.dataSourceId);
    const sourceMap = source?.pages.get(pageId);
    if (!source || !sourceMap) return;
    const page = readPage(pageId, sourceMap, this.initialContent.get(pageId) ?? null);
    const databaseId = 'page-properties-' + pageId;
    const dataSourceId = databaseId;
    const target = this.ensureDataSourceRoom(dataSourceId, { schema: roomSchema(source), pages: [] }, databaseId, page.title || 'Propriedades da pagina');
    target.document.transact(() => {
      target.pages.set(pageId, createPageMap(page));
      if (!target.pageOrder.toArray().includes(pageId)) target.pageOrder.push([pageId]);
    }, 'page-unlink-target');
    this.workspaceDocument.transact(() => this.setOwnership(pageId, dataSourceId), 'page-unlink-ownership-commit');
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
    const room = reference ? this.dataSourceRooms.get(reference.dataSourceId) : null;
    if (!room) return;
    room.document.transact(() => this.writePageRank(room, resourceId, pageId, overPageId), 'resource-reorder-page');
  }

  moveBoardPage(resourceId: string, pageId: string, propertyId: string, statusId: StoredPropertyValue, beforePageId?: string): void {
    const reference = this.readReferences().find((item) => item.id === resourceId);
    const room = reference ? this.dataSourceRooms.get(reference.dataSourceId) : null;
    const page = room?.pages.get(pageId);
    const properties = page?.get('properties');
    if (!room || !(page instanceof YMap) || !(properties instanceof YMap)) return;
    room.document.transact(() => {
      properties.set(propertyId, statusId);
      page.set('lastEditedTime', new Date().toISOString());
      if (beforePageId && beforePageId !== pageId) this.writePageRank(room, resourceId, pageId, beforePageId);
    }, 'board-card-move');
  }

  private writePageRank(room: DataSourceRoom, viewId: string, pageId: string, beforePageId: string): void {
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
    this.workspaceDocument.transact(() => this.pageOwnership.delete(pageId), 'page-delete-ownership');
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

  private findPageRoom(pageId: string): DataSourceRoom | undefined {
    const ownership = this.readOwnership(pageId);
    if (!ownership) return undefined;
    const room = this.dataSourceRooms.get(ownership.dataSourceId);
    return room?.pages.has(pageId) ? room : undefined;
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

  private disposeDataSourceRoom(id: string): void {
    const room = this.dataSourceRooms.get(id);
    if (!room) return;
    room.document.off('afterTransaction', room.onTransaction);
    room.provider.destroy();
    room.document.destroy();
    this.dataSourceRooms.delete(id);
  }

  destroy(): void {
    this.contentTimers.forEach((timer) => clearTimeout(timer));
    [...this.resourceRooms.keys()].forEach((id) => this.disposeResourceRoom(id));
    [...this.databaseRooms.keys()].forEach((id) => this.disposeDatabaseRoom(id));
    [...this.dataSourceRooms.keys()].forEach((id) => this.disposeDataSourceRoom(id));
    this.workspaceDocument.off('afterTransaction', this.handleWorkspaceTransaction);
    this.workspaceProvider.destroy();
    this.workspaceDocument.destroy();
    this.listeners.clear();
  }
}
