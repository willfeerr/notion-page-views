'use client';

/**
 * Exports editor content as Markdown string.
 * Usage: <ExportPlugin onExport={setMarkdown} />
 *        — fires onExport once on mount and again after every change.
 *
 * Or: call the exported `useExportMarkdown()` hook imperatively.
 */

import { useCallback, useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $convertToMarkdownString, TRANSFORMERS } from '@lexical/markdown';

interface ExportPluginProps {
  onExport?: (markdown: string) => void;
}

export function ExportPlugin({ onExport }: ExportPluginProps) {
  const [editor] = useLexicalComposerContext();

  const doExport = useCallback(() => {
    editor.getEditorState().read(() => {
      const md = $convertToMarkdownString(TRANSFORMERS);
      onExport?.(md);
    });
  }, [editor, onExport]);

  useEffect(() => {
    doExport();
    return editor.registerUpdateListener(doExport);
  }, [editor, doExport]);

  return null;
}

/** Imperative hook — returns a function that produces the current Markdown string. */
export function useExportMarkdown() {
  const [editor] = useLexicalComposerContext();
  return useCallback(() => {
    let result = '';
    editor.getEditorState().read(() => {
      result = $convertToMarkdownString(TRANSFORMERS);
    });
    return result;
  }, [editor]);
}
