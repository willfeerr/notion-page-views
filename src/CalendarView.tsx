import { useEffect, useMemo, useState, type CSSProperties, type ComponentType, type ReactNode } from 'react';
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor,
  useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Columns3,
  GanttChartSquare, Grid2X2, Grid3X3, List, Plus, Rows3,
} from 'lucide-react';
import type { DateRangeValue, NotionPageData, NotionSchema } from '../notion-page/types';
import { normalizeDateValue } from './domain';

type CalendarMode = 'day' | 'workweek' | 'week' | 'month' | 'year' | 'agenda' | 'gantt';

interface CalendarViewProps {
  title: string;
  schema: NotionSchema;
  pages: NotionPageData[];
  datePropertyId: string;
  timezone: string;
  defaultView: CalendarMode;
  visibleHours: { from: number; to: number };
  onViewChange?: (mode: CalendarMode) => void;
  onOpenPage: (pageId: string) => void;
  onCreatePage: (datePropertyId: string, start: string, end?: string) => void;
  onMoveEvent: (pageId: string, datePropertyId: string, start: string, end: string) => void;
}

interface PageEvent {
  id: string;
  page: NotionPageData;
  start: string;
  end: string;
  allDay: boolean;
  timezone: string;
}

type DragData =
  | { kind: 'event'; event: PageEvent }
  | { kind: 'create'; origin: string }
  | { kind: 'resize-start' | 'resize-end'; event: PageEvent };

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

function parseLocal(value: string): Date {
  return new Date(value.length <= 10 ? `${value}T00:00:00` : value);
}

function localIso(date: Date, allDay: boolean): string {
  if (allDay) return datePart(date);
  return `${datePart(date)}T${`${date.getHours()}`.padStart(2, '0')}:${`${date.getMinutes()}`.padStart(2, '0')}`;
}

function addDays(date: Date, count: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + count);
  return next;
}

function startOfWeek(date: Date, monday = false): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - (monday ? (start.getDay() + 6) % 7 : start.getDay()));
  return start;
}

