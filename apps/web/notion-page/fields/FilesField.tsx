import { File, Plus, X } from 'lucide-react';
import { useState } from 'react';

export function FilesField({ value, compact = false, onChange }: { value: string[] | null | undefined; compact?: boolean; onChange?: (value: string[]) => void }) {
  const files = Array.isArray(value) ? value : [];
  const [draft, setDraft] = useState('');
  if (compact) return files.length ? <span className="npc-file-compact"><File size={11} />{files.length} arquivo{files.length === 1 ? '' : 's'}</span> : <span className="npc-muted">Vazio</span>;
  return <div className="npc-files-field">
    {files.map((url) => <span key={url}><a href={url} target="_blank" rel="noreferrer"><File size={11} />{url.split('/').pop() || url}</a>{onChange ? <button type="button" onClick={() => onChange(files.filter((item) => item !== url))}><X size={10} /></button> : null}</span>)}
    {onChange ? <form onSubmit={(event) => { event.preventDefault(); const url = draft.trim(); if (!url) return; onChange([...files, url]); setDraft(''); }}><input type="url" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="https://..." /><button type="submit" aria-label="Adicionar arquivo"><Plus size={12} /></button></form> : null}
  </div>;
}
