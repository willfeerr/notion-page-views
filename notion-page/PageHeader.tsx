'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Image as ImageIcon, Smile, X, Move } from 'lucide-react';
import { EmojiPicker } from './fields/EmojiPicker';
import { Popover } from './fields/Popover';

interface PageHeaderProps {
  icon?: string | null;
  coverUrl?: string | null;
  coverPosition?: number; // 0-100, default 50
  title: string;
  onIconChange?: (icon: string | null) => void;
  onCoverChange?: (url: string | null) => void;
  onCoverPositionChange?: (pos: number) => void;
  onTitleChange?: (title: string) => void;
}

export function PageHeader({
  icon, coverUrl, coverPosition = 50, title,
  onIconChange, onCoverChange, onCoverPositionChange, onTitleChange,
}: PageHeaderProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const coverRef = useRef<HTMLDivElement>(null);
  const [isDraggingCover, setIsDraggingCover] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartPos, setDragStartPos] = useState(coverPosition);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [title]);

  // Cover drag-to-reposition
  function onCoverMouseDown(e: React.MouseEvent) {
    if (!onCoverPositionChange) return;
    setIsDraggingCover(true);
    setDragStartY(e.clientY);
    setDragStartPos(coverPosition);
    e.preventDefault();
  }

  useEffect(() => {
    if (!isDraggingCover) return;
    function onMouseMove(e: MouseEvent) {
      const coverEl = coverRef.current;
      if (!coverEl) return;
      const h = coverEl.offsetHeight;
      const delta = ((e.clientY - dragStartY) / h) * 100;
      const newPos = Math.max(0, Math.min(100, dragStartPos - delta));
      onCoverPositionChange?.(Math.round(newPos));
    }
    function onMouseUp() { setIsDraggingCover(false); }
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDraggingCover, dragStartY, dragStartPos, onCoverPositionChange]);

  return (
    <div className="npc-page-header">
      {coverUrl && (
        <div
          ref={coverRef}
          className={`npc-cover ${isDraggingCover ? 'is-dragging' : ''}`}
          style={{ backgroundImage: `url(${coverUrl})`, backgroundPositionY: `${coverPosition}%` }}
          onMouseDown={onCoverPositionChange ? onCoverMouseDown : undefined}
        >
          <div className="npc-cover-actions">
            {onCoverPositionChange && (
              <span className="npc-cover-action-hint">
                <Move size={12} /> Arraste para reposicionar
              </span>
            )}
            {onCoverChange && (
              <button type="button" className="npc-cover-remove" onClick={() => onCoverChange(null)}>
                <X size={13} /> Remover capa
              </button>
            )}
          </div>
        </div>
      )}

      <div className={`npc-title-block ${coverUrl ? 'has-cover' : ''}`}>
        {icon &&
          (onIconChange ? (
            <EmojiPicker onSelect={onIconChange} onClear={() => onIconChange(null)}
              trigger={({ toggle }) => (
                <button type="button" className="npc-page-icon" onClick={toggle} aria-label="Trocar ícone">{icon}</button>
              )}
            />
          ) : (
            <span className="npc-page-icon">{icon}</span>
          ))}

        {(onIconChange || onCoverChange) && (
          <div className="npc-title-actions">
            {!icon && onIconChange && (
              <EmojiPicker onSelect={onIconChange}
                trigger={({ toggle }) => (
                  <button type="button" className="npc-ghost-btn" onClick={toggle}><Smile size={14} /> Adicionar ícone</button>
                )}
              />
            )}
            {!coverUrl && onCoverChange && <CoverUrlPopover onSubmit={onCoverChange} />}
          </div>
        )}

        <textarea
          ref={textareaRef}
          className="npc-title-input"
          value={title}
          rows={1}
          placeholder="Sem título"
          onChange={(e) => onTitleChange?.(e.target.value)}
        />
      </div>
    </div>
  );
}

function CoverUrlPopover({ onSubmit }: { onSubmit: (url: string) => void }) {
  return (
    <Popover align="left"
      trigger={({ toggle }): ReactNode => (
        <button type="button" className="npc-ghost-btn" onClick={toggle}><ImageIcon size={14} /> Adicionar capa</button>
      )}
    >
      {({ close }) => (
        <CoverUrlForm onSubmit={(url) => { onSubmit(url); close(); }} />
      )}
    </Popover>
  );
}

function CoverUrlForm({ onSubmit }: { onSubmit: (url: string) => void }) {
  const [url, setUrl] = useState('');
  return (
    <form className="npc-cover-form"
      onSubmit={(e) => { e.preventDefault(); if (url.trim()) onSubmit(url.trim()); }}>
      <input autoFocus className="npc-text-input" placeholder="Cole o link de uma imagem"
        value={url} onChange={(e) => setUrl(e.target.value)} />
      <button type="submit" className="npc-primary-btn-sm">Salvar</button>
    </form>
  );
}
