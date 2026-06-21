import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Grid2X2, List, Plus } from 'lucide-react';
import type { DateRangeValue, NotionPageData, NotionSchema, StoredPropertyValue } from '../notion-page/types';

interface CalendarViewProps {
  schema: NotionSchema;
  pages: NotionPageData[];
  onOpenPage: (pageId: string) => void;
  onCreatePage: (datePropertyId: string, date: string) => void;
}

interface PageEvent {
  id: string;
  page: NotionPageData;
  propertyName: string;
  start: string;
  end: string;
}

function datePart(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDate(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00`);
}

function readRange(value: StoredPropertyValue): { start: string; end: string } | null {
  if (typeof value === 'string' && value) return { start: value.slice(0, 10), end: value.slice(0, 10) };
  if (value && typeof value === 'object' && !Array.isArray(value) && 'start' in value) {
    const range = value as DateRangeValue;
    if (range.start) return { start: range.start.slice(0, 10), end: (range.end || range.start).slice(0, 10) };
  }
  return null;
}

function monthCells(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

export function CalendarView({ schema, pages, onOpenPage, onCreatePage }: CalendarViewProps) {
  const [anchor, setAnchor] = useState(() => new Date());
  const [mode, setMode] = useState<'month' | 'agenda'>('month');
  const dateProperties = schema.properties.filter((property) => property.type === 'date');
  const primaryDate = dateProperties[0];
  const events = useMemo(() => pages.flatMap((page) => dateProperties.flatMap((property): PageEvent[] => {
    const range = readRange(page.properties[property.id]);
    return range ? [{ id: `${page.id}:${property.id}`, page, propertyName: property.name, ...range }] : [];
  })).sort((a, b) => a.start.localeCompare(b.start)), [dateProperties, pages]);
  const cells = useMemo(() => monthCells(anchor), [anchor]);
  const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(anchor);

  function moveMonth(offset: number) {
    setAnchor((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  return (
    <section className="lab-calendar-view">
      <div className="lab-heading lab-calendar-heading">
        <div><span>DATABASE VIEW</span><h1>Calendario</h1></div>
        {primaryDate ? <button onClick={() => onCreatePage(primaryDate.id, datePart(new Date()))}><Plus size={15} />Novo evento</button> : null}
      </div>
      <div className="lab-calendar-shell">
        <header className="lab-calendar-toolbar">
          <div>
            <button type="button" onClick={() => setAnchor(new Date())}>Hoje</button>
            <button type="button" className="is-icon" title="Mes anterior" onClick={() => moveMonth(-1)}><ChevronLeft size={16} /></button>
            <button type="button" className="is-icon" title="Proximo mes" onClick={() => moveMonth(1)}><ChevronRight size={16} /></button>
            <strong>{monthLabel}</strong>
          </div>
          <div className="lab-calendar-modes">
            <button type="button" className={mode === 'month' ? 'is-active' : ''} onClick={() => setMode('month')}><Grid2X2 size={14} />Mes</button>
            <button type="button" className={mode === 'agenda' ? 'is-active' : ''} onClick={() => setMode('agenda')}><List size={14} />Agenda</button>
          </div>
        </header>

        {!primaryDate ? (
          <div className="lab-calendar-empty"><CalendarDays size={26} /><strong>Adicione uma property de data</strong><span>Paginas com data ou periodo aparecem aqui automaticamente.</span></div>
        ) : mode === 'month' ? (
          <div className="lab-calendar-grid">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map((day) => <div key={day} className="lab-calendar-weekday">{day}</div>)}
            {cells.map((date) => {
              const iso = datePart(date);
              const dayEvents = events.filter((event) => event.start <= iso && event.end >= iso);
              const outside = date.getMonth() !== anchor.getMonth();
              const today = iso === datePart(new Date());
              return (
                <div key={iso} className={`lab-calendar-day${outside ? ' is-outside' : ''}${today ? ' is-today' : ''}`}>
                  <button className="lab-calendar-day-number" type="button" title="Criar pagina nesta data" onClick={() => onCreatePage(primaryDate.id, iso)}>{date.getDate()}</button>
                  <div className="lab-calendar-events">
                    {dayEvents.slice(0, 3).map((event) => {
                      const position = event.start === event.end ? 'single' : iso === event.start ? 'first' : iso === event.end ? 'last' : 'middle';
                      return (
                        <button key={event.id} type="button" className={`lab-calendar-event is-${position}`} onClick={() => onOpenPage(event.page.id)} title={`${event.page.title} - ${event.propertyName}`}>
                          {position === 'middle' || position === 'last' ? null : <><span>{event.page.icon || '📄'}</span>{event.page.title}</>}
                        </button>
                      );
                    })}
                    {dayEvents.length > 3 ? <span className="lab-calendar-more">+{dayEvents.length - 3}</span> : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="lab-calendar-agenda">
            {events.length ? events.map((event) => (
              <button key={event.id} type="button" onClick={() => onOpenPage(event.page.id)}>
                <time><strong>{parseDate(event.start).getDate()}</strong>{new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(parseDate(event.start))}</time>
                <span className="lab-calendar-agenda-icon">{event.page.icon || '📄'}</span>
                <span><strong>{event.page.title}</strong><small>{event.propertyName} · {event.start === event.end ? event.start : `${event.start} ate ${event.end}`}</small></span>
              </button>
            )) : <div className="lab-calendar-empty"><CalendarDays size={26} /><strong>Nenhuma pagina agendada</strong></div>}
          </div>
        )}
      </div>
    </section>
  );
}
