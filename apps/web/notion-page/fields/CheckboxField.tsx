import { Check } from 'lucide-react';

interface CheckboxFieldProps {
  value: boolean | null | undefined;
  compact?: boolean;
  onChange?: (next: boolean) => void;
}

export function CheckboxField({ value, compact = false, onChange }: CheckboxFieldProps) {
  const checked = !!value;

  if (compact) {
    return (
      <span className={`npc-checkbox npc-checkbox-compact ${checked ? 'is-checked' : ''}`} aria-hidden>
        {checked && <Check size={11} strokeWidth={3} />}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={`npc-checkbox ${checked ? 'is-checked' : ''}`}
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange?.(!checked)}
    >
      {checked && <Check size={13} strokeWidth={3} />}
    </button>
  );
}
