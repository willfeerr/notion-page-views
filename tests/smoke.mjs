import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

class ElementMock {
  constructor() {
    this.innerHTML = '';
    this.textContent = '';
    this.value = '';
    this.dataset = {};
    this.classList = { add() {}, remove() {}, toggle() {}, contains() { return false; } };
    this.content = { cloneNode: () => new ElementMock() };
  }
  addEventListener() {}
  querySelector() { return new ElementMock(); }
  querySelectorAll() { return []; }
  replaceChildren() {}
  append() {}
  remove() {}
  focus() {}
  select() {}
  closest() { return null; }
}

const elements = new Map();
const getElement = (selector) => {
  if (!elements.has(selector)) elements.set(selector, new ElementMock());
  return elements.get(selector);
};
const storage = new Map();

const context = {
  console,
  structuredClone,
  crypto: webcrypto,
  Intl,
  Date,
  Math,
  setTimeout: (callback) => { callback(); return 1; },
  clearTimeout() {},
  confirm: () => true,
  location: { hash: '#board', href: 'http://localhost:4173/#board' },
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  },
  navigator: { clipboard: { writeText: async () => {} } },
  CSS: { escape: (value) => String(value) },
  document: {
    body: new ElementMock(),
    querySelector: getElement,
    querySelectorAll: () => [],
    createElement: () => new ElementMock(),
    addEventListener() {},
    execCommand: () => true,
  },
  window: { addEventListener() {} },
};
context.globalThis = context;

let source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
source = source.replace(/render\(\);\s*$/, 'globalThis.__appTest = { navigate, render, state }; render();');
vm.runInNewContext(source, context, { filename: 'app.js' });

context.__appTest.navigate('page');
context.__appTest.navigate('components');
context.__appTest.navigate('board');

if (context.__appTest.state.pages.length < 3) throw new Error('Seed pages were not initialized');
console.log('Smoke test passed: board, page and components rendered.');
