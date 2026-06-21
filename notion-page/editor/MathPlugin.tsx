'use client';

import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $insertNodes, $isRootOrShadowRoot, $createParagraphNode, COMMAND_PRIORITY_EDITOR } from 'lexical';
import { $wrapNodeInElement } from '@lexical/utils';
import { $createMathNode, INSERT_MATH_COMMAND } from './nodes/MathNode';

export function MathPlugin() {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    return editor.registerCommand(INSERT_MATH_COMMAND, ({ latex, inline }) => {
      const node = $createMathNode(latex, inline ?? false);
      $insertNodes([node]);
      if (!inline && $isRootOrShadowRoot(node.getParentOrThrow())) {
        $wrapNodeInElement(node, $createParagraphNode).selectEnd();
      }
      return true;
    }, COMMAND_PRIORITY_EDITOR);
  }, [editor]);
  return null;
}
