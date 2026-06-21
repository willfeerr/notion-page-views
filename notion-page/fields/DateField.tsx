import { Calendar, X } from 'lucide-react';
import type { DateRangeValue } from '../types';

interface DateFieldProps {
  value: string | DateRangeValue | null | undefined;
  compact?: boolean;
  onChange?: (next: string | DateRangeValue | null) => void;
  locale?: string;
}

function formatDate(iso: string, locale: string): string {
  const date = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

export function DateField({ value, compact = false, onChange, locale = 'pt-BR' }: DateFieldProps) {
  const start = typeof value === 'string' ? value : value?.start ?? '';
  const end = typeof value === 'object' && value ? value.end ?? '' : '';

  if (compact) {
    if (!start) return <span className="npc-muted">Vazio</span>;
    return (
      <span className="npc-date-value">
        <Calendar size={12} className="npc-date-icon" />
        {formatDate(start, locale)}
        {end ? ` - ${formatDate(end, locale)}` : ''}
      </span>
    );
  }

  return (
    <div className="npc-date-range-field">
      <input
        aria-label="Data inicial"
        className="npc-text-input npc-date-input"
        type="date"
        value={start.slice(0, 10)}
        onChange={(event) => {
          const nextStart = event.target.value;
          if (!nextStart) onChange?.(null);
          else onChange?.(end ? { start: nextStart, end: end < nextStart ? nextStart : end } : nextStart);
        }}
      />
      {end ? (
        <>
          <span className="npc-date-range-separator">ate</span>
          <input
            aria-label="Data final"
            className="npc-text-input npc-date-input"
            type="date"
            min={start.slice(0, 10)}
            value={end.slice(0, 10)}
            onChange={(event) => onChange?.({ start, end: event.target.value || start })}
          />
          <button type="button" className="npc-date-range-clear" title="Remover data final" onClick={() => onChange?.(start || null)}>
            <X size={12} />
          </button>
        </>
      ) : (
        <button type="button" className="npc-date-range-add" disabled={!start} onClick={() => start && onChange?.({ start, end: start })}>
          + Data final
        </button>
      )}
    </div>
  );
}
