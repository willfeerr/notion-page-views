import { describe, expect, it } from 'vitest';
import { resolveCollabConfig } from './collabConfig';

const user = { id: 'user-1', name: 'William', color: '#2383e2', location: 'Corpo do documento' };

describe('resolveCollabConfig', () => {
  it('uses broadcast by default', () => {
    expect(resolveCollabConfig({ room: 'page:demo:v2', user, env: {} })).toEqual({
      transport: 'broadcast',
      room: 'page:demo:v2',
      user,
    });
  });

  it('uses Hocuspocus when explicitly configured', () => {
    expect(resolveCollabConfig({
      room: 'page:demo:v2',
      user,
      env: { VITE_COLLAB_TRANSPORT: 'hocuspocus', VITE_HOCUSPOCUS_URL: 'https://collab.skrbe.com' },
    })).toEqual({
      transport: 'hocuspocus',
      wsUrl: 'wss://collab.skrbe.com',
      room: 'page:demo:v2',
      user,
    });
  });

  it('falls back to broadcast when Hocuspocus URL is missing', () => {
    expect(resolveCollabConfig({
      room: 'page:demo:v2',
      user,
      env: { VITE_COLLAB_TRANSPORT: 'hocuspocus' },
    })).toEqual({
      transport: 'broadcast',
      room: 'page:demo:v2',
      user,
    });
  });
});
