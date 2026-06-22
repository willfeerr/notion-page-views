'use client';

import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $insertNodes, $createParagraphNode, COMMAND_PRIORITY_EDITOR, $isRootOrShadowRoot } from 'lexical';
import { $wrapNodeInElement } from '@lexical/utils';
import { $createBookmarkNode, INSERT_BOOKMARK_COMMAND } from './nodes/BookmarkNode';

/**
 * Handles INSERT_BOOKMARK_COMMAND.
 * In production, fetch OG metadata (title, description, favicon) from your backend
 * before dispatching the command. Here we store the URL and leave title/description
 * empty — the card still renders with the hostname as fallback.
 */
export function BookmarkPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      INSERT_BOOKMARK_COMMAND,
      ({ url }) => {
        const node = $createBookmarkNode(url);
        $insertNodes([node]);
        if ($isRootOrShadowRoot(node.getParentOrThrow())) {
          $wrapNodeInElement(node, $createParagraphNode).selectEnd();
        }
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );
  }, [editor]);

  return null;
}
