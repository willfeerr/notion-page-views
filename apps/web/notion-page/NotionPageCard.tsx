'use client';

import type { NotionPageData, NotionSchema } from './types';
import { getPlainTextPreview } from './editor/getPlainTextPreview';
import { PropertyField } from './fields/PropertyField';
import { PROPERTY_ICONS } from './propertyTokens';
import { GripHorizontal } from 'lucide-react';

interface NotionPageCardProps {
  schema: NotionSchema;
  page: NotionPageData;
  locale?: string;
  /** Which property ids to show on the card. Defaults to every property in the schema. */
  visiblePropertyIds?: string[];
  onClick?: () => void;
  onDelete?: () => void;
  showWindowControls?: boolean;
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

/** The "card" view: a compact, read-only summary meant to drop into a board column. */
export function NotionPageCard({ schema, page, locale, visiblePropertyIds, onClick, onDelete, showWindowControls = false }: NotionPageCardProps) {
  const preview = getPlainTextPreview(page.content, 120);
  const visibleProperties = visiblePropertyIds
    ? schema.properties.filter((p) => visiblePropertyIds.includes(p.id))
    : schema.properties;

  return (
    <div
      className="npc-card"
      data-window-controls={showWindowControls || undefined}
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
          <button type="button" className="is-delete" title="Excluir pagina" aria-label="Excluir pagina" onClick={(event) => { event.stopPropagation(); onDelete?.(); }} />
          <span className="is-state" title="Pagina sincronizada" />
          <button type="button" className="is-open" title="Abrir pagina" aria-label="Abrir pagina" onClick={(event) => { event.stopPropagation(); onClick?.(); }} />
          <GripHorizontal size={24} className="npc-card-window-grip" />
        </div>
      ) : null}
      <div className="npc-card-body">
        <div className="npc-card-title-row">
          {page.icon && <span className="npc-card-icon">{page.icon}</span>}
          <span className="npc-card-title">{page.title || 'Sem título'}</span>
        </div>

        {preview && <p className="npc-card-preview">{preview}</p>}

        {visibleProperties.length > 0 && (
          <div className="npc-card-properties">
            {visibleProperties.map((definition) => {
              const value = page.properties[definition.id];
              if (isEmptyValue(value) && definition.type !== 'checkbox') return null;
              const Icon = PROPERTY_ICONS[definition.type];
              return (
                <span key={definition.id} className="npc-card-property">
                  <Icon size={12} className="npc-card-property-icon" strokeWidth={2} />
                  <PropertyField definition={definition} value={value} compact locale={locale} />
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
