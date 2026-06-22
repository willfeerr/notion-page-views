'use client';

import { useEffect, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot } from 'lexical';

function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

interface WordCountPluginProps {
  onStats?: (stats: { words: number; chars: number; minutes: number }) => void;
}

export function WordCountPlugin({ onStats }: WordCountPluginProps) {
  const [editor] = useLexicalComposerContext();
  const [stats, setStats] = useState({ words: 0, chars: 0, minutes: 0 });

  useEffect(() => {
    function update() {
      editor.getEditorState().read(() => {
        const text = $getRoot().getTextContent();
        const words = countWords(text);
        const chars = text.replace(/\s/g, '').length;
        const minutes = Math.ceil(words / 200); // avg reading speed
        const next = { words, chars, minutes };
        setStats(next);
        onStats?.(next);
      });
    }
    update();
    return editor.registerUpdateListener(update);
  }, [editor, onStats]);

  return (
    <div className="npc-word-count">
      {stats.words} palavras · {stats.chars} caracteres · {stats.minutes} min de leitura
    </div>
  );
}
