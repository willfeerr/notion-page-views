import {
  Type, Hash, ChevronDown, Tags, CircleDot, Calendar, User, CheckSquare,
  Link2, AtSign, Phone, Clock, type LucideIcon,
} from 'lucide-react';
import type { PropertyColor, PropertyType } from './types';

export interface ColorTokens { bg: string; fg: string; dot: string; }

export const COLOR_TOKENS: Record<PropertyColor, ColorTokens> = {
  default: { bg: '#F1F0EE', fg: '#5B5955', dot: '#A6A29B' },
  gray:    { bg: '#EAEAE8', fg: '#65635E', dot: '#9B9894' },
  brown:   { bg: '#F1E7DE', fg: '#8C6D55', dot: '#B0876A' },
  orange:  { bg: '#FBE6CF', fg: '#9C5E1F', dot: '#D98B3F' },
  yellow:  { bg: '#FBF0C8', fg: '#8E7220', dot: '#CDA92E' },
  green:   { bg: '#DFEEE3', fg: '#3F7657', dot: '#5FAE7E' },
  blue:    { bg: '#DEEBF6', fg: '#2F6188', dot: '#4F8FBE' },
  purple:  { bg: '#E9E0F5', fg: '#6A4C93', dot: '#9777C2' },
  pink:    { bg: '#F6E1ED', fg: '#9B4A75', dot: '#CC76A4' },
  red:     { bg: '#FAE0DC', fg: '#A8412F', dot: '#D9694F' },
};

export const PROPERTY_ICONS: Record<PropertyType, LucideIcon> = {
  text: Type, number: Hash, select: ChevronDown, multi_select: Tags,
  status: CircleDot, date: Calendar, person: User, checkbox: CheckSquare,
  url: Link2, email: AtSign, phone: Phone, created_time: Clock, last_edited_time: Clock,
};

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  text: 'Texto', number: 'Número', select: 'Select', multi_select: 'Multi-select',
  status: 'Status', date: 'Data', person: 'Pessoa', checkbox: 'Checkbox',
  url: 'URL', email: 'E-mail', phone: 'Telefone', created_time: 'Criado em', last_edited_time: 'Editado em',
};

const AVATAR_PALETTE: PropertyColor[] = ['blue','green','orange','purple','pink','red','brown','yellow'];
export function colorForId(id: string): PropertyColor {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

const OPTION_COLORS: PropertyColor[] = [
  'gray','brown','orange','yellow','green','blue','purple','pink','red',
];
export function nextOptionColor(existingCount: number): PropertyColor {
  return OPTION_COLORS[existingCount % OPTION_COLORS.length];
}
