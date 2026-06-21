'use client';

import { useEffect, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot } from 'lexical';
import { $isHeadingNode, type HeadingTagType } from '@lexical/rich-text';

interface TocEntry {
  key: string;
  tag: HeadingTagType;
  text: string;
  level: number;
}

function tagToLevel(tag: HeadingTagType): number {
  return tag === 'h1' ? 1 : tag === 'h2' ? 2 : 3;
}

interface TableOfContentsPluginProps {
  /** Render the TOC externally; omit to render the built-in sidebar panel. */
  onEntries?: (entries: TocEntry[]) => void;
}

export function TableOfContentsPlugin({ onEntries }: TableOfContentsPluginProps) {
  const [editor] = useLexicalComposerContext();
  const [entries, setEntries] = useState<TocEntry[]>([]);

  useEffect(() => {
    function update() {
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const found: TocEntry[] = [];
        for (const child of root.getChildren()) {
          if ($isHeadingNode(child)) {
            found.push({
              key: child.getKey(),
              tag: child.getTag(),
              text: child.getTextContent(),
              level: tagToLevel(child.getTag()),
            });
          }
        }
        setEntries(found);
        onEntries?.(found);
      });
    }
    update();
    return editor.registerUpdateListener(update);
  }, [editor, onEntries]);

  if (onEntries || entries.length === 0) return null;

  return (
    <nav className="npc-toc">
      <div className="npc-toc-title">Conteúdo</div>
      {entries.map((e) => (
        <button
          key={e.key}
          type="button"
          className={`npc-toc-item npc-toc-level-${e.level}`}
          onClick={() => {
            const dom = editor.getElementByKey(e.key);
            dom?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        >
          {e.text}
        </button>
      ))}
    </nav>
  );
}
