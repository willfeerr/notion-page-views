const seedPages = [
  {
    id: 'research', icon: '🔎', title: 'Pesquisa com usuarios', status: 'todo', priority: 'Media',
    tags: ['Design'], assignees: ['RL'], due: 'Sem prazo', cover: '',
    summary: 'Consolidar entrevistas e transformar os aprendizados em decisoes de produto.',
  },
  {
    id: 'launch', icon: '🚀', title: 'Lancamento da v2.0', status: 'doing', priority: 'Alta',
    tags: ['Frontend', 'Backend'], assignees: ['MS', 'FA'], due: '03 jul. 2026',
    cover: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1600&q=80',
    summary: 'Plano de lancamento do novo dashboard, com foco em performance e permissoes por equipe.',
  },
  {
    id: 'billing', icon: '💳', title: 'Revisar fluxo de cobranca', status: 'doing', priority: 'Urgente',
    tags: ['Backend'], assignees: ['FA'], due: '24 jun. 2026', cover: '',
    summary: 'Mapear falhas de pagamento e melhorar a recuperacao de assinaturas.',
  },
  {
    id: 'onboarding', icon: '✨', title: 'Novo onboarding', status: 'done', priority: 'Baixa',
    tags: ['Design', 'Frontend'], assignees: ['MS'], due: 'Concluido', cover: '',
    summary: 'Primeira experiencia mais curta, clara e orientada ao resultado.',
  },
];

const columns = [
  { id: 'todo', label: 'A fazer', tone: 'gray' },
  { id: 'doing', label: 'Em andamento', tone: 'blue' },
  { id: 'done', label: 'Concluido', tone: 'green' },
];

const state = {
  pages: loadPages(),
  activeView: location.hash.slice(1) || 'board',
  activePageId: 'launch',
  fullWidth: false,
  smallFont: false,
  toc: false,
};

const root = document.querySelector('#view-root');
const label = document.querySelector('#current-view-label');
const sidebar = document.querySelector('.sidebar');

document.querySelectorAll('[data-view]').forEach((button) => {
  button.addEventListener('click', () => navigate(button.dataset.view));
});
document.querySelector('.mobile-menu').addEventListener('click', () => sidebar.classList.toggle('is-open'));
window.addEventListener('hashchange', () => {
  state.activeView = location.hash.slice(1) || 'board';
  render();
});

function loadPages() {
  try { return JSON.parse(localStorage.getItem('notion-preview-pages')) || seedPages; }
  catch { return seedPages; }
}

function persist() {
  localStorage.setItem('notion-preview-pages', JSON.stringify(state.pages));
}

function navigate(view) {
  location.hash = view;
  state.activeView = view;
  sidebar.classList.remove('is-open');
  render();
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
  board.innerHTML = columns.map((column) => {
    const pages = state.pages.filter((page) => page.status === column.id);
    return `<section class="board-column">
      <header class="column-header"><span class="status ${column.tone}"><i></i>${column.label}</span><b>${pages.length}</b><button type="button" aria-label="Adicionar">+</button></header>
      <div class="card-list">${pages.map(cardMarkup).join('')}</div>
      <button class="add-card" type="button" data-add-status="${column.id}">+ Nova pagina</button>
    </section>`;
  }).join('');
  board.querySelectorAll('[data-page-id]').forEach((card) => card.addEventListener('click', () => {
    state.activePageId = card.dataset.pageId;
    navigate('page');
  }));
  board.querySelectorAll('[data-add-status]').forEach((button) => button.addEventListener('click', () => addPage(button.dataset.addStatus)));
  document.querySelector('#new-card').addEventListener('click', () => addPage('todo'));
}

function cardMarkup(page) {
  return `<button class="page-card" type="button" data-page-id="${page.id}">
    ${page.cover ? `<span class="card-cover" style="background-image:url('${page.cover}')"></span>` : ''}
    <span class="card-content">
      <strong class="card-title"><span>${page.icon}</span>${escapeHtml(page.title)}</strong>
      <span class="card-summary">${escapeHtml(page.summary)}</span>
      <span class="card-meta"><span class="priority ${page.priority.toLowerCase()}">${page.priority}</span><span>${page.due}</span></span>
      <span class="card-footer"><span>${page.tags.map((tag) => `<i>${tag}</i>`).join('')}</span><span class="avatar-stack">${page.assignees.map((name) => `<b>${name}</b>`).join('')}</span></span>
    </span>
  </button>`;
}

function addPage(status) {
  const id = `page-${Date.now()}`;
  state.pages.push({ id, icon: '📄', title: 'Nova pagina', status, priority: 'Media', tags: [], assignees: ['WF'], due: 'Sem prazo', cover: '', summary: 'Clique para abrir e editar esta pagina.' });
  persist();
  renderBoard();
}

