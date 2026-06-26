import type { CollabConfig } from '../notion-page/types';
import { normalizeHocuspocusUrl } from '../notion-page/editor/collabUrl';

type CollabEnv = Partial<Record<'VITE_COLLAB_TRANSPORT' | 'VITE_HOCUSPOCUS_URL', string>>;

function viteEnv(): CollabEnv {
  return ((import.meta as unknown as { env?: CollabEnv }).env ?? {});
}

export function resolveCollabConfig({
  room,
  user,
  env = viteEnv(),
}: {
  room: string;
  user: CollabConfig['user'];
  env?: CollabEnv;
}): CollabConfig {
  const requestedTransport = env.VITE_COLLAB_TRANSPORT?.trim().toLowerCase();
  if (requestedTransport !== 'hocuspocus') return { transport: 'broadcast', room, user };

  const wsUrl = normalizeHocuspocusUrl(env.VITE_HOCUSPOCUS_URL);
  if (!wsUrl) return { transport: 'broadcast', room, user };

  return { transport: 'hocuspocus', wsUrl, room, user };
}
