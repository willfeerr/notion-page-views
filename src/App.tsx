import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, RotateCcw, Search, Settings2, X } from 'lucide-react';
import type { SerializedEditorState } from 'lexical';
import { NotionPageCard, NotionPageView } from '../notion-page';
import { samplePages, sampleSchema } from '../notion-page/example/sampleData';
import type { NotionPageData, NotionSchema, PropertyDefinition, StoredPropertyValue } from '../notion-page/types';
import { Doc, Map as YMap, type YMapEvent, type Transaction } from 'yjs';
import { BroadcastProvider } from '../notion-page/editor/BroadcastProvider';

type View = 'board' | 'page';

const STORAGE_KEY = 'notion-pages-real-v2';
const WORKSPACE_ORIGIN = Symbol('workspace-local-change');

function loadState(): { schema: NotionSchema; pages: NotionPageData[] } {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as { schema: NotionSchema; pages: NotionPageData[] };
  } catch { /* use seed */ }
  return { schema: structuredClone(sampleSchema), pages: structuredClone(samplePages) };
}

function emptyValueFor(definition: PropertyDefinition): StoredPropertyValue {
  if (definition.type === 'checkbox') return false;
  if (definition.type === 'multi_select' || definition.type === 'person') return [];
  return null;
}

export default function App() {
  const [initial] = useState(loadState);
  const [schema, setSchema] = useState(initial.schema);
  const [pages, setPages] = useState(initial.pages);
  const [view, setView] = useState<View>('board');
  const [openId, setOpenId] = useState(initial.pages[1]?.id ?? initial.pages[0]?.id ?? null);
  const [query, setQuery] = useState('');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [user] = useState(() => ({ id: crypto.randomUUID(), name: 'Você', color: '#2F76B7' }));
  const workspaceMapRef = useRef<YMap<string> | null>(null);
  const workspaceReadyRef = useRef(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schema, pages }));
    const map = workspaceMapRef.current;
    if (!workspaceReadyRef.current || !map) return;
    const serialized = JSON.stringify({ schema, pages });
    if (map.get('snapshot') !== serialized) {
      map.doc?.transact(() => map.set('snapshot', serialized), WORKSPACE_ORIGIN);
    }
  }, [schema, pages]);

  useEffect(() => {
    const document = new Doc();
    const provider = new BroadcastProvider('notion-pages-workspace', document);
    const map = document.getMap<string>('workspace');
    workspaceMapRef.current = map;

    const applySnapshot = () => {
      const raw = map.get('snapshot');
      if (!raw) return;
      try {
        const snapshot = JSON.parse(raw) as { schema: NotionSchema; pages: NotionPageData[] };
        setSchema(snapshot.schema);
        setPages(snapshot.pages);
      } catch { /* ignore malformed remote state */ }
    };
    const observer = (_event: YMapEvent<string>, transaction: Transaction) => {
      if (transaction.origin !== WORKSPACE_ORIGIN) applySnapshot();
    };
    map.observe(observer);
    const initialize = window.setTimeout(() => {
      workspaceReadyRef.current = true;
      if (map.has('snapshot')) applySnapshot();
      else document.transact(() => map.set('snapshot', JSON.stringify(initial)), WORKSPACE_ORIGIN);
    }, 180);

    return () => {
      window.clearTimeout(initialize);
      map.unobserve(observer);
      provider.destroy();
      document.destroy();
      workspaceMapRef.current = null;
    };
  }, [initial]);

  const openPage = pages.find((page) => page.id === openId) ?? pages[0] ?? null;
  const statusDefinition = schema.properties.find((property) => property.type === 'status');
  const statusOptions = statusDefinition?.type === 'status' ? statusDefinition.options : [];
  const visiblePages = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR');
    return normalized ? pages.filter((page) => page.title.toLocaleLowerCase('pt-BR').includes(normalized)) : pages;
  }, [pages, query]);

  function updatePage(id: string, patch: Partial<NotionPageData>) {
    const now = new Date().toISOString();
    setPages((current) => current.map((page) => page.id === id
      ? { ...page, ...patch, lastEditedTime: now, properties: { ...page.properties, editedTime: now, ...(patch.properties ?? {}) } }
      : page));
  }

  function updateProperty(pageId: string, propertyId: string, value: StoredPropertyValue) {
    const page = pages.find((item) => item.id === pageId);
    if (!page) return;
    updatePage(pageId, { properties: { ...page.properties, [propertyId]: value } });
  }

  function updateSchema(next: NotionSchema) {
    const previousIds = new Set(schema.properties.map((property) => property.id));
    const nextIds = new Set(next.properties.map((property) => property.id));
    const added = next.properties.filter((property) => !previousIds.has(property.id));
    setSchema(next);
    setPages((current) => current.map((page) => {
      const properties = Object.fromEntries(Object.entries(page.properties).filter(([id]) => nextIds.has(id)));
      for (const definition of added) properties[definition.id] = emptyValueFor(definition);
      return { ...page, properties };
    }));
  }

  function createPage(statusId?: string) {
    const now = new Date().toISOString();
    const properties = Object.fromEntries(schema.properties.map((definition) => [definition.id, emptyValueFor(definition)]));
    if (statusDefinition && statusId) properties[statusDefinition.id] = statusId;
    properties.createdTime = now;
    properties.editedTime = now;
    const page: NotionPageData = {
      id: crypto.randomUUID(), icon: '📄', coverUrl: null, title: 'Sem titulo', properties,
      content: null, createdTime: now, lastEditedTime: now,
    };
    setPages((current) => [...current, page]);
    setOpenId(page.id);
    setView('page');
  }

  function movePage(pageId: string, statusId: string) {
    if (!statusDefinition) return;
    updateProperty(pageId, statusDefinition.id, statusId);
  }

  function resetDemo() {
    if (!confirm('Restaurar schema e paginas de exemplo?')) return;
    setSchema(structuredClone(sampleSchema));
    setPages(structuredClone(samplePages));
    setOpenId(samplePages[1]?.id ?? samplePages[0]?.id ?? null);
    setView('board');
  }

  return (
    <div className="lab-shell">
      <aside className="lab-sidebar">
        <div className="lab-brand"><span>N</span><strong>Notion Pages Lab</strong></div>
        <button className={view === 'board' ? 'is-active' : ''} onClick={() => setView('board')}>▦ Board</button>
        <button className={view === 'page' ? 'is-active' : ''} onClick={() => setView('page')} disabled={!openPage}>□ Pagina</button>
        <div className="lab-sidebar-foot"><button onClick={resetDemo}><RotateCcw size={14} />Restaurar demo</button></div>
      </aside>

      <main className="lab-main">
        <header className="lab-topbar">
          <div className="lab-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar paginas" /></div>
          <div className="lab-top-actions"><span>{pages.length} paginas · {schema.properties.length} propriedades</span><button onClick={() => createPage()}><Plus size={14} />Nova pagina</button></div>
        </header>

        {view === 'board' && (
          <section className="lab-board-view">
            <div className="lab-heading"><div><span>DATABASE</span><h1>Roadmap de produto</h1></div><button onClick={() => createPage()}><Plus size={15} />Nova pagina</button></div>
            <div className="lab-board">
              {statusOptions.map((status) => {
                const columnPages = visiblePages.filter((page) => page.properties[statusDefinition?.id ?? 'status'] === status.id);
                return (
                  <section key={status.id} className="lab-column"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => { if (draggingId) movePage(draggingId, status.id); setDraggingId(null); }}>
                    <header><i data-color={status.color} />{status.name}<b>{columnPages.length}</b><button onClick={() => createPage(status.id)}>+</button></header>
                    <div className="lab-card-list">
                      {columnPages.map((page) => (
                        <div key={page.id} draggable onDragStart={() => setDraggingId(page.id)} onDragEnd={() => setDraggingId(null)} className={draggingId === page.id ? 'is-dragging' : ''}>
                          <NotionPageCard schema={schema} page={page} visiblePropertyIds={['priority', 'tags', 'assignee', 'due']} onClick={() => { setOpenId(page.id); setView('page'); }} />
                        </div>
                      ))}
                    </div>
                    <button className="lab-add-card" onClick={() => createPage(status.id)}>+ Nova pagina</button>
                  </section>
                );
              })}
            </div>
          </section>
        )}

        {view === 'page' && openPage && (
          <section className="lab-page-stage">
            <div className="lab-page-toolbar"><button onClick={() => setView('board')}>← Board</button><span>Yjs local · sincronização entre abas</span><button title="Fechar" onClick={() => setView('board')}><X size={15} /></button></div>
            <NotionPageView
              schema={schema}
              page={openPage}
              onTitleChange={(title) => updatePage(openPage.id, { title })}
              onIconChange={(icon) => updatePage(openPage.id, { icon })}
              onCoverChange={(coverUrl) => updatePage(openPage.id, { coverUrl })}
              onCoverPositionChange={(coverPosition) => updatePage(openPage.id, { coverPosition })}
              onPropertyChange={(propertyId, value) => updateProperty(openPage.id, propertyId, value)}
              onContentChange={(content: SerializedEditorState) => updatePage(openPage.id, { content })}
              onSchemaChange={updateSchema}
              collab={{ transport: 'broadcast', room: `page-${openPage.id}`, user }}
            />
          </section>
        )}
      </main>
    </div>
  );
}
