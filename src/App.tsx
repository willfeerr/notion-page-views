import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, FileJson, GripVertical, Moon, Plus, RotateCcw, Search, Sun, Trash2, X } from 'lucide-react';
import type { SerializedEditorState } from 'lexical';
import { NotionEditor, NotionPageCard, NotionPageView } from '../notion-page';
import { PropertiesPanel } from '../notion-page/PropertiesPanel';
import { samplePages, sampleSchema } from '../notion-page/example/sampleData';
import type { NotionPageData, NotionSchema, StoredPropertyValue } from '../notion-page/types';
import { Doc } from 'yjs';
import { BroadcastProvider } from '../notion-page/editor/BroadcastProvider';
import { CalendarView } from './CalendarView';
import { WorkspaceYjsStore } from './workspaceYjs';
import { downloadJson, pageExport, pageSearchText, resourceExport } from './exportJson';
import {
  buildProperty, createId, emptyValueFor, normalizeDateValue, schemaForResource,
  type BoardResource, type CalendarResource, type WorkspaceResource,
} from './domain';

type View = 'board' | 'calendar' | 'page';

const STORAGE_KEY = 'notion-pages-real-v2';

function loadState(): { schema: NotionSchema; pages: NotionPageData[]; resources?: WorkspaceResource[] } {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as { schema: NotionSchema; pages: NotionPageData[]; resources?: WorkspaceResource[] };
  } catch { /* use seed */ }
  return { schema: structuredClone(sampleSchema), pages: structuredClone(samplePages) };
}

