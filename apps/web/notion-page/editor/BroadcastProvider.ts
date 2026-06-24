import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness';
import { applyUpdate, Doc, encodeStateAsUpdate } from 'yjs';

type Listener = (...args: unknown[]) => void;
type Message =
  | { type: 'sync-request' }
  | { type: 'sync-state'; update: Uint8Array }
  | { type: 'update'; update: Uint8Array }
  | { type: 'awareness'; update: Uint8Array };

/** Minimal Lexical-compatible Yjs provider using the browser BroadcastChannel API. */
export class BroadcastProvider {
  readonly awareness: Awareness;
  private readonly storageKey: string;
  private readonly storageKeys: string[];
  private channel: BroadcastChannel | null = null;
  private listeners = new Map<string, Set<Listener>>();
  private connected = false;
  private synced = false;
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(readonly name: string, readonly document: Doc) {
    this.storageKey = `notion-yjs:${name}`;
    this.storageKeys = [this.storageKey, ...legacyStorageKeys(name).map((key) => `notion-yjs:${key}`)];
    this.restore();
    this.awareness = new Awareness(document);
    this.connect();
  }

  private restore(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const encoded = this.storageKeys.map((key) => localStorage.getItem(key)).find((value): value is string => Boolean(value));
      if (!encoded) return;
      const binary = atob(encoded);
      const update = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      applyUpdate(this.document, update, this);
    } catch {
      try { localStorage.removeItem(this.storageKey); } catch { /* storage unavailable */ }
    }
  }

  private persist(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const update = encodeStateAsUpdate(this.document);
      let binary = '';
      for (const byte of update) binary += String.fromCharCode(byte);
      localStorage.setItem(this.storageKey, btoa(binary));
      this.storageKeys.slice(1).forEach((key) => { try { localStorage.removeItem(key); } catch { /* ignore */ } });
    } catch {
      // Storage can be unavailable or full; live BroadcastChannel sync still works.
    }
  }

  private schedulePersist(): void {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.persist();
    }, 250);
  }

  private post(message: Message): void {
    this.channel?.postMessage(message);
  }

  private handleDocumentUpdate = (update: Uint8Array, origin: unknown): void => {
    this.schedulePersist();
    if (origin !== this) this.post({ type: 'update', update });
  };

  private handleAwarenessUpdate = ({ added, updated, removed }: {
    added: number[]; updated: number[]; removed: number[];
  }, origin: unknown): void => {
    if (origin === this) return;
    const clients = [...added, ...updated, ...removed];
    if (clients.length) this.post({ type: 'awareness', update: encodeAwarenessUpdate(this.awareness, clients) });
  };

  private handleMessage = (event: MessageEvent<Message>): void => {
    const message = event.data;
    if (!message || typeof message !== 'object') return;
    if (message.type === 'sync-request') {
      this.post({ type: 'sync-state', update: encodeStateAsUpdate(this.document) });
      const clients = [...this.awareness.getStates().keys()];
      if (clients.length) this.post({ type: 'awareness', update: encodeAwarenessUpdate(this.awareness, clients) });
    }
    if (message.type === 'sync-state' || message.type === 'update') {
      applyUpdate(this.document, new Uint8Array(message.update), this);
      if (!this.synced) { this.synced = true; this.emit('sync', true); }
    }
    if (message.type === 'awareness') applyAwarenessUpdate(this.awareness, new Uint8Array(message.update), this);
  };

  connect(): void {
    if (this.connected) return;
    this.connected = true;
    this.channel = new BroadcastChannel(`notion-yjs:${this.name}`);
    this.channel.addEventListener('message', this.handleMessage);
    this.document.on('update', this.handleDocumentUpdate);
    this.awareness.on('update', this.handleAwarenessUpdate);
    this.post({ type: 'sync-request' });
    this.syncTimer = setTimeout(() => {
      if (!this.synced) { this.synced = true; this.emit('sync', true); }
      this.emit('status', { status: 'connected' });
      this.syncTimer = null;
    }, 100);
  }

  disconnect(): void {
    if (!this.connected) return;
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = null;
    this.persist();
    removeAwarenessStates(this.awareness, [this.document.clientID], 'disconnect');
    this.document.off('update', this.handleDocumentUpdate);
    this.awareness.off('update', this.handleAwarenessUpdate);
    this.channel?.removeEventListener('message', this.handleMessage);
    this.channel?.close();
    this.channel = null;
    if (this.syncTimer) clearTimeout(this.syncTimer);
    this.syncTimer = null;
    this.connected = false;
    this.emit('status', { status: 'disconnected' });
  }

  destroy(): void { this.disconnect(); this.awareness.destroy(); }

  on(event: string, listener: Listener): void {
    const set = this.listeners.get(event) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(event, set);
    if (event === 'sync' && this.synced) queueMicrotask(() => listener(true));
  }

  off(event: string, listener: Listener): void { this.listeners.get(event)?.delete(listener); }

  private emit(event: string, ...args: unknown[]): void {
    this.listeners.get(event)?.forEach((listener) => listener(...args));
  }
}

function legacyStorageKeys(name: string): string[] {
  if (name === 'workspace:notion-pages-lab:v2') return ['workspace:notion-pages-lab'];
  if (name.startsWith('view:') && name.endsWith(':v2')) return [name.slice(0, -3)];
  if (name.startsWith('page:') && name.endsWith(':v2')) return [name.slice(0, -3).replace(/^page:/, 'page-')];
  return [];
}
