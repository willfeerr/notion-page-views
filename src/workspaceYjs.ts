import { Array as YArray, Doc, Map as YMap } from 'yjs';
import type { SerializedEditorState } from 'lexical';
import type { NotionPageData, NotionSchema, StoredPropertyValue } from '../notion-page/types';
import { getPlainTextPreview } from '../notion-page/editor/getPlainTextPreview';
import { ROOM_NAMES } from './yjs/model';

export interface WorkspaceState {
  schema: NotionSchema;
  pages: NotionPageData[];
  resources?: WorkspaceResource[];
}

export interface WorkspaceResource {
  id: string;
  type: 'board' | 'calendar';
  title: string;
  pageIds: string[];
}

export interface RoomProvider {
  destroy(): void;
}

export type RoomProviderFactory = (room: string, document: Doc) => RoomProvider;

interface ResourceReference {
  id: string;
  type: WorkspaceResource['type'];
}

interface ResourceRoom {
  document: Doc;
  provider: RoomProvider;
  config: YMap<string>;
  pageIds: YArray<string>;
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

function hasDateValue(value: StoredPropertyValue): boolean {
  if (typeof value === 'string') return /^\d{4}-\d{2}-\d{2}/.test(value);
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && 'start' in value && value.start);
}

function defaultResources(pages: NotionPageData[]): WorkspaceResource[] {
  return [
    { id: 'board-roadmap', type: 'board', title: 'Roadmap de produto', pageIds: pages.map((page) => page.id) },
    {
      id: 'calendar-product', type: 'calendar', title: 'Calendario de produto',
      pageIds: pages.filter((page) => Object.values(page.properties).some(hasDateValue)).map((page) => page.id),
    },
  ];
}

function valuesEqual(left: unknown, right: unknown): boolean {
  return left === right || JSON.stringify(left) === JSON.stringify(right);
}

function createPageMap(page: NotionPageData): YMap<unknown> {
  const map = new YMap<unknown>();
  const properties = new YMap<StoredPropertyValue>();
  Object.entries(page.properties).forEach(([key, value]) => properties.set(key, value));
  map.set('properties', properties);
  writePageFields(map, {
    ...page,
    contentPreview: page.contentPreview ?? getPlainTextPreview(page.content, 240),
  });
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
  const propertyValues = properties instanceof YMap ? properties.toJSON() : {};
  return {
    id,
    icon: map.get('icon') as string | null | undefined,
    coverUrl: map.get('coverUrl') as string | null | undefined,
    coverPosition: map.get('coverPosition') as number | undefined,
    title: (map.get('title') as string | undefined) ?? 'Sem titulo',
    properties: propertyValues,
    content,
    contentPreview: (map.get('contentPreview') as string | undefined) ?? '',
    createdTime: (map.get('createdTime') as string | undefined) ?? new Date().toISOString(),
    lastEditedTime: (map.get('lastEditedTime') as string | undefined) ?? new Date().toISOString(),
  };
}