export default function App() {
  const [initial] = useState(loadState);
  const [schema, setSchema] = useState(initial.schema);
  const [pages, setPages] = useState(initial.pages);
  const [resources, setResources] = useState<WorkspaceResource[]>(initial.resources ?? []);
  const [view, setView] = useState<View>('board');
  const [activeResourceId, setActiveResourceId] = useState('board-roadmap');
  const [creatingType, setCreatingType] = useState<WorkspaceResource['type'] | null>(null);
  const [openId, setOpenId] = useState<string | null>(initial.pages[1]?.id ?? initial.pages[0]?.id ?? null);
  const [query, setQuery] = useState('');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggingLaneId, setDraggingLaneId] = useState<string | null>(null);
  const [editingLaneId, setEditingLaneId] = useState<string | null>(null);
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

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('skrbe-theme', theme);
  }, [theme]);

  useEffect(() => {
    const document = new Doc();
    const provider = new BroadcastProvider('notion-pages-workspace', document);
    const store = new WorkspaceYjsStore(document);
    workspaceStoreRef.current = store;
    store.initialize(initial);
    const unsubscribe = store.subscribe((state) => {
      setSchema(state.schema);
      setPages(state.pages);
      setResources(state.resources ?? []);
    });

    return () => {
      unsubscribe();
      provider.destroy();
      document.destroy();
      workspaceStoreRef.current = null;
    };
  }, [initial]);

  const openPage = pages.find((page) => page.id === openId) ?? pages[0] ?? null;
  const activeResource = resources.find((resource) => resource.id === activeResourceId) ?? resources[0];
  const activeSchema = useMemo(() => schemaForResource(schema, activeResource), [activeResource, schema]);
  const statusDefinition = activeResource?.type === 'board'
    ? schema.properties.find((property) => property.id === activeResource.statusPropertyId && property.type === 'status')
    : undefined;
  const statusOptions = statusDefinition?.type === 'status' ? statusDefinition.options : [];
  const visiblePages = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR');
    return normalized ? pages.filter((page) => pageSearchText(page, schema).toLocaleLowerCase('pt-BR').includes(normalized)) : pages;
  }, [pages, query, schema]);
  const activePages = useMemo(() => {
    if (!activeResource) return visiblePages;
    const byId = new Map(visiblePages.map((page) => [page.id, page]));
    return activeResource.pageIds.map((id) => byId.get(id)).filter((page): page is NotionPageData => Boolean(page));
  }, [activeResource, visiblePages]);

  function updatePage(id: string, patch: Partial<NotionPageData>) {
    const now = new Date().toISOString();
    const editedProperty = schema.properties.find((property) => property.type === 'last_edited_time');
    const page = pages.find((item) => item.id === id);
    if (!page) return;
    const nextPatch: Partial<NotionPageData> = { ...patch, lastEditedTime: now };
    const changedProperties = { ...(patch.properties ?? {}) };
    if (editedProperty) changedProperties[editedProperty.id] = now;
    if (Object.keys(changedProperties).length) nextPatch.properties = changedProperties;
    workspaceStoreRef.current?.updatePage(id, nextPatch);
  }

  function updateProperty(pageId: string, propertyId: string, value: StoredPropertyValue) {
    const page = pages.find((item) => item.id === pageId);
    if (!page) return;
    workspaceStoreRef.current?.updateProperty(pageId, propertyId, value);
    const definition = schema.properties.find((property) => property.id === propertyId);
    if (definition?.type === 'date') {
      resources.filter((resource) => resource.type === 'calendar' && resource.datePropertyId === propertyId).forEach((calendar) => {
        if (value) workspaceStoreRef.current?.linkPage(calendar.id, pageId);
        else workspaceStoreRef.current?.unlinkPage(calendar.id, pageId);
      });
    }
  }

  function updateSchema(next: NotionSchema, fallbackByPropertyId: Record<string, StoredPropertyValue> = {}) {
    if (!activeResource) return;
    const activeIds = new Set(activeResource.propertyIds);
    const resourceProperties = [...next.properties];
    let primaryPatch: Partial<WorkspaceResource> = {};
    if (activeResource.type === 'board' && !resourceProperties.some((property) => property.id === activeResource.statusPropertyId && property.type === 'status')) {
      const replacement = buildProperty('status', `${activeResource.title} Status`);
      resourceProperties.push(replacement);
      primaryPatch = { statusPropertyId: replacement.id } as Partial<WorkspaceResource>;
    }
    if (activeResource.type === 'calendar' && !resourceProperties.some((property) => property.id === activeResource.datePropertyId && property.type === 'date')) {
      const replacement = buildProperty('date', `${activeResource.title} Data`);
      resourceProperties.push(replacement);
      primaryPatch = { datePropertyId: replacement.id } as Partial<WorkspaceResource>;
    }
    const nextById = new Map(resourceProperties.map((property) => [property.id, property]));
    const referencedElsewhere = new Set(resources.filter((resource) => resource.id !== activeResource.id).flatMap((resource) => resource.propertyIds));
    const mergedProperties = schema.properties.flatMap((property) => {
      const changed = nextById.get(property.id);
      if (changed) {
        nextById.delete(property.id);
        return [changed];
      }
      if (activeIds.has(property.id) && !referencedElsewhere.has(property.id)) return [];
      return [property];
    });
    const merged = { properties: [...mergedProperties, ...nextById.values()] };
    workspaceStoreRef.current?.applySchema(merged, fallbackByPropertyId);
    workspaceStoreRef.current?.updateResource(activeResource.id, {
      ...primaryPatch,
      propertyIds: resourceProperties.map((property) => property.id),
    } as Partial<WorkspaceResource>);
  }

  function createPage(statusId?: string, afterPageId?: string) {
    const now = new Date().toISOString();
    const properties = Object.fromEntries(schema.properties.map((definition) => [definition.id, emptyValueFor(definition)]));
    if (statusDefinition && statusId) properties[statusDefinition.id] = statusId;
    for (const definition of schema.properties) {
      if (definition.type === 'created_time' || definition.type === 'last_edited_time') properties[definition.id] = now;
    }
    const page: NotionPageData = {
      id: crypto.randomUUID(), icon: '📄', coverUrl: null, title: 'Sem titulo', properties,
      content: null, createdTime: now, lastEditedTime: now,
    };
    workspaceStoreRef.current?.insertPage(page, afterPageId);
    if (activeResource) workspaceStoreRef.current?.linkPage(activeResource.id, page.id, afterPageId);
    setOpenId(page.id);
    setView('page');
  }

  function movePage(pageId: string, statusId: string) {
    if (!statusDefinition) return;
    updateProperty(pageId, statusDefinition.id, statusId);
  }

  function resetDemo() {
    if (!confirm('Restaurar schema e paginas de exemplo?')) return;
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
    const properties = Object.fromEntries(schema.properties.map((definition) => [definition.id, emptyValueFor(definition)]));
    properties[datePropertyId] = normalizeDateValue({ start, end: end ?? start, allDay: start.length <= 10 }, activeResource?.type === 'calendar' ? activeResource.timezone : undefined);
    if (statusDefinition && statusId) properties[statusDefinition.id] = statusId;
    for (const definition of schema.properties) {
      if (definition.type === 'created_time' || definition.type === 'last_edited_time') properties[definition.id] = now;
    }
    const page: NotionPageData = { id: crypto.randomUUID(), icon: '📅', coverUrl: null, title: 'Novo evento', properties, content: null, createdTime: now, lastEditedTime: now };
    workspaceStoreRef.current?.insertPage(page);
    if (activeResource?.type === 'calendar') workspaceStoreRef.current?.linkPage(activeResource.id, page.id);
    setOpenId(page.id);
    setView('page');
  }

  function moveCalendarEvent(pageId: string, datePropertyId: string, start: string, end: string) {
    const current = pages.find((page) => page.id === pageId)?.properties[datePropertyId];
    const normalized = normalizeDateValue(current, activeResource?.type === 'calendar' ? activeResource.timezone : undefined);
    updateProperty(pageId, datePropertyId, { ...normalized, start, end, allDay: start.length <= 10 });
  }

  function createResource(type: WorkspaceResource['type'], title: string, existingDatePropertyId?: string) {
    const existingDate = type === 'calendar' && existingDatePropertyId
      ? schema.properties.find((property) => property.id === existingDatePropertyId && property.type === 'date')
      : undefined;
    const primary = existingDate ?? buildProperty(type === 'board' ? 'status' : 'date', type === 'board' ? `${title} Status` : `${title} Data`);
    const propertyIds = [primary.id];
    const id = createId(type);
    const resource: WorkspaceResource = type === 'board'
      ? { id, type, title, pageIds: [], propertyIds, statusPropertyId: primary.id }
      : { id, type, title, pageIds: [], propertyIds, datePropertyId: primary.id, timezone: 'America/Sao_Paulo', defaultView: 'month', visibleHours: { from: 7, to: 21 } };
    workspaceStoreRef.current?.createResource(resource, existingDate ? [] : [primary]);
    setActiveResourceId(resource.id);
    setView(type);
    setCreatingType(null);
  }

  function openResource(resource: WorkspaceResource) {
    setActiveResourceId(resource.id);
    setView(resource.type);
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
    const next = pages.find((page) => page.id !== openPage.id);
    setOpenId(next?.id ?? null);
    setView(activeResource?.type ?? 'board');
  }

  function exportActiveResource() {
    if (!activeResource) return;
    downloadJson(activeResource.title, resourceExport(activeResource, pages, schema));
  }

  if (preview.kind === 'page') {
    const page = pages.find((item) => item.id === preview.id) ?? pages[0];
    return page ? <EmbeddedPagePreview schema={schema} page={page} /> : null;
  }

  if (preview.kind === 'board') {
    const resource = resources.find((item): item is BoardResource => item.type === 'board' && item.id === preview.id)
      ?? resources.find((item): item is BoardResource => item.type === 'board');
    return resource ? <EmbeddedBoardPreview resource={resource} schema={schemaForResource(schema, resource)} pages={pages.filter((page) => resource.pageIds.includes(page.id))} /> : null;
  }

  if (preview.kind === 'calendar') {
    const resource = resources.find((item): item is CalendarResource => item.type === 'calendar' && item.id === preview.id)
      ?? resources.find((item): item is CalendarResource => item.type === 'calendar');
    return resource ? <CalendarView title={resource.title} schema={schemaForResource(schema, resource)} pages={pages.filter((page) => resource.pageIds.includes(page.id))} datePropertyId={resource.datePropertyId} timezone={resource.timezone} defaultView={resource.defaultView} visibleHours={resource.visibleHours} onOpenPage={() => undefined} onCreatePage={() => undefined} onMoveEvent={() => undefined} /> : null;
  }

  return (
    <div className="lab-shell">
      <aside className="lab-sidebar">
        <div className="lab-brand"><span>N</span><strong>Notion Pages Lab</strong></div>
        <div className="lab-sidebar-label"><span>APPS</span><button type="button" title="Novo board" onClick={() => setCreatingType('board')}><Plus size={13} /></button></div>
        {resources.map((resource) => (
          <div key={resource.id} className={`lab-resource-row${view === resource.type && activeResource?.id === resource.id ? ' is-active' : ''}`}>
            <button type="button" onClick={() => openResource(resource)} onDoubleClick={() => renameResource(resource)}>{resource.type === 'calendar' ? <CalendarDays size={14} /> : <span className="lab-nav-symbol">▦</span>}<span>{resource.title}</span></button>
            <button type="button" title="Renomear" onClick={() => renameResource(resource)}>✎</button>
            <button type="button" title="Excluir" onClick={() => deleteResource(resource)}><Trash2 size={12} /></button>
          </div>
        ))}
        <div className="lab-sidebar-create">
          <button type="button" onClick={() => setCreatingType('board')}><Plus size={13} />Board</button>
          <button type="button" onClick={() => setCreatingType('calendar')}><Plus size={13} />Calendario</button>
        </div>
        <button className={view === 'page' ? 'is-active' : ''} onClick={() => setView('page')} disabled={!openPage}>□ Pagina</button>
        <div className="lab-sidebar-foot"><button onClick={resetDemo}><RotateCcw size={14} />Restaurar demo</button></div>
      </aside>

      <main className="lab-main">
        <header className="lab-topbar">
          <div className="lab-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar paginas" /></div>
          <div className="lab-top-actions">
            <span>{pages.length} paginas · {schema.properties.length} propriedades</span>
            <button className="lab-theme-toggle" type="button" title={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <button className="lab-export-button" type="button" title="Exportar recurso como JSON" onClick={exportActiveResource}><FileJson size={14} />JSON</button>
            <button onClick={() => createPage()}><Plus size={14} />Nova pagina</button>
          </div>
        </header>

        {view === 'board' && (
          <section className="lab-board-view">
            <div className="lab-heading"><div><span>BOARD</span><h1>{activeResource?.type === 'board' ? activeResource.title : 'Board'}</h1></div><button onClick={() => createPage()}><Plus size={15} />Nova pagina</button></div>
            <div className="lab-board">
              {statusOptions.map((status) => {
                const columnPages = activePages.filter((page) => page.properties[statusDefinition?.id ?? 'status'] === status.id);
                return (
                  <section key={status.id} className="lab-column"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (draggingId) movePage(draggingId, status.id);
                      else reorderLane(status.id);
                      setDraggingId(null);
                    }}>
                    <header draggable onDragStart={() => setDraggingLaneId(status.id)} onDragEnd={() => setDraggingLaneId(null)}>
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
                      ) : <button className="lab-lane-title" type="button" title="Renomear lane" onClick={() => setEditingLaneId(status.id)}>{status.name}</button>}
                      <b>{columnPages.length}</b>
                      <button type="button" title="Adicionar card" onClick={() => createPage(status.id)}><Plus size={14} /></button>
                      <button type="button" title="Excluir lane" disabled={statusOptions.length <= 1} onClick={() => deleteLane(status.id)}><Trash2 size={13} /></button>
                    </header>
                    <div className="lab-card-list">
                      {columnPages.map((page) => (
                        <div key={page.id} className="lab-card-slot" onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
                          event.stopPropagation();
                          if (!draggingId || !activeResource || draggingId === page.id) return;
                          movePage(draggingId, status.id);
                          workspaceStoreRef.current?.reorderResourcePage(activeResource.id, draggingId, page.id);
                          setDraggingId(null);
                        }}>
                          <div draggable onDragStart={() => setDraggingId(page.id)} onDragEnd={() => setDraggingId(null)} className={draggingId === page.id ? 'is-dragging' : ''}>
                          <NotionPageCard schema={activeSchema} page={page} visiblePropertyIds={activeSchema.properties.filter((property) => property.id !== statusDefinition?.id).slice(0, 4).map((property) => property.id)} onClick={() => { setOpenId(page.id); setView('page'); }} />
                          </div>
                          <div className="lab-insert-row">
                            <span />
                            <button type="button" onClick={() => createPage(status.id, page.id)} title="Adicionar pagina depois deste card">+</button>
                            <span />
                          </div>
                        </div>
                      ))}
                    </div>
                    <button className="lab-add-card" onClick={() => createPage(status.id)}>+ Nova pagina</button>
                  </section>
                );
              })}
              <button className="lab-add-lane" type="button" aria-label="Adicionar lane" onClick={addLane}><Plus size={18} /><span>Adicionar lane</span></button>
            </div>
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
            onOpenPage={(pageId) => { setOpenId(pageId); setView('page'); }}
            onCreatePage={createCalendarPage}
            onMoveEvent={moveCalendarEvent}
          />
        )}

        {view === 'page' && openPage && (
          <section className="lab-page-stage">
            <div className="lab-page-toolbar">
              <button onClick={() => setView(activeResource?.type ?? 'board')}>← {activeResource?.title ?? 'Workspace'}</button>
              <span>Salvo no Yjs local</span>
              <div><button type="button" title="Exportar pagina como JSON" onClick={() => downloadJson(openPage.title, pageExport(openPage, schema))}><FileJson size={14} />Exportar JSON</button><button type="button" title="Excluir pagina" onClick={deleteOpenPage}><Trash2 size={14} /></button><button title="Fechar" onClick={() => setView(activeResource?.type ?? 'board')}><X size={15} /></button></div>
            </div>
            <NotionPageView
              schema={activeSchema}
              page={openPage}
              collab={{ transport: 'broadcast', room: `page-${openPage.id}`, user: { id: 'local-user', name: 'Voce', color: '#2383e2' } }}
              onTitleChange={(title) => updatePage(openPage.id, { title })}
              onIconChange={(icon) => updatePage(openPage.id, { icon })}
              onCoverChange={(coverUrl) => updatePage(openPage.id, { coverUrl })}
              onCoverPositionChange={(coverPosition) => updatePage(openPage.id, { coverPosition })}
              onPropertyChange={(propertyId, value) => updateProperty(openPage.id, propertyId, value)}
              onContentChange={(content: SerializedEditorState) => updatePage(openPage.id, { content })}
              onSchemaChange={updateSchema}
            />
          </section>
        )}
      </main>
      {creatingType ? <CreateResourceDialog type={creatingType} schema={schema} onClose={() => setCreatingType(null)} onCreate={createResource} /> : null}
    </div>
  );
}

