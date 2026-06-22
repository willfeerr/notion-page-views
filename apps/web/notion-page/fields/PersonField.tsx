import { Plus, Check } from 'lucide-react';
import type { PersonOption } from '../types';
import { Avatar } from './Avatar';
import { Popover } from './Popover';

interface PersonFieldProps {
  people: PersonOption[];
  value: string[] | null | undefined;
  compact?: boolean;
  multiple?: boolean;
  onChange?: (next: string[]) => void;
}

export function PersonField({ people, value, compact = false, multiple = true, onChange }: PersonFieldProps) {
  const selectedIds = value ?? [];
  const selected = people.filter((p) => selectedIds.includes(p.id));

  if (compact) {
    if (selected.length === 0) return <span className="npc-muted">Vazio</span>;
    const visible = selected.slice(0, 3);
    const rest = selected.length - visible.length;
    return (
      <span className="npc-avatar-stack" title={selected.map((p) => p.name).join(', ')}>
        {visible.map((p) => (
          <Avatar key={p.id} person={p} size={20} />
        ))}
        {rest > 0 && <span className="npc-pill npc-pill-more">+{rest}</span>}
      </span>
    );
  }

  function pick(id: string) {
    if (!multiple) {
      onChange?.([id]);
      return;
    }
    const next = selectedIds.includes(id) ? selectedIds.filter((i) => i !== id) : [...selectedIds, id];
    onChange?.(next);
  }

  return (
    <div className="npc-pill-row npc-pill-row-edit">
      {selected.map((p) => (
        <span key={p.id} className="npc-person-chip">
          <Avatar person={p} size={18} />
          {p.name}
        </span>
      ))}
      <Popover
        align="left"
        trigger={({ toggle: open }) => (
          <button type="button" className="npc-add-pill-btn" onClick={open} aria-label="Atribuir pessoa">
            <Plus size={13} />
          </button>
        )}
      >
        {({ close }) => (
          <div className="npc-options-list">
            {people.map((person) => {
              const checked = selectedIds.includes(person.id);
              return (
                <button
                  key={person.id}
                  type="button"
                  className="npc-option-row"
                  onClick={() => {
                    pick(person.id);
                    if (!multiple) close();
                  }}
                >
                  <span className="npc-option-checkmark">{checked && <Check size={13} strokeWidth={3} />}</span>
                  <Avatar person={person} size={18} />
                  {person.name}
                </button>
              );
            })}
          </div>
        )}
      </Popover>
    </div>
  );
}
