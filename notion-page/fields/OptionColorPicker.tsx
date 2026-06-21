'use client';

import { useEffect, useState } from 'react';
import { Check, Trash2 } from 'lucide-react';
import { COLOR_TOKENS } from '../propertyTokens';
import type { PropertyColor, SelectOption } from '../types';
import { Popover } from './Popover';

const PICKABLE_COLORS: PropertyColor[] = [
  'gray','brown','orange','yellow','green','blue','purple','pink','red','default',
];

interface OptionColorPickerProps {
  option: SelectOption;
  onUpdate: (option: SelectOption) => void;
  onDelete?: () => void;
}

export function OptionColorPicker({ option, onUpdate, onDelete }: OptionColorPickerProps) {
  const t = COLOR_TOKENS[option.color];
  const [name, setName] = useState(option.name);
  useEffect(() => setName(option.name), [option.name]);
  return (
    <Popover
      align="left"
      trigger={({ toggle }) => (
        <button
          type="button"
          className="npc-option-color-dot"
          style={{ background: t.dot }}
          onClick={(e) => { e.stopPropagation(); toggle(); }}
          title="Trocar cor"
          aria-label="Trocar cor"
        />
      )}
    >
      {({ close }) => (
        <div className="npc-color-picker-panel">
          <form className="npc-option-edit-form" onSubmit={(event) => {
            event.preventDefault();
            if (name.trim()) onUpdate({ ...option, name: name.trim() });
          }}>
            <input value={name} onChange={(event) => setName(event.target.value)} aria-label="Nome da opção" />
            <button type="submit" title="Salvar nome"><Check size={13} /></button>
          </form>
          <div className="npc-color-panel-title">COR</div>
          <div className="npc-color-grid-wide">
            {PICKABLE_COLORS.map((color) => {
              const tok = COLOR_TOKENS[color];
              return (
                <button
                  key={color}
                  type="button"
                  className={`npc-color-pick-btn ${option.color === color ? 'is-selected' : ''}`}
                  title={color}
                  onClick={() => { onUpdate({ ...option, color }); close(); }}
                >
                  <span className="npc-color-pick-swatch" style={{ background: tok.dot }} />
                  <span className="npc-color-pick-label" style={{ color: tok.fg, background: tok.bg }}>
                    {color.charAt(0).toUpperCase() + color.slice(1)}
                  </span>
                </button>
              );
            })}
          </div>
          {onDelete && (
            <button type="button" className="npc-option-delete-btn" onClick={() => { onDelete(); close(); }}>
              <Trash2 size={13} />Deletar opção
            </button>
          )}
        </div>
      )}
    </Popover>
  );
}
