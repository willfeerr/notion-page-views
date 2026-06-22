import { describe, expect, it } from 'vitest';
import { deriveCardQuickActions } from './CardQuickActions';
import type { NotionPageData, NotionSchema } from './types';

describe('card quick actions', () => {
  it('derives callable and external actions from page properties', () => {
    const schema: NotionSchema = { properties: [
      { id: 'phone', name: 'Telefone', type: 'phone' },
      { id: 'whatsapp', name: 'WhatsApp', type: 'text' },
      { id: 'site', name: 'Site', type: 'url' },
    ] };
    const page: NotionPageData = {
      id: 'page', title: 'Lead', properties: { phone: '(11) 99999-0000', whatsapp: '11999990000', site: 'example.com' },
      content: null, createdTime: 'a', lastEditedTime: 'b',
    };

    expect(deriveCardQuickActions(schema, page)).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'phone', href: 'tel:11999990000' }),
      expect.objectContaining({ kind: 'whatsapp', href: 'https://wa.me/5511999990000' }),
      expect.objectContaining({ kind: 'url', href: 'https://example.com' }),
    ]));
  });
});
