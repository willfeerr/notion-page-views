import { Array as YArray, Doc, Map as YMap } from 'yjs';
import type { NotionPageData, NotionSchema, StoredPropertyValue } from '../notion-page/types';

export interface WorkspaceState {
  schema: NotionSchema;
  pages: NotionPageData[];
}

function replaceArray<T>(array: YArray<T>, values: T[]): void {
  if (array.length) array.delete(0, array.length);
  if (values.length) array.insert(0, values);
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

  constructor(private readonly document: Doc) {
    this.definitions = document.getMap<string>('schema-definitions');
    this.definitionOrder = document.getArray<string>('schema-order');
    this.pageMaps = document.getMap<YMap<unknown>>('pages');
    this.pageOrder = document.getArray<string>('page-order');
  }

  initialize(seed: WorkspaceState): void {
    if (this.definitions.size || this.pageMaps.size) return;
    this.replaceAll(seed);
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
    return { schema: { properties: [...orderedDefinitions, ...unorderedDefinitions] }, pages: [...orderedPages, ...unorderedPages] };
  }

  replaceAll(state: WorkspaceState): void {
    this.document.transact(() => {
      this.definitions.clear();
      state.schema.properties.forEach((definition) => this.definitions.set(definition.id, JSON.stringify(definition)));
      replaceArray(this.definitionOrder, state.schema.properties.map((definition) => definition.id));
      this.pageMaps.clear();
      state.pages.forEach((page) => this.pageMaps.set(page.id, createPageMap(page)));
      replaceArray(this.pageOrder, state.pages.map((page) => page.id));
    }, 'workspace-replace');
  }

  setSchema(schema: NotionSchema): void {
    this.document.transact(() => {
      const nextIds = new Set(schema.properties.map((definition) => definition.id));
      [...this.definitions.keys()].forEach((id) => { if (!nextIds.has(id)) this.definitions.delete(id); });
      schema.properties.forEach((definition) => this.definitions.set(definition.id, JSON.stringify(definition)));
      replaceArray(this.definitionOrder, schema.properties.map((definition) => definition.id));
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
