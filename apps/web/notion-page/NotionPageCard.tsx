'use client';

import { useState, type ButtonHTMLAttributes } from 'react';
import type { NotionPageData, NotionSchema } from './types';
import type { SerializedEditorState } from 'lexical';
import { getPlainTextPreview } from './editor/getPlainTextPreview';
import { NotionEditor } from './editor/NotionEditor';
import { PropertyField } from './fields/PropertyField';
import { Popover } from './fields/Popover';
import { PROPERTY_ICONS } from './propertyTokens';
import { ChevronsDownUp, ChevronsUpDown, GripHorizontal, Maximize2, Trash2 } from 'lucide-react';
import type { StoredPropertyValue } from './types';
import { CardQuickActions, type CardQuickAction } from './CardQuickActions';

interface NotionPageCardProps {
  schema: NotionSchema;
  page: NotionPageData;
  locale?: string;
  /** Which property ids to show on the card. Defaults to every property in the schema. */
  visiblePropertyIds?: string[];
  onClick?: () => void;
  onDelete?: () => void;
  onPropertyChange?: (propertyId: string, value: StoredPropertyValue) => void;
  onContentChange?: (content: SerializedEditorState) => void;
  quickActions?: CardQuickAction[];
  dragHandleProps?: ButtonHTMLAttributes<HTMLButtonElement>;
  showWindowControls?: boolean;
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

/** Compact page view with lightweight property edits and opt-in body expansion. */
const INLINE_EDITABLE_TYPES = new Set(['date', 'person', 'multi_select', 'select', 'checkbox']);

export function NotionPageCard({ schema, page, locale, visiblePropertyIds, onClick, onDelete, onPropertyChange, onContentChange, quickActions, dragHandleProps, showWindowControls = false }: NotionPageCardProps) {
  const [expanded, setExpanded] = useState(false);
  const preview = page.contentPreview ?? getPlainTextPreview(page.content, 120);
  const visibleProperties = visiblePropertyIds
    ? schema.properties.filter((p) => visiblePropertyIds.includes(p.id))
    : schema.properties;

  return (
    <div
      className="npc-card"
      data-window-controls={showWindowControls || undefined}
      data-expanded={expanded || undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      {showWindowControls ? (
        <div className="npc-card-window-controls" draggable={false} onPointerDown={(event) => event.stopPropagation()} onDragStart={(event) => event.preventDefault()}>
          <button type="button" className="is-delete" title="Excluir pagina" aria-label="Excluir pagina" onClick={(event) => { event.stopPropagation(); onDelete?.(); }}><Trash2 size={8} /></button>
          <button type="button" className="is-expand" title={expanded ? 'Recolher card' : 'Expandir e editar corpo'} aria-label={expanded ? 'Recolher card' : 'Expandir e editar corpo'} onClick={(event) => { event.stopPropagation(); setExpanded((current) => !current); }}>{expanded ? <ChevronsDownUp size={8} /> : <ChevronsUpDown size={8} />}</button>
          <button type="button" className="is-open" title="Abrir pagina" aria-label="Abrir pagina" onClick={(event) => { event.stopPropagation(); onClick?.(); }}><Maximize2 size={8} /></button>
          <button type="button" {...dragHandleProps} className="npc-card-window-grip" title="Arrastar card" aria-label="Arrastar card" onClick={(event) => event.stopPropagation()}><GripHorizontal size={20} /></button>
        </div>
      ) : null}
      {page.coverUrl && <div className="npc-card-cover" style={{ backgroundImage: `url(${page.coverUrl})` }} />}
      <div className="npc-card-body">
        <div className="npc-card-title-row">
          {page.icon && <span className="npc-card-icon">{page.icon}</span>}
          <span className="npc-card-title">{page.title || 'Sem título'}</span>
        </div>

        {expanded ? (
          <div className="npc-card-expanded-editor" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
            <NotionEditor key={page.id} initialContent={page.content} onChange={onContentChange} placeholder="Edite o corpo da pagina..." />
          </div>
        ) : preview ? <p className="npc-card-preview">{preview}</p> : null}

      </div>
      <footer className="npc-card-footer">
        {visibleProperties.length > 0 && (
          <div className="npc-card-properties">
            {visibleProperties.map((definition) => {
              const value = page.properties[definition.id];
              const editable = Boolean(onPropertyChange && INLINE_EDITABLE_TYPES.has(definition.type));
              if (isEmptyValue(value) && definition.type !== 'checkbox' && !editable) return null;
              const Icon = PROPERTY_ICONS[definition.type];
              if (!editable) return <span key={definition.id} className="npc-card-property"><Icon size={12} className="npc-card-property-icon" strokeWidth={2} /><PropertyField definition={definition} value={value} compact locale={locale} /></span>;
              return <Popover key={definition.id} align="left" trigger={({ open, toggle }) => (
                <button type="button" className={`npc-card-property npc-card-property-trigger${open ? ' is-open' : ''}`} title={`Editar ${definition.name}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); toggle(); }}>
                  <Icon size={12} className="npc-card-property-icon" strokeWidth={2} />
                  <PropertyField definition={definition} value={value} compact locale={locale} />
                </button>
              )}>{() => <div className="npc-card-property-editor" onClick={(event) => event.stopPropagation()}><strong>{definition.name}</strong><PropertyField definition={definition} value={value} locale={locale} onChange={(next) => onPropertyChange?.(definition.id, next)} /></div>}</Popover>;
            })}
          </div>
        )}
        <CardQuickActions schema={schema} page={page} actions={quickActions} />
      </footer>
    </div>
  );
}
