import { BarChart3, Plus } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { NotionPageData, NotionSchema, StoredPropertyValue } from '../notion-page/types';
import type { ChartResource } from './domain';

export interface ChartSeriesItem { label: string; value: number; }

function labelFor(value: StoredPropertyValue, schema: NotionSchema, propertyId?: string): string {
  if (value === null || value === undefined || value === '') return 'Sem valor';
  const definition = schema.properties.find((property) => property.id === propertyId);
  if ((definition?.type === 'select' || definition?.type === 'status') && typeof value === 'string') {
    return definition.options.find((option) => option.id === value)?.name ?? value;
  }
  if (Array.isArray(value)) return value.join(', ') || 'Sem valor';
  return String(value);
}

export function buildChartSeries(resource: ChartResource, schema: NotionSchema, pages: NotionPageData[]): ChartSeriesItem[] {
  const groups = new Map<string, number[]>();
  pages.forEach((page) => {
    const label = labelFor(resource.groupPropertyId ? page.properties[resource.groupPropertyId] : 'Todos', schema, resource.groupPropertyId);
    const numericValue = resource.valuePropertyId ? Number(page.properties[resource.valuePropertyId]) : 1;
    groups.set(label, [...(groups.get(label) ?? []), Number.isFinite(numericValue) ? numericValue : 0]);
  });
  return [...groups.entries()].map(([label, numbers]) => ({
    label,
    value: resource.aggregation === 'count'
      ? numbers.length
      : resource.aggregation === 'sum'
        ? numbers.reduce((total, value) => total + value, 0)
        : numbers.length ? numbers.reduce((total, value) => total + value, 0) / numbers.length : 0,
  }));
}

function ChartPlot({ type, values }: { type: ChartResource['chartType']; values: ChartSeriesItem[] }) {
  const maximum = Math.max(1, ...values.map((item) => item.value));
  const total = Math.max(1, values.reduce((sum, item) => sum + Math.max(0, item.value), 0));
  const colors = ['#2383e2', '#0f9d76', '#d97706', '#a855f7', '#e0564a', '#64748b'];
  const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

  if (!values.length) return <p className="lab-chart-empty">Nenhuma página para exibir.</p>;
  if (type === 'line') {
    const points = values.map((item, index) => `${values.length === 1 ? 500 : index * (1000 / (values.length - 1))},${250 - (item.value / maximum) * 220}`).join(' ');
    return <div className="lab-chart-line"><svg viewBox="0 0 1000 270" role="img" aria-label="Gráfico de linha"><polyline points={points} />{values.map((item, index) => <circle key={item.label} cx={values.length === 1 ? 500 : index * (1000 / (values.length - 1))} cy={250 - (item.value / maximum) * 220} r="7"><title>{item.label}: {number.format(item.value)}</title></circle>)}</svg><div className="lab-chart-legend">{values.map((item) => <span key={item.label}><i />{item.label}<b>{number.format(item.value)}</b></span>)}</div></div>;
  }
  if (type === 'donut') {
    let offset = 0;
    const stops = values.map((item, index) => {
      const start = offset;
      offset += Math.max(0, item.value) / total * 100;
      return `${colors[index % colors.length]} ${start}% ${offset}%`;
    }).join(', ');
    return <div className="lab-chart-donut-wrap"><div className="lab-chart-donut" role="img" aria-label="Gráfico de rosca" style={{ '--chart-stops': stops } as CSSProperties}><strong>{number.format(values.reduce((sum, item) => sum + item.value, 0))}</strong><span>Total</span></div><div className="lab-chart-legend">{values.map((item, index) => <span key={item.label}><i style={{ background: colors[index % colors.length] }} />{item.label}<b>{number.format(item.value)}</b></span>)}</div></div>;
  }
  return <div className="lab-chart-bars">{values.map((item, index) => <div key={item.label} className="lab-chart-item"><span title={item.label}>{item.label}</span><div><i style={{ '--chart-ratio': item.value / maximum, background: colors[index % colors.length] } as CSSProperties} /></div><strong>{number.format(item.value)}</strong></div>)}</div>;
}

export function ChartView({ resource, schema, pages, onCreatePage, onChange }: {
  resource: ChartResource;
  schema: NotionSchema;
  pages: NotionPageData[];
  onCreatePage: () => void;
  onChange: (patch: Partial<ChartResource>) => void;
}) {
  const values = buildChartSeries(resource, schema, pages);
  const groupable = schema.properties.filter((property) => !['files', 'formula', 'rollup'].includes(property.type));
  const numeric = schema.properties.filter((property) => ['number', 'formula', 'rollup'].includes(property.type));

  return <section className="lab-collection-view lab-chart-view">
    <div className="lab-heading"><div><span>CHART</span><h1><BarChart3 size={17} />{resource.title}</h1><small>{pages.length} páginas</small></div><button type="button" onClick={onCreatePage}><Plus size={15} />Nova página</button></div>
    <div className="lab-chart-toolbar">
      <label>Agrupar<select value={resource.groupPropertyId ?? ''} onChange={(event) => onChange({ groupPropertyId: event.target.value || undefined })}><option value="">Todos</option>{groupable.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label>
      <label>Valor<select value={resource.valuePropertyId ?? ''} disabled={resource.aggregation === 'count'} onChange={(event) => onChange({ valuePropertyId: event.target.value || undefined })}><option value="">Contagem</option>{numeric.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label>
      <label>Cálculo<select value={resource.aggregation} onChange={(event) => onChange({ aggregation: event.target.value as ChartResource['aggregation'] })}><option value="count">Contagem</option><option value="sum">Soma</option><option value="average">Média</option></select></label>
      <label>Formato<select value={resource.chartType} onChange={(event) => onChange({ chartType: event.target.value as ChartResource['chartType'] })}><option value="bar">Barras</option><option value="line">Linha</option><option value="donut">Rosca</option></select></label>
    </div>
    <div className={`lab-chart-plot is-${resource.chartType}`}><ChartPlot type={resource.chartType} values={values} /></div>
  </section>;
}
