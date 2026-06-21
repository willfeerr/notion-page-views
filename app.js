const PEOPLE = [
  { id: 'MS', name: 'Marina Souza', color: 'purple' },
  { id: 'FA', name: 'Felipe Andrade', color: 'blue' },
  { id: 'RL', name: 'Renata Lima', color: 'green' },
  { id: 'WF', name: 'Willian Ferreira', color: 'orange' },
];

const TAGS = ['Design', 'Frontend', 'Backend', 'Pesquisa', 'Bug'];
const EMOJIS = ['📄', '📝', '📋', '📌', '💡', '🎯', '🚀', '⚡', '🔥', '✅', '⭐', '🏆', '📊', '🧩', '💻', '🧠', '📦', '📅', '🏷️', '🎨'];
const PROPERTY_ORDER = ['status', 'priority', 'tags', 'assignees', 'due', 'reviewed'];
const COVER = 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1600&q=80';

const seedPages = [
  pageSeed('research', '🔎', 'Pesquisa com usuarios', 'todo', 'Media', ['Design', 'Pesquisa'], ['RL'], '', 'Consolidar entrevistas e transformar os aprendizados em decisoes de produto.'),
  pageSeed('launch', '🚀', 'Lancamento da v2.0', 'doing', 'Alta', ['Frontend', 'Backend'], ['MS', 'FA'], COVER, 'Plano de lancamento do novo dashboard, com foco em performance e permissoes por equipe.'),
  pageSeed('billing', '💳', 'Revisar fluxo de cobranca', 'doing', 'Urgente', ['Backend', 'Bug'], ['FA'], '', 'Mapear falhas de pagamento e melhorar a recuperacao de assinaturas.'),
  pageSeed('onboarding', '✨', 'Novo onboarding', 'done', 'Baixa', ['Design', 'Frontend'], ['MS'], '', 'Primeira experiencia mais curta, clara e orientada ao resultado.'),
];

const columns = [
  { id: 'todo', label: 'A fazer', tone: 'gray' },
  { id: 'doing', label: 'Em andamento', tone: 'blue' },
  { id: 'done', label: 'Concluido', tone: 'green' },
];

const state = {
  pages: loadPages(),
  activeView: location.hash.slice(1) || 'board',
  activePageId: localStorage.getItem('notion-active-page') || 'launch',
  fullWidth: false,
  smallFont: false,
  toc: false,
  filter: 'all',
  draggedPageId: null,
  draggedBlockId: null,
  draggedProperty: null,
  insertAfterBlockId: null,
};

const root = document.querySelector('#view-root');
const label = document.querySelector('#current-view-label');
const sidebar = document.querySelector('.sidebar');

document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.view)));
document.querySelector('.mobile-menu').addEventListener('click', () => sidebar.classList.toggle('is-open'));
window.addEventListener('hashchange', () => { state.activeView = location.hash.slice(1) || 'board'; render(); });
document.addEventListener('click', (event) => {
  if (!event.target.closest('.menu-root') && !event.target.closest('[data-menu-toggle]')) closeMenus();
});

function pageSeed(id, icon, title, status, priority, tags, assignees, cover, summary) {
  return {
    id, icon, title, status, priority, tags, assignees, cover, summary,
    due: id === 'launch' ? '2026-07-03' : '', reviewed: id === 'onboarding', coverPosition: 48,
    propertyOrder: [...PROPERTY_ORDER], blocks: defaultBlocks(summary),
  };
}

function defaultBlocks(summary) {
  return [
    block('heading1', 'Visao geral'),
    block('paragraph', summary),
    block('callout', 'Esta pagina e completamente editavel. Arraste blocos, abra os menus e teste os controles.'),
    block('heading2', 'Escopo'),
    block('todo', 'Validar a experiencia principal', false),
    block('todo', 'Revisar estados vazios e responsividade', true),
    block('todo', 'Preparar integracao com o backend', false),
    block('quote', 'Performance nao e feature, e pre-requisito.'),
  ];
}

function block(type, text = '', checked = false, src = '') {
  return { id: uid('block'), type, text, checked, src };
}

