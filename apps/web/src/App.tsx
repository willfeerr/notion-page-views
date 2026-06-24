import { useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react';
import { DndContext, DragOverlay, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { createPortal } from 'react-dom';
import { BarChart3, CalendarDays, CalendarRange, FileJson, FileText, GripVertical, Images, List, Moon, PanelLeftClose, PanelLeftOpen, Plus, RotateCcw, Search, Sun, Table2, Trash2, X } from 'lucide-react';
import type { SerializedEditorState } from 'lexical';
import { NotionEditor, NotionPageCard, NotionPageView } from '../notion-page';
import { PropertiesPanel } from '../notion-page/PropertiesPanel';
import { samplePages, sampleSchema } from '../notion-page/example/sampleData';
import type { BoardLinkOption, BoardLinkValue, CollabPresence, DatabasePageLayout, NotionPageData, NotionSchema, RelationTargetOption, StoredPropertyValue } from '../notion-page/types';
import { BroadcastProvider } from '../notion-page/editor/BroadcastProvider';
import { CalendarView } from './CalendarView';
import { ChartView } from './ChartView';
import { DatabaseCollectionView } from './DatabaseCollectionView';
import { WorkspaceYjsStore } from './workspaceYjs';
import { downloadJson, pageExport, pageSearchText, workspaceExport } from './exportJson';
import {
  buildInitialDataSourceProperties, buildProperty, createId, normalizeDateValue, schemaForResource,
  type BoardResource, type CalendarResource, type PageOwnership, type PropertyMapping, type WorkspaceResource,
} from './domain';
import { ROOM_NAMES } from './yjs/model';
import { executeViewQuery } from './viewQuery';
import { defaultPropertyValue } from './propertyRegistry';
import { ViewSettings } from './ViewSettings';

type View = WorkspaceResource['type'] | 'page';

const STORAGE_KEY = 'notion-pages-real-v2';

function BoardLaneDrop({ statusId, children, onLaneDrop }: { statusId: string; children: ReactNode; onLaneDrop: () => void }) {
  const { isOver, setNodeRef } = useDroppable({ id: `board-lane:${statusId}`, data: { statusId } });
  return <section ref={setNodeRef} className={`lab-column${isOver ? ' is-dnd-over' : ''}`} onDragOver={(event) => event.preventDefault()} onDrop={onLaneDrop}>{children}</section>;
}

function BoardCardDnd({ pageId, statusId, dragging, renderCard, after }: { pageId: string; statusId: string; dragging: boolean; renderCard: (dragHandleProps: ButtonHTMLAttributes<HTMLButtonElement>) => ReactNode; after: ReactNode }) {
  const draggable = useDraggable({ id: `board-card:${pageId}`, data: { pageId } });
  const droppable = useDroppable({ id: `board-card-drop:${pageId}`, data: { statusId, beforePageId: pageId } });
  const style = draggable.transform && !dragging ? { transform: `translate3d(${draggable.transform.x}px, ${draggable.transform.y}px, 0)` } as CSSProperties : undefined;
  const dragHandleProps = { ...draggable.attributes, ...draggable.listeners } as ButtonHTMLAttributes<HTMLButtonElement>;
  return <div ref={droppable.setNodeRef} className={`lab-card-slot${droppable.isOver ? ' is-dnd-over' : ''}`}>
    <div ref={draggable.setNodeRef} style={style} className={`lab-board-card-drag${dragging ? ' is-dragging' : ''}`}>{renderCard(dragHandleProps)}</div>
    {after}
  </div>;
}

function isCurrentResource(resource: unknown): resource is WorkspaceResource {
  if (!resource || typeof resource !== 'object') return false;
  const candidate = resource as Partial<WorkspaceResource>;
  if (typeof candidate.id !== 'string' || typeof candidate.title !== 'string'
    || !Array.isArray(candidate.pageIds) || !Array.isArray(candidate.propertyIds)) return false;
  if (candidate.type === 'board') return typeof candidate.statusPropertyId === 'string';
  if (candidate.type === 'calendar' || candidate.type === 'timeline') return typeof candidate.datePropertyId === 'string';
  if (candidate.type === 'chart') return typeof candidate.chartType === 'string' && typeof candidate.aggregation === 'string';
  return candidate.type === 'table' || candidate.type === 'list' || candidate.type === 'gallery';
}

function loadState(): { schema: NotionSchema; pages: NotionPageData[]; resources?: WorkspaceResource[] } {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as { schema: NotionSchema; pages: NotionPageData[]; resources?: unknown[] };
      const resources = parsed.resources?.filter(isCurrentResource);
      return { schema: parsed.schema, pages: parsed.pages, resources: resources?.length ? resources : undefined };
    }
  } catch { /* use seed */ }
  return { schema: structuredClone(sampleSchema), pages: structuredClone(samplePages) };
}

function loadCollabUser() {
  const id = sessionStorage.getItem('skrbe-collab-tab') ?? crypto.randomUUID();
  sessionStorage.setItem('skrbe-collab-tab', id);
  const colors = ['#2383e2', '#0f9d76', '#a855f7', '#e0564a', '#d97706'];
  const color = colors[[...id].reduce((sum, character) => sum + character.charCodeAt(0), 0) % colors.length];
  return { id, name: localStorage.getItem('skrbe-collab-name') || 'William', color };
}

