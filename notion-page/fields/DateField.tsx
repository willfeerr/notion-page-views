import { Calendar } from 'lucide-react';

interface DateFieldProps {
  value: string | null | undefined;
  compact?: boolean;
  onChange?: (next: string | null) => void;
  locale?: string;
}

function formatDate(iso: string, locale: string): string {
  const date = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

export function DateField({ value, compact = false, onChange, locale = 'pt-BR' }: DateFieldProps) {
  if (compact) {
    if (!value) return <span className="npc-muted">Vazio</span>;
    return (
      <span className="npc-date-value">
        <Calendar size={12} className="npc-date-icon" />
        {formatDate(value, locale)}
      </span>
    );
  }

  return (
    <input
      className="npc-text-input npc-date-input"
      type="date"
      value={value ? value.slice(0, 10) : ''}
      onChange={(e) => onChange?.(e.target.value === '' ? null : e.target.value)}
    />
  );
}
