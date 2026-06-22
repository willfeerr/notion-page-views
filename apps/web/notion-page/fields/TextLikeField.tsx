import { ExternalLink } from 'lucide-react';
import type { StoredPropertyValue } from '../types';

export type TextLikeKind = 'text' | 'number' | 'url' | 'email' | 'phone';

interface TextLikeFieldProps {
  kind: TextLikeKind;
  value: StoredPropertyValue;
  compact?: boolean;
  onChange?: (next: StoredPropertyValue) => void;
  numberFormat?: 'plain' | 'currency' | 'percent';
  currency?: string;
  locale?: string;
  placeholder?: string;
}

function formatNumber(value: number, format: 'plain' | 'currency' | 'percent' | undefined, currency: string, locale: string) {
  if (format === 'currency') {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
  }
  if (format === 'percent') {
    return new Intl.NumberFormat(locale, { style: 'percent' }).format(value);
  }
  return new Intl.NumberFormat(locale).format(value);
}

const INPUT_TYPE: Record<TextLikeKind, string> = {
  text: 'text',
  number: 'number',
  url: 'url',
  email: 'email',
  phone: 'tel',
};

const HREF_PREFIX: Partial<Record<TextLikeKind, string>> = {
  url: '',
  email: 'mailto:',
  phone: 'tel:',
};

export function TextLikeField({
  kind,
  value,
  compact = false,
  onChange,
  numberFormat,
  currency = 'BRL',
  locale = 'pt-BR',
  placeholder = 'Vazio',
}: TextLikeFieldProps) {
  const isEmpty = value === null || value === undefined || value === '';

  if (compact) {
    if (isEmpty) return <span className="npc-muted">{placeholder}</span>;
    if (kind === 'number') {
      return <span className="npc-text-value">{formatNumber(Number(value), numberFormat, currency, locale)}</span>;
    }
    if (kind === 'url' || kind === 'email' || kind === 'phone') {
      const href = `${HREF_PREFIX[kind]}${value}`;
      return (
        <a className="npc-link-value" href={href} target={kind === 'url' ? '_blank' : undefined} rel="noreferrer">
          {String(value)}
        </a>
      );
    }
    return <span className="npc-text-value">{String(value)}</span>;
  }

  // Edit mode
  const showOpenButton = (kind === 'url' || kind === 'email' || kind === 'phone') && !isEmpty;
  return (
    <div className="npc-field-row-input">
      <input
        className="npc-text-input"
        type={INPUT_TYPE[kind]}
        value={value === null || value === undefined ? '' : String(value)}
        placeholder={placeholder}
        onChange={(e) => {
          const raw = e.target.value;
          if (kind === 'number') {
            onChange?.(raw === '' ? null : Number(raw));
          } else {
            onChange?.(raw);
          }
        }}
      />
      {showOpenButton && (
        <a
          className="npc-inline-icon-btn"
          href={`${HREF_PREFIX[kind]}${value}`}
          target={kind === 'url' ? '_blank' : undefined}
          rel="noreferrer"
          aria-label="Abrir"
        >
          <ExternalLink size={13} />
        </a>
      )}
    </div>
  );
}
