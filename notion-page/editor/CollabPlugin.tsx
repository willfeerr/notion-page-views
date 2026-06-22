'use client';

/** Lexical collaboration bridge for local BroadcastChannel or Hocuspocus. */

import { useEffect, useRef } from 'react';
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

  useEffect(() => () => {
    const provider = providerRef.current as Provider & { destroy?: () => void };
    provider?.destroy?.();
    providerRef.current = null;
  }, []);

  return (
    <CollaborationPlugin
      id={room}
      providerFactory={(id, yjsDocMap) => {
        if (providerRef.current) return providerRef.current;
        const doc = new Doc();
        yjsDocMap.set(id, doc);
        const provider = transport === 'broadcast'
          ? new BroadcastProvider(id, doc)
          : new HocuspocusProvider({ url: wsUrl ?? '', name: id, document: doc });
        // HocuspocusProvider is structurally compatible with the Lexical Provider interface
        providerRef.current = provider as unknown as Provider;
        return providerRef.current;
      }}
      shouldBootstrap
      initialEditorState={initialContent ? JSON.stringify(initialContent) : null}
      username={user.name}
      cursorColor={user.color}
      awarenessData={{ userId: user.id, color: user.color }}
    />
  );
}
