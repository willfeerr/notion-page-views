'use client';

import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $insertNodes, $isRootOrShadowRoot, $createParagraphNode, COMMAND_PRIORITY_EDITOR } from 'lexical';
import { $wrapNodeInElement } from '@lexical/utils';
import { $createEmbedNode, INSERT_EMBED_COMMAND } from './nodes/EmbedNode';

export function EmbedPlugin() {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    return editor.registerCommand(INSERT_EMBED_COMMAND, ({ url }) => {
      const node = $createEmbedNode(url);
      $insertNodes([node]);
      if ($isRootOrShadowRoot(node.getParentOrThrow())) {
        $wrapNodeInElement(node, $createParagraphNode).selectEnd();
      }
      return true;
    }, COMMAND_PRIORITY_EDITOR);
  }, [editor]);
  return null;
}
