'use client';

import { COLOR_TOKENS } from '../propertyTokens';
import type { PropertyColor, SelectOption } from '../types';
import { Popover } from './Popover';

const PICKABLE_COLORS: PropertyColor[] = [
  'gray','brown','orange','yellow','green','blue','purple','pink','red','default',
];

interface OptionColorPickerProps {
  option: SelectOption;
  onColorChange: (color: PropertyColor) => void;
}

export function OptionColorPicker({ option, onColorChange }: OptionColorPickerProps) {
  const t = COLOR_TOKENS[option.color];
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
                  onClick={() => { onColorChange(color); close(); }}
                >
                  <span className="npc-color-pick-swatch" style={{ background: tok.dot }} />
                  <span className="npc-color-pick-label" style={{ color: tok.fg, background: tok.bg }}>
                    {color.charAt(0).toUpperCase() + color.slice(1)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </Popover>
  );
}