function monthCells(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

function daysInMonth(anchor: Date): Date[] {
  return Array.from({ length: new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate() }, (_, index) => new Date(anchor.getFullYear(), anchor.getMonth(), index + 1));
}

function intersects(event: PageEvent, start: string, end = start): boolean {
  return event.start.slice(0, 10) <= end.slice(0, 10) && event.end.slice(0, 10) >= start.slice(0, 10);
}

function displayRange(event: PageEvent): string {
  const formatter = new Intl.DateTimeFormat('pt-BR', event.allDay
    ? { day: '2-digit', month: '2-digit', year: 'numeric' }
    : { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const start = formatter.format(parseLocal(event.start));
  const end = formatter.format(parseLocal(event.end));
  return start === end ? start : `${start} - ${end}`;
}

function anchorLabel(anchor: Date, mode: CalendarMode): string {
  if (mode === 'day') return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(anchor);
  if (mode === 'week' || mode === 'workweek') {
    const start = startOfWeek(anchor, mode === 'workweek');
    const end = addDays(start, mode === 'workweek' ? 4 : 6);
    return `${start.getDate()} ${new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(start)} - ${end.getDate()} ${new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' }).format(end)}`;
  }
  if (mode === 'year') return String(anchor.getFullYear());
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(anchor);
}

export function CalendarView(props: CalendarViewProps) {
  const {
    title, schema, pages, datePropertyId, timezone, defaultView, visibleHours,
    onViewChange, onOpenPage, onCreatePage, onMoveEvent,
  } = props;
  const [anchor, setAnchor] = useState(() => new Date());
  const [mode, setMode] = useState<CalendarMode>(defaultView);
  const [activeDrag, setActiveDrag] = useState<DragData | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const dateProperty = schema.properties.find((property) => property.id === datePropertyId && property.type === 'date');
  const events = useMemo(() => pages.flatMap((page): PageEvent[] => {
    const value = normalizeDateValue(page.properties[datePropertyId], timezone);
    if (!value) return [];
    return [{
      id: `${page.id}:${datePropertyId}`, page, start: value.start,
      end: value.end || value.start, allDay: value.allDay ?? value.start.length <= 10,
      timezone: value.timezone || timezone,
    }];
  }).sort((a, b) => a.start.localeCompare(b.start)), [datePropertyId, pages, timezone]);

  useEffect(() => setMode(defaultView), [defaultView]);

  function selectMode(next: CalendarMode) {
    setMode(next);
    onViewChange?.(next);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    const data = active.data.current as DragData | undefined;
    const target = over?.data.current?.value as string | undefined;
    setActiveDrag(null);
    if (!data || !target) return;
    if (data.kind === 'create') {
      const start = data.origin <= target ? data.origin : target;
      const end = data.origin <= target ? target : data.origin;
      onCreatePage(datePropertyId, start, end);
      return;
    }
    const event = data.event;
    if (data.kind === 'resize-start') {
      if (target <= event.end) onMoveEvent(event.page.id, datePropertyId, target, event.end);
      return;
    }
    if (data.kind === 'resize-end') {
      if (target >= event.start) onMoveEvent(event.page.id, datePropertyId, event.start, target);
      return;
    }
    const duration = Math.max(0, parseLocal(event.end).getTime() - parseLocal(event.start).getTime());
    let nextStart = target;
    if (target.length <= 10 && !event.allDay) nextStart = `${target}T${event.start.slice(11, 16)}`;
    const nextEnd = localIso(new Date(parseLocal(nextStart).getTime() + duration), event.allDay);
    onMoveEvent(event.page.id, datePropertyId, nextStart, nextEnd);
  }

  function navigate(offset: number) {
    setAnchor((current) => {
      if (mode === 'day') return addDays(current, offset);
      if (mode === 'week' || mode === 'workweek') return addDays(current, offset * 7);
      if (mode === 'year') return new Date(current.getFullYear() + offset, current.getMonth(), 1);
      return new Date(current.getFullYear(), current.getMonth() + offset, 1);
    });
  }

  const shared = { events, datePropertyId, onOpenPage, onCreatePage, visibleHours };
  return (
    <DndContext sensors={sensors} onDragStart={(event) => setActiveDrag(event.active.data.current as DragData)} onDragCancel={() => setActiveDrag(null)} onDragEnd={handleDragEnd}>
      <section className="lab-calendar-view">
        <div className="lab-heading lab-calendar-heading">
          <div><span>CALENDAR</span><h1>{title}</h1><small>{timezone}</small></div>
          {dateProperty ? <CreateHandle origin={`${datePart(new Date())}T09:00`} onCreate={() => onCreatePage(datePropertyId, `${datePart(new Date())}T09:00`, `${datePart(new Date())}T10:00`)} label="Novo evento" /> : null}
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
                return <button key={item.mode} type="button" title={item.label} className={mode === item.mode ? 'is-active' : ''} onClick={() => selectMode(item.mode)}><Icon size={14} /><span>{item.shortLabel}</span></button>;
              })}
            </div>
          </header>
          {!dateProperty ? <div className="lab-calendar-empty"><CalendarDays size={26} /><strong>Propriedade de data indisponivel</strong></div>
            : <CalendarModeView mode={mode} anchor={anchor} {...shared} />}
        </div>
      </section>
      <DragOverlay>{activeDrag?.kind === 'event' ? <div className="lab-calendar-drag-overlay">{activeDrag.event.page.icon || '📄'} {activeDrag.event.page.title}</div> : activeDrag ? <div className="lab-calendar-drag-overlay"><Plus size={14} />Criar periodo</div> : null}</DragOverlay>
    </DndContext>
  );
}

function CalendarModeView(props: {
  mode: CalendarMode; anchor: Date; events: PageEvent[]; datePropertyId: string; visibleHours: { from: number; to: number };
  onOpenPage: (id: string) => void; onCreatePage: (propertyId: string, start: string, end?: string) => void;
}) {
  const { mode, anchor } = props;
  if (mode === 'month') return <MonthView {...props} />;
  if (mode === 'year') return <YearView {...props} />;
  if (mode === 'agenda') return <AgendaView {...props} />;
  if (mode === 'gantt') return <GanttView {...props} />;
  const start = mode === 'day' ? anchor : startOfWeek(anchor, mode === 'workweek');
  const count = mode === 'day' ? 1 : mode === 'workweek' ? 5 : 7;
  return <DaysView {...props} days={Array.from({ length: count }, (_, index) => addDays(start, index))} />;
}

function DropTarget({ value, className = '', children }: { value: string; className?: string; children?: ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id: `drop:${value}`, data: { value } });
  return <div ref={setNodeRef} className={`${className}${isOver ? ' is-dnd-over' : ''}`}>{children}</div>;
}

