'use client';

import { useState } from 'react';
import { NotionPageView, NotionPageCard } from '../index';
import { sampleSchema, samplePages, cardPropertyIds } from './sampleData';
import type { NotionPageData } from '../types';

/**
 * Reference example — NOT meant to ship as-is.
 *
 * Shows the two views working together:
 *  - NotionPageCard: the compact card, one per board column (this is what
 *    you drop into your existing kanban board).
 *  - NotionPageView: the full page, shown when a card is clicked.
 *
 * In a real app, `pages` and `schema` come from your backend, and
 * `onPropertyChange` / `onContentChange` etc. would persist to it
 * (debounced, since onContentChange fires on every keystroke).
 */
export function BoardExample() {
  const [pages, setPages] = useState<NotionPageData[]>(samplePages);
  const [openId, setOpenId] = useState<string | null>(null);
  const openPage = pages.find((p) => p.id === openId) ?? null;

  function updatePage(id: string, patch: Partial<NotionPageData>) {
    setPages((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch, lastEditedTime: new Date().toISOString() } : p)),
    );
  }

  if (openPage) {
    return (
      <div>
        <button onClick={() => setOpenId(null)}>← Voltar pro board</button>
        <NotionPageView
          schema={sampleSchema}
          page={openPage}
          onTitleChange={(title) => updatePage(openPage.id, { title })}
          onIconChange={(icon) => updatePage(openPage.id, { icon })}
          onCoverChange={(coverUrl) => updatePage(openPage.id, { coverUrl })}
          onPropertyChange={(propertyId, value) =>
            updatePage(openPage.id, { properties: { ...openPage.properties, [propertyId]: value } })
          }
          onContentChange={(content) => updatePage(openPage.id, { content })}
        />
      </div>
    );
  }

  const statusIds = ['todo', 'doing', 'done'];
  const statusDef = sampleSchema.properties.find((p) => p.id === 'status');

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      {statusIds.map((statusId) => {
        const option = statusDef && 'options' in statusDef ? statusDef.options.find((o) => o.id === statusId) : null;
        const colPages = pages.filter((p) => p.properties.status === statusId);
        return (
          <div key={statusId} style={{ width: 280 }}>
            <h3>{option?.name ?? statusId} · {colPages.length}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {colPages.map((page) => (
                <NotionPageCard
                  key={page.id}
                  schema={sampleSchema}
                  page={page}
                  visiblePropertyIds={cardPropertyIds}
                  onClick={() => setOpenId(page.id)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