export default function App() {
  const [initial] = useState(loadState);
  const [pages, setPages] = useState(initial.pages);
  const [resources, setResources] = useState<WorkspaceResource[]>(initial.resources ?? []);
  const [pageSchemas, setPageSchemas] = useState<Record<string, NotionSchema>>({});
  const [dataSourceSchemas, setDataSourceSchemas] = useState<Record<string, NotionSchema>>({});
  const [dataSourceLayouts, setDataSourceLayouts] = useState<Record<string, DatabasePageLayout>>({});
  const [ownership, setOwnership] = useState<Record<string, PageOwnership>>({});
  const [view, setView] = useState<View>('board');
  const [activeResourceId, setActiveResourceId] = useState('board-roadmap');
  const [creatingType, setCreatingType] = useState<WorkspaceResource['type'] | null>(null);
  const [openId, setOpenId] = useState<string | null>(initial.pages[1]?.id ?? initial.pages[0]?.id ?? null);
  const [query, setQuery] = useState('');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggingLaneId, setDraggingLaneId] = useState<string | null>(null);
  const [editingLaneId, setEditingLaneId] = useState<string | null>(null);
  const [collabUser, setCollabUser] = useState(loadCollabUser);
  const [presence, setPresence] = useState<CollabPresence[]>([]);
  const [editingLocation, setEditingLocation] = useState('Corpo do documento');
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [lastMoveOperationId, setLastMoveOperationId] = useState<string | null>(null);
  const [peekMode, setPeekMode] = useState<'side_peek' | 'center_peek' | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const stored = localStorage.getItem('skrbe-sidebar-collapsed');
    return stored === null ? window.matchMedia('(max-width: 760px)').matches : stored === 'true';
  });
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem('skrbe-theme');
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [preview] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return { kind: params.get('embed'), id: params.get('id') };
  });
  const workspaceStoreRef = useRef<WorkspaceYjsStore | null>(null);
  const boardSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('skrbe-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('skrbe-sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    const store = new WorkspaceYjsStore((room, document) => new BroadcastProvider(room, document));
    workspaceStoreRef.current = store;
    store.initialize(initial);
    const unsubscribe = store.subscribe((state) => {
      setPages(state.pages);
      setResources(state.resources ?? []);
      setPageSchemas(state.pageSchemas ?? {});
      setDataSourceSchemas(state.dataSourceSchemas ?? {});
      setDataSourceLayouts(state.dataSourceLayouts ?? {});
      setOwnership(state.ownership ?? {});
    });

    return () => {
      unsubscribe();
      store.destroy();
      workspaceStoreRef.current = null;
    };
  }, [initial]);

  const openPage = pages.find((page) => page.id === openId) ?? pages[0] ?? null;
  const activeResource = resources.find((resource) => resource.id === activeResourceId);
  const activeSchema = useMemo(() => (
    activeResource ? dataSourceSchemas[activeResource.dataSourceId] ?? { properties: [] } : { properties: [] }
  ), [activeResource, dataSourceSchemas]);
  const schemaCatalog = useMemo(() => {
    const properties = new Map<string, NotionSchema['properties'][number]>();
    Object.values(dataSourceSchemas).forEach((sourceSchema) => {
      sourceSchema.properties.forEach((property) => properties.set(property.id, property));
    });
    return { properties: [...properties.values()] };
  }, [dataSourceSchemas]);
  const openPageResource = openPage
    ? resources.find((resource) => resource.pageIds.includes(openPage.id))
    : undefined;
  const openPageDataSourceId = openPage ? ownership[openPage.id]?.dataSourceId : undefined;
  const openPageBoard = openPage
    ? resources.find((resource): resource is BoardResource => resource.type === 'board' && resource.pageIds.includes(openPage.id))
    : undefined;
  const openPageSchema = openPageResource
    ? dataSourceSchemas[openPageResource.dataSourceId] ?? { properties: [] }
    : openPage ? pageSchemas[openPage.id] ?? { properties: [] } : { properties: [] };
  const boardOptions: BoardLinkOption[] = resources.flatMap((resource) => {
    if (resource.type !== 'board') return [];
    const grouping = dataSourceSchemas[resource.dataSourceId]?.properties.find((property) => property.id === resource.statusPropertyId && property.type === 'status');
    if (!grouping || grouping.type !== 'status') return [];
    return [{
      id: resource.id,
      databaseId: resource.dataSourceId,
      title: resource.title,
      lanes: grouping.options.map((option) => ({ id: option.id, name: option.name, color: option.color })),
    }];
  });
  const relationTargets: RelationTargetOption[] = [...new Map(resources.map((resource) => [resource.dataSourceId, resource])).values()]
    .map((resource) => ({
      id: resource.dataSourceId,
      title: resource.title,
      pages: resource.pageIds.flatMap((pageId) => {
        const related = pages.find((page) => page.id === pageId);
        return related ? [{ id: related.id, title: related.title || 'Sem titulo', icon: related.icon }] : [];
      }),
    }));
  const boardPlacement: BoardLinkValue | null = openPage && openPageBoard
    ? {
        boardId: openPageBoard.id,
        laneId: typeof openPage.properties[openPageBoard.statusPropertyId] === 'string'
          ? openPage.properties[openPageBoard.statusPropertyId] as string
          : null,
      }
    : null;
  const statusDefinition = activeResource?.type === 'board'
    ? activeSchema.properties.find((property) => property.id === activeResource.statusPropertyId && property.type === 'status')
    : undefined;
  const statusOptions = statusDefinition?.type === 'status' ? statusDefinition.options : [];
  const boardStatusDefinitions = activeSchema.properties.filter((property) => property.type === 'status');
  const boardVisiblePropertyIds = activeResource?.projection?.propertyIds?.length
    ? activeResource.projection.propertyIds
    : activeSchema.properties.slice(0, 4).map((property) => property.id);
  const draggingPage = draggingId ? pages.find((page) => page.id === draggingId) ?? null : null;
  const visiblePages = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR');
    return normalized ? pages.filter((page) => pageSearchText(page, pageSchemas[page.id] ?? { properties: [] }).toLocaleLowerCase('pt-BR').includes(normalized)) : pages;
  }, [pageSchemas, pages, query]);
  const activePages = useMemo(() => {
    if (!activeResource) return visiblePages;
    const byId = new Map(visiblePages.map((page) => [page.id, page]));
    const rows = activeResource.pageIds.map((id) => byId.get(id)).filter((page): page is NotionPageData => Boolean(page));
    return executeViewQuery(rows, activeResource);
  }, [activeResource, visiblePages]);
  const validStatusIds = new Set(statusOptions.map((status) => status.id));
  const hasUnassignedPages = Boolean(statusDefinition && activePages.some((page) => {
    const value = page.properties[statusDefinition.id];
    return typeof value !== 'string' || !validStatusIds.has(value);
  }));
  const boardLanes = hasUnassignedPages
    ? [...statusOptions, { id: '__unassigned__', name: 'Sem status', color: 'gray' as const }]
    : statusOptions;

  function updatePage(id: string, patch: Partial<NotionPageData>) {
    const now = new Date().toISOString();
    const editedProperty = pageSchemas[id]?.properties.find((property) => property.type === 'last_edited_time');
    const page = pages.find((item) => item.id === id);
    if (!page) return;
    const nextPatch: Partial<NotionPageData> = { ...patch, lastEditedTime: now };
    const changedProperties = { ...(patch.properties ?? {}) };
    if (editedProperty) changedProperties[editedProperty.id] = now;
    if (Object.keys(changedProperties).length) nextPatch.properties = changedProperties;
    workspaceStoreRef.current?.updatePage(id, nextPatch);
  }

  function updateProperty(pageId: string, propertyId: string, value: StoredPropertyValue) {
    if (!pages.some((item) => item.id === pageId)) return;
    workspaceStoreRef.current?.updateProperty(pageId, propertyId, value);
  }

  function openDatabasePage(pageId: string) {
    const mode = activeResource?.projection?.openMode ?? 'full_page';
    setOpenId(pageId);
    if (mode === 'full_page') {
      setPeekMode(null);
      setView('page');
    } else setPeekMode(mode);
  }

  function closePageView() {
    if (peekMode) setPeekMode(null);
    else setView(activeResource?.type ?? 'board');
  }

  function updateBoardPlacement(placement: BoardLinkValue | null) {
    if (!openPage) return;
    if (!placement) {
      if (!openPageBoard) return;
      if (!confirm('Remover esta pagina do database do board? As propriedades desse database serao removidas.')) return;
      workspaceStoreRef.current?.unlinkPage(openPageBoard.id, openPage.id);
      return;
    }

    const target = resources.find((resource): resource is BoardResource => resource.type === 'board' && resource.id === placement.boardId);
    if (!target || !placement.laneId) return;
    if (openPageResource?.dataSourceId !== target.dataSourceId) return;
    workspaceStoreRef.current?.updateProperty(openPage.id, target.statusPropertyId, placement.laneId);
    setActiveResourceId(target.id);
  }

  function moveOpenPage(targetDataSourceId: string, propertyMapping: PropertyMapping[]) {
    if (!openPage) return;
    const operation = workspaceStoreRef.current?.prepareMove(openPage.id, targetDataSourceId, propertyMapping);
    if (!operation) return;
    const result = workspaceStoreRef.current?.commitMove(operation.id);
    if (result?.status === 'cleaned') setLastMoveOperationId(result.id);
    setMoveDialogOpen(false);
  }

  function undoLastMove() {
    if (!lastMoveOperationId) return;
    const result = workspaceStoreRef.current?.undoMove(lastMoveOperationId);
    if (result?.status === 'undone') setLastMoveOperationId(null);
  }

  function updateSchema(
    next: NotionSchema,
    fallbackByPropertyId: Record<string, StoredPropertyValue> = {},
    resource: WorkspaceResource | undefined = activeResource,
  ) {
    if (!resource) return;
    const resourceProperties = [...next.properties];
    let primaryPatch: Partial<WorkspaceResource> = {};
    if (resource.type === 'board' && !resourceProperties.some((property) => property.id === resource.statusPropertyId && property.type === 'status')) {
      const replacement = buildProperty('status', resource.title + ' Status');
      resourceProperties.push(replacement);
      primaryPatch = { statusPropertyId: replacement.id } as Partial<WorkspaceResource>;
    }
    if ((resource.type === 'calendar' || resource.type === 'timeline') && !resourceProperties.some((property) => property.id === resource.datePropertyId && property.type === 'date')) {
      const replacement = buildProperty('date', resource.title + ' Data');
      resourceProperties.push(replacement);
      primaryPatch = { datePropertyId: replacement.id } as Partial<WorkspaceResource>;
    }
    const databaseSchema = { properties: resourceProperties };
    workspaceStoreRef.current?.applySchema(resource.dataSourceId, databaseSchema, fallbackByPropertyId);
    workspaceStoreRef.current?.updateResource(resource.id, {
      ...primaryPatch,
      propertyIds: resourceProperties.map((property) => property.id),
    } as Partial<WorkspaceResource>);
  }

  function createPage(statusId?: string, afterPageId?: string, resourceId?: string) {
    const now = new Date().toISOString();
    const targetResource = resourceId ? resources.find((resource) => resource.id === resourceId) : undefined;
    const targetSchema = targetResource
      ? schemaForResource(dataSourceSchemas[targetResource.dataSourceId] ?? { properties: [] }, targetResource)
      : { properties: [] };
    const properties = Object.fromEntries(targetSchema.properties.map((definition) => [
      definition.id, defaultPropertyValue(definition, { pageId: 'pending', userId: collabUser.id }),
    ]));
    if (targetResource?.type === 'board') {
      const grouping = targetSchema.properties.find((definition) => definition.id === targetResource.statusPropertyId && definition.type === 'status');
      if (grouping && statusId && statusId !== '__unassigned__') properties[grouping.id] = statusId;
    }
    for (const definition of targetSchema.properties) {
      if (definition.type === 'created_time' || definition.type === 'last_edited_time') properties[definition.id] = now;
    }
    const page: NotionPageData = {
      id: crypto.randomUUID(), icon: '📄', coverUrl: null, title: 'Sem titulo', properties,
      content: null, createdTime: now, lastEditedTime: now,
    };
    targetSchema.properties.filter((definition) => definition.type === 'unique_id').forEach((definition) => {
      properties[definition.id] = defaultPropertyValue(definition, { pageId: page.id, userId: collabUser.id });
    });
    workspaceStoreRef.current?.insertPage(page, afterPageId, targetResource?.dataSourceId);
    setOpenId(page.id);
    setPeekMode(null);
    setView('page');
  }

  function createBoardPage(statusId = statusOptions[0]?.id, afterPageId?: string) {
    if (activeResource?.type !== 'board') return;
    createPage(statusId, afterPageId, activeResource.id);
  }

  function changeBoardGrouping(propertyId: string) {
    if (activeResource?.type !== 'board') return;
    const nextStatus = activeSchema.properties.find((property) => property.id === propertyId && property.type === 'status');
    if (!nextStatus || nextStatus.type !== 'status') return;
    workspaceStoreRef.current?.updateResource(activeResource.id, {
      statusPropertyId: nextStatus.id,
      group: { propertyId: nextStatus.id },
    } as Partial<WorkspaceResource>);
  }

  function finishBoardCardDrag(event: DragEndEvent) {
    const pageId = event.active.data.current?.pageId as string | undefined;
    const statusId = event.over?.data.current?.statusId as string | undefined;
    const beforePageId = event.over?.data.current?.beforePageId as string | undefined;
    if (pageId && statusId && activeResource?.type === 'board' && statusDefinition) {
      workspaceStoreRef.current?.moveBoardPage(
        activeResource.id,
        pageId,
        statusDefinition.id,
        statusId === '__unassigned__' ? null : statusId,
        beforePageId,
      );
    }
    setDraggingId(null);
  }

  function resetDemo() {
    if (!confirm('Restaurar schema e paginas de exemplo?')) return;
    const pageIds = new Set([...pages, ...samplePages].map((page) => page.id));
    pageIds.forEach((pageId) => localStorage.removeItem(`notion-yjs:${ROOM_NAMES.page(pageId)}`));
    localStorage.removeItem(STORAGE_KEY);
    workspaceStoreRef.current?.replaceAll({ schema: structuredClone(sampleSchema), pages: structuredClone(samplePages) });
    setOpenId(samplePages[1]?.id ?? samplePages[0]?.id ?? null);
    setView('board');
  }

  function addLane() {
    if (!statusDefinition || statusDefinition.type !== 'status') return;
    const id = `status-${crypto.randomUUID()}`;
    const option = { id, name: 'Nova lane', color: 'default' as const };
    const firstGroup = statusDefinition.groups[0];
    updateSchema({
      ...activeSchema,
      properties: activeSchema.properties.map((property) => property.id === statusDefinition.id ? {
        ...statusDefinition,
        options: [...statusDefinition.options, option],
        groups: firstGroup
          ? [{ ...firstGroup, optionIds: [...firstGroup.optionIds, id] }, ...statusDefinition.groups.slice(1)]
          : statusDefinition.groups,
      } : property),
    });
    setEditingLaneId(id);
  }

  function renameLane(id: string, name: string) {
    if (!statusDefinition || statusDefinition.type !== 'status' || !name.trim()) return;
    updateSchema({ ...activeSchema, properties: activeSchema.properties.map((property) => property.id === statusDefinition.id
      ? { ...statusDefinition, options: statusDefinition.options.map((option) => option.id === id ? { ...option, name: name.trim() } : option) }
      : property) });
  }

  function deleteLane(id: string) {
    if (!statusDefinition || statusDefinition.type !== 'status' || statusDefinition.options.length <= 1) return;
    const lane = statusDefinition.options.find((option) => option.id === id);
    if (!confirm(`Excluir a lane "${lane?.name ?? ''}"? Os cards serao movidos para a primeira lane.`)) return;
    const fallback = statusDefinition.options.find((option) => option.id !== id)!;
    updateSchema({ ...activeSchema, properties: activeSchema.properties.map((property) => property.id === statusDefinition.id ? {
      ...statusDefinition,
      options: statusDefinition.options.filter((option) => option.id !== id),
      groups: statusDefinition.groups.map((group) => ({ ...group, optionIds: group.optionIds.filter((optionId) => optionId !== id) })),
    } : property) }, { [statusDefinition.id]: fallback.id });
  }

  function reorderLane(overId: string) {
    if (!statusDefinition || statusDefinition.type !== 'status' || !draggingLaneId || draggingLaneId === overId) return;
    const options = [...statusDefinition.options];
    const from = options.findIndex((option) => option.id === draggingLaneId);
    const to = options.findIndex((option) => option.id === overId);
    if (from < 0 || to < 0) return;
    const [moved] = options.splice(from, 1);
    options.splice(to, 0, moved);
    updateSchema({ ...activeSchema, properties: activeSchema.properties.map((property) => property.id === statusDefinition.id ? { ...statusDefinition, options } : property) });
    setDraggingLaneId(null);
  }

  function createCalendarPage(datePropertyId: string, start: string, end?: string) {
    const statusId = statusOptions[0]?.id;
    const now = new Date().toISOString();
    const pageId = crypto.randomUUID();
    const properties = Object.fromEntries(activeSchema.properties.map((definition) => [definition.id, defaultPropertyValue(definition, { pageId, userId: collabUser.id })]));
    properties[datePropertyId] = normalizeDateValue({ start, end: end ?? start, allDay: start.length <= 10 }, activeResource?.type === 'calendar' ? activeResource.timezone : undefined);
    if (statusDefinition && statusId) properties[statusDefinition.id] = statusId;
    for (const definition of activeSchema.properties) {
      if (definition.type === 'created_time' || definition.type === 'last_edited_time') properties[definition.id] = now;
    }
    const page: NotionPageData = { id: pageId, icon: '📅', coverUrl: null, title: 'Novo evento', properties, content: null, createdTime: now, lastEditedTime: now };
    workspaceStoreRef.current?.insertPage(
      page,
      undefined,
      activeResource?.type === 'calendar' ? activeResource.dataSourceId : undefined,
    );
    setOpenId(page.id);
    setPeekMode(null);
    setView('page');
  }

  function moveCalendarEvent(pageId: string, datePropertyId: string, start: string, end: string) {
    const current = pages.find((page) => page.id === pageId)?.properties[datePropertyId];
    const normalized = normalizeDateValue(current, activeResource?.type === 'calendar' ? activeResource.timezone : undefined);
    updateProperty(pageId, datePropertyId, { ...normalized, start, end, allDay: start.length <= 10 });
  }

  function createResource(type: WorkspaceResource['type'], title: string, existingDatePropertyId?: string, sourceDataSourceId?: string) {
    const usesDate = type === 'calendar' || type === 'timeline';
    const selectedOwner = sourceDataSourceId ? resources.find((resource) => resource.dataSourceId === sourceDataSourceId) : undefined;
    const selectedSchema = selectedOwner ? dataSourceSchemas[selectedOwner.dataSourceId] ?? { properties: [] } : undefined;
    const existingDate = usesDate && existingDatePropertyId
      ? (selectedSchema ?? schemaCatalog).properties.find((property) => property.id === existingDatePropertyId && property.type === 'date')
      : undefined;
    const existingStatus = type === 'board' ? selectedSchema?.properties.find((property) => property.type === 'status') : undefined;
    const existingSourceDate = usesDate ? selectedSchema?.properties.find((property) => property.type === 'date') : undefined;
    const primary = existingStatus ?? existingDate ?? existingSourceDate ?? buildProperty(
      type === 'board' ? 'status' : usesDate ? 'date' : 'text',
      type === 'board' ? `${title} Status` : usesDate ? `${title} Data` : 'Nota',
    );
    const owner = selectedOwner ?? (existingDate
      ? resources.find((resource) => resource.propertyIds.includes(existingDate.id))
      : undefined);
    const initialDefinitions = owner ? [] : buildInitialDataSourceProperties(primary);
    const propertyIds = owner?.propertyIds ?? initialDefinitions.map((property) => property.id);
    const databaseId = owner?.databaseId ?? createId('database');
    const dataSourceId = owner?.dataSourceId ?? createId('datasource');
    const id = createId(type);
    const base = { id, databaseId, dataSourceId, title, pageIds: owner?.pageIds ?? [], propertyIds };
    const projection = { propertyIds, openMode: 'full_page' as const, cardPreview: type === 'gallery' ? 'cover' as const : 'none' as const };
    const groupProperty = (selectedSchema ?? { properties: initialDefinitions }).properties.find((property) => ['select', 'multi_select', 'status', 'text'].includes(property.type));
    const valueProperty = (selectedSchema ?? { properties: initialDefinitions }).properties.find((property) => ['number', 'formula', 'rollup'].includes(property.type));
    const resource: WorkspaceResource = type === 'board'
      ? { ...base, type, statusPropertyId: primary.id, group: { propertyId: primary.id }, projection: { ...projection, cardPreview: 'content' } }
      : type === 'calendar'
        ? { ...base, type, datePropertyId: primary.id, timezone: 'America/Sao_Paulo', defaultView: 'month', visibleHours: { from: 7, to: 21 }, projection }
        : type === 'timeline'
          ? { ...base, type, datePropertyId: primary.id, timezone: 'America/Sao_Paulo', projection }
          : type === 'chart'
            ? { ...base, type, chartType: 'bar', aggregation: 'count', groupPropertyId: groupProperty?.id, valuePropertyId: valueProperty?.id, projection }
          : { ...base, type, projection };
    workspaceStoreRef.current?.createResource(resource, initialDefinitions);
    setActiveResourceId(resource.id);
    setView(type);
    setCreatingType(null);
    closeMobileSidebar();
  }

  function closeMobileSidebar() {
    if (window.matchMedia('(max-width: 760px)').matches) setSidebarCollapsed(true);
  }

  function openResource(resource: WorkspaceResource) {
    setActiveResourceId(resource.id);
    setView(resource.type);
    closeMobileSidebar();
  }

  function updateActiveResource(patch: Partial<WorkspaceResource>) {
    if (!activeResource) return;
    let nextPatch = patch;
    if (activeResource.type === 'board' && patch.group) {
      const grouping = activeSchema.properties.find((property) => property.id === patch.group?.propertyId && property.type === 'status');
      if (grouping) nextPatch = { ...patch, statusPropertyId: grouping.id } as Partial<WorkspaceResource>;
    }
    workspaceStoreRef.current?.updateResource(activeResource.id, nextPatch);
  }

  function renameResource(resource: WorkspaceResource) {
    const title = prompt('Novo nome do recurso', resource.title)?.trim();
    if (title) workspaceStoreRef.current?.updateResource(resource.id, { title } as Partial<WorkspaceResource>);
  }

  function deleteResource(resource: WorkspaceResource) {
    if (!confirm(`Excluir "${resource.title}"? As paginas serao mantidas.`)) return;
    workspaceStoreRef.current?.deleteResource(resource.id);
    const next = resources.find((candidate) => candidate.id !== resource.id);
    if (next) {
      setActiveResourceId(next.id);
      setView(next.type);
    }
  }

  function deleteOpenPage() {
    if (!openPage || !confirm(`Excluir a pagina "${openPage.title}"?`)) return;
    workspaceStoreRef.current?.deletePage(openPage.id);
    setPeekMode(null);
    const next = pages.find((page) => page.id !== openPage.id);
    setOpenId(next?.id ?? null);
    setView(activeResource?.type ?? 'board');
  }

  function renameCollabUser() {
    const name = prompt('Nome exibido nos cursores colaborativos', collabUser.name)?.trim();
    if (!name) return;
    localStorage.setItem('skrbe-collab-name', name);
    setCollabUser((current) => ({ ...current, name }));
  }

  function exportWorkspace() {
    downloadJson('skrbe-workspace', workspaceExport(resources, pages, schemaCatalog));
  }

  if (preview.kind === 'page') {
    const page = pages.find((item) => item.id === preview.id) ?? pages[0];
    return page ? <EmbeddedPagePreview schema={pageSchemas[page.id] ?? { properties: [] }} page={page} /> : null;
  }

  if (preview.kind === 'board') {
    const resource = resources.find((item): item is BoardResource => item.type === 'board' && item.id === preview.id)
      ?? resources.find((item): item is BoardResource => item.type === 'board');
    return resource ? <EmbeddedBoardPreview resource={resource} schema={schemaForResource(dataSourceSchemas[resource.dataSourceId] ?? { properties: [] }, resource)} pages={pages.filter((page) => resource.pageIds.includes(page.id))} /> : null;
  }

  if (preview.kind === 'calendar') {
    const resource = resources.find((item): item is CalendarResource => item.type === 'calendar' && item.id === preview.id)
      ?? resources.find((item): item is CalendarResource => item.type === 'calendar');
    return resource ? <CalendarView title={resource.title} schema={schemaForResource(dataSourceSchemas[resource.dataSourceId] ?? { properties: [] }, resource)} pages={pages.filter((page) => resource.pageIds.includes(page.id))} datePropertyId={resource.datePropertyId} timezone={resource.timezone} defaultView={resource.defaultView} visibleHours={resource.visibleHours} onOpenPage={() => undefined} onCreatePage={() => undefined} onMoveEvent={() => undefined} /> : null;
  }

  return (
    <div className={`lab-shell is-${view}${sidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
      <aside className="lab-sidebar">
        <div className="lab-brand">
          <span className="lab-brand-mark">S</span>
          <strong>SKRBE Workspace</strong>
          <button type="button" className="lab-sidebar-toggle" title={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'} aria-label={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'} onClick={() => setSidebarCollapsed((current) => !current)}>
            {sidebarCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
          </button>
        </div>
        <div className="lab-sidebar-label"><span>APPS</span><button type="button" title="Novo board" onClick={() => setCreatingType('board')}><Plus size={13} /></button></div>
        {resources.map((resource) => (
          <div key={resource.id} className={`lab-resource-row${view === resource.type && activeResource?.id === resource.id ? ' is-active' : ''}`}>
            <button type="button" title={resource.title} onClick={() => openResource(resource)} onDoubleClick={() => renameResource(resource)}>{resource.type === 'calendar' ? <CalendarDays size={14} /> : resource.type === 'timeline' ? <CalendarRange size={14} /> : resource.type === 'table' ? <Table2 size={14} /> : resource.type === 'list' ? <List size={14} /> : resource.type === 'gallery' ? <Images size={14} /> : resource.type === 'chart' ? <BarChart3 size={14} /> : <span className="lab-nav-symbol">▦</span>}<span>{resource.title}</span></button>
            <button type="button" title="Renomear" onClick={() => renameResource(resource)}>✎</button>
            <button type="button" title="Excluir" onClick={() => deleteResource(resource)}><Trash2 size={12} /></button>
          </div>
        ))}
        <div className="lab-sidebar-create">
          <button type="button" title="Novo board" onClick={() => setCreatingType('board')}><Plus size={13} /><span>Board</span></button>
          <button type="button" title="Novo calendario" onClick={() => setCreatingType('calendar')}><Plus size={13} /><span>Calendario</span></button>
          <button type="button" title="Nova tabela" onClick={() => setCreatingType('table')}><Plus size={13} /><span>Tabela</span></button>
          <button type="button" title="Nova lista" onClick={() => setCreatingType('list')}><Plus size={13} /><span>Lista</span></button>
          <button type="button" title="Nova galeria" onClick={() => setCreatingType('gallery')}><Plus size={13} /><span>Galeria</span></button>
          <button type="button" title="Nova timeline" onClick={() => setCreatingType('timeline')}><Plus size={13} /><span>Timeline</span></button>
          <button type="button" title="Novo grafico" onClick={() => setCreatingType('chart')}><Plus size={13} /><span>Grafico</span></button>
        </div>
        <div className="lab-sidebar-label"><span>PAGINAS</span><button type="button" title="Nova pagina independente" onClick={() => createPage()}><Plus size={13} /></button></div>
        <div className="lab-page-list">
          {pages.map((page) => (
            <button key={page.id} type="button" title={page.title || 'Sem titulo'} className={view === 'page' && openPage?.id === page.id ? 'is-active' : ''} onClick={() => { setPeekMode(null); setOpenId(page.id); setView('page'); closeMobileSidebar(); }}>
              <span>{page.icon || <FileText size={13} />}</span><span>{page.title || 'Sem titulo'}</span>
            </button>
          ))}
        </div>
        <div className="lab-sidebar-foot"><button title="Restaurar demo" onClick={resetDemo}><RotateCcw size={14} /><span>Restaurar demo</span></button></div>
      </aside>
      <button type="button" className="lab-sidebar-scrim" aria-label="Fechar menu" onClick={() => setSidebarCollapsed(true)} />

      <main className="lab-main">
        <header className="lab-topbar">
          <div className="lab-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar paginas" /></div>
          <div className="lab-top-actions">
            <span>{pages.length} paginas · {schemaCatalog.properties.length} propriedades</span>
            {activeResource && view !== 'page' ? <ViewSettings resource={activeResource} schema={activeSchema} onChange={updateActiveResource} /> : null}
            <button className="lab-theme-toggle" type="button" title={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <button className="lab-export-button" type="button" title="Exportar workspace indexavel como JSON" onClick={exportWorkspace}><FileJson size={14} />JSON</button>
            <button onClick={() => createPage()}><Plus size={14} />Nova pagina</button>
          </div>
        </header>

        {view === 'board' && (
          <section className="lab-board-view">
            <div className="lab-heading">
              <div><span>BOARD</span><h1>{activeResource?.type === 'board' ? activeResource.title : 'Board'}</h1></div>
              <div className="lab-board-actions">
                {activeResource?.type === 'board' && boardStatusDefinitions.length ? (
                  <label className="lab-board-grouping">
                    <span>Agrupar por</span>
                    <select value={activeResource.statusPropertyId} onChange={(event) => changeBoardGrouping(event.target.value)}>
                      {boardStatusDefinitions.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
                    </select>
                  </label>
                ) : null}
                <button onClick={() => createBoardPage()}><Plus size={15} />Novo card</button>
              </div>
            </div>
            <DndContext sensors={boardSensors} onDragStart={(event) => { const pageId = event.active.data.current?.pageId; setDraggingId(typeof pageId === 'string' ? pageId : null); }} onDragCancel={() => setDraggingId(null)} onDragEnd={finishBoardCardDrag}>
            <div className="lab-board">
              {boardLanes.map((status) => {
                const isUnassigned = status.id === '__unassigned__';
                const columnPages = activePages.filter((page) => {
                  const value = page.properties[statusDefinition?.id ?? 'status'];
                  return isUnassigned ? typeof value !== 'string' || !validStatusIds.has(value) : value === status.id;
                });
                return (
                  <BoardLaneDrop key={status.id} statusId={status.id} onLaneDrop={() => reorderLane(status.id)}>
                    <header draggable={!isUnassigned} onDragStart={() => { if (!isUnassigned) setDraggingLaneId(status.id); }} onDragEnd={() => setDraggingLaneId(null)}>
                      <GripVertical size={13} className="lab-lane-grip" />
                      <i data-color={status.color} />
                      {editingLaneId === status.id ? (
                        <input
                          aria-label="Nome da lane"
                          autoFocus
                          defaultValue={status.name}
                          onFocus={(event) => event.currentTarget.select()}
                          onBlur={(event) => { renameLane(status.id, event.target.value); setEditingLaneId(null); }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') event.currentTarget.blur();
                            if (event.key === 'Escape') setEditingLaneId(null);
                          }}
                        />
                      ) : <button className="lab-lane-title" type="button" title={isUnassigned ? 'Paginas sem valor nesta propriedade' : 'Renomear lane'} onClick={() => { if (!isUnassigned) setEditingLaneId(status.id); }}>{status.name}</button>}
                      <b>{columnPages.length}</b>
                      <button type="button" title="Adicionar card" onClick={() => createBoardPage(status.id)}><Plus size={14} /></button>
                      <button type="button" title="Excluir lane" disabled={isUnassigned || statusOptions.length <= 1} onClick={() => deleteLane(status.id)}><Trash2 size={13} /></button>
                    </header>
                    <div className="lab-card-list">
                      {columnPages.map((page) => (
                        <BoardCardDnd key={page.id} pageId={page.id} statusId={status.id} dragging={draggingId === page.id} renderCard={(dragHandleProps) => <NotionPageCard schema={activeSchema} page={page} visiblePropertyIds={boardVisiblePropertyIds} showWindowControls dragHandleProps={dragHandleProps} onDelete={() => workspaceStoreRef.current?.deletePage(page.id)} onPropertyChange={(propertyId, value) => updateProperty(page.id, propertyId, value)} onContentChange={(content) => updatePage(page.id, { content })} onClick={() => openDatabasePage(page.id)} />} after={<div className="lab-insert-row">
                            <span />
                            <button type="button" onClick={() => createBoardPage(status.id, page.id)} title="Adicionar pagina depois deste card">+</button>
                            <span />
                          </div>} />
                      ))}
                    </div>
                    <button className="lab-add-card" onClick={() => createBoardPage(status.id)}>+ Novo card</button>
                  </BoardLaneDrop>
                );
              })}
              <button className="lab-add-lane" type="button" aria-label="Adicionar lane" onClick={addLane}><Plus size={18} /><span>Adicionar lane</span></button>
            </div>
            {createPortal(
              <DragOverlay dropAnimation={null}>
                {draggingPage ? (
                  <div className="lab-drag-overlay">
                    <NotionPageCard schema={activeSchema} page={draggingPage} visiblePropertyIds={boardVisiblePropertyIds} showWindowControls />
                  </div>
                ) : null}
              </DragOverlay>,
              document.body,
            )}
            </DndContext>
          </section>
        )}

        {view === 'calendar' && (
          <CalendarView
            title={activeResource?.type === 'calendar' ? activeResource.title : 'Calendario'}
            schema={activeSchema}
            pages={activePages}
            datePropertyId={activeResource?.type === 'calendar' ? activeResource.datePropertyId : ''}
            timezone={activeResource?.type === 'calendar' ? activeResource.timezone : 'America/Sao_Paulo'}
            defaultView={activeResource?.type === 'calendar' ? activeResource.defaultView : 'month'}
            visibleHours={activeResource?.type === 'calendar' ? activeResource.visibleHours : { from: 7, to: 21 }}
            onViewChange={(defaultView) => activeResource?.type === 'calendar' && workspaceStoreRef.current?.updateResource(activeResource.id, { defaultView } as Partial<WorkspaceResource>)}
            onOpenPage={openDatabasePage}
            onCreatePage={createCalendarPage}
            onMoveEvent={moveCalendarEvent}
          />
        )}

        {(view === 'table' || view === 'list' || view === 'gallery' || view === 'timeline')
          && activeResource && activeResource.type === view ? (
          <DatabaseCollectionView
            resource={activeResource}
            schema={activeSchema}
            pages={activePages}
            onOpenPage={openDatabasePage}
            onCreatePage={() => createPage(undefined, undefined, activeResource.id)}
            onPropertyChange={updateProperty}
          />
        ) : null}

        {view === 'chart' && activeResource?.type === 'chart' ? (
          <ChartView
            resource={activeResource}
            schema={activeSchema}
            pages={activePages}
            onCreatePage={() => createPage(undefined, undefined, activeResource.id)}
            onChange={(patch) => workspaceStoreRef.current?.updateResource(activeResource.id, patch)}
          />
        ) : null}

        {(view === 'page' || peekMode) && openPage && (
          <section className={`lab-page-stage${peekMode ? ` is-${peekMode}` : ''}`}>
            <div className="lab-page-toolbar">
              <button onClick={closePageView}>← {activeResource?.title ?? 'Workspace'}</button>
              <button type="button" className="lab-presence-summary" onClick={renameCollabUser} title={presence.length ? presence.map((item) => `${item.name} · ${item.location}`).join('\n') : 'Alterar nome colaborativo'}>
                <i style={{ background: collabUser.color }} />
                <span>{collabUser.name} · {editingLocation}</span>
                {presence.filter((item) => item.userId !== collabUser.id).slice(0, 3).map((item) => <i key={item.clientId} style={{ background: item.color }} title={`${item.name} · ${item.location}`} />)}
                {presence.length > 4 ? <b>+{presence.length - 4}</b> : null}
              </button>
              <div>{lastMoveOperationId ? <button type="button" onClick={undoLastMove}><RotateCcw size={14} />Desfazer move</button> : null}<button type="button" onClick={() => setMoveDialogOpen(true)}>Mover para...</button><button type="button" title="Exportar pagina como JSON" onClick={() => downloadJson(openPage.title, pageExport(openPage, openPageSchema))}><FileJson size={14} />Exportar JSON</button><button type="button" title="Excluir pagina" onClick={deleteOpenPage}><Trash2 size={14} /></button><button title="Fechar" onClick={closePageView}><X size={15} /></button></div>
            </div>
            <NotionPageView
              schema={openPageSchema}
              page={openPage}
              collab={{ transport: 'broadcast', room: ROOM_NAMES.page(openPage.id), user: { ...collabUser, location: editingLocation }, onPresenceChange: setPresence }}
              onTitleChange={(title) => updatePage(openPage.id, { title })}
              onIconChange={(icon) => updatePage(openPage.id, { icon })}
              onCoverChange={(coverUrl) => updatePage(openPage.id, { coverUrl })}
              onCoverPositionChange={(coverPosition) => updatePage(openPage.id, { coverPosition })}
              onPropertyChange={(propertyId, value) => updateProperty(openPage.id, propertyId, value)}
              onContentChange={(content: SerializedEditorState) => updatePage(openPage.id, { content })}
              onSchemaChange={openPageResource
                ? (next) => updateSchema(next, {}, openPageResource)
                : (next) => workspaceStoreRef.current?.applyPageSchema(openPage.id, next)}
              boardOptions={boardOptions.filter((board) => board.databaseId === openPageDataSourceId)}
              boardPlacement={boardPlacement}
              onBoardPlacementChange={updateBoardPlacement}
              relationTargets={relationTargets}
              layout={openPageDataSourceId ? dataSourceLayouts[openPageDataSourceId] : undefined}
              onLayoutChange={openPageDataSourceId ? (layout) => workspaceStoreRef.current?.updateDataSourceLayout(openPageDataSourceId, layout) : undefined}
              onEditingLocationChange={setEditingLocation}
            />
          </section>
        )}
      </main>
      {creatingType ? <CreateResourceDialog
        type={creatingType}
        schema={schemaCatalog}
        sources={[...new Map(resources.map((resource) => [resource.dataSourceId, resource])).values()].map((resource) => ({
          id: resource.dataSourceId,
          title: resource.title,
          schema: dataSourceSchemas[resource.dataSourceId] ?? { properties: [] },
        }))}
        onClose={() => setCreatingType(null)}
        onCreate={createResource}
      /> : null}
      {moveDialogOpen && openPageDataSourceId ? <MovePageDialog
        sourceSchema={openPageSchema}
        sourceDataSourceId={openPageDataSourceId}
        targets={relationTargets.map((target) => ({ ...target, schema: dataSourceSchemas[target.id] ?? { properties: [] } }))}
        onClose={() => setMoveDialogOpen(false)}
        onMove={moveOpenPage}
      /> : null}
    </div>
  );
}

function MovePageDialog({ sourceSchema, sourceDataSourceId, targets, onClose, onMove }: {
  sourceSchema: NotionSchema;
  sourceDataSourceId: string;
  targets: Array<RelationTargetOption & { schema: NotionSchema }>;
  onClose: () => void;
  onMove: (targetDataSourceId: string, mapping: PropertyMapping[]) => void;
}) {
  const availableTargets = targets.filter((target) => target.id !== sourceDataSourceId);
  const [targetId, setTargetId] = useState(availableTargets[0]?.id ?? '');
  const target = availableTargets.find((candidate) => candidate.id === targetId);
  const suggested = sourceSchema.properties.map((source) => {
    const exact = target?.schema.properties.find((candidate) => candidate.id === source.id);
    const byName = target?.schema.properties.find((candidate) => candidate.name.trim().toLocaleLowerCase() === source.name.trim().toLocaleLowerCase());
    return [source.id, exact?.id ?? byName?.id ?? ''] as const;
  });
  const [mapping, setMapping] = useState<Record<string, string>>(() => Object.fromEntries(suggested));

  function selectTarget(nextTargetId: string) {
    const nextTarget = availableTargets.find((candidate) => candidate.id === nextTargetId);
    setTargetId(nextTargetId);
    setMapping(Object.fromEntries(sourceSchema.properties.map((source) => {
      const exact = nextTarget?.schema.properties.find((candidate) => candidate.id === source.id);
      const byName = nextTarget?.schema.properties.find((candidate) => candidate.name.trim().toLocaleLowerCase() === source.name.trim().toLocaleLowerCase());
      return [source.id, exact?.id ?? byName?.id ?? ''];
    })));
  }

  const propertyMapping: PropertyMapping[] = sourceSchema.properties.map((source) => {
    const targetPropertyId = mapping[source.id];
    const targetProperty = target?.schema.properties.find((candidate) => candidate.id === targetPropertyId);
    return targetProperty ? {
      sourcePropertyId: source.id,
      targetPropertyId,
      conversion: source.type === targetProperty.type ? 'direct' : 'convert',
    } : { sourcePropertyId: source.id, conversion: 'archive' };
  });

  return <div className="lab-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <form className="lab-dialog lab-move-dialog" onSubmit={(event) => { event.preventDefault(); if (targetId) onMove(targetId, propertyMapping); }}>
      <header><span>⇢</span><div><strong>Mover pagina</strong><small>Confirme como cada propriedade sera tratada.</small></div></header>
      <label>Data Source de destino<select value={targetId} onChange={(event) => selectTarget(event.target.value)}>{availableTargets.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.title}</option>)}</select></label>
      <div className="lab-move-mapping">{sourceSchema.properties.map((source) => {
        const selected = target?.schema.properties.find((candidate) => candidate.id === mapping[source.id]);
        return <label key={source.id}><span><strong>{source.name}</strong><small>{source.type}</small></span><select value={mapping[source.id] ?? ''} onChange={(event) => setMapping((current) => ({ ...current, [source.id]: event.target.value }))}><option value="">Arquivar no snapshot</option>{target?.schema.properties.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} ({candidate.type})</option>)}</select><em>{selected ? selected.type === source.type ? 'Direto' : 'Converter' : 'Arquivar'}</em></label>;
      })}</div>
      <footer><button type="button" onClick={onClose}>Cancelar</button><button type="submit" disabled={!targetId}>Confirmar movimento</button></footer>
    </form>
  </div>;
}

function CreateResourceDialog({ type, schema, sources, onClose, onCreate }: {
  type: WorkspaceResource['type'];
  schema: NotionSchema;
  sources: Array<{ id: string; title: string; schema: NotionSchema }>;
  onClose: () => void;
  onCreate: (type: WorkspaceResource['type'], title: string, existingDatePropertyId?: string, sourceDataSourceId?: string) => void;
}) {
  const labels: Record<WorkspaceResource['type'], string> = { board: 'Board', calendar: 'Calendario', table: 'Tabela', list: 'Lista', gallery: 'Galeria', timeline: 'Timeline', chart: 'Grafico' };
  const label = labels[type];
  const [title, setTitle] = useState(`Novo ${label.toLocaleLowerCase()}`);
  const compatibleSources = sources.filter((source) => type === 'board'
    ? source.schema.properties.some((property) => property.type === 'status')
    : type === 'calendar' || type === 'timeline'
      ? source.schema.properties.some((property) => property.type === 'date')
      : true);
  const [sourceId, setSourceId] = useState('new');
  const [datePropertyId, setDatePropertyId] = useState('new');
  const selectedSource = compatibleSources.find((source) => source.id === sourceId);
  const dates = (selectedSource?.schema ?? schema).properties.filter((property) => property.type === 'date');
  return <div className="lab-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="lab-dialog" onSubmit={(event) => { event.preventDefault(); if (title.trim()) onCreate(type, title.trim(), datePropertyId === 'new' ? undefined : datePropertyId, sourceId === 'new' ? undefined : sourceId); }}><header><span>{type === 'board' ? '▦' : type === 'table' ? '▤' : type === 'list' ? '☷' : type === 'gallery' ? '▦' : type === 'chart' ? '▥' : '▣'}</span><div><strong>Nova view: {label}</strong><small>Crie uma fonte independente ou use uma Data Source existente.</small></div></header><label>Titulo<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>Data Source<select value={sourceId} onChange={(event) => { setSourceId(event.target.value); setDatePropertyId('new'); }}><option value="new">Nova fonte de dados</option>{compatibleSources.map((source) => <option key={source.id} value={source.id}>{source.title}</option>)}</select></label>{type === 'calendar' || type === 'timeline' ? <label>Propriedade de data<select value={datePropertyId} onChange={(event) => setDatePropertyId(event.target.value)}><option value="new">{sourceId === 'new' ? 'Criar nova propriedade' : 'Usar primeira propriedade disponível'}</option>{dates.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label> : null}<footer><button type="button" onClick={onClose}>Cancelar</button><button type="submit">Criar</button></footer></form></div>;
}

function EmbeddedPagePreview({ schema, page }: { schema: NotionSchema; page: NotionPageData }) {
  return (
    <main className="lab-embed-preview">
      {page.coverUrl ? <div className="lab-embed-cover" style={{ backgroundImage: `url(${page.coverUrl})`, backgroundPositionY: `${page.coverPosition ?? 50}%` }} /> : null}
      <section className="lab-embed-page">
        <span className="lab-embed-icon">{page.icon || '📄'}</span>
        <p>PAGE</p>
        <h1>{page.title || 'Sem titulo'}</h1>
        <PropertiesPanel schema={schema} properties={page.properties} />
        <div className="npc-page-divider" />
        <NotionEditor initialContent={page.content} editable={false} />
      </section>
    </main>
  );
}

function EmbeddedBoardPreview({ resource, schema, pages }: { resource: Extract<WorkspaceResource, { type: 'board' }>; schema: NotionSchema; pages: NotionPageData[] }) {
  const status = schema.properties.find((property) => property.id === resource.statusPropertyId && property.type === 'status');
  const options = status?.type === 'status' ? status.options : [];
  return (
    <main className="lab-embed-preview lab-embed-board-preview">
      <header><p>BOARD</p><h1>{resource.title}</h1></header>
      <div className="lab-embed-board">
        {options.map((option) => (
          <section key={option.id}>
            <h2><i data-color={option.color} />{option.name}<b>{pages.filter((page) => page.properties[status?.id ?? 'status'] === option.id).length}</b></h2>
            {pages.filter((page) => page.properties[status?.id ?? 'status'] === option.id).map((page) => (
              <NotionPageCard key={page.id} schema={schema} page={page} visiblePropertyIds={['priority', 'tags', 'assignee', 'due']} />
            ))}
          </section>
        ))}
      </div>
    </main>
  );
}
