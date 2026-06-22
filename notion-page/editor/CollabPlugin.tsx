'use client';

/**
 * Hocuspocus collaboration plugin for Lexical.
 *
 * Wraps CollaborationPlugin from @lexical/react, wiring HocuspocusProvider
 * as the Yjs provider. Yjs owns editing history; a separate OnChange listener
 * may mirror debounced JSON snapshots for indexing and export.
 */

import { useCallback, useEffect, useRef } from 'react';
import { CollaborationPlugin } from '@lexical/react/LexicalCollaborationPlugin';
import { HocuspocusProvider } from '@hocuspocus/provider';
import type { Provider } from '@lexical/yjs';
import { Doc } from 'yjs';
import type { SerializedEditorState } from 'lexical';
import type { CollabConfig } from '../types';
import { BroadcastProvider } from './BroadcastProvider';

interface CollabPluginProps extends CollabConfig {
  initialContent?: SerializedEditorState | null;
}

export function CollabPlugin({ transport = 'broadcast', wsUrl, room, user, initialContent }: CollabPluginProps) {
  const providerRef = useRef<Provider | null>(null);

  const providerFactory = useCallback((id: string, yjsDocMap: Map<string, Doc>) => {
    if (providerRef.current) return providerRef.current;
    const doc = new Doc();
    yjsDocMap.set(id, doc);
    const provider = transport === 'broadcast'
      ? new BroadcastProvider(id, doc)
      : new HocuspocusProvider({ url: wsUrl ?? '', name: id, document: doc });
    providerRef.current = provider as unknown as Provider;
    return providerRef.current;
  }, [transport, wsUrl]);

  useEffect(() => () => {
    const provider = providerRef.current as Provider & { destroy?: () => void };
    provider?.destroy?.();
    providerRef.current = null;
  }, []);

  return (
    <CollaborationPlugin
      id={room}
      providerFactory={providerFactory}
      shouldBootstrap
      initialEditorState={initialContent ? JSON.stringify(initialContent) : null}
      username={user.name}
      cursorColor={user.color}
      awarenessData={{ userId: user.id, color: user.color }}
    />
  );
}
