'use client';

import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $createParagraphNode, $insertNodes, $isRootOrShadowRoot, COMMAND_PRIORITY_EDITOR } from 'lexical';
import { $wrapNodeInElement } from '@lexical/utils';
import {
  $createWorkspaceComponentNode,
  INSERT_WORKSPACE_COMPONENT_COMMAND,
} from './nodes/WorkspaceComponentNode';

export function WorkspaceComponentPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => editor.registerCommand(
    INSERT_WORKSPACE_COMPONENT_COMMAND,
    ({ componentType, targetId, title }) => {
      const node = $createWorkspaceComponentNode(componentType, targetId, title);
      $insertNodes([node]);
      if ($isRootOrShadowRoot(node.getParentOrThrow())) {
        $wrapNodeInElement(node, $createParagraphNode).selectEnd();
      }
      return true;
    },
    COMMAND_PRIORITY_EDITOR,
  ), [editor]);

  return null;
}
