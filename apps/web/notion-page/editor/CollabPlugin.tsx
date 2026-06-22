'use client';

/**
 * Hocuspocus collaboration plugin for Lexical.
 *
 * Wraps CollaborationPlugin from @lexical/react, wiring HocuspocusProvider
 * as the Yjs provider. Yjs owns editing history; a separate OnChange listener
 * may mirror debounced JSON snapshots for indexing and export.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CollaborationPlugin } from '@lexical/react/LexicalCollaborationPlugin';
import { HocuspocusProvider } from '@hocuspocus/provider';
import type { Provider } from '@lexical/yjs';
import { Doc } from 'yjs';
import type { SerializedEditorState } from 'lexical';
import type { CollabConfig, CollabPresence } from '../types';
import { BroadcastProvider } from './BroadcastProvider';

interface CollabPluginProps extends CollabConfig {
  initialContent?: SerializedEditorState | null;
}

export function CollabPlugin({ transport = 'broadcast', wsUrl, room, user, initialContent, onPresenceChange }: CollabPluginProps) {
  const providerRef = useRef<Provider | null>(null);
  const [presenceProvider, setPresenceProvider] = useState<Provider | null>(null);
  const awarenessData = useMemo(() => ({
    userId: user.id,
    color: user.color,
    location: user.location ?? 'Corpo do documento',
  }), [user.color, user.id, user.location]);

  const providerFactory = useCallback((id: string, yjsDocMap: Map<string, Doc>) => {
    if (providerRef.current) return providerRef.current;
    const doc = new Doc();
    yjsDocMap.set(id, doc);
    const provider = transport === 'broadcast'
      ? new BroadcastProvider(id, doc)
      : new HocuspocusProvider({ url: wsUrl ?? '', name: id, document: doc });
    providerRef.current = provider as unknown as Provider;
    setPresenceProvider(providerRef.current);
    return providerRef.current;
  }, [transport, wsUrl]);

  useEffect(() => {
    if (!presenceProvider || !onPresenceChange) return;
    const publish = () => {
      const presence: CollabPresence[] = [];
      presenceProvider.awareness.getStates().forEach((state, clientId) => {
        const data = state.awarenessData as { userId?: string; location?: string } | undefined;
        const awarenessName = typeof state.name === 'string' ? state.name : 'Colaborador';
        presence.push({
          clientId,
          userId: data?.userId ?? String(clientId),
          name: awarenessName.split(' · ')[0],
          color: typeof state.color === 'string' ? state.color : '#2383e2',
          location: data?.location ?? user.location ?? 'Corpo do documento',
        });
      });
      onPresenceChange(presence);
    };
    publish();
    presenceProvider.awareness.on('update', publish);
    return () => {
      presenceProvider.awareness.off('update', publish);
      onPresenceChange([]);
    };
  }, [onPresenceChange, presenceProvider, user.location]);

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
      username={`${user.name} · ${user.location ?? 'Corpo'}`}
      cursorColor={user.color}
      awarenessData={awarenessData}
    />
  );
}
