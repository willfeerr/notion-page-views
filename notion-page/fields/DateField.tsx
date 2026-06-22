import { Calendar, X } from 'lucide-react';
import type { DateRangeValue } from '../types';

interface DateFieldProps {
  value: string | DateRangeValue | null | undefined;
  compact?: boolean;
  onChange?: (next: string | DateRangeValue | null) => void;
  locale?: string;
  includeTime?: boolean;
  timezone?: string;
}

function formatDate(iso: string, locale: string): string {
  const date = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit', month: '2-digit', year: 'numeric',
    ...(iso.length > 10 ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date);
}

export function DateField({ value, compact = false, onChange, locale = 'pt-BR', includeTime = true, timezone = 'America/Sao_Paulo' }: DateFieldProps) {
  const start = typeof value === 'string' ? value : value?.start ?? '';
  const end = typeof value === 'object' && value ? value.end ?? '' : '';
  const allDay = typeof value === 'object' && value ? value.allDay ?? start.length <= 10 : start.length <= 10;
  const inputType = includeTime && !allDay ? 'datetime-local' : 'date';
  const inputValue = (iso: string) => inputType === 'date' ? iso.slice(0, 10) : iso.slice(0, 16);
  const nextRange = (nextStart: string, nextEnd?: string | null): DateRangeValue => ({
    start: nextStart,
    end: nextEnd || nextStart,
    allDay,
    timezone,
  });

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
      {includeTime ? <label className="npc-date-all-day"><input type="checkbox" checked={allDay} onChange={(event) => {
        if (!start) return;
        const nextAllDay = event.target.checked;
        const normalize = (iso: string) => nextAllDay ? iso.slice(0, 10) : `${iso.slice(0, 10)}T09:00`;
        onChange?.({ start: normalize(start), end: normalize(end || start), allDay: nextAllDay, timezone });
      }} />Dia inteiro</label> : null}
      <input
        aria-label="Data inicial"
        className="npc-text-input npc-date-input"
        type={inputType}
        value={inputValue(start)}
        onChange={(event) => {
          const nextStart = event.target.value;
          if (!nextStart) onChange?.(null);
          else onChange?.(nextRange(nextStart, end && end >= nextStart ? end : nextStart));
        }}
      />
      {end ? (
        <>
          <span className="npc-date-range-separator">ate</span>
          <input
            aria-label="Data final"
            className="npc-text-input npc-date-input"
            type={inputType}
            min={inputValue(start)}
            value={inputValue(end)}
            onChange={(event) => onChange?.(nextRange(start, event.target.value || start))}
          />
          <button type="button" className="npc-date-range-clear" title="Remover data final" onClick={() => onChange?.({ start, end: start, allDay, timezone })}>
            <X size={12} />
          </button>
        </>
      ) : (
        <button type="button" className="npc-date-range-add" disabled={!start} onClick={() => start && onChange?.(nextRange(start, start))}>
          + Data final
        </button>
      )}
    </div>
  );
}
