import { Plus, SlidersHorizontal, Trash2 } from 'lucide-react';
import { Popover } from '../notion-page/fields/Popover';
import type { NotionSchema, PropertyDefinition, StoredPropertyValue } from '../notion-page/types';
import type { FilterCondition, FilterOperator, WorkspaceResource } from './domain';

interface ViewSettingsProps {
  resource: WorkspaceResource;
  schema: NotionSchema;
  onChange: (patch: Partial<WorkspaceResource>) => void;
}

const OPERATORS: Array<{ value: FilterOperator; label: string }> = [
  { value: 'equals', label: 'É igual a' }, { value: 'not_equals', label: 'Não é igual a' },
  { value: 'contains', label: 'Contém' }, { value: 'is_empty', label: 'Está vazio' },
  { value: 'is_not_empty', label: 'Não está vazio' }, { value: 'greater_than', label: 'Maior que' },
  { value: 'less_than', label: 'Menor que' }, { value: 'before', label: 'Antes de' }, { value: 'after', label: 'Depois de' },
];

function parseFilterValue(definition: PropertyDefinition | undefined, value: string): StoredPropertyValue {
  if (definition?.type === 'number') return value === '' ? null : Number(value);
  if (definition?.type === 'checkbox') return value === 'true';
  return value;
}

export function ViewSettings({ resource, schema, onChange }: ViewSettingsProps) {
  const projection = resource.projection ?? { propertyIds: resource.propertyIds, openMode: 'full_page' as const, cardPreview: 'none' as const };
  const conditions = resource.filter?.filters.filter((entry): entry is FilterCondition => entry.type === 'condition') ?? [];
  const firstProperty = schema.properties[0];

  function updateConditions(next: FilterCondition[]) {
    onChange({ filter: next.length ? { type: 'group', operator: resource.filter?.operator ?? 'and', filters: next } : undefined });
  }

  return <Popover align="right" trigger={({ toggle }) => <button type="button" className="lab-view-settings-trigger" title="Configurar exibição" onClick={toggle}><SlidersHorizontal size={14} /><span>Exibição</span></button>}>
    {() => <div className="lab-view-settings">
      <section><strong>Propriedades visíveis</strong><div className="lab-view-property-grid">{schema.properties.map((property) => <label key={property.id}><input type="checkbox" checked={projection.propertyIds.includes(property.id)} onChange={(event) => onChange({ projection: { ...projection, propertyIds: event.target.checked ? [...projection.propertyIds, property.id] : projection.propertyIds.filter((id) => id !== property.id) } })} /><span>{property.name}</span></label>)}</div></section>

      <section><strong>Ordenação</strong>{(resource.sorts ?? []).map((sort, index) => <div key={`${sort.propertyId}-${index}`} className="lab-view-setting-row"><select value={sort.propertyId} onChange={(event) => onChange({ sorts: (resource.sorts ?? []).map((item, itemIndex) => itemIndex === index ? { ...item, propertyId: event.target.value } : item) })}><option value="title">Nome</option>{schema.properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select><select value={sort.direction} onChange={(event) => onChange({ sorts: (resource.sorts ?? []).map((item, itemIndex) => itemIndex === index ? { ...item, direction: event.target.value as 'ascending' | 'descending' } : item) })}><option value="ascending">Crescente</option><option value="descending">Decrescente</option></select><button type="button" aria-label="Remover ordenação" onClick={() => onChange({ sorts: resource.sorts?.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 size={12} /></button></div>)}<button type="button" className="lab-view-add-setting" onClick={() => onChange({ sorts: [...(resource.sorts ?? []), { propertyId: firstProperty?.id ?? 'title', direction: 'ascending' }] })}><Plus size={12} />Adicionar ordenação</button></section>

      <section><div className="lab-view-section-title"><strong>Filtros</strong><select value={resource.filter?.operator ?? 'and'} onChange={(event) => onChange({ filter: { type: 'group', operator: event.target.value as 'and' | 'or', filters: conditions } })}><option value="and">Todos (AND)</option><option value="or">Qualquer (OR)</option></select></div>{conditions.map((condition, index) => { const definition = schema.properties.find((property) => property.id === condition.propertyId); const noValue = condition.operator === 'is_empty' || condition.operator === 'is_not_empty'; return <div key={`${condition.propertyId}-${index}`} className="lab-view-setting-row lab-filter-row"><select value={condition.propertyId} onChange={(event) => updateConditions(conditions.map((item, itemIndex) => itemIndex === index ? { ...item, propertyId: event.target.value } : item))}>{schema.properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select><select value={condition.operator} onChange={(event) => updateConditions(conditions.map((item, itemIndex) => itemIndex === index ? { ...item, operator: event.target.value as FilterOperator } : item))}>{OPERATORS.map((operator) => <option key={operator.value} value={operator.value}>{operator.label}</option>)}</select>{!noValue ? <input value={condition.value == null ? '' : String(condition.value)} onChange={(event) => updateConditions(conditions.map((item, itemIndex) => itemIndex === index ? { ...item, value: parseFilterValue(definition, event.target.value) } : item))} /> : null}<button type="button" aria-label="Remover filtro" onClick={() => updateConditions(conditions.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={12} /></button></div>; })}<button type="button" className="lab-view-add-setting" disabled={!firstProperty} onClick={() => firstProperty && updateConditions([...conditions, { type: 'condition', propertyId: firstProperty.id, operator: 'equals', value: null }])}><Plus size={12} />Adicionar filtro</button></section>

      <section className="lab-view-two-columns"><label><span>Agrupar</span><select value={resource.group?.propertyId ?? ''} onChange={(event) => onChange({ group: event.target.value ? { propertyId: event.target.value } : undefined })}><option value="">Sem grupo</option>{schema.properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label><label><span>Subgrupo</span><select value={resource.subgroup?.propertyId ?? ''} onChange={(event) => onChange({ subgroup: event.target.value ? { propertyId: event.target.value } : undefined })}><option value="">Sem subgrupo</option>{schema.properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label></section>

      <section className="lab-view-two-columns"><label><span>Abrir página</span><select value={projection.openMode} onChange={(event) => onChange({ projection: { ...projection, openMode: event.target.value as typeof projection.openMode } })}><option value="side_peek">Visão lateral</option><option value="center_peek">Visão central</option><option value="full_page">Página inteira</option></select></label><label><span>Preview do card</span><select value={projection.cardPreview} onChange={(event) => onChange({ projection: { ...projection, cardPreview: event.target.value as typeof projection.cardPreview } })}><option value="none">Nenhum</option><option value="content">Conteúdo</option><option value="cover">Capa</option></select></label></section>
    </div>}
  </Popover>;
}
