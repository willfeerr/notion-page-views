'use client';

import { useRef, useState } from 'react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS as DndCSS } from '@dnd-kit/utilities';
import {
  Plus, ChevronDown, ChevronUp, MoreHorizontal,
  Trash2, Edit3, GripVertical, ArrowRight, LayoutDashboard, X,
} from 'lucide-react';
import type {
  BoardLinkOption, BoardLinkValue, NotionSchema, PageProperties, PropertyDefinition,
  PersonOption, PropertyType, RelationTargetOption, SelectOption, StoredPropertyValue,
} from './types';
import { PROPERTY_ICONS, PROPERTY_TYPE_LABELS } from './propertyTokens';
import { PropertyField } from './fields/PropertyField';
import { Popover } from './fields/Popover';

interface PropertiesPanelProps {
  schema: NotionSchema;
  properties: PageProperties;
  locale?: string;
  onChange?: (propertyId: string, next: StoredPropertyValue) => void;
  onSchemaChange?: (schema: NotionSchema) => void;
  boardOptions?: BoardLinkOption[];
  boardPlacement?: BoardLinkValue | null;
  onBoardPlacementChange?: (placement: BoardLinkValue | null) => void;
  relationTargets?: RelationTargetOption[];
  // schema passed here for context (not used directly — parent owns state)
}

function isEmptyValue(val: StoredPropertyValue): boolean {
  if (val === null || val === undefined || val === '') return true;
  if (Array.isArray(val) && val.length === 0) return true;
  return false;
}

const ALWAYS_SHOW_TYPES: PropertyType[] = ['checkbox', 'created_time', 'last_edited_time', 'unique_id', 'created_by', 'last_edited_by'];

const ADDABLE_TYPES: PropertyType[] = [
  'text','number','select','multi_select','status','date','person',
  'checkbox','url','email','phone','relation','files','unique_id','created_by','last_edited_by','place',
];

