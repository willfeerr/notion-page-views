import { useEffect } from 'react';
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

  useEffect(() => {
    if (!value) return;

    const applyIncoming = (onlyWhenCurrentIsEmpty: boolean) => {
      const incoming = JSON.stringify(value);
      const currentState = editor.getEditorState().toJSON();
      const current = JSON.stringify(currentState);
      if (incoming === current) return;
      if (onlyWhenCurrentIsEmpty) {
        if (!hasSerializedEditorContent(value)) return;
        if (hasSerializedEditorContent(currentState)) return;
      }
      editor.setEditorState(editor.parseEditorState(incoming));
    };

    if (mode === 'hydrate-empty-once') {
      const timers = [0, 80, 220, 500, 1000, 1800].map((delay) => (
        window.setTimeout(() => applyIncoming(true), delay)
      ));
      return () => timers.forEach((timer) => window.clearTimeout(timer));
    }

    applyIncoming(false);
    return undefined;
  }, [editor, mode, value]);

  return null;
}
