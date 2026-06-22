'use client';

import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $insertNodes, $createParagraphNode, COMMAND_PRIORITY_EDITOR } from 'lexical';
import { $createColumnLayoutNode, $createColumnNode, INSERT_COLUMN_LAYOUT_COMMAND, type ColumnCount } from './nodes/ColumnLayoutNode';

export function ColumnLayoutPlugin() {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    return editor.registerCommand(INSERT_COLUMN_LAYOUT_COMMAND, ({ columns }) => {
      const layout = $createColumnLayoutNode(columns as ColumnCount);
      for (let i = 0; i < columns; i++) {
        const col = $createColumnNode();
        col.append($createParagraphNode());
        layout.append(col);
      }
      $insertNodes([layout]);
      return true;
    }, COMMAND_PRIORITY_EDITOR);
  }, [editor]);
  return null;
}
