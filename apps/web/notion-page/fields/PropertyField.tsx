'use client';

import type { DateRangeValue, PropertyDefinition, RelationPageOption, SelectOption, StoredPropertyValue } from '../types';
import { TextLikeField } from './TextLikeField';
import { CheckboxField } from './CheckboxField';
import { DateField } from './DateField';
import { SelectField } from './SelectField';
import { MultiSelectField } from './MultiSelectField';
import { PersonField } from './PersonField';
import { TimestampField } from './TimestampField';
import { RelationField } from './RelationField';
import { FilesField } from './FilesField';

interface PropertyFieldProps {
  definition: PropertyDefinition;
  value: StoredPropertyValue;
  compact?: boolean;
  locale?: string;
  onChange?: (next: StoredPropertyValue) => void;
  onCreateOption?: (option: SelectOption) => void;
  onUpdateOption?: (option: SelectOption) => void;
  onDeleteOption?: (optionId: string) => void;
  relationOptions?: RelationPageOption[];
}

export function PropertyField({
  definition, value, compact = false, locale = 'pt-BR',
  onChange, onCreateOption, onUpdateOption, onDeleteOption, relationOptions = [],
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
    case 'place':
      return <TextLikeField kind="text" value={value} compact={compact} onChange={onChange} />;
    case 'checkbox':
      return <CheckboxField value={value as boolean | null | undefined} compact={compact}
        onChange={(v) => onChange?.(v)} />;
    case 'date':
      return <DateField value={value as string | DateRangeValue | null | undefined} compact={compact} locale={locale}
        includeTime={definition.includeTime} timezone={definition.timezone}
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
    case 'relation':
      return <RelationField options={relationOptions} value={value as string[] | null | undefined}
        compact={compact} multiple={definition.cardinality === 'one' ? false : definition.multiple}
        onChange={onChange ? (next) => onChange(next) : undefined} />;
    case 'files':
      return <FilesField value={value as string[] | null | undefined} compact={compact} onChange={onChange ? (next) => onChange(next) : undefined} />;
    case 'unique_id':
    case 'created_by':
    case 'last_edited_by':
    case 'formula':
    case 'rollup':
      return <span className="npc-system-value">{value !== null && value !== undefined && !Array.isArray(value) && typeof value !== 'object' ? String(value) : 'Vazio'}</span>;
    case 'created_time':
    case 'last_edited_time':
      return <TimestampField value={value as string | null | undefined} locale={locale} />;
    default:
      return null;
  }
}
