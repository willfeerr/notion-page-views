'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { LexicalComposer, type InitialConfigType } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { HorizontalRulePlugin } from '@lexical/react/LexicalHorizontalRulePlugin';
import { TablePlugin } from '@lexical/react/LexicalTablePlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { AutoLinkPlugin } from '@lexical/react/LexicalAutoLinkPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { TRANSFORMERS } from '@lexical/markdown';
import type { EditorState, SerializedEditorState } from 'lexical';
import { editorTheme } from './theme';
import { editorNodes } from './nodes';
import { FloatingToolbarPlugin } from './FloatingToolbarPlugin';
import { SlashCommandPlugin } from './SlashCommandPlugin';
import { BlockMenuPlugin } from './BlockMenuPlugin';
import { TogglePlugin } from './TogglePlugin';
import { ImagePlugin } from './ImagePlugin';
import { EmbedPlugin } from './EmbedPlugin';
import { MathPlugin } from './MathPlugin';
import { ColumnLayoutPlugin } from './ColumnLayoutPlugin';
import { BookmarkPlugin } from './BookmarkPlugin';
import { LinkEditorPlugin } from './LinkEditorPlugin';
import { WordCountPlugin } from './WordCountPlugin';
import { TableOfContentsPlugin } from './TableOfContentsPlugin';
import { CollabPlugin } from './CollabPlugin';
import type { CollabConfig, PersonOption } from '../types';
import { MentionPlugin } from './MentionPlugin';
import { SerializedStateSyncPlugin, hasSerializedEditorContent } from './SerializedStateSyncPlugin';
import { LocalCursorLabelPlugin } from './LocalCursorLabelPlugin';
import { WorkspaceComponentPlugin } from './WorkspaceComponentPlugin';
import { getBlockIdentityIndex, withStableBlockIds } from './blockIdentity';

// URL matchers for AutoLinkPlugin
const URL_MATCHER = /((https?:\/\/|www\.|ftp\.)((\w+:\w+@)?[\w-]+(\.[\w-]+)+(:\d+)?(\/[^\s]*)?)|[\w-]+\.[\w-]{2,}(\/[^\s]*)?)/i;
const EMAIL_MATCHER = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

const AUTOLINK_MATCHERS = [
  (text: string) => {
    const match = URL_MATCHER.exec(text);
    if (!match) return null;
    const url = match[0];
    return { index: match.index, length: url.length, text: url, url: url.startsWith('http') ? url : `https://${url}` };
  },
  (text: string) => {
    const match = EMAIL_MATCHER.exec(text);
    if (!match) return null;
    return { index: match.index, length: match[0].length, text: match[0], url: `mailto:${match[0]}` };
  },
];

interface NotionEditorProps {
  initialContent?: SerializedEditorState | null;
  onChange?: (content: SerializedEditorState) => void;
  editable?: boolean;
  placeholder?: string;
  collab?: CollabConfig;
  mentionPeople?: PersonOption[];
  showWordCount?: boolean;
  showTableOfContents?: boolean;
}

export function NotionEditor({
  initialContent,
  onChange,
  editable = true,
  placeholder = "Escreva algo, ou '/' para comandos…",
  collab,
  mentionPeople = [],
  showWordCount = false,
  showTableOfContents = false,
}: NotionEditorProps) {
  const [containerElem, setContainerElem] = useState<HTMLDivElement | null>(null);
  const changeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blockIndexRef = useRef(getBlockIdentityIndex(initialContent));
  const skippedInitialEmptyCollabChangeRef = useRef(false);

  useEffect(() => {
    blockIndexRef.current = getBlockIdentityIndex(initialContent);
  }, [initialContent]);

  const initialConfig: InitialConfigType = {
    namespace: collab ? `collab-${collab.room}` : 'notion-page',
    theme: editorTheme,
    nodes: editorNodes,
    editable,
    onError: (e) => console.error('[NotionEditor]', e),
    editorState: collab ? undefined : (initialContent ? JSON.stringify(initialContent) : undefined),
  };

  const handleChange = useCallback(
    (editorState: EditorState) => {
      if (changeTimer.current) clearTimeout(changeTimer.current);
      const snapshot = withStableBlockIds(editorState.toJSON(), { previous: blockIndexRef.current });
      blockIndexRef.current = snapshot.blockIndex;

      if (
        collab
        && hasSerializedEditorContent(initialContent)
        && !skippedInitialEmptyCollabChangeRef.current
        && !hasSerializedEditorContent(snapshot)
      ) {
        skippedInitialEmptyCollabChangeRef.current = true;
        return;
      }
      skippedInitialEmptyCollabChangeRef.current = true;

      changeTimer.current = setTimeout(() => {
        changeTimer.current = null;
        onChange?.(snapshot);
      }, 200);
    },
    [collab, initialContent, onChange],
  );

  useEffect(() => () => {
    if (changeTimer.current) clearTimeout(changeTimer.current);
  }, []);

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="npc-editor-wrap">
        {showTableOfContents && (
          <TableOfContentsPlugin />
        )}
        <div className="npc-editor-container" ref={setContainerElem}>
          <RichTextPlugin
            contentEditable={<ContentEditable className="npc-editor-content-editable" />}
            placeholder={<div className="npc-editor-placeholder">{placeholder}</div>}
            ErrorBoundary={LexicalErrorBoundary}
          />

          {/* Core */}
          <ListPlugin />
          <CheckListPlugin />
          <LinkPlugin />
          <HorizontalRulePlugin />
          <TablePlugin />
          <TogglePlugin />

          {/* Auto-formatting */}
          <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
          <AutoLinkPlugin matchers={AUTOLINK_MATCHERS} />

          {/* Command handlers */}
          <ImagePlugin />
          <EmbedPlugin />
          <WorkspaceComponentPlugin />
          <MathPlugin />
          <ColumnLayoutPlugin />
          <BookmarkPlugin />

          {/* UI plugins */}
          <FloatingToolbarPlugin />
          <LinkEditorPlugin />
          <SlashCommandPlugin />
          {mentionPeople.length > 0 && <MentionPlugin people={mentionPeople} />}

          {containerElem && (
            <BlockMenuPlugin anchorElem={containerElem} />
          )}

          {/* Collab OR local */}
          {collab ? (
            <>
              <CollabPlugin {...collab} initialContent={initialContent} />
              <SerializedStateSyncPlugin value={initialContent} mode="hydrate-empty-once" />
              <LocalCursorLabelPlugin user={collab.user} />
            </>
          ) : (
            <>
              <HistoryPlugin />
              <SerializedStateSyncPlugin value={initialContent} />
            </>
          )}

          {onChange && <OnChangePlugin onChange={handleChange} ignoreSelectionChange />}

          {showWordCount && <WordCountPlugin />}
        </div>
      </div>
    </LexicalComposer>
  );
}