function createId(prefix: string): string {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function buildNewProperty(type: PropertyType, people: PersonOption[] = [], relationTargetId = ''): PropertyDefinition {
  const id = createId('prop');
  switch (type) {
    case 'select':
      return { id, name: 'Select', type, options: [] };
    case 'multi_select':
      return { id, name: 'Multi-select', type, options: [] };
    case 'status':
      const todoId = createId('status');
      const doingId = createId('status');
      const doneId = createId('status');
      return {
        id, name: 'Status', type,
        options: [
          { id: todoId, name: 'A fazer', color: 'gray' },
          { id: doingId, name: 'Em andamento', color: 'blue' },
          { id: doneId, name: 'Concluído', color: 'green' },
        ],
        groups: [
          { id: createId('group'), name: 'A fazer', color: 'gray', optionIds: [todoId] },
          { id: createId('group'), name: 'Em andamento', color: 'blue', optionIds: [doingId] },
          { id: createId('group'), name: 'Concluído', color: 'green', optionIds: [doneId] },
        ],
      };
    case 'person':
      return { id, name: 'Pessoa', type, people, multiple: true };
    case 'date':
      return { id, name: 'Data', type, includeTime: true, timezone: 'America/Sao_Paulo' };
    case 'relation':
      return { id, name: 'Relação', type, targetDataSourceId: relationTargetId, multiple: true };
    case 'unique_id':
      return { id, name: 'ID', type, prefix: 'PAGE' };
    default:
      return { id, name: PROPERTY_TYPE_LABELS[type] ?? type, type } as PropertyDefinition;
  }
}

// ─── Sortable row ───────────────────────────────────────────────
interface SortableRowProps {
  definition: PropertyDefinition;
  properties: PageProperties;
  locale?: string;
  renamingId: string | null;
  renameDraft: string;
  readOnly: boolean;
  onChange?: (id: string, val: StoredPropertyValue) => void;
  onSchemaChange?: (schema: NotionSchema) => void;
  // schema passed here for context (not used directly — parent owns state)
  // Note: schema is passed to enable context-aware type changes
  onStartRename: (id: string, current: string) => void;
  onFinishRename: (id: string) => void;
  onCancelRename: () => void;
  onRenameDraftChange: (v: string) => void;
  onDelete: (id: string) => void;
  onChangeType: (id: string, newType: PropertyType) => void;
  onCreateOption: (propId: string, opt: SelectOption) => void;
  onUpdateOption: (propId: string, opt: SelectOption) => void;
  onDeleteOption: (propId: string, optionId: string) => void;
  relationTargets: RelationTargetOption[];
  onRelationTargetChange: (propertyId: string, targetDataSourceId: string) => void;
}

function SortablePropertyRow({
  definition, properties, locale, renamingId, renameDraft,
  readOnly, onChange,
  onStartRename, onFinishRename, onCancelRename, onRenameDraftChange,
  onDelete, onChangeType, onCreateOption, onUpdateOption, onDeleteOption,
  relationTargets, onRelationTargetChange,
}: SortableRowProps) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: definition.id, disabled: readOnly });

  const style = {
    transform: DndCSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const renameRef = useRef<HTMLInputElement>(null);
  const isRenaming = renamingId === definition.id;
  const Icon = PROPERTY_ICONS[definition.type];
  const changeableTypes = ADDABLE_TYPES.filter((type) => type !== definition.type);

  return (
    <div ref={setNodeRef} style={style} className="npc-property-row">
      <div className="npc-property-label">
        {!readOnly && (
          <button
            type="button"
            className="npc-prop-drag-handle-btn"
            {...attributes}
            {...listeners}
            aria-label="Reordenar"
          >
            <GripVertical size={13} />
          </button>
        )}
        <Icon size={14} className="npc-property-icon" strokeWidth={1.75} />

        {isRenaming ? (
          <input
            ref={renameRef}
            autoFocus
            className="npc-prop-rename-input"
            value={renameDraft}
            onChange={(e) => onRenameDraftChange(e.target.value)}
            onBlur={() => onFinishRename(definition.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onFinishRename(definition.id);
              if (e.key === 'Escape') onCancelRename();
            }}
          />
        ) : (
          <span
            className={`npc-prop-name ${!readOnly ? 'npc-prop-name-editable' : ''}`}
            onDoubleClick={() => { if (!readOnly) onStartRename(definition.id, definition.name); }}
          >
            {definition.name}
          </span>
        )}

        {!readOnly && !isRenaming && (
          <Popover
            align="left"
            trigger={({ toggle }) => (
              <button type="button" className="npc-prop-action-btn" onClick={toggle}>
                <MoreHorizontal size={13} />
              </button>
            )}
          >
            {({ close }) => (
              <div className="npc-prop-actions-menu">
                <button type="button" className="npc-block-menu-item" onClick={() => {
                  onStartRename(definition.id, definition.name); close();
                }}>
                  <Edit3 size={13} />Renomear
                </button>

                {changeableTypes.length > 0 && (
                  <>
                    <div className="npc-block-menu-sep" />
                    <div className="npc-block-menu-group-label">Mudar para</div>
                    {changeableTypes.map((t) => {
                      const TIcon = PROPERTY_ICONS[t];
                      return (
                        <button key={t} type="button" className="npc-block-menu-item"
                          onClick={() => { onChangeType(definition.id, t); close(); }}>
                          <TIcon size={13} />{PROPERTY_TYPE_LABELS[t]}
                          <ArrowRight size={12} className="npc-menu-arrow" />
                        </button>
                      );
                    })}
                  </>
                )}

                <div className="npc-block-menu-sep" />
                <button type="button" className="npc-block-menu-item npc-block-menu-item-danger"
                  onClick={() => { onDelete(definition.id); close(); }}>
                  <Trash2 size={13} />Deletar propriedade
                </button>
              </div>
            )}
          </Popover>
        )}
      </div>

      <div className="npc-property-value-cell">
        {definition.type === 'relation' && !readOnly && relationTargets.length > 0 ? (
          <select className="npc-relation-target" aria-label="Data Source relacionado" value={definition.targetDataSourceId}
            onChange={(event) => onRelationTargetChange(definition.id, event.target.value)}>
            {relationTargets.map((target) => <option key={target.id} value={target.id}>{target.title}</option>)}
          </select>
        ) : null}
        <PropertyField
          definition={definition}
          value={properties[definition.id]}
          locale={locale}
          onChange={(next) => onChange?.(definition.id, next)}
          onCreateOption={(opt) => onCreateOption(definition.id, opt)}
          onUpdateOption={(opt) => onUpdateOption(definition.id, opt)}
          onDeleteOption={(optionId) => onDeleteOption(definition.id, optionId)}
          relationOptions={definition.type === 'relation'
            ? relationTargets.find((target) => target.id === definition.targetDataSourceId)?.pages ?? []
            : undefined}
        />
      </div>
    </div>
  );
}