function CreateResourceDialog({ type, schema, onClose, onCreate }: { type: WorkspaceResource['type']; schema: NotionSchema; onClose: () => void; onCreate: (type: WorkspaceResource['type'], title: string, existingDatePropertyId?: string) => void }) {
  const [title, setTitle] = useState(type === 'board' ? 'Novo board' : 'Novo calendario');
  const [datePropertyId, setDatePropertyId] = useState('new');
  const dates = schema.properties.filter((property) => property.type === 'date');
  return <div className="lab-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="lab-dialog" onSubmit={(event) => { event.preventDefault(); if (title.trim()) onCreate(type, title.trim(), datePropertyId === 'new' ? undefined : datePropertyId); }}><header><span>{type === 'board' ? '▦' : '▣'}</span><div><strong>Novo {type === 'board' ? 'Board' : 'Calendario'}</strong><small>Crie uma entidade independente no workspace.</small></div></header><label>Titulo<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} /></label>{type === 'calendar' ? <label>Propriedade de data<select value={datePropertyId} onChange={(event) => setDatePropertyId(event.target.value)}><option value="new">Criar nova propriedade</option>{dates.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label> : null}<footer><button type="button" onClick={onClose}>Cancelar</button><button type="submit">Criar</button></footer></form></div>;
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
