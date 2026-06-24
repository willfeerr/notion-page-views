import { LayoutDashboard, Plus, Trash2 } from 'lucide-react';
import type { DatabasePageLayout, NotionSchema } from './types';
import { Popover } from './fields/Popover';

export function PageLayoutSettings({ schema, layout, onChange }: {
  schema: NotionSchema;
  layout: DatabasePageLayout;
  onChange: (layout: DatabasePageLayout) => void;
}) {
  function togglePinned(propertyId: string) {
    const pinned = layout.pinnedPropertyIds.includes(propertyId);
    if (!pinned && layout.pinnedPropertyIds.length >= 4) return;
    const pinnedPropertyIds = pinned
      ? layout.pinnedPropertyIds.filter((id) => id !== propertyId)
      : [...layout.pinnedPropertyIds, propertyId];
    const sections = pinned
      ? layout.sections.map((section, index) => index === 0 ? { ...section, propertyIds: [...section.propertyIds, propertyId] } : section)
      : layout.sections.map((section) => ({ ...section, propertyIds: section.propertyIds.filter((id) => id !== propertyId) }));
    onChange({ pinnedPropertyIds, sections });
  }

  function assignSection(propertyId: string, sectionId: string) {
    onChange({
      pinnedPropertyIds: layout.pinnedPropertyIds.filter((id) => id !== propertyId),
      sections: layout.sections.map((section) => ({
        ...section,
        propertyIds: section.id === sectionId
          ? [...section.propertyIds.filter((id) => id !== propertyId), propertyId]
          : section.propertyIds.filter((id) => id !== propertyId),
      })),
    });
  }

  function addSection() {
    onChange({ ...layout, sections: [...layout.sections, { id: `section-${crypto.randomUUID()}`, title: 'Nova seção', propertyIds: [] }] });
  }

  function deleteSection(sectionId: string) {
    const removed = layout.sections.find((section) => section.id === sectionId);
    const remaining = layout.sections.filter((section) => section.id !== sectionId);
    if (!removed || !remaining.length) return;
    remaining[0] = { ...remaining[0], propertyIds: [...remaining[0].propertyIds, ...removed.propertyIds] };
    onChange({ ...layout, sections: remaining });
  }

  return <Popover align="right" trigger={({ toggle }) => <button type="button" className="npc-layout-trigger" onClick={toggle}><LayoutDashboard size={13} />Personalizar layout</button>}>
    {() => <div className="npc-layout-settings">
      <header><strong>Layout da página</strong><small>Configuração compartilhada nesta base</small></header>
      <section><div className="npc-layout-heading"><strong>Propriedades fixadas</strong><span>{layout.pinnedPropertyIds.length}/4</span></div><div className="npc-layout-property-list">{schema.properties.map((property) => <label key={property.id}><input type="checkbox" checked={layout.pinnedPropertyIds.includes(property.id)} disabled={!layout.pinnedPropertyIds.includes(property.id) && layout.pinnedPropertyIds.length >= 4} onChange={() => togglePinned(property.id)} /><span>{property.name}</span></label>)}</div></section>
      <section><div className="npc-layout-heading"><strong>Seções</strong><button type="button" onClick={addSection}><Plus size={12} />Adicionar</button></div>{layout.sections.map((section) => <div key={section.id} className="npc-layout-section-editor"><input aria-label="Nome da seção" value={section.title} onChange={(event) => onChange({ ...layout, sections: layout.sections.map((item) => item.id === section.id ? { ...item, title: event.target.value } : item) })} /><label><input type="checkbox" checked={Boolean(section.collapsed)} onChange={(event) => onChange({ ...layout, sections: layout.sections.map((item) => item.id === section.id ? { ...item, collapsed: event.target.checked } : item) })} />Recolhida</label><button type="button" aria-label="Excluir seção" disabled={layout.sections.length === 1} onClick={() => deleteSection(section.id)}><Trash2 size={12} /></button></div>)}</section>
      <section><strong>Organização</strong>{schema.properties.map((property) => <label key={property.id} className="npc-layout-assignment"><span>{property.name}</span><select value={layout.pinnedPropertyIds.includes(property.id) ? 'pinned' : layout.sections.find((section) => section.propertyIds.includes(property.id))?.id ?? layout.sections[0]?.id} onChange={(event) => event.target.value === 'pinned' ? togglePinned(property.id) : assignSection(property.id, event.target.value)}><option value="pinned" disabled={!layout.pinnedPropertyIds.includes(property.id) && layout.pinnedPropertyIds.length >= 4}>Fixada</option>{layout.sections.map((section) => <option key={section.id} value={section.id}>{section.title || 'Sem título'}</option>)}</select></label>)}</section>
    </div>}
  </Popover>;
}
