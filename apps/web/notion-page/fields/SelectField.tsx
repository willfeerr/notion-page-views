'use client';

import { useRef, useState } from 'react';
import { ChevronDown, Check, Plus, Search } from 'lucide-react';
import type { SelectOption, StatusGroup } from '../types';
import { COLOR_TOKENS, nextOptionColor } from '../propertyTokens';
import { Popover } from './Popover';
import { OptionColorPicker } from './OptionColorPicker';

export interface SelectFieldProps {
  variant: 'select' | 'status';
  options: SelectOption[];
  groups?: StatusGroup[];
  value: string | null | undefined;
  compact?: boolean;
  onChange?: (next: string | null) => void;
  onCreateOption?: (option: SelectOption) => void;
  onUpdateOption?: (option: SelectOption) => void;
  onDeleteOption?: (optionId: string) => void;
}

export function Pill({ option }: { option: SelectOption }) {
  const t = COLOR_TOKENS[option.color];
  return <span className="npc-pill" style={{ background: t.bg, color: t.fg }}>{option.name}</span>;
}

function StatusLabel({ option }: { option: SelectOption }) {
  const t = COLOR_TOKENS[option.color];
  return (
    <span className="npc-status-value">
      <span className="npc-status-dot" style={{ background: t.dot }} />{option.name}
    </span>
  );
}

export function SelectField({
  variant, options, groups, value, compact = false,
  onChange, onCreateOption, onUpdateOption, onDeleteOption,
}: SelectFieldProps) {
  const selected = options.find((o) => o.id === value) ?? null;
  const [search, setSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const compactNode = selected
    ? variant === 'select' ? <Pill option={selected} /> : <StatusLabel option={selected} />
    : <span className="npc-muted">Vazio</span>;

  if (compact) return compactNode;

  const filtered = search
    ? options.filter((o) => o.name.toLowerCase().includes(search.toLowerCase()))
    : options;

  const orderedGroups = variant === 'status' && groups
    ? groups.map((g) => ({ group: g, opts: filtered.filter((o) => g.optionIds.includes(o.id)) }))
    : [{ group: null, opts: filtered }];

  const showCreate = search.trim() && !options.some((o) => o.name.toLowerCase() === search.toLowerCase());

  function handleCreate(close: () => void) {
    if (!search.trim()) return;
    const newOpt: SelectOption = {
      id: `opt-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`,
      name: search.trim(),
      color: nextOptionColor(options.length),
    };
    onCreateOption?.(newOpt);
    onChange?.(newOpt.id);
    setSearch('');
    close();
  }

  return (
    <Popover
      align="left"
      trigger={({ toggle }) => (
        <button type="button" className="npc-select-trigger" onClick={toggle}>
          {compactNode}<ChevronDown size={13} className="npc-trigger-chevron" />
        </button>
      )}
    >
      {({ close }) => (
        <div className="npc-options-list">
          <div className="npc-options-search">
            <Search size={12} className="npc-options-search-icon" />
            <input
              autoFocus ref={searchInputRef}
              className="npc-options-search-input"
              value={search} placeholder="Buscar ou criar…"
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && showCreate) handleCreate(close); }}
            />
          </div>

          {orderedGroups.map(({ group, opts }) => (
            <div key={group?.id ?? 'all'} className="npc-options-group">
              {group && <div className="npc-options-group-label">{group.name}</div>}
              {opts.map((option) => (
                <div key={option.id} className="npc-option-row-wrap">
                  <button
                    type="button"
                    className="npc-option-row"
                    onClick={() => { onChange?.(option.id === value ? null : option.id); close(); }}
                  >
                    <span className="npc-option-checkmark">
                      {option.id === value && <Check size={13} strokeWidth={3} />}
                    </span>
                    {variant === 'select' ? <Pill option={option} /> : <StatusLabel option={option} />}
                  </button>
                  {onUpdateOption && (
                    <OptionColorPicker
                      option={option}
                      onUpdate={onUpdateOption}
                      onDelete={onDeleteOption ? () => {
                        onDeleteOption(option.id);
                        if (value === option.id) onChange?.(null);
                      } : undefined}
                    />
                  )}
                </div>
              ))}
            </div>
          ))}

          {showCreate && onCreateOption && (
            <button type="button" className="npc-option-create" onClick={() => handleCreate(close)}>
              <Plus size={13} />Criar <strong>{search.trim()}</strong>
            </button>
          )}
        </div>
      )}
    </Popover>
  );
}
