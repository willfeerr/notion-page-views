import { useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import type { SerializedEditorState } from 'lexical';

type SerializedNode = {
  type?: string;
  text?: string;
  children?: SerializedNode[];
  url?: string;
  targetId?: string;
};

function nodeHasContent(node: SerializedNode): boolean {
  if (typeof node.text === 'string' && node.text.trim().length > 0) return true;
  if (typeof node.url === 'string' && node.url.trim().length > 0) return true;
  if (typeof node.targetId === 'string' && node.targetId.trim().length > 0) return true;
  return Array.isArray(node.children) && node.children.some(nodeHasContent);
}

export function hasSerializedEditorContent(value?: SerializedEditorState | null): boolean {
  const root = (value as unknown as { root?: SerializedNode } | null | undefined)?.root;
  return Boolean(root && nodeHasContent(root));
}

/** Applies content received from the workspace Yjs map without resetting local selection. */
export function SerializedStateSyncPlugin({
  value,
  mode = 'sync',
}: {
  value?: SerializedEditorState | null;
  mode?: 'sync' | 'hydrate-empty-once';
}) {
  const [editor] = useLexicalComposerContext();
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (!value) return;

    const applyIncoming = () => {
      const incoming = JSON.stringify(value);
      const currentState = editor.getEditorState().toJSON();
      const current = JSON.stringify(currentState);
      if (incoming === current) return;

      if (mode === 'hydrate-empty-once') {
        if (hydratedRef.current) return;
        if (!hasSerializedEditorContent(value)) return;
        if (hasSerializedEditorContent(currentState)) {
          hydratedRef.current = true;
          return;
        }
        hydratedRef.current = true;
      }

      editor.setEditorState(editor.parseEditorState(incoming));
    };

    if (mode === 'hydrate-empty-once') {
      const timeout = window.setTimeout(applyIncoming, 250);
      return () => window.clearTimeout(timeout);
    }

    applyIncoming();
    return undefined;
  }, [editor, mode, value]);

  return null;
}