function renderPage() {
  const page = state.pages.find((item) => item.id === state.activePageId) || state.pages[0];
  const view = document.querySelector('#page-view');
  view.classList.toggle('is-full-width', state.fullWidth);
  view.classList.toggle('is-small-font', state.smallFont);
  view.innerHTML = `
    ${page.cover ? `<div class="page-cover" style="background-image:url('${page.cover}')"><span>Arraste para reposicionar</span></div>` : ''}
    <div class="page-inner">
      <div class="page-tools">
        <button type="button" data-tool="full" class="${state.fullWidth ? 'is-active' : ''}">↔ Largura total</button>
        <button type="button" data-tool="font" class="${state.smallFont ? 'is-active' : ''}">A Fonte pequena</button>
        <button type="button" data-tool="toc" class="${state.toc ? 'is-active' : ''}">☷ Indice</button>
      </div>
      <div class="page-icon">${page.icon}</div>
      <input class="page-title" aria-label="Titulo" value="${escapeAttr(page.title)}" />
      <div class="properties">
        ${propertyRow('◉', 'Status', `<select data-property="status">${columns.map((c) => `<option value="${c.id}" ${page.status === c.id ? 'selected' : ''}>${c.label}</option>`).join('')}</select>`)}
        ${propertyRow('↑', 'Prioridade', `<span class="priority ${page.priority.toLowerCase()}">${page.priority}</span>`)}
        ${propertyRow('#', 'Tags', `<span class="tag-row">${page.tags.map((tag) => `<i>${tag}</i>`).join('') || '<em>Vazio</em>'}</span>`)}
        ${propertyRow('●', 'Responsavel', `<span class="people-row">${page.assignees.map((name) => `<b>${name}</b>`).join('')}</span>`)}
        ${propertyRow('□', 'Prazo', `<span>${page.due}</span>`)}
        ${propertyRow('✓', 'Revisado?', `<button class="checkbox" type="button" aria-label="Alternar revisado"></button>`)}
      </div>
      <div class="page-divider"></div>
      <div class="document-layout">
        ${state.toc ? `<nav class="toc"><strong>Conteudo</strong><a href="#intro">Visao geral</a><a href="#scope">Escopo</a><a href="#next">Proximos passos</a></nav>` : ''}
        <div class="editor" contenteditable="true" spellcheck="true" aria-label="Conteudo editavel">
          <h1 id="intro">Visao geral</h1>
          <p>${escapeHtml(page.summary)}</p>
          <aside class="callout"><span>💡</span><p>Esta e uma demonstracao editavel. As alteracoes do titulo, status e board ficam salvas neste navegador.</p></aside>
          <h2 id="scope">Escopo</h2>
          <ul><li>Validar a experiencia principal</li><li>Revisar estados vazios e responsividade</li><li>Preparar integracao com o backend</li></ul>
          <blockquote>Performance nao e feature, e pre-requisito.</blockquote>
          <details open><summary>Decisoes tecnicas</summary><p>React, Lexical e Yjs continuam sendo a base indicada para a versao integrada.</p></details>
          <h2 id="next">Proximos passos</h2><p>Conectar persistencia, colaboracao e permissoes.</p>
        </div>
      </div>
    </div>`;

  view.querySelector('.page-title').addEventListener('input', (event) => { page.title = event.target.value; persist(); });
  view.querySelector('[data-property="status"]').addEventListener('change', (event) => { page.status = event.target.value; persist(); });
  view.querySelectorAll('[data-tool]').forEach((button) => button.addEventListener('click', () => {
    if (button.dataset.tool === 'full') state.fullWidth = !state.fullWidth;
    if (button.dataset.tool === 'font') state.smallFont = !state.smallFont;
    if (button.dataset.tool === 'toc') state.toc = !state.toc;
    renderPage();
  }));
  view.querySelector('.checkbox').addEventListener('click', (event) => event.currentTarget.classList.toggle('is-checked'));
}

function propertyRow(icon, label, value) {
  return `<div class="property-row"><span class="property-name"><i>${icon}</i>${label}</span><span class="property-value">${value}</span></div>`;
}

function renderComponents() {
  const grid = document.querySelector('#components-grid');
  grid.innerHTML = `
    <section class="component-panel"><header><span>Propriedades</span><b>8 tipos</b></header><div class="component-body properties showcase">
      ${propertyRow('T', 'Texto', '<span>Texto simples</span>')}
      ${propertyRow('#', 'Numero', '<span>R$ 12.450,00</span>')}
      ${propertyRow('◉', 'Status', '<span class="status blue"><i></i>Em andamento</span>')}
      ${propertyRow('⌄', 'Select', '<span class="priority alta">Alta</span>')}
      ${propertyRow('⊙', 'Pessoa', '<span class="people-row"><b>MS</b><b>FA</b></span>')}
      ${propertyRow('□', 'Data', '<span>03/07/2026</span>')}
      ${propertyRow('✓', 'Checkbox', '<button class="checkbox is-checked" type="button"></button>')}
    </div></section>
    <section class="component-panel"><header><span>Blocos do editor</span><b>6 exemplos</b></header><div class="component-body editor showcase-editor">
      <h1>Titulo principal</h1><p>Paragrafo com <strong>negrito</strong>, <em>italico</em> e <code>codigo inline</code>.</p>
      <aside class="callout"><span>✅</span><p>Callout para informacoes importantes.</p></aside>
      <blockquote>Uma citacao curta e visualmente distinta.</blockquote>
      <details open><summary>Toggle interativo</summary><p>Conteudo escondido ou revelado sem perder o contexto.</p></details>
      <pre><code>const ready = true;</code></pre>
    </div></section>
    <section class="component-panel wide"><header><span>Cards</span><b>Board view</b></header><div class="component-body card-samples">${state.pages.slice(0, 3).map(cardMarkup).join('')}</div></section>`;
  grid.querySelectorAll('[data-page-id]').forEach((card) => card.addEventListener('click', () => { state.activePageId = card.dataset.pageId; navigate('page'); }));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}
function escapeAttr(value) { return escapeHtml(value); }

render();