function uid(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function loadPages() {
  try {
    const saved = JSON.parse(localStorage.getItem('notion-preview-pages'));
    if (!Array.isArray(saved) || saved.length === 0) return structuredClone(seedPages);
    return saved.map((page) => ({
      reviewed: false, due: '', coverPosition: 48, propertyOrder: [...PROPERTY_ORDER], ...page,
      blocks: Array.isArray(page.blocks) ? page.blocks : defaultBlocks(page.summary || ''),
    }));
  } catch { return structuredClone(seedPages); }
}

function persist() {
  localStorage.setItem('notion-preview-pages', JSON.stringify(state.pages));
  localStorage.setItem('notion-active-page', state.activePageId);
}

function navigate(view) {
  state.activeView = view;
  if (location.hash.slice(1) !== view) location.hash = view;
  sidebar.classList.remove('is-open');
  render();
}

function activePage() {
  return state.pages.find((item) => item.id === state.activePageId) || state.pages[0];
}

function render() {
  const view = ['board', 'page', 'components'].includes(state.activeView) ? state.activeView : 'board';
  document.querySelectorAll('[data-view]').forEach((item) => item.classList.toggle('is-active', item.dataset.view === view));
  label.textContent = view === 'board' ? 'Board' : view === 'page' ? 'Pagina' : 'Componentes';
  root.replaceChildren(document.querySelector(`#${view}-template`).content.cloneNode(true));
  if (view === 'board') renderBoard();
  if (view === 'page') renderPage();
  if (view === 'components') renderComponents();
}

function renderBoard() {
  const board = document.querySelector('#board');
  const visiblePages = state.filter === 'all' ? state.pages : state.pages.filter((page) => page.priority === state.filter);
  board.innerHTML = columns.map((column) => {
    const pages = visiblePages.filter((page) => page.status === column.id);
    return `<section class="board-column" data-column="${column.id}">
      <header class="column-header"><span class="status ${column.tone}"><i></i>${column.label}</span><b>${pages.length}</b><button type="button" data-add-status="${column.id}" aria-label="Adicionar pagina">+</button></header>
      <div class="card-list">${pages.map(cardMarkup).join('')}</div>
      <button class="add-card" type="button" data-add-status="${column.id}">+ Nova pagina</button>
    </section>`;
  }).join('');

  const actions = document.querySelector('.heading-actions');
  actions.innerHTML = `<div class="menu-root filter-root">
      <button class="button secondary" type="button" data-menu-toggle="filter-menu">${state.filter === 'all' ? 'Filtrar' : state.filter}⌄</button>
      <div class="dropdown-menu align-right" data-menu="filter-menu">
        ${['all', 'Urgente', 'Alta', 'Media', 'Baixa'].map((value) => `<button type="button" data-filter="${value}" class="${state.filter === value ? 'is-selected' : ''}">${value === 'all' ? 'Todas as prioridades' : value}</button>`).join('')}
      </div>
    </div><button class="button primary" id="new-card" type="button">+ Nova pagina</button>`;

  bindMenuToggles();
  document.querySelectorAll('[data-filter]').forEach((button) => button.addEventListener('click', () => { state.filter = button.dataset.filter; renderBoard(); }));
  document.querySelectorAll('[data-add-status]').forEach((button) => button.addEventListener('click', () => addPage(button.dataset.addStatus)));
  document.querySelector('#new-card').addEventListener('click', () => addPage('todo'));

  board.querySelectorAll('.page-card').forEach((card) => {
    card.addEventListener('click', (event) => {
      if (event.target.closest('button') || event.target.closest('.card-menu')) return;
      state.activePageId = card.dataset.pageId; persist(); navigate('page');
    });
    card.addEventListener('keydown', (event) => { if (event.key === 'Enter') { state.activePageId = card.dataset.pageId; navigate('page'); } });
    card.addEventListener('dragstart', () => { state.draggedPageId = card.dataset.pageId; card.classList.add('is-dragging'); });
    card.addEventListener('dragend', () => { state.draggedPageId = null; card.classList.remove('is-dragging'); clearDropStates(); });
    card.addEventListener('dragover', (event) => { event.preventDefault(); card.classList.add('is-drop-target'); });
    card.addEventListener('dragleave', () => card.classList.remove('is-drop-target'));
  });

  board.querySelectorAll('[data-column]').forEach((column) => {
    column.addEventListener('dragover', (event) => { event.preventDefault(); column.classList.add('is-column-target'); });
    column.addEventListener('dragleave', (event) => { if (!column.contains(event.relatedTarget)) column.classList.remove('is-column-target'); });
    column.addEventListener('drop', (event) => {
      event.preventDefault();
      const targetCard = event.target.closest('.page-card');
      movePage(state.draggedPageId, column.dataset.column, targetCard?.dataset.pageId || null);
    });
  });

  board.querySelectorAll('[data-card-action]').forEach((button) => button.addEventListener('click', (event) => {
    event.stopPropagation();
    const id = button.closest('.page-card').dataset.pageId;
    cardAction(button.dataset.cardAction, id);
  }));
}

function cardMarkup(page) {
  return `<article class="page-card" tabindex="0" draggable="true" data-page-id="${page.id}">
    ${page.cover ? `<span class="card-cover" style="background-image:url('${escapeAttr(page.cover)}');background-position:center ${page.coverPosition}%"></span>` : ''}
    <span class="card-content">
      <span class="card-title-row"><strong class="card-title"><span>${page.icon || '📄'}</span>${escapeHtml(page.title)}</strong>
        <span class="menu-root card-menu-root"><button class="card-more" type="button" data-menu-toggle="card-${page.id}" aria-label="Menu do card">•••</button>
          <span class="dropdown-menu align-right card-menu" data-menu="card-${page.id}">
            <button type="button" data-card-action="open">Abrir</button><button type="button" data-card-action="duplicate">Duplicar</button><button type="button" data-card-action="delete" class="danger">Excluir</button>
          </span>
        </span>
      </span>
      <span class="card-summary">${escapeHtml(page.summary)}</span>
      <span class="card-meta"><span class="priority ${page.priority.toLowerCase()}">${page.priority}</span><span>${formatDate(page.due)}</span></span>
      <span class="card-footer"><span>${page.tags.map((tag) => `<i>${tag}</i>`).join('')}</span><span class="avatar-stack">${page.assignees.map(avatarMarkup).join('')}</span></span>
    </span>
  </article>`;
}

function addPage(status) {
  const page = pageSeed(uid('page'), '📄', 'Nova pagina', status, 'Media', [], ['WF'], '', 'Clique para abrir e editar esta pagina.');
  state.pages.push(page); state.activePageId = page.id; persist(); renderBoard();
}

function movePage(pageId, status, beforeId) {
  if (!pageId) return;
  const index = state.pages.findIndex((page) => page.id === pageId);
  if (index < 0) return;
  const [page] = state.pages.splice(index, 1);
  page.status = status;
  const beforeIndex = beforeId ? state.pages.findIndex((item) => item.id === beforeId) : -1;
  if (beforeIndex >= 0) state.pages.splice(beforeIndex, 0, page); else state.pages.push(page);
  persist(); renderBoard();
}

function cardAction(action, id) {
  const index = state.pages.findIndex((page) => page.id === id);
  if (index < 0) return;
  if (action === 'open') { state.activePageId = id; navigate('page'); }
  if (action === 'duplicate') {
    const copy = structuredClone(state.pages[index]); copy.id = uid('page'); copy.title += ' (copia)'; copy.blocks.forEach((item) => { item.id = uid('block'); });
    state.pages.splice(index + 1, 0, copy); persist(); renderBoard();
  }
  if (action === 'delete' && confirm('Excluir esta pagina?')) { state.pages.splice(index, 1); persist(); renderBoard(); }
}

function renderPage() {
  const page = activePage();
  const view = document.querySelector('#page-view');
  view.classList.toggle('is-full-width', state.fullWidth);
  view.classList.toggle('is-small-font', state.smallFont);
  view.innerHTML = `${page.cover ? coverMarkup(page) : ''}<div class="page-inner">
    <div class="page-top-actions">
      <button type="button" class="back-button" data-back-board>← Board</button>
      <div class="page-action-group"><button type="button" data-page-action="share">Compartilhar</button><button type="button" data-menu-toggle="page-menu">•••</button>
        <div class="menu-root"><div class="dropdown-menu align-right page-menu" data-menu="page-menu"><button data-page-action="duplicate">Duplicar pagina</button><button data-page-action="reset">Restaurar demo</button><button data-page-action="delete" class="danger">Excluir pagina</button></div></div>
      </div>
    </div>
    <div class="page-tools">
      ${!page.cover ? '<button type="button" data-page-action="cover">▧ Adicionar capa</button>' : ''}
      <button type="button" data-tool="full" class="${state.fullWidth ? 'is-active' : ''}">↔ Largura total</button>
      <button type="button" data-tool="font" class="${state.smallFont ? 'is-active' : ''}">A Fonte pequena</button>
      <button type="button" data-tool="toc" class="${state.toc ? 'is-active' : ''}">☷ Indice</button>
    </div>
    <div class="icon-wrap menu-root"><button class="page-icon editable-icon" type="button" data-menu-toggle="emoji-menu" aria-label="Editar icone">${page.icon || '＋'}</button>
      <div class="dropdown-menu emoji-menu" data-menu="emoji-menu"><div class="emoji-grid">${EMOJIS.map((emoji) => `<button type="button" data-emoji="${emoji}">${emoji}</button>`).join('')}</div><button type="button" data-emoji="" class="danger">Remover icone</button></div>
    </div>
    <input class="page-title" aria-label="Titulo" value="${escapeAttr(page.title)}" />
    <div class="properties" id="properties">${page.propertyOrder.map((key) => propertyMarkup(page, key)).join('')}</div>
    <button class="add-property" type="button" data-page-action="add-property">＋ Adicionar propriedade</button>
    <div class="page-divider"></div>
    <div class="document-layout">
      ${state.toc ? tocMarkup(page.blocks) : ''}
      <div class="editor" id="editor" aria-label="Conteudo editavel">${page.blocks.map(blockMarkup).join('')}<div class="insert-root menu-root"><button class="insert-block-button" type="button" data-menu-toggle="insert-menu">＋ Clique para adicionar um bloco</button>${insertMenuMarkup('insert-menu')}</div></div>
    </div>
  </div>`;

  bindMenuToggles();
  view.querySelector('[data-back-board]').addEventListener('click', () => navigate('board'));
  view.querySelector('.page-title').addEventListener('input', (event) => { page.title = event.target.value; persist(); });
  view.querySelectorAll('[data-tool]').forEach((button) => button.addEventListener('click', () => {
    if (button.dataset.tool === 'full') state.fullWidth = !state.fullWidth;
    if (button.dataset.tool === 'font') state.smallFont = !state.smallFont;
    if (button.dataset.tool === 'toc') state.toc = !state.toc;
    renderPage();
  }));
  view.querySelectorAll('[data-page-action]').forEach((button) => button.addEventListener('click', () => pageAction(button.dataset.pageAction, page)));
  view.querySelectorAll('[data-emoji]').forEach((button) => button.addEventListener('click', () => { page.icon = button.dataset.emoji; persist(); renderPage(); }));
  view.querySelectorAll('[data-set-property]').forEach((button) => button.addEventListener('click', () => setProperty(page, button.dataset.setProperty, button.dataset.value)));
  view.querySelectorAll('[data-toggle-tag]').forEach((button) => button.addEventListener('click', () => toggleArrayValue(page, 'tags', button.dataset.toggleTag)));
  view.querySelectorAll('[data-toggle-person]').forEach((button) => button.addEventListener('click', () => toggleArrayValue(page, 'assignees', button.dataset.togglePerson)));
  view.querySelector('[data-create-tag]')?.addEventListener('click', () => openTextDialog('Criar tag', 'Nome da tag', '', (tag) => {
    if (!TAGS.includes(tag)) TAGS.push(tag); page.tags = [...new Set([...page.tags, tag])]; persist(); renderPage();
  }));
  view.querySelector('[data-date-input]').addEventListener('change', (event) => { page.due = event.target.value; persist(); renderPage(); });
  view.querySelector('[data-reviewed]').addEventListener('click', () => { page.reviewed = !page.reviewed; persist(); renderPage(); });
  bindPropertyDnd(page);
  bindBlocks(page);
}

function coverMarkup(page) {
  return `<div class="page-cover" style="background-image:url('${escapeAttr(page.cover)}');background-position:center ${page.coverPosition}%">
    <div class="cover-actions"><button type="button" data-page-action="reposition">↕ Reposicionar</button><button type="button" data-page-action="cover">Trocar</button><button type="button" data-page-action="remove-cover">Remover</button></div>
  </div>`;
}

function propertyMarkup(page, key) {
  const definitions = {
    status: ['◉', 'Status', `<button class="property-trigger" type="button" data-menu-toggle="prop-status"><span class="status ${statusTone(page.status)}"><i></i>${statusLabel(page.status)}</span><b>⌄</b></button><div class="menu-root">${choiceMenu('prop-status', columns.map((c) => [c.id, c.label]), 'status', page.status)}</div>`],
    priority: ['↑', 'Prioridade', `<button class="property-trigger" type="button" data-menu-toggle="prop-priority"><span class="priority ${page.priority.toLowerCase()}">${page.priority}</span><b>⌄</b></button><div class="menu-root">${choiceMenu('prop-priority', ['Urgente', 'Alta', 'Media', 'Baixa'].map((v) => [v, v]), 'priority', page.priority)}</div>`],
    tags: ['#', 'Tags', `<button class="property-trigger tags-trigger" type="button" data-menu-toggle="prop-tags"><span class="tag-row">${page.tags.map((tag) => `<i>${tag}</i>`).join('') || '<em>Vazio</em>'}</span><b>⌄</b></button><div class="menu-root"><div class="dropdown-menu property-menu" data-menu="prop-tags"><div class="menu-label">TAGS</div>${TAGS.map((tag) => `<button type="button" data-toggle-tag="${tag}" class="${page.tags.includes(tag) ? 'is-selected' : ''}"><span class="menu-check">${page.tags.includes(tag) ? '✓' : ''}</span><i class="tag-option">${tag}</i></button>`).join('')}<button type="button" data-create-tag>＋ Criar tag</button></div></div>`],
    assignees: ['●', 'Responsavel', `<button class="property-trigger" type="button" data-menu-toggle="prop-people"><span class="people-row">${page.assignees.map(avatarMarkup).join('') || '<em>Vazio</em>'}</span><b>⌄</b></button><div class="menu-root"><div class="dropdown-menu property-menu people-menu" data-menu="prop-people"><div class="menu-label">PESSOAS</div>${PEOPLE.map((person) => `<button type="button" data-toggle-person="${person.id}" class="${page.assignees.includes(person.id) ? 'is-selected' : ''}"><span class="menu-check">${page.assignees.includes(person.id) ? '✓' : ''}</span>${avatarMarkup(person.id)}<span>${person.name}</span></button>`).join('')}</div></div>`],
    due: ['□', 'Prazo', `<input class="date-property" type="date" data-date-input value="${page.due || ''}" />`],
    reviewed: ['✓', 'Revisado?', `<button class="checkbox ${page.reviewed ? 'is-checked' : ''}" type="button" data-reviewed aria-checked="${page.reviewed}"></button>`],
  };
  const [icon, name, value] = definitions[key];
  return `<div class="property-row editable-property" draggable="true" data-property-key="${key}"><span class="property-drag" title="Arrastar">⋮⋮</span><span class="property-name"><i>${icon}</i>${name}</span><div class="property-value">${value}</div></div>`;
}

function choiceMenu(id, options, property, selected) {
  return `<div class="dropdown-menu property-menu" data-menu="${id}">${options.map(([value, name]) => `<button type="button" data-set-property="${property}" data-value="${value}" class="${value === selected ? 'is-selected' : ''}"><span class="menu-check">${value === selected ? '✓' : ''}</span>${name}</button>`).join('')}</div>`;
}

function setProperty(page, property, value) { page[property] = value; persist(); renderPage(); }
function toggleArrayValue(page, property, value) {
  page[property] = page[property].includes(value) ? page[property].filter((item) => item !== value) : [...page[property], value];
  persist(); renderPage();
}

function bindPropertyDnd(page) {
  document.querySelectorAll('[data-property-key]').forEach((row) => {
    row.addEventListener('dragstart', (event) => { state.draggedProperty = row.dataset.propertyKey; event.stopPropagation(); });
    row.addEventListener('dragover', (event) => { event.preventDefault(); event.stopPropagation(); row.classList.add('is-property-target'); });
    row.addEventListener('dragleave', () => row.classList.remove('is-property-target'));
    row.addEventListener('drop', (event) => {
      event.preventDefault(); event.stopPropagation();
      const target = row.dataset.propertyKey;
      const from = page.propertyOrder.indexOf(state.draggedProperty); const to = page.propertyOrder.indexOf(target);
      if (from >= 0 && to >= 0) { const [key] = page.propertyOrder.splice(from, 1); page.propertyOrder.splice(to, 0, key); persist(); renderPage(); }
    });
  });
}

function blockMarkup(item) {
  const content = {
    heading1: `<h1 contenteditable="true" data-block-text>${escapeHtml(item.text)}</h1>`,
    heading2: `<h2 contenteditable="true" data-block-text>${escapeHtml(item.text)}</h2>`,
    paragraph: `<p contenteditable="true" data-block-text>${escapeHtml(item.text)}</p>`,
    callout: `<aside class="callout"><span>💡</span><p contenteditable="true" data-block-text>${escapeHtml(item.text)}</p></aside>`,
    quote: `<blockquote contenteditable="true" data-block-text>${escapeHtml(item.text)}</blockquote>`,
    todo: `<label class="todo-block"><input type="checkbox" data-block-check ${item.checked ? 'checked' : ''}/><span contenteditable="true" data-block-text class="${item.checked ? 'is-done' : ''}">${escapeHtml(item.text)}</span></label>`,
    divider: '<hr />',
    image: `<figure class="editor-image"><img src="${escapeAttr(item.src)}" alt="${escapeAttr(item.text || 'Imagem')}"/><figcaption contenteditable="true" data-block-text>${escapeHtml(item.text || 'Adicionar legenda')}</figcaption></figure>`,
  }[item.type];
  return `<div class="block-row" draggable="true" data-block-id="${item.id}">
    <div class="block-controls"><button class="block-handle" type="button" title="Arrastar">⋮⋮</button><button class="block-add" type="button" data-insert-after="${item.id}" data-menu-toggle="insert-${item.id}" title="Adicionar bloco">＋</button><button class="block-more" type="button" data-menu-toggle="block-${item.id}" title="Menu do bloco">•••</button></div>
    <div class="block-content">${content}</div>
    <div class="inline-toolbar"><button type="button" data-format="bold"><b>B</b></button><button type="button" data-format="italic"><i>I</i></button><button type="button" data-format="underline"><u>U</u></button></div>
    <div class="menu-root">${blockMenuMarkup(item)}${insertMenuMarkup(`insert-${item.id}`)}</div>
  </div>`;
}

function blockMenuMarkup(item) {
  return `<div class="dropdown-menu block-menu" data-menu="block-${item.id}"><div class="menu-label">TRANSFORMAR EM</div>
    ${[['paragraph', 'Texto'], ['heading1', 'Titulo 1'], ['heading2', 'Titulo 2'], ['todo', 'Tarefa'], ['callout', 'Callout'], ['quote', 'Citacao']].map(([type, name]) => `<button type="button" data-block-action="transform" data-type="${type}" class="${item.type === type ? 'is-selected' : ''}">${name}</button>`).join('')}
    <div class="menu-separator"></div><button type="button" data-block-action="duplicate">Duplicar</button><button type="button" data-block-action="delete" class="danger">Excluir</button></div>`;
}

function insertMenuMarkup(id) {
  return `<div class="dropdown-menu insert-menu" data-menu="${id}"><div class="menu-label">BLOCOS BASICOS</div>
    ${[['paragraph', 'T', 'Texto', 'Paragrafo simples'], ['heading1', 'H1', 'Titulo 1', 'Titulo grande'], ['heading2', 'H2', 'Titulo 2', 'Titulo medio'], ['todo', '✓', 'Tarefa', 'Item com checkbox'], ['callout', '!', 'Callout', 'Caixa de destaque'], ['quote', '❝', 'Citacao', 'Bloco de citacao'], ['divider', '—', 'Divisor', 'Linha horizontal'], ['image', '▧', 'Imagem', 'Imagem por URL']].map(([type, icon, title, desc]) => `<button type="button" class="insert-option" data-insert-type="${type}"><i>${icon}</i><span><b>${title}</b><small>${desc}</small></span></button>`).join('')}</div>`;
}

function bindBlocks(page) {
  document.querySelectorAll('[data-block-id]').forEach((row) => {
    const id = row.dataset.blockId;
    const item = page.blocks.find((entry) => entry.id === id);
    row.querySelector('[data-block-text]')?.addEventListener('input', (event) => { item.text = event.currentTarget.textContent; persist(); });
    row.querySelector('[data-block-text]')?.addEventListener('keydown', (event) => {
      if (event.key === '/' && event.currentTarget.textContent.trim() === '') { event.preventDefault(); state.insertAfterBlockId = id; openMenu(`insert-${id}`); }
    });
    row.querySelector('[data-block-check]')?.addEventListener('change', (event) => { item.checked = event.target.checked; persist(); renderPage(); });
    row.addEventListener('dragstart', (event) => { state.draggedBlockId = id; event.stopPropagation(); row.classList.add('is-dragging'); });
    row.addEventListener('dragend', () => { row.classList.remove('is-dragging'); state.draggedBlockId = null; });
    row.addEventListener('dragover', (event) => { event.preventDefault(); event.stopPropagation(); row.classList.add('is-block-target'); });
    row.addEventListener('dragleave', () => row.classList.remove('is-block-target'));
    row.addEventListener('drop', (event) => { event.preventDefault(); event.stopPropagation(); reorderBlock(page, state.draggedBlockId, id); });
    row.querySelectorAll('[data-block-action]').forEach((button) => button.addEventListener('click', () => blockAction(page, id, button.dataset.blockAction, button.dataset.type)));
    row.querySelectorAll('[data-format]').forEach((button) => button.addEventListener('mousedown', (event) => { event.preventDefault(); document.execCommand(button.dataset.format); }));
  });
  document.querySelectorAll('[data-insert-after]').forEach((button) => button.addEventListener('click', () => { state.insertAfterBlockId = button.dataset.insertAfter; }));
  document.querySelectorAll('[data-insert-type]').forEach((button) => button.addEventListener('click', () => insertBlock(page, button.dataset.insertType, state.insertAfterBlockId)));
}

function reorderBlock(page, draggedId, targetId) {
  if (!draggedId || draggedId === targetId) return;
  const from = page.blocks.findIndex((item) => item.id === draggedId); const to = page.blocks.findIndex((item) => item.id === targetId);
  if (from < 0 || to < 0) return;
  const [item] = page.blocks.splice(from, 1); page.blocks.splice(to, 0, item); persist(); renderPage();
}

function blockAction(page, id, action, type) {
  const index = page.blocks.findIndex((item) => item.id === id); if (index < 0) return;
  if (action === 'transform') page.blocks[index].type = type;
  if (action === 'duplicate') { const copy = structuredClone(page.blocks[index]); copy.id = uid('block'); page.blocks.splice(index + 1, 0, copy); }
  if (action === 'delete') page.blocks.splice(index, 1);
  persist(); renderPage();
}

function insertBlock(page, type, afterId) {
  if (type === 'image') {
    openTextDialog('Inserir imagem', 'URL da imagem', '', (src) => { insertBlockValue(page, block('image', '', false, src), afterId); });
    return;
  }
  const texts = { paragraph: 'Comece a escrever...', heading1: 'Novo titulo', heading2: 'Novo subtitulo', todo: 'Nova tarefa', callout: 'Informacao importante', quote: 'Nova citacao', divider: '' };
  insertBlockValue(page, block(type, texts[type]), afterId);
}

function insertBlockValue(page, item, afterId) {
  const index = afterId ? page.blocks.findIndex((entry) => entry.id === afterId) : -1;
  if (index >= 0) page.blocks.splice(index + 1, 0, item); else page.blocks.push(item);
  state.insertAfterBlockId = null; persist(); renderPage();
}

function pageAction(action, page) {
  if (action === 'cover') openTextDialog('Imagem de capa', 'Cole a URL da imagem', page.cover, (url) => { page.cover = url; persist(); renderPage(); });
  if (action === 'remove-cover') { page.cover = ''; persist(); renderPage(); }
  if (action === 'reposition') { page.coverPosition = page.coverPosition >= 70 ? 30 : page.coverPosition + 10; persist(); renderPage(); }
  if (action === 'duplicate') { const copy = structuredClone(page); copy.id = uid('page'); copy.title += ' (copia)'; copy.blocks.forEach((item) => { item.id = uid('block'); }); state.pages.push(copy); state.activePageId = copy.id; persist(); renderPage(); }
  if (action === 'delete' && confirm('Excluir esta pagina?')) { state.pages = state.pages.filter((item) => item.id !== page.id); state.activePageId = state.pages[0]?.id; persist(); navigate('board'); }
  if (action === 'reset' && confirm('Restaurar todos os dados da demonstracao?')) { state.pages = structuredClone(seedPages); state.activePageId = 'launch'; persist(); renderPage(); }
  if (action === 'share') navigator.clipboard?.writeText(location.href).then(() => toast('Link copiado'));
  if (action === 'add-property') openTextDialog('Nova propriedade', 'Nome da propriedade', '', (name) => toast(`Propriedade "${name}" criada na versao conceitual`));
}

function openTextDialog(title, labelText, initialValue, onSave) {
  document.querySelector('.modal-backdrop')?.remove();
  const modal = document.createElement('div'); modal.className = 'modal-backdrop';
  modal.innerHTML = `<form class="dialog"><header><h2>${escapeHtml(title)}</h2><button type="button" data-close-modal>×</button></header><label>${escapeHtml(labelText)}<input name="value" value="${escapeAttr(initialValue || '')}" autofocus /></label><footer><button type="button" class="button secondary" data-close-modal>Cancelar</button><button type="submit" class="button primary">Salvar</button></footer></form>`;
  document.body.append(modal); const input = modal.querySelector('input'); input.focus(); input.select();
  modal.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', () => modal.remove()));
  modal.addEventListener('click', (event) => { if (event.target === modal) modal.remove(); });
  modal.querySelector('form').addEventListener('submit', (event) => { event.preventDefault(); const value = input.value.trim(); if (value) onSave(value); modal.remove(); });
}

function bindMenuToggles() {
  document.querySelectorAll('[data-menu-toggle]').forEach((button) => button.addEventListener('click', (event) => {
    event.stopPropagation(); const id = button.dataset.menuToggle; const menu = document.querySelector(`[data-menu="${CSS.escape(id)}"]`); const wasOpen = menu?.classList.contains('is-open'); closeMenus(); if (!wasOpen) menu?.classList.add('is-open');
  }));
}

function openMenu(id) { closeMenus(); document.querySelector(`[data-menu="${CSS.escape(id)}"]`)?.classList.add('is-open'); }
function closeMenus() { document.querySelectorAll('.dropdown-menu.is-open').forEach((menu) => menu.classList.remove('is-open')); }
function clearDropStates() { document.querySelectorAll('.is-drop-target,.is-column-target').forEach((el) => el.classList.remove('is-drop-target', 'is-column-target')); }

function tocMarkup(blocks) {
  const headings = blocks.filter((item) => item.type === 'heading1' || item.type === 'heading2');
  return `<nav class="toc"><strong>Conteudo</strong>${headings.map((item) => `<button type="button" class="${item.type}">${escapeHtml(item.text)}</button>`).join('')}</nav>`;
}

function renderComponents() {
  const grid = document.querySelector('#components-grid');
  const page = activePage();
  grid.innerHTML = `<section class="component-panel"><header><span>Propriedades editaveis</span><b>Arraste e clique</b></header><div class="component-body properties showcase">${page.propertyOrder.map((key) => propertyMarkup(page, key)).join('')}</div></section>
    <section class="component-panel"><header><span>Blocos do editor</span><b>Menus e DND</b></header><div class="component-body editor showcase-editor">${page.blocks.slice(0, 5).map(blockMarkup).join('')}</div></section>
    <section class="component-panel wide"><header><span>Cards</span><b>Board view</b></header><div class="component-body card-samples">${state.pages.slice(0, 3).map(cardMarkup).join('')}</div></section>`;
  grid.querySelectorAll('.page-card').forEach((card) => card.addEventListener('click', () => { state.activePageId = card.dataset.pageId; navigate('page'); }));
  toast('Abra Board ou Pagina para testar todas as interacoes');
}

function toast(message) {
  document.querySelector('.toast')?.remove(); const el = document.createElement('div'); el.className = 'toast'; el.textContent = message; document.body.append(el); setTimeout(() => el.remove(), 2400);
}

function avatarMarkup(id) {
  const person = PEOPLE.find((item) => item.id === id); return `<b class="avatar-${person?.color || 'blue'}" title="${person?.name || id}">${id}</b>`;
}
function statusLabel(value) { return columns.find((item) => item.id === value)?.label || value; }
function statusTone(value) { return columns.find((item) => item.id === value)?.tone || 'gray'; }
function formatDate(value) { if (!value) return 'Sem prazo'; const date = new Date(`${value}T00:00:00`); return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]); }
function escapeAttr(value) { return escapeHtml(value); }

render();
