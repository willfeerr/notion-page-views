'use client';

import { Check, Link2, Plus, Search, X } from 'lucide-react';
import { useState } from 'react';
import type { RelationPageOption } from '../types';
import { Popover } from './Popover';

interface RelationFieldProps {
  options: RelationPageOption[];
  value: string[] | null | undefined;
  compact?: boolean;
  multiple?: boolean;
  onChange?: (next: string[]) => void;
}

export function RelationField({ options, value, compact = false, multiple = true, onChange }: RelationFieldProps) {
  const selectedIds = Array.isArray(value) ? value : [];
  const selected = selectedIds.flatMap((id) => {
    const option = options.find((candidate) => candidate.id === id);
    return option ? [option] : [];
  });
  const [search, setSearch] = useState('');

  if (compact) {
    if (!selected.length) return <span className="npc-muted">Vazio</span>;
    return <span className="npc-relation-compact"><Link2 size={11} />{selected[0].icon}<span>{selected[0].title}</span>{selected.length > 1 ? <b>+{selected.length - 1}</b> : null}</span>;
  }

  function toggle(id: string) {
    if (!multiple) {
      onChange?.(selectedIds.includes(id) ? [] : [id]);
      return;
    }
    onChange?.(selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id]);
  }

  const filtered = options.filter((option) => option.title.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  return <div className="npc-pill-row npc-pill-row-edit">
    {selected.map((option) => <span key={option.id} className="npc-relation-pill">
      <span>{option.icon || <Link2 size={11} />}</span><span>{option.title}</span>
      {onChange ? <button type="button" aria-label={`Remover ${option.title}`} onClick={() => toggle(option.id)}><X size={10} /></button> : null}
    </span>)}
    {onChange ? <Popover align="left" trigger={({ toggle: open }) => <button type="button" className="npc-add-pill-btn" onClick={open} aria-label="Relacionar página"><Plus size={13} /></button>}>
      {() => <div className="npc-options-list">
        <div className="npc-options-search"><Search size={12} className="npc-options-search-icon" /><input autoFocus className="npc-options-search-input" value={search} placeholder="Buscar página..." onChange={(event) => setSearch(event.target.value)} /></div>
        {filtered.map((option) => <button key={option.id} type="button" className="npc-option-row" onClick={() => toggle(option.id)}>
          <span className="npc-option-checkmark">{selectedIds.includes(option.id) ? <Check size={13} strokeWidth={3} /> : null}</span>
          <span>{option.icon || <Link2 size={12} />}</span><span>{option.title}</span>
        </button>)}
        {!filtered.length ? <span className="npc-options-empty">Nenhuma página encontrada</span> : null}
      </div>}
    </Popover> : null}
  </div>;
}
