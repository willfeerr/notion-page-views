import { ExternalLink, Mail, MapPin, MessageCircle, Phone, type LucideIcon } from 'lucide-react';
import type { NotionPageData, NotionSchema } from './types';

export type CardQuickActionKind = 'url' | 'maps' | 'email' | 'phone' | 'whatsapp' | 'automation';

export interface CardQuickAction {
  id: string;
  kind: CardQuickActionKind;
  label: string;
  href?: string;
  onTrigger?: () => void;
}

const ICONS: Record<CardQuickActionKind, LucideIcon> = {
  url: ExternalLink,
  maps: MapPin,
  email: Mail,
  phone: Phone,
  whatsapp: MessageCircle,
  automation: ExternalLink,
};

function normalizeKey(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function textValue(value: unknown) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  return '';
}

export function deriveCardQuickActions(schema: NotionSchema, page: NotionPageData): CardQuickAction[] {
  const actions: CardQuickAction[] = [];
  const seen = new Set<string>();
  const push = (kind: CardQuickActionKind, href: string | undefined, label: string, id: string) => {
    if (!href || seen.has(href)) return;
    seen.add(href);
    actions.push({ id, kind, href, label });
  };

  for (const definition of schema.properties) {
    const value = textValue(page.properties[definition.id]);
    if (!value) continue;
    const key = normalizeKey(definition.name);
    const digits = value.replace(/\D/g, '');

    if (definition.type === 'phone' || /phone|telefone|fone|celular/.test(key)) {
      if (digits.length >= 8) push('phone', `tel:${value.replace(/[^\d+]/g, '')}`, definition.name || 'Ligar', `phone:${definition.id}`);
      continue;
    }
    if (/whatsapp/.test(key) && digits.length >= 8) {
      const number = digits.length <= 11 ? `55${digits}` : digits;
      push('whatsapp', `https://wa.me/${number}`, definition.name || 'WhatsApp', `whatsapp:${definition.id}`);
      continue;
    }
    if (definition.type === 'email' || /email|mail/.test(key)) {
      push('email', `mailto:${value}`, definition.name || 'E-mail', `email:${definition.id}`);
      continue;
    }
    if (definition.type === 'url' || /url|site|link|maps|mapa/.test(key)) {
      const href = /^https?:\/\//i.test(value) ? value : `https://${value}`;
      const kind = /maps|mapa/.test(key) || /google\.[^/]+\/maps|maps\.app\.goo\.gl/i.test(href) ? 'maps' : /wa\.me|whatsapp/.test(href) ? 'whatsapp' : 'url';
      push(kind, href, definition.name || 'Abrir', `${kind}:${definition.id}`);
    }
  }
  return actions;
}

export function CardQuickActions({ schema, page, actions = [] }: { schema: NotionSchema; page: NotionPageData; actions?: CardQuickAction[] }) {
  const items = [...deriveCardQuickActions(schema, page), ...actions];
  if (!items.length) return null;
  return <div className="npc-card-quick-actions" aria-label="Acoes rapidas">
    {items.map((action) => {
      const Icon = ICONS[action.kind];
      const content = <><Icon size={13} /><span>{action.label}</span></>;
      if (action.href) return <a key={action.id} href={action.href} target={action.kind === 'url' || action.kind === 'maps' || action.kind === 'whatsapp' ? '_blank' : undefined} rel="noreferrer" title={action.label} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>{content}</a>;
      return <button key={action.id} type="button" title={action.label} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); action.onTrigger?.(); }}>{content}</button>;
    })}
  </div>;
}