function CreateHandle({ origin, onCreate, label, className = '', showIcon = true }: { origin: string; onCreate: () => void; label?: ReactNode; className?: string; showIcon?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `create:${origin}`, data: { kind: 'create', origin } satisfies DragData });
  return <button ref={setNodeRef} {...attributes} {...listeners} type="button" className={`${className}${isDragging ? ' is-dragging' : ''}`} title="Clique para criar ou arraste para definir o periodo" onClick={onCreate}>{showIcon ? <Plus size={13} /> : null}{label ? <span>{label}</span> : null}</button>;
}

function EventButton({ event, onOpenPage, compact = false }: { event: PageEvent; onOpenPage: (id: string) => void; compact?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `event:${event.id}`, data: { kind: 'event', event } satisfies DragData });
  return <button ref={setNodeRef} {...attributes} {...listeners} type="button" className={`${compact ? 'lab-calendar-event' : 'lab-calendar-event-card'}${isDragging ? ' is-dragging' : ''}`} onClick={() => onOpenPage(event.page.id)}><span>{event.page.icon || '📄'}</span><span><strong>{event.page.title}</strong>{compact ? null : <small>{displayRange(event)}</small>}</span></button>;
}

function DaysView({ days, events, datePropertyId, visibleHours, onOpenPage, onCreatePage }: {
  days: Date[]; events: PageEvent[]; datePropertyId: string; visibleHours: { from: number; to: number };
  onOpenPage: (id: string) => void; onCreatePage: (propertyId: string, start: string, end?: string) => void;
}) {
  const hours = Array.from({ length: Math.max(1, visibleHours.to - visibleHours.from) }, (_, index) => visibleHours.from + index);
  return <div className="lab-calendar-days-view lab-calendar-timed" style={{ '--day-count': days.length } as CSSProperties}>
    <div className="lab-calendar-time-gutter" />
    {days.map((day) => <header key={datePart(day)}><span>{new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(day)}</span><strong>{day.getDate()}</strong><CreateHandle origin={datePart(day)} onCreate={() => onCreatePage(datePropertyId, datePart(day))} /></header>)}
    <aside>{hours.map((hour) => <span key={hour}>{`${hour}`.padStart(2, '0')}:00</span>)}</aside>
    {days.map((day) => {
      const iso = datePart(day);
      const allDay = events.filter((event) => event.allDay && intersects(event, iso));
      return <section key={iso}><DropTarget value={iso} className="lab-calendar-all-day"><small>DIA INTEIRO</small>{allDay.map((event) => <EventButton key={event.id} event={event} onOpenPage={onOpenPage} />)}</DropTarget><div className="lab-calendar-hour-list">{hours.map((hour) => {
        const slot = `${iso}T${`${hour}`.padStart(2, '0')}:00`;
        const slotEvents = events.filter((event) => !event.allDay && event.start.slice(0, 13) === slot.slice(0, 13));
        return <DropTarget key={slot} value={slot} className="lab-calendar-hour-slot"><CreateHandle origin={slot} onCreate={() => onCreatePage(datePropertyId, slot, `${iso}T${`${hour + 1}`.padStart(2, '0')}:00`)} />{slotEvents.map((event) => <EventButton key={event.id} event={event} onOpenPage={onOpenPage} />)}</DropTarget>;
      })}</div></section>;
    })}
  </div>;
}

function MonthView({ anchor, events, datePropertyId, onOpenPage, onCreatePage }: Parameters<typeof CalendarModeView>[0]) {
  return <div className="lab-calendar-grid">
    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map((day) => <div key={day} className="lab-calendar-weekday">{day}</div>)}
    {monthCells(anchor).map((date) => {
      const iso = datePart(date);
      const dayEvents = events.filter((event) => intersects(event, iso));
      return <DropTarget key={iso} value={iso} className={`lab-calendar-day${date.getMonth() !== anchor.getMonth() ? ' is-outside' : ''}${iso === datePart(new Date()) ? ' is-today' : ''}`}><CreateHandle origin={iso} onCreate={() => onCreatePage(datePropertyId, iso)} label={date.getDate()} className="lab-calendar-day-number" showIcon={false} />
        <div className="lab-calendar-events">{dayEvents.slice(0, 3).map((event) => <EventButton key={event.id} event={event} onOpenPage={onOpenPage} compact />)}{dayEvents.length > 3 ? <span className="lab-calendar-more">+{dayEvents.length - 3}</span> : null}</div>
      </DropTarget>;
    })}
  </div>;
}

