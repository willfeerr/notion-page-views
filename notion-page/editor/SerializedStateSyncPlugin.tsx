import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import type { SerializedEditorState } from 'lexical';

/** Applies content received from the workspace Yjs map without resetting local selection. */
export function SerializedStateSyncPlugin({ value }: { value?: SerializedEditorState | null }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!value) return;
    const incoming = JSON.stringify(value);
    const current = JSON.stringify(editor.getEditorState().toJSON());
    if (incoming === current) return;
    editor.setEditorState(editor.parseEditorState(incoming));
  }, [editor, value]);

  return null;
}
