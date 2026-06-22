'use client';

import { useState } from 'react';
import { Plus, X, Check, Search } from 'lucide-react';
import type { SelectOption } from '../types';
import { COLOR_TOKENS, nextOptionColor } from '../propertyTokens';
import { Popover } from './Popover';
import { OptionColorPicker } from './OptionColorPicker';

interface MultiSelectFieldProps {
  options: SelectOption[];
  value: string[] | null | undefined;
  compact?: boolean;
  maxCompactPills?: number;
  onChange?: (next: string[]) => void;
  onCreateOption?: (option: SelectOption) => void;
  onUpdateOption?: (option: SelectOption) => void;
  onDeleteOption?: (optionId: string) => void;
}

function Pill({ option, onRemove }: { option: SelectOption; onRemove?: () => void }) {
  const t = COLOR_TOKENS[option.color];
  return (
    <span className="npc-pill npc-pill-removable" style={{ background: t.bg, color: t.fg }}>
      {option.name}
      {onRemove && (
        <button type="button" className="npc-pill-remove"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}>
          <X size={10} strokeWidth={3} />
        </button>
      )}
    </span>
  );
}

export function MultiSelectField({
  options, value, compact = false, maxCompactPills = 3,
  onChange, onCreateOption, onUpdateOption, onDeleteOption,
}: MultiSelectFieldProps) {
  const selectedIds = value ?? [];
  const selectedOptions = options.filter((o) => selectedIds.includes(o.id));
  const [search, setSearch] = useState('');

  if (compact) {
    if (selectedOptions.length === 0) return <span className="npc-muted">Vazio</span>;
    const visible = selectedOptions.slice(0, maxCompactPills);
    const rest = selectedOptions.length - visible.length;
    return (
      <span className="npc-pill-row">
        {visible.map((o) => <Pill key={o.id} option={o} />)}
        {rest > 0 && <span className="npc-pill npc-pill-more">+{rest}</span>}
      </span>
    );
  }

  function toggle(id: string) {
    onChange?.(selectedIds.includes(id) ? selectedIds.filter((i) => i !== id) : [...selectedIds, id]);
  }

  const filtered = search
    ? options.filter((o) => o.name.toLowerCase().includes(search.toLowerCase()))
    : options;

  const showCreate = search.trim() && !options.some((o) => o.name.toLowerCase() === search.toLowerCase());

  function handleCreate() {
    if (!search.trim()) return;
    const newOpt: SelectOption = {
      id: `opt-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`,
      name: search.trim(), color: nextOptionColor(options.length),
    };
    onCreateOption?.(newOpt);
    onChange?.([...selectedIds, newOpt.id]);
    setSearch('');
  }

  return (
    <div className="npc-pill-row npc-pill-row-edit">
      {selectedOptions.map((o) => <Pill key={o.id} option={o} onRemove={() => toggle(o.id)} />)}
      <Popover
        align="left"
        trigger={({ toggle: openPop }) => (
          <button type="button" className="npc-add-pill-btn" onClick={openPop} aria-label="Adicionar tag">
            <Plus size={13} />
          </button>
        )}
      >
        {() => (
          <div className="npc-options-list">
            <div className="npc-options-search">
              <Search size={12} className="npc-options-search-icon" />
              <input autoFocus className="npc-options-search-input" value={search}
                placeholder="Buscar ou criar…"
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && showCreate) handleCreate(); }}
              />
            </div>
            {filtered.map((option) => (
              <div key={option.id} className="npc-option-row-wrap">
                <button type="button" className="npc-option-row" onClick={() => toggle(option.id)}>
                  <span className="npc-option-checkmark">
                    {selectedIds.includes(option.id) && <Check size={13} strokeWidth={3} />}
                  </span>
                  <Pill option={option} />
                </button>
                {onUpdateOption && (
                  <OptionColorPicker
                    option={option}
                    onUpdate={onUpdateOption}
                    onDelete={onDeleteOption ? () => {
                      onDeleteOption(option.id);
                      if (selectedIds.includes(option.id)) onChange?.(selectedIds.filter((id) => id !== option.id));
                    } : undefined}
                  />
                )}
              </div>
            ))}
            {showCreate && onCreateOption && (
              <button type="button" className="npc-option-create" onClick={handleCreate}>
                <Plus size={13} />Criar <strong>{search.trim()}</strong>
              </button>
            )}
          </div>
        )}
      </Popover>
    </div>
  );
}
