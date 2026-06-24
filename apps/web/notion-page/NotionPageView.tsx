'use client';

import { useState } from 'react';
import type { SerializedEditorState } from 'lexical';
import type { BoardLinkOption, BoardLinkValue, CollabConfig, NotionPageData, NotionSchema, PersonOption, RelationTargetOption, StoredPropertyValue } from './types';
import { PageHeader } from './PageHeader';
import { PropertiesPanel } from './PropertiesPanel';
import { NotionEditor } from './editor/NotionEditor';
import { BookOpen, ZoomIn, AlignLeft } from 'lucide-react';

interface NotionPageViewProps {
  schema: NotionSchema;
  page: NotionPageData;
  locale?: string;
  collab?: CollabConfig;
  onTitleChange?: (title: string) => void;
  onIconChange?: (icon: string | null) => void;
  onCoverChange?: (url: string | null) => void;
  onCoverPositionChange?: (pos: number) => void;
  onPropertyChange?: (propertyId: string, value: StoredPropertyValue) => void;
  onContentChange?: (content: SerializedEditorState) => void;
  onSchemaChange?: (schema: NotionSchema) => void;
  boardOptions?: BoardLinkOption[];
  boardPlacement?: BoardLinkValue | null;
  onBoardPlacementChange?: (placement: BoardLinkValue | null) => void;
  relationTargets?: RelationTargetOption[];
  onEditingLocationChange?: (location: string) => void;
}

function getMentionPeople(schema: NotionSchema): PersonOption[] {
  const seen = new Set<string>();
  const people: PersonOption[] = [];
  for (const def of schema.properties) {
    if (def.type === 'person') {
      for (const p of def.people) {
        if (!seen.has(p.id)) { seen.add(p.id); people.push(p); }
      }
    }
  }
  return people;
}

export function NotionPageView({
  schema, page, locale, collab,
  onTitleChange, onIconChange, onCoverChange, onCoverPositionChange,
  onPropertyChange, onContentChange, onSchemaChange,
  boardOptions, boardPlacement, onBoardPlacementChange,
  relationTargets,
  onEditingLocationChange,
}: NotionPageViewProps) {
  const [fullWidth, setFullWidth] = useState(false);
  const [smallFont, setSmallFont] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const mentionPeople = getMentionPeople(schema);

  return (
    <div
      className={`npc-page-view ${fullWidth ? 'is-full-width' : ''} ${smallFont ? 'is-small-font' : ''}`}
      onFocusCapture={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest('.npc-title-input, .npc-title-block')) onEditingLocationChange?.('Titulo da pagina');
        else if (target.closest('.npc-properties-panel')) onEditingLocationChange?.('Propriedades');
        else if (target.closest('.npc-editor-content-editable')) onEditingLocationChange?.('Corpo do documento');
      }}
    >
      <PageHeader
        icon={page.icon}
        coverUrl={page.coverUrl}
        coverPosition={page.coverPosition}
        title={page.title}
        onTitleChange={onTitleChange}
        onIconChange={onIconChange}
        onCoverChange={onCoverChange}
        onCoverPositionChange={onCoverPositionChange}
      />

      {/* Page-level controls — full-width, small font, TOC */}
      <div className="npc-page-controls">
        <button
          type="button"
          className={`npc-page-ctrl-btn ${fullWidth ? 'is-active' : ''}`}
          title="Largura total"
          onClick={() => setFullWidth((v) => !v)}
        >
          <AlignLeft size={13} />
          <span>Largura total</span>
        </button>
        <button
          type="button"
          className={`npc-page-ctrl-btn ${smallFont ? 'is-active' : ''}`}
          title="Fonte pequena"
          onClick={() => setSmallFont((v) => !v)}
        >
          <ZoomIn size={13} />
          <span>Fonte pequena</span>
        </button>
        <button
          type="button"
          className={`npc-page-ctrl-btn ${showToc ? 'is-active' : ''}`}
          title="Índice"
          onClick={() => setShowToc((v) => !v)}
        >
          <BookOpen size={13} />
          <span>Índice</span>
        </button>
      </div>

      <div className="npc-page-body">
        <PropertiesPanel
          schema={schema}
          properties={page.properties}
          locale={locale}
          onChange={onPropertyChange}
          onSchemaChange={onSchemaChange}
          boardOptions={boardOptions}
          boardPlacement={boardPlacement}
          onBoardPlacementChange={onBoardPlacementChange}
          relationTargets={relationTargets}
        />
        <div className="npc-page-divider" />
        <NotionEditor
          key={collab ? `collab-${collab.room}` : page.id}
          initialContent={page.content}
          onChange={onContentChange}
          collab={collab}
          mentionPeople={mentionPeople}
          showWordCount
          showTableOfContents={showToc}
        />
      </div>
    </div>
  );
}
