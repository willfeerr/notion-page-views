interface TimestampFieldProps {
  value: string | null | undefined;
  locale?: string;
}

/** created_time / last_edited_time are always system-managed and read-only. */
export function TimestampField({ value, locale = 'pt-BR' }: TimestampFieldProps) {
  if (!value) return <span className="npc-muted">Vazio</span>;
  const date = new Date(value);
  const formatted = Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(locale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
  return <span className="npc-muted npc-timestamp-value">{formatted}</span>;
}