// ─── Main panel ────────────────────────────────────────────────
export function PropertiesPanel({
  schema, properties, locale, onChange, onSchemaChange,
  boardOptions = [], boardPlacement, onBoardPlacementChange,
  relationTargets = [],
}: PropertiesPanelProps) {
  const [showHidden, setShowHidden] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [editingBoardLink, setEditingBoardLink] = useState(false);
  const [draftBoardId, setDraftBoardId] = useState(boardPlacement?.boardId ?? boardOptions[0]?.id ?? '');
  const [draftLaneId, setDraftLaneId] = useState(boardPlacement?.laneId ?? '');
  const readOnly = !onSchemaChange;
  const canManageBoardLink = Boolean(onBoardPlacementChange && boardOptions.length);
  const placementBoard = boardOptions.find((board) => board.id === boardPlacement?.boardId);
  const placementLane = placementBoard?.lanes.find((lane) => lane.id === boardPlacement?.laneId);
  const draftBoard = boardOptions.find((board) => board.id === draftBoardId);
  const availablePeople = schema.properties.flatMap((property) => property.type === 'person' ? property.people : [])
    .filter((person, index, all) => all.findIndex((candidate) => candidate.id === person.id) === index);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function openBoardLinkEditor() {
    const boardId = boardPlacement?.boardId ?? boardOptions[0]?.id ?? '';
    const board = boardOptions.find((candidate) => candidate.id === boardId);
    setDraftBoardId(boardId);
    setDraftLaneId(boardPlacement?.laneId ?? board?.lanes[0]?.id ?? '');
    setEditingBoardLink(true);
  }

  function changeDraftBoard(boardId: string) {
    const board = boardOptions.find((candidate) => candidate.id === boardId);
    setDraftBoardId(boardId);
    setDraftLaneId(board?.lanes[0]?.id ?? '');
  }

  function applyBoardLink() {
    if (!onBoardPlacementChange || !draftBoardId || !draftLaneId) return;
    onBoardPlacementChange({ boardId: draftBoardId, laneId: draftLaneId });
    setEditingBoardLink(false);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !onSchemaChange) return;
    const oldIdx = schema.properties.findIndex((p) => p.id === active.id);
    const newIdx = schema.properties.findIndex((p) => p.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    onSchemaChange({ ...schema, properties: arrayMove(schema.properties, oldIdx, newIdx) });
  }

  function finishRename(id: string) {
    if (!renameDraft.trim() || !onSchemaChange) return;
    onSchemaChange({
      ...schema,
      properties: schema.properties.map((p) =>
        p.id === id ? { ...p, name: renameDraft.trim() } : p,
      ),
    });
    setRenamingId(null);
  }

  function deleteProperty(id: string) {
    if (!window.confirm('Deletar esta propriedade de todas as páginas?')) return;
    onSchemaChange?.({ ...schema, properties: schema.properties.filter((p) => p.id !== id) });
  }

  function changeType(id: string, newType: PropertyType) {
    if (!onSchemaChange) return;
    onSchemaChange({
      ...schema,
      properties: schema.properties.map((p) => {
        if (p.id !== id) return p;
        const base = buildNewProperty(newType, availablePeople, relationTargets[0]?.id ?? '');
        return { ...base, id: p.id, name: p.name };
      }),
    });
  }

  function addProperty(type: PropertyType) {
    if (!onSchemaChange) return;
    const prop = buildNewProperty(type, availablePeople, relationTargets[0]?.id ?? '');
    onSchemaChange({ ...schema, properties: [...schema.properties, prop] });
    setShowHidden(true);
    setRenamingId(prop.id);
    setRenameDraft(prop.name);
  }

  function handleCreateOption(propId: string, option: SelectOption) {
    if (!onSchemaChange) return;
    onSchemaChange({
      ...schema,
      properties: schema.properties.map((p) => {
        if (p.id !== propId) return p;
        if (p.type === 'status') {
          const [firstGroup, ...rest] = p.groups;
          return {
            ...p,
            options: [...p.options, option],
            groups: firstGroup ? [{ ...firstGroup, optionIds: [...firstGroup.optionIds, option.id] }, ...rest] : p.groups,
          };
        }
        if (p.type === 'select' || p.type === 'multi_select') {
          return { ...p, options: [...p.options, option] };
        }
        return p;
      }),
    });
  }

  function handleUpdateOption(propId: string, option: SelectOption) {
    if (!onSchemaChange) return;
    onSchemaChange({
      ...schema,
      properties: schema.properties.map((p) => {
        if (p.id !== propId) return p;
        if (p.type === 'select' || p.type === 'multi_select' || p.type === 'status') {
          return { ...p, options: p.options.map((o) => (o.id === option.id ? option : o)) };
        }
        return p;
      }),
    });
  }

  function handleDeleteOption(propId: string, optionId: string) {
    if (!onSchemaChange) return;
    onSchemaChange({
      ...schema,
      properties: schema.properties.map((property) => {
        if (property.id !== propId) return property;
        if (property.type === 'status') {
          return {
            ...property,
            options: property.options.filter((option) => option.id !== optionId),
            groups: property.groups.map((group) => ({
              ...group,
              optionIds: group.optionIds.filter((id) => id !== optionId),
            })),
          };
        }
        if (property.type === 'select' || property.type === 'multi_select') {
          return { ...property, options: property.options.filter((option) => option.id !== optionId) };
        }
        return property;
      }),
    });
  }

  function changeRelationTarget(propertyId: string, targetDataSourceId: string) {
    if (!onSchemaChange) return;
    onSchemaChange({
      ...schema,
      properties: schema.properties.map((property) => property.id === propertyId && property.type === 'relation'
        ? { ...property, targetDataSourceId }
        : property),
    });
    onChange?.(propertyId, []);
  }

  const visibleProps = schema.properties.filter((p) => {
    if (ALWAYS_SHOW_TYPES.includes(p.type)) return true;
    return showHidden || !isEmptyValue(properties[p.id]);
  });

  const emptyPropertyCount = schema.properties.filter((p) => {
    if (ALWAYS_SHOW_TYPES.includes(p.type)) return false;
    return isEmptyValue(properties[p.id]);
  }).length;

  const sortableIds = visibleProps.map((p) => p.id);

  return (
    <div className="npc-properties-panel">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          {visibleProps.map((definition) => (
            <SortablePropertyRow
              key={definition.id}
              definition={definition}
              properties={properties}
              locale={locale}
              renamingId={renamingId}
              renameDraft={renameDraft}
              readOnly={readOnly}
              onChange={onChange}
              onSchemaChange={onSchemaChange}
              onStartRename={(id, name) => { setRenamingId(id); setRenameDraft(name); }}
              onFinishRename={finishRename}
              onCancelRename={() => setRenamingId(null)}
              onRenameDraftChange={setRenameDraft}
              onDelete={deleteProperty}
              onChangeType={changeType}
              onCreateOption={handleCreateOption}
              onUpdateOption={handleUpdateOption}
              onDeleteOption={handleDeleteOption}
              relationTargets={relationTargets}
              onRelationTargetChange={changeRelationTarget}
            />
          ))}
        </SortableContext>
      </DndContext>

      {(boardPlacement || editingBoardLink) && canManageBoardLink ? (
        <div className="npc-board-link-row">
          <div className="npc-board-link-label"><LayoutDashboard size={14} /><span>Board</span></div>
          {editingBoardLink ? (
            <div className="npc-board-link-editor">
              <label>
                <span>Board</span>
                <select value={draftBoardId} onChange={(event) => changeDraftBoard(event.target.value)}>
                  {boardOptions.map((board) => <option key={board.id} value={board.id}>{board.title}</option>)}
                </select>
              </label>
              <label>
                <span>Lane</span>
                <select value={draftLaneId} onChange={(event) => setDraftLaneId(event.target.value)}>
                  {draftBoard?.lanes.map((lane) => <option key={lane.id} value={lane.id}>{lane.name}</option>)}
                </select>
              </label>
              <div className="npc-board-link-actions">
                <button type="button" onClick={() => { setEditingBoardLink(false); if (!boardPlacement) setDraftBoardId(''); }}>Cancelar</button>
                <button type="button" className="is-primary" disabled={!draftBoardId || !draftLaneId} onClick={applyBoardLink}>Aplicar</button>
              </div>
            </div>
          ) : (
            <div className="npc-board-link-value">
              <button type="button" onClick={openBoardLinkEditor}>
                <strong>{placementBoard?.title ?? 'Board'}</strong>
                <span>/</span>
                <em>{placementLane?.name ?? 'Sem status'}</em>
              </button>
              <button type="button" className="npc-board-link-remove" title="Remover do board" onClick={() => onBoardPlacementChange?.(null)}><X size={13} /></button>
            </div>
          )}
        </div>
      ) : null}

      {emptyPropertyCount > 0 && (
        <button type="button" className="npc-hidden-props-toggle"
          onClick={() => setShowHidden((v) => !v)}>
          {showHidden ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {showHidden
            ? 'Ocultar propriedades vazias'
            : `${emptyPropertyCount} propriedade${emptyPropertyCount !== 1 ? 's' : ''} oculta${emptyPropertyCount !== 1 ? 's' : ''}`}
        </button>
      )}

      {(!readOnly || canManageBoardLink) && (
        <Popover
          align="left"
          trigger={({ toggle }) => (
            <button type="button" className="npc-add-property-btn" onClick={toggle}>
              <Plus size={13} />Adicionar propriedade
            </button>
          )}
        >
          {({ close }) => (
            <div className="npc-type-picker">
              {!readOnly ? (
                <>
                  <div className="npc-type-picker-label">TIPO DE PROPRIEDADE</div>
                  {ADDABLE_TYPES.map((type) => {
                    const Icon = PROPERTY_ICONS[type];
                    return (
                      <button key={type} type="button" className="npc-type-picker-item"
                        onClick={() => { addProperty(type); close(); }}>
                        <Icon size={14} strokeWidth={1.75} />{PROPERTY_TYPE_LABELS[type]}
                      </button>
                    );
                  })}
                </>
              ) : null}
              {canManageBoardLink ? (
                <>
                  <div className="npc-type-picker-label npc-type-picker-section">VINCULOS</div>
                  <button type="button" className="npc-type-picker-item" onClick={() => { openBoardLinkEditor(); close(); }}>
                    <LayoutDashboard size={14} strokeWidth={1.75} />Board
                  </button>
                </>
              ) : null}
            </div>
          )}
        </Popover>
      )}
    </div>
  );
}
