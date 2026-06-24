import { CalendarRange, Image as ImageIcon, List, Plus, Table2 } from 'lucide-react';
import { NotionPageCard } from '../notion-page';
import { PropertyField } from '../notion-page/fields/PropertyField';
import type { DateRangeValue, NotionPageData, NotionSchema, StoredPropertyValue } from '../notion-page/types';
import type { CollectionResource, TimelineResource } from './domain';

type Resource = CollectionResource | TimelineResource;

interface DatabaseCollectionViewProps {
  resource: Resource;
  schema: NotionSchema;
  pages: NotionPageData[];
  onOpenPage: (pageId: string) => void;
  onCreatePage: () => void;
  onPropertyChange: (pageId: string, propertyId: string, value: StoredPropertyValue) => void;
}

function dateStart(value: StoredPropertyValue): string | null {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && !Array.isArray(value)) return (value as DateRangeValue).start;
  return null;
}

function ViewIcon({ type }: { type: Resource['type'] }) {
  if (type === 'table') return <Table2 size={17} />;
  if (type === 'list') return <List size={17} />;
  if (type === 'gallery') return <ImageIcon size={17} />;
  return <CalendarRange size={17} />;
}

export function DatabaseCollectionView({ resource, schema, pages, onOpenPage, onCreatePage, onPropertyChange }: DatabaseCollectionViewProps) {
  const propertyIds = resource.projection?.propertyIds?.length ? resource.projection.propertyIds : resource.propertyIds;
  const properties = propertyIds.flatMap((id) => {
    const definition = schema.properties.find((candidate) => candidate.id === id);
    return definition ? [definition] : [];
  });

  if (resource.type === 'table') return <section className="lab-collection-view">
    <CollectionHeader resource={resource} count={pages.length} onCreatePage={onCreatePage} />
    <div className="lab-table-scroll"><table className="lab-data-table"><thead><tr><th>Nome</th>{properties.map((property) => <th key={property.id}>{property.name}</th>)}</tr></thead><tbody>
      {pages.map((page) => <tr key={page.id}><td><button type="button" onClick={() => onOpenPage(page.id)}>{page.icon || '▤'}<span>{page.title || 'Sem titulo'}</span></button></td>{properties.map((property) => <td key={property.id}><PropertyField definition={property} value={page.properties[property.id]} onChange={(value) => onPropertyChange(page.id, property.id, value)} /></td>)}</tr>)}
    </tbody></table></div>
  </section>;

  if (resource.type === 'list') return <section className="lab-collection-view">
    <CollectionHeader resource={resource} count={pages.length} onCreatePage={onCreatePage} />
    <div className="lab-list-view">{pages.map((page) => <button type="button" key={page.id} onClick={() => onOpenPage(page.id)}><span className="lab-list-icon">{page.icon || '▤'}</span><span><strong>{page.title || 'Sem titulo'}</strong><small>{page.contentPreview || 'Sem conteudo'}</small></span><span className="lab-list-properties">{properties.slice(0, 3).map((property) => <PropertyField key={property.id} definition={property} value={page.properties[property.id]} compact />)}</span></button>)}</div>
  </section>;

  if (resource.type === 'gallery') return <section className="lab-collection-view">
    <CollectionHeader resource={resource} count={pages.length} onCreatePage={onCreatePage} />
    <div className="lab-gallery-view">{pages.map((page) => <NotionPageCard key={page.id} schema={schema} page={page} visiblePropertyIds={properties.map((property) => property.id)} onClick={() => onOpenPage(page.id)} onPropertyChange={(propertyId, value) => onPropertyChange(page.id, propertyId, value)} />)}</div>
  </section>;

  if (resource.type !== 'timeline') return null;
  const dated = pages.map((page) => ({ page, start: dateStart(page.properties[resource.datePropertyId]) })).filter((item): item is { page: NotionPageData; start: string } => Boolean(item.start)).sort((left, right) => left.start.localeCompare(right.start));
  return <section className="lab-collection-view">
    <CollectionHeader resource={resource} count={dated.length} onCreatePage={onCreatePage} />
    <div className="lab-timeline-view">{dated.map(({ page, start }, index) => <button type="button" key={page.id} onClick={() => onOpenPage(page.id)}><time>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: resource.timezone }).format(new Date(start))}</time><i /><span><strong>{page.icon} {page.title || 'Sem titulo'}</strong><small>{page.contentPreview || 'Sem conteudo'}</small></span>{index < dated.length - 1 ? <hr /> : null}</button>)}</div>
  </section>;
}

function CollectionHeader({ resource, count, onCreatePage }: { resource: Resource; count: number; onCreatePage: () => void }) {
  return <div className="lab-heading"><div><span>{resource.type.toUpperCase()}</span><h1><ViewIcon type={resource.type} />{resource.title}</h1><small>{count} paginas</small></div><button type="button" onClick={onCreatePage}><Plus size={15} />Nova pagina</button></div>;
}
