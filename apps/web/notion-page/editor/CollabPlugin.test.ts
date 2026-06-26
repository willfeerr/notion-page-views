import { describe, expect, it } from 'vitest';
import { normalizeHocuspocusUrl } from './CollabPlugin';

describe('normalizeHocuspocusUrl', () => {
  it('converts public HTTP endpoints to websocket endpoints', () => {
    expect(normalizeHocuspocusUrl('https://collab.skrbe.com')).toBe('wss://collab.skrbe.com');
    expect(normalizeHocuspocusUrl('http://localhost:1234')).toBe('ws://localhost:1234');
  });

  it('keeps explicit websocket endpoints unchanged', () => {
    expect(normalizeHocuspocusUrl('wss://collab.skrbe.com')).toBe('wss://collab.skrbe.com');
    expect(normalizeHocuspocusUrl('ws://localhost:1234')).toBe('ws://localhost:1234');
  });
});
