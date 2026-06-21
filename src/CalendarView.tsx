import { useMemo, useState, type CSSProperties, type ComponentType } from 'react';
import {
  CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Columns3,
  GanttChartSquare, Grid2X2, Grid3X3, List, Plus, Rows3,
} from 'lucide-react';
import type { DateRangeValue, NotionPageData, NotionSchema, StoredPropertyValue } from '../notion-page/types';

interface CalendarViewProps {
  title: string;
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

type CalendarMode = 'day' | 'workweek' | 'week' | 'month' | 'year' | 'agenda' | 'gantt';

const VIEW_ITEMS: Array<{ mode: CalendarMode; label: string; shortLabel: string; icon: ComponentType<{ size?: number }> }> = [
  { mode: 'day', label: 'Dia', shortLabel: 'Dia', icon: List },
  { mode: 'workweek', label: 'Dias uteis', shortLabel: 'Uteis', icon: Columns3 },
  { mode: 'week', label: 'Semana', shortLabel: 'Semana', icon: Rows3 },
  { mode: 'month', label: 'Mes', shortLabel: 'Mes', icon: Grid2X2 },
  { mode: 'year', label: 'Ano', shortLabel: 'Ano', icon: Grid3X3 },
  { mode: 'agenda', label: 'Agenda', shortLabel: 'Agenda', icon: CalendarRange },
  { mode: 'gantt', label: 'Gantt', shortLabel: 'Gantt', icon: GanttChartSquare },
];

function datePart(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDate(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00`);
}

function addDays(date: Date, count: number): Date {
  const next = new Date(date);
  next.setDate(date.getDate() + count);
  return next;
}

function startOfWeek(date: Date, monday = false): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = start.getDay();
  start.setDate(start.getDate() - (monday ? (day + 6) % 7 : day));
  return start;
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
  const start = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

function daysInMonth(anchor: Date): Date[] {
  const count = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
  return Array.from({ length: count }, (_, index) => new Date(anchor.getFullYear(), anchor.getMonth(), index + 1));
}

function intersects(event: PageEvent, start: string, end = start): boolean {
  return event.start <= end && event.end >= start;
}

function anchorLabel(anchor: Date, mode: CalendarMode): string {
  if (mode === 'day') return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(anchor);
  if (mode === 'week' || mode === 'workweek') {
    const start = startOfWeek(anchor, mode === 'workweek');
    const end = addDays(start, mode === 'workweek' ? 4 : 6);
    return `${start.getDate()} ${new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(start)} - ${end.getDate()} ${new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' }).format(end)}`;
  }
  if (mode === 'year') return `${anchor.getFullYear()}`;
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(anchor);
}

export function CalendarView({ title, schema, pages, onOpenPage, onCreatePage }: CalendarViewProps) {
  const [anchor, setAnchor] = useState(() => new Date());
  const [mode, setMode] = useState<CalendarMode>('month');
  const dateProperties = schema.properties.filter((property) => property.type === 'date');
  const primaryDate = dateProperties[0];
  const events = useMemo(() => pages.flatMap((page) => dateProperties.flatMap((property): PageEvent[] => {
    const range = readRange(page.properties[property.id]);
    return range ? [{ id: `${page.id}:${property.id}`, page, propertyName: property.name, ...range }] : [];
  })).sort((a, b) => a.start.localeCompare(b.start)), [dateProperties, pages]);

  function navigate(offset: number) {
    setAnchor((current) => {
      if (mode === 'day') return addDays(current, offset);
      if (mode === 'week' || mode === 'workweek') return addDays(current, offset * 7);
      if (mode === 'year') return new Date(current.getFullYear() + offset, current.getMonth(), 1);
      return new Date(current.getFullYear(), current.getMonth() + offset, 1);
    });
  }

  return (
    <section className="lab-calendar-view">
      <div className="lab-heading lab-calendar-heading">
        <div><span>CALENDAR</span><h1>{title}</h1></div>
        {primaryDate ? <button onClick={() => onCreatePage(primaryDate.id, datePart(new Date()))}><Plus size={15} />Novo evento</button> : null}
      </div>
      <div className="lab-calendar-shell">
        <header className="lab-calendar-toolbar">
          <div className="lab-calendar-navigation">
            <button type="button" onClick={() => setAnchor(new Date())}>Hoje</button>
            <button type="button" className="is-icon" title="Anterior" onClick={() => navigate(-1)}><ChevronLeft size={16} /></button>
            <button type="button" className="is-icon" title="Proximo" onClick={() => navigate(1)}><ChevronRight size={16} /></button>
            <strong>{anchorLabel(anchor, mode)}</strong>
          </div>
          <div className="lab-calendar-modes">
            {VIEW_ITEMS.map((item) => {
              const Icon = item.icon;
              return <button key={item.mode} type="button" title={item.label} className={mode === item.mode ? 'is-active' : ''} onClick={() => setMode(item.mode)}><Icon size={14} /><span>{item.shortLabel}</span></button>;
            })}
          </div>
        </header>

        {!primaryDate ? (
          <div className="lab-calendar-empty"><CalendarDays size={26} /><strong>Adicione uma property de data</strong><span>Paginas com data ou periodo aparecem aqui automaticamente.</span></div>
        ) : (
          <CalendarModeView mode={mode} anchor={anchor} events={events} datePropertyId={primaryDate.id} onOpenPage={onOpenPage} onCreatePage={onCreatePage} />
        )}
      </div>
    </section>
  );
}

function CalendarModeView(props: {
  mode: CalendarMode; anchor: Date; events: PageEvent[]; datePropertyId: string;
  onOpenPage: (id: string) => void; onCreatePage: (propertyId: string, date: string) => void;
}) {
  const { mode, anchor, events, datePropertyId, onOpenPage, onCreatePage } = props;
  if (mode === 'month') return <MonthView anchor={anchor} events={events} datePropertyId={datePropertyId} onOpenPage={onOpenPage} onCreatePage={onCreatePage} />;
  if (mode === 'year') return <YearView anchor={anchor} events={events} datePropertyId={datePropertyId} onCreatePage={onCreatePage} />;
  if (mode === 'agenda') return <AgendaView anchor={anchor} events={events} onOpenPage={onOpenPage} />;
  if (mode === 'gantt') return <GanttView anchor={anchor} events={events} onOpenPage={onOpenPage} />;
  const start = mode === 'day' ? anchor : startOfWeek(anchor, mode === 'workweek');
  const count = mode === 'day' ? 1 : mode === 'workweek' ? 5 : 7;
  return <DaysView days={Array.from({ length: count }, (_, index) => addDays(start, index))} events={events} datePropertyId={datePropertyId} onOpenPage={onOpenPage} onCreatePage={onCreatePage} />;
}

function EventButton({ event, onOpenPage }: { event: PageEvent; onOpenPage: (id: string) => void }) {
  return <button type="button" className="lab-calendar-event-card" onClick={() => onOpenPage(event.page.id)}><span>{event.page.icon || '📄'}</span><span><strong>{event.page.title}</strong><small>{event.start === event.end ? event.start : `${event.start} - ${event.end}`}</small></span></button>;
}

function DaysView({ days, events, datePropertyId, onOpenPage, onCreatePage }: {
  days: Date[]; events: PageEvent[]; datePropertyId: string; onOpenPage: (id: string) => void; onCreatePage: (propertyId: string, date: string) => void;
}) {
  return (
    <div className="lab-calendar-days-view" style={{ '--day-count': days.length } as CSSProperties}>
      <div className="lab-calendar-time-gutter" />
      {days.map((day) => <header key={datePart(day)}><span>{new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(day)}</span><strong>{day.getDate()}</strong><button type="button" title="Criar pagina" onClick={() => onCreatePage(datePropertyId, datePart(day))}><Plus size={13} /></button></header>)}
      <aside>{Array.from({ length: 12 }, (_, index) => <span key={index}>{`${index + 7}`.padStart(2, '0')}:00</span>)}</aside>
      {days.map((day) => {
        const iso = datePart(day);
        const dayEvents = events.filter((event) => intersects(event, iso));
        return <section key={iso}><div className="lab-calendar-all-day"><small>DIA INTEIRO</small>{dayEvents.map((event) => <EventButton key={event.id} event={event} onOpenPage={onOpenPage} />)}</div></section>;
      })}
    </div>
  );
}

function MonthView({ anchor, events, datePropertyId, onOpenPage, onCreatePage }: {
  anchor: Date; events: PageEvent[]; datePropertyId: string; onOpenPage: (id: string) => void; onCreatePage: (propertyId: string, date: string) => void;
}) {
  const cells = monthCells(anchor);
  return <div className="lab-calendar-grid">
    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map((day) => <div key={day} className="lab-calendar-weekday">{day}</div>)}
    {cells.map((date) => {
      const iso = datePart(date);
      const dayEvents = events.filter((event) => intersects(event, iso));
      return <div key={iso} className={`lab-calendar-day${date.getMonth() !== anchor.getMonth() ? ' is-outside' : ''}${iso === datePart(new Date()) ? ' is-today' : ''}`}>
        <button className="lab-calendar-day-number" type="button" title="Criar pagina nesta data" onClick={() => onCreatePage(datePropertyId, iso)}>{date.getDate()}</button>
        <div className="lab-calendar-events">{dayEvents.slice(0, 3).map((event) => {
          const position = event.start === event.end ? 'single' : iso === event.start ? 'first' : iso === event.end ? 'last' : 'middle';
          return <button key={event.id} type="button" className={`lab-calendar-event is-${position}`} onClick={() => onOpenPage(event.page.id)}>{position === 'middle' || position === 'last' ? null : <><span>{event.page.icon || '📄'}</span>{event.page.title}</>}</button>;
        })}{dayEvents.length > 3 ? <span className="lab-calendar-more">+{dayEvents.length - 3}</span> : null}</div>
      </div>;
    })}
  </div>;
}

function YearView({ anchor, events, datePropertyId, onCreatePage }: { anchor: Date; events: PageEvent[]; datePropertyId: string; onCreatePage: (propertyId: string, date: string) => void }) {
  return <div className="lab-calendar-year">{Array.from({ length: 12 }, (_, month) => {
    const monthDate = new Date(anchor.getFullYear(), month, 1);
    return <section key={month}><h3>{new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(monthDate)}</h3><div>{['D','S','T','Q','Q','S','S'].map((day, index) => <small key={`${day}-${index}`}>{day}</small>)}{monthCells(monthDate).map((date) => {
      const iso = datePart(date); const hasEvent = events.some((event) => intersects(event, iso));
      return <button key={iso} type="button" className={`${date.getMonth() !== month ? 'is-outside ' : ''}${hasEvent ? 'has-event' : ''}`} onClick={() => onCreatePage(datePropertyId, iso)}>{date.getDate()}</button>;
    })}</div></section>;
  })}</div>;
}

function AgendaView({ anchor, events, onOpenPage }: { anchor: Date; events: PageEvent[]; onOpenPage: (id: string) => void }) {
  const monthStart = datePart(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
  const monthEnd = datePart(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0));
  const visible = events.filter((event) => intersects(event, monthStart, monthEnd));
  return <div className="lab-calendar-agenda">{visible.length ? visible.map((event) => <button key={event.id} type="button" onClick={() => onOpenPage(event.page.id)}><time><strong>{parseDate(event.start).getDate()}</strong>{new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(parseDate(event.start))}</time><span className="lab-calendar-agenda-icon">{event.page.icon || '📄'}</span><span><strong>{event.page.title}</strong><small>{event.propertyName} · {event.start === event.end ? event.start : `${event.start} ate ${event.end}`}</small></span></button>) : <div className="lab-calendar-empty"><CalendarDays size={26} /><strong>Nenhuma pagina agendada</strong></div>}</div>;
}

function GanttView({ anchor, events, onOpenPage }: { anchor: Date; events: PageEvent[]; onOpenPage: (id: string) => void }) {
  const days = daysInMonth(anchor);
  const first = datePart(days[0]);
  const last = datePart(days[days.length - 1]);
  const visible = events.filter((event) => intersects(event, first, last));
  return <div className="lab-gantt"><div className="lab-gantt-header"><strong>Pagina</strong><div>{days.map((day) => <span key={datePart(day)} className={day.getDay() === 0 || day.getDay() === 6 ? 'is-weekend' : ''}><small>{new Intl.DateTimeFormat('pt-BR', { weekday: 'narrow' }).format(day)}</small>{day.getDate()}</span>)}</div></div>{visible.map((event) => {
    const start = Math.max(0, Math.round((parseDate(event.start).getTime() - parseDate(first).getTime()) / 86400000));
    const end = Math.min(days.length - 1, Math.round((parseDate(event.end).getTime() - parseDate(first).getTime()) / 86400000));
    return <div className="lab-gantt-row" key={event.id}><button type="button" onClick={() => onOpenPage(event.page.id)}><span>{event.page.icon || '📄'}</span><span><strong>{event.page.title}</strong><small>{event.propertyName}</small></span></button><div className="lab-gantt-track">{days.map((day) => <i key={datePart(day)} className={day.getDay() === 0 || day.getDay() === 6 ? 'is-weekend' : ''} />)}<button type="button" className="lab-gantt-bar" style={{ left: `${start * 32 + 3}px`, width: `${Math.max(26, (end - start + 1) * 32 - 6)}px` }} onClick={() => onOpenPage(event.page.id)} title={`${event.start} - ${event.end}`}>{event.page.title}</button></div></div>;
  })}{!visible.length ? <div className="lab-calendar-empty"><GanttChartSquare size={26} /><strong>Nenhuma pagina no periodo</strong></div> : null}</div>;
}