function YearView({ anchor, events, datePropertyId, onCreatePage }: Parameters<typeof CalendarModeView>[0]) {
  return <div className="lab-calendar-year">{Array.from({ length: 12 }, (_, month) => {
    const monthDate = new Date(anchor.getFullYear(), month, 1);
    return <section key={month}><h3>{new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(monthDate)}</h3><div>{['D','S','T','Q','Q','S','S'].map((day, index) => <small key={`${day}-${index}`}>{day}</small>)}{monthCells(monthDate).map((date) => {
      const iso = datePart(date);
      return <DropTarget key={iso} value={iso} className={`${date.getMonth() !== month ? 'is-outside ' : ''}${events.some((event) => intersects(event, iso)) ? 'has-event' : ''}`}><CreateHandle origin={iso} onCreate={() => onCreatePage(datePropertyId, iso)} label={date.getDate()} showIcon={false} /></DropTarget>;
    })}</div></section>;
  })}</div>;
}

function AgendaView({ anchor, events, onOpenPage }: Parameters<typeof CalendarModeView>[0]) {
  const first = datePart(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
  const last = datePart(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0));
  const visible = events.filter((event) => intersects(event, first, last));
  return <div className="lab-calendar-agenda">{visible.length ? visible.map((event) => <DropTarget key={event.id} value={event.start}><EventButton event={event} onOpenPage={onOpenPage} /></DropTarget>) : <div className="lab-calendar-empty"><CalendarDays size={26} /><strong>Nenhuma pagina agendada</strong></div>}</div>;
}

function ResizeHandle({ event, edge }: { event: PageEvent; edge: 'start' | 'end' }) {
  const kind = edge === 'start' ? 'resize-start' : 'resize-end';
  const { attributes, listeners, setNodeRef } = useDraggable({ id: `${kind}:${event.id}`, data: { kind, event } satisfies DragData });
  return <span ref={setNodeRef} {...attributes} {...listeners} className={`lab-gantt-resize is-${edge}`} title={`Ajustar ${edge === 'start' ? 'inicio' : 'fim'}`} />;
}

function GanttView({ anchor, events, onOpenPage }: Parameters<typeof CalendarModeView>[0]) {
  const days = daysInMonth(anchor);
  const first = datePart(days[0]);
  const last = datePart(days[days.length - 1]);
  const visible = events.filter((event) => intersects(event, first, last));
  return <div className="lab-gantt"><div className="lab-gantt-header"><strong>Pagina</strong><div>{days.map((day) => <DropTarget key={datePart(day)} value={datePart(day)} className={day.getDay() === 0 || day.getDay() === 6 ? 'is-weekend' : ''}><small>{new Intl.DateTimeFormat('pt-BR', { weekday: 'narrow' }).format(day)}</small>{day.getDate()}</DropTarget>)}</div></div>{visible.map((event) => {
    const start = Math.max(0, Math.round((parseLocal(event.start).getTime() - parseLocal(first).getTime()) / 86400000));
    const end = Math.min(days.length - 1, Math.round((parseLocal(event.end).getTime() - parseLocal(first).getTime()) / 86400000));
    return <div className="lab-gantt-row" key={event.id}><button type="button" onClick={() => onOpenPage(event.page.id)}><span>{event.page.icon || '📄'}</span><span><strong>{event.page.title}</strong><small>{displayRange(event)}</small></span></button><div className="lab-gantt-track">{days.map((day) => <DropTarget key={datePart(day)} value={datePart(day)} className={day.getDay() === 0 || day.getDay() === 6 ? 'is-weekend' : ''} />)}<div className="lab-gantt-bar" style={{ left: `${start * 32 + 3}px`, width: `${Math.max(26, (end - start + 1) * 32 - 6)}px` }}><ResizeHandle event={event} edge="start" /><EventButton event={event} onOpenPage={onOpenPage} compact /><ResizeHandle event={event} edge="end" /></div></div></div>;
  })}{!visible.length ? <div className="lab-calendar-empty"><GanttChartSquare size={26} /><strong>Nenhuma pagina no periodo</strong></div> : null}</div>;
}
