'use client';

import type { PropertyDefinition, SelectOption, StoredPropertyValue } from '../types';
import { TextLikeField } from './TextLikeField';
import { CheckboxField } from './CheckboxField';
import { DateField } from './DateField';
import { SelectField } from './SelectField';
import { MultiSelectField } from './MultiSelectField';
import { PersonField } from './PersonField';
import { TimestampField } from './TimestampField';

interface PropertyFieldProps {
  definition: PropertyDefinition;
  value: StoredPropertyValue;
  compact?: boolean;
  locale?: string;
  onChange?: (next: StoredPropertyValue) => void;
  onCreateOption?: (option: SelectOption) => void;
  onUpdateOption?: (option: SelectOption) => void;
  onDeleteOption?: (optionId: string) => void;
}

export function PropertyField({
  definition, value, compact = false, locale = 'pt-BR',
  onChange, onCreateOption, onUpdateOption, onDeleteOption,
}: PropertyFieldProps) {
  switch (definition.type) {
    case 'text':
      return <TextLikeField kind="text" value={value} compact={compact} onChange={onChange} />;
    case 'number':
      return <TextLikeField kind="number" value={value} compact={compact} onChange={onChange}
        numberFormat={definition.format} currency={definition.currency} locale={locale} />;
    case 'url':
      return <TextLikeField kind="url" value={value} compact={compact} onChange={onChange} />;
    case 'email':
      return <TextLikeField kind="email" value={value} compact={compact} onChange={onChange} />;
    case 'phone':
      return <TextLikeField kind="phone" value={value} compact={compact} onChange={onChange} />;
    case 'checkbox':
      return <CheckboxField value={value as boolean | null | undefined} compact={compact}
        onChange={(v) => onChange?.(v)} />;
    case 'date':
      return <DateField value={value as string | null | undefined} compact={compact} locale={locale}
        onChange={(v) => onChange?.(v)} />;
    case 'select':
      return <SelectField variant="select" options={definition.options}
        value={value as string | null | undefined} compact={compact}
        onChange={(v) => onChange?.(v)}
        onCreateOption={onCreateOption}
        onUpdateOption={onUpdateOption}
        onDeleteOption={onDeleteOption} />;
    case 'status':
      return <SelectField variant="status" options={definition.options} groups={definition.groups}
        value={value as string | null | undefined} compact={compact}
        onChange={(v) => onChange?.(v)}
        onCreateOption={onCreateOption}
        onUpdateOption={onUpdateOption}
        onDeleteOption={onDeleteOption} />;
    case 'multi_select':
      return <MultiSelectField options={definition.options}
        value={value as string[] | null | undefined} compact={compact}
        onChange={(v) => onChange?.(v)}
        onCreateOption={onCreateOption}
        onUpdateOption={onUpdateOption}
        onDeleteOption={onDeleteOption} />;
    case 'person':
      return <PersonField people={definition.people}
        value={value as string[] | null | undefined} compact={compact}
        multiple={definition.multiple} onChange={(v) => onChange?.(v)} />;
    case 'created_time':
    case 'last_edited_time':
      return <TimestampField value={value as string | null | undefined} locale={locale} />;
    default:
      return null;
  }
}