/** Coordinates independent workspace, database, view and page rooms behind one app-facing API. */
export class WorkspaceYjsStore {
  private readonly workspaceDocument = new Doc();
  private readonly databaseDocument = new Doc();
  private readonly workspaceProvider: RoomProvider;
  private readonly databaseProvider: RoomProvider;
  private readonly resourceReferences = this.workspaceDocument.getMap<string>('resource-references');
  private readonly resourceOrder = this.workspaceDocument.getArray<string>('resource-order');
  private readonly definitions = this.databaseDocument.getMap<string>('schema-definitions');
  private readonly definitionOrder = this.databaseDocument.getArray<string>('schema-order');
  private readonly pageMaps = this.databaseDocument.getMap<YMap<unknown>>('pages');
  private readonly pageOrder = this.databaseDocument.getArray<string>('page-order');
  private readonly resourceRooms = new Map<string, ResourceRoom>();
  private readonly listeners = new Set<(state: WorkspaceState) => void>();
  private readonly initialContent = new Map<string, SerializedEditorState | null>();
  private readonly contentPublishTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private readonly createProvider: RoomProviderFactory) {
    this.workspaceProvider = createProvider(ROOM_NAMES.workspace, this.workspaceDocument);
    this.databaseProvider = createProvider(ROOM_NAMES.database, this.databaseDocument);
    this.workspaceDocument.on('afterTransaction', this.handleWorkspaceTransaction);
    this.databaseDocument.on('afterTransaction', this.publish);
  }

  private handleWorkspaceTransaction = (): void => {
    this.syncResourceRooms();
    this.publish();
  };

  private publish = (): void => {
    const state = this.read();
    this.listeners.forEach((listener) => listener(state));
  };

  initialize(seed: WorkspaceState): void {
    seed.pages.forEach((page) => this.initialContent.set(page.id, page.content));
    if (!this.definitions.size && !this.pageMaps.size) this.replaceDatabase(seed);
    const resources = seed.resources?.length ? seed.resources : defaultResources(seed.pages);
    if (!this.resourceReferences.size) {
      resources.forEach((resource) => this.ensureResourceRoom(resource));
      this.workspaceDocument.transact(() => {
        resources.forEach((resource) => this.resourceReferences.set(resource.id, JSON.stringify({ id: resource.id, type: resource.type })));
        replaceArray(this.resourceOrder, resources.map((resource) => resource.id));
      }, 'workspace-seed');
    } else {
      this.syncResourceRooms(resources);
    }
    this.publish();
  }

  subscribe(listener: (state: WorkspaceState) => void): () => void {
    this.listeners.add(listener);
    listener(this.read());
    return () => this.listeners.delete(listener);
  }

  read(): WorkspaceState {
    const definitionIds = this.definitionOrder.toArray();
    const orderedDefinitions = definitionIds
      .map((id) => this.definitions.get(id))
      .filter((definition): definition is string => Boolean(definition))
      .map((definition) => JSON.parse(definition) as NotionSchema['properties'][number]);
    const unorderedDefinitions = [...this.definitions.entries()]
      .filter(([id]) => !definitionIds.includes(id))
      .map(([, definition]) => JSON.parse(definition) as NotionSchema['properties'][number]);
    const pageIds = this.pageOrder.toArray();
    const orderedPages = pageIds
      .map((id) => {
        const map = this.pageMaps.get(id);
        return map ? readPage(id, map, this.initialContent.get(id) ?? null) : null;
      })
      .filter((page): page is NotionPageData => Boolean(page));
    const unorderedPages = [...this.pageMaps.entries()]
      .filter(([id]) => !pageIds.includes(id))
      .map(([id, map]) => readPage(id, map, this.initialContent.get(id) ?? null));
    return {
      schema: { properties: [...orderedDefinitions, ...unorderedDefinitions] },
      pages: [...orderedPages, ...unorderedPages],
      resources: this.readResources(),
    };
  }

  private readReferences(): ResourceReference[] {
    const orderedIds = this.resourceOrder.toArray();
    const ordered = orderedIds.map((id) => this.resourceReferences.get(id)).filter((raw): raw is string => Boolean(raw));
    const unordered = [...this.resourceReferences.entries()].filter(([id]) => !orderedIds.includes(id)).map(([, raw]) => raw);
    return [...ordered, ...unordered].map((raw) => JSON.parse(raw) as ResourceReference);
  }

  private readResources(): WorkspaceResource[] {
    return this.readReferences().flatMap((reference) => {
      const room = this.resourceRooms.get(reference.id);
      if (!room) return [];
      return [{
        id: reference.id,
        type: reference.type,
        title: room.config.get('title') ?? (reference.type === 'board' ? 'Board' : 'Calendario'),
        pageIds: room.pageIds.toArray(),
      }];
    });
  }

  private ensureResourceRoom(resource: WorkspaceResource): ResourceRoom {
    const existing = this.resourceRooms.get(resource.id);
    if (existing) return existing;
    const document = new Doc();
    const provider = this.createProvider(ROOM_NAMES.view(resource.id), document);
    const config = document.getMap<string>('config');
    const pageIds = document.getArray<string>('page-ids');
    if (!config.has('title')) {
      document.transact(() => {
        config.set('title', resource.title);
        config.set('type', resource.type);
        replaceArray(pageIds, resource.pageIds);
      }, 'view-seed');
    }
    const onTransaction = () => this.publish();
    document.on('afterTransaction', onTransaction);
    const room = { document, provider, config, pageIds, onTransaction };
    this.resourceRooms.set(resource.id, room);
    return room;
  }

  private syncResourceRooms(seed: WorkspaceResource[] = []): void {
    const references = this.readReferences();
    const activeIds = new Set(references.map((reference) => reference.id));
    references.forEach((reference) => {
      const fallback = seed.find((resource) => resource.id === reference.id) ?? {
        ...reference,
        title: reference.type === 'board' ? 'Board' : 'Calendario',
        pageIds: [],
      };
      this.ensureResourceRoom(fallback);
    });
    [...this.resourceRooms.keys()].forEach((id) => {
      if (!activeIds.has(id)) this.disposeResourceRoom(id);
    });
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
    const resources = state.resources?.length ? state.resources : defaultResources(state.pages);
    resources.forEach((resource) => {
      const room = this.ensureResourceRoom(resource);
      room.document.transact(() => {
        room.config.set('title', resource.title);
        room.config.set('type', resource.type);
        replaceArray(room.pageIds, resource.pageIds);
      }, 'view-replace');
    });
    this.workspaceDocument.transact(() => {
      this.resourceReferences.clear();
      resources.forEach((resource) => this.resourceReferences.set(resource.id, JSON.stringify({ id: resource.id, type: resource.type })));
      replaceArray(this.resourceOrder, resources.map((resource) => resource.id));
    }, 'workspace-replace');
  }

  setSchema(schema: NotionSchema): void {
    this.databaseDocument.transact(() => {
      const nextIds = new Set(schema.properties.map((definition) => definition.id));
      [...this.definitions.keys()].forEach((id) => { if (!nextIds.has(id)) this.definitions.delete(id); });
      schema.properties.forEach((definition) => {
        const value = JSON.stringify(definition);
        if (this.definitions.get(definition.id) !== value) this.definitions.set(definition.id, value);
      });
      replaceArray(this.definitionOrder, schema.properties.map((definition) => definition.id));
    }, 'schema-change');
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

  createResource(resource: WorkspaceResource): void {
    this.ensureResourceRoom(resource);
    this.workspaceDocument.transact(() => {
      this.resourceReferences.set(resource.id, JSON.stringify({ id: resource.id, type: resource.type }));
      this.resourceOrder.push([resource.id]);
    }, 'resource-create');
  }

  linkPage(resourceId: string, pageId: string): void {
    const room = this.resourceRooms.get(resourceId);
    if (!room || room.pageIds.toArray().includes(pageId)) return;
    room.document.transact(() => room.pageIds.push([pageId]), 'view-link-page');
  }

  updatePage(id: string, patch: Partial<NotionPageData>): void {
    if (patch.content !== undefined) this.updatePageContent(id, patch.content);
    const map = this.pageMaps.get(id);
    if (!map) return;
    this.databaseDocument.transact(() => {
      writePageFields(map, patch);
      if (patch.properties) {
        const properties = map.get('properties');
        if (properties instanceof YMap) {
          Object.entries(patch.properties).forEach(([key, value]) => {
            if (!valuesEqual(properties.get(key), value)) properties.set(key, value);
          });
        }
      }
    }, 'page-change');
  }

  updatePageContent(id: string, content: SerializedEditorState | null): void {
    this.initialContent.set(id, content);
    const existing = this.contentPublishTimers.get(id);
    if (existing) clearTimeout(existing);
    this.contentPublishTimers.set(id, setTimeout(() => {
      this.contentPublishTimers.delete(id);
      const page = this.pageMaps.get(id);
      if (!page) { this.publish(); return; }
      const now = new Date().toISOString();
      const editedDefinition = [...this.definitions.values()]
        .map((value) => JSON.parse(value) as NotionSchema['properties'][number])
        .find((definition) => definition.type === 'last_edited_time');
      this.databaseDocument.transact(() => {
        page.set('lastEditedTime', now);
        const properties = page.get('properties');
        if (editedDefinition && properties instanceof YMap) properties.set(editedDefinition.id, now);
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
    this.contentPublishTimers.forEach((timer) => clearTimeout(timer));
    this.contentPublishTimers.clear();
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
