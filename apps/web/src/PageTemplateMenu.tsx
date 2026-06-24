import { Copy, FilePlus2, Trash2 } from 'lucide-react';
import { Popover } from '../notion-page/fields/Popover';
import type { DatabasePageTemplate } from '../notion-page/types';

export function PageTemplateMenu({ templates, onUse, onDelete }: {
  templates: DatabasePageTemplate[];
  onUse: (templateId: string) => void;
  onDelete: (templateId: string) => void;
}) {
  return <Popover align="right" trigger={({ toggle }) => <button type="button" className="lab-template-trigger" title="Criar usando template" onClick={toggle}><Copy size={14} /><span>Templates</span></button>}>
    {({ close }) => <div className="lab-template-menu">
      <header><strong>Templates</strong><small>{templates.length} salvo{templates.length === 1 ? '' : 's'} neste Data Source</small></header>
      {templates.length ? templates.map((template) => <div key={template.id} className="lab-template-row"><button type="button" onClick={() => { onUse(template.id); close(); }}><span>{template.icon || <FilePlus2 size={14} />}</span><span><strong>{template.name}</strong><small>{template.title || 'Página sem título'}</small></span></button><button type="button" title="Excluir template" aria-label={`Excluir ${template.name}`} onClick={() => onDelete(template.id)}><Trash2 size={12} /></button></div>) : <p>Nenhum template salvo.</p>}
    </div>}
  </Popover>;
}
