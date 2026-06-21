'use client';

/**
 * Makes toggle blocks interactive: clicking the ▶ arrow in a ToggleTitleNode
 * opens/closes the ToggleContentNode via editor.update().
 */

import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { CLICK_COMMAND, COMMAND_PRIORITY_LOW, $getNearestNodeFromDOMNode } from 'lexical';
import { $isToggleTitleNode, $isToggleContainerNode } from './nodes/ToggleNode';

export function TogglePlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      CLICK_COMMAND,
      (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        const titleElement = target.closest('.npc-toggle-title') as HTMLElement | null;
        if (!titleElement) return false;
        const rect = titleElement.getBoundingClientRect();
        if (event.clientX > rect.left + 24) return false;
        editor.update(() => {
          const node = $getNearestNodeFromDOMNode(titleElement);
          if (!node) return;
          const titleNode = $isToggleTitleNode(node) ? node : node.getParent();
          if (!$isToggleTitleNode(titleNode)) return;
          const container = titleNode.getParent();
          if ($isToggleContainerNode(container)) {
            container.toggleOpen();
          }
        });
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor]);

  return null;
}
