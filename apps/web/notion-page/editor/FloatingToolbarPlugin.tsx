'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getSelection, $isRangeSelection,
  FORMAT_TEXT_COMMAND, FORMAT_ELEMENT_COMMAND,
  SELECTION_CHANGE_COMMAND, COMMAND_PRIORITY_LOW,
} from 'lexical';
import { $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
import { $patchStyleText, $getSelectionStyleValueForProperty } from '@lexical/selection';
import { mergeRegister } from '@lexical/utils';
import {
  Bold, Italic, Underline, Strikethrough, Code, Link as LinkIcon,
  Highlighter, Palette, AlignLeft, AlignCenter, AlignRight, AlignJustify,
} from 'lucide-react';

const TEXT_COLORS = [
  { name: 'Padrão',   value: 'inherit',  dot: '#37352f' },
  { name: 'Cinza',    value: '#9b9a97',  dot: '#9b9a97' },
  { name: 'Marrom',   value: '#64473a',  dot: '#64473a' },
  { name: 'Laranja',  value: '#d9730d',  dot: '#d9730d' },
  { name: 'Amarelo',  value: '#dfab01',  dot: '#dfab01' },
  { name: 'Verde',    value: '#0f7b6c',  dot: '#0f7b6c' },
  { name: 'Azul',     value: '#0b6e99',  dot: '#0b6e99' },
  { name: 'Roxo',     value: '#6940a5',  dot: '#6940a5' },
  { name: 'Rosa',     value: '#ad1a72',  dot: '#ad1a72' },
  { name: 'Vermelho', value: '#e03e3e',  dot: '#e03e3e' },
];

const HIGHLIGHT_COLORS = [
  { name: 'Nenhum',   value: 'transparent', dot: '#fff', border: true },
  { name: 'Cinza',    value: '#ebeced',     dot: '#ebeced' },
  { name: 'Marrom',   value: '#e9e5e3',     dot: '#e9e5e3' },
  { name: 'Laranja',  value: '#faebdd',     dot: '#faebdd' },
  { name: 'Amarelo',  value: '#fbf3db',     dot: '#fbf3db' },
  { name: 'Verde',    value: '#ddedea',     dot: '#ddedea' },
  { name: 'Azul',     value: '#ddebf1',     dot: '#ddebf1' },
  { name: 'Roxo',     value: '#eae4f2',     dot: '#eae4f2' },
  { name: 'Rosa',     value: '#f4dfeb',     dot: '#f4dfeb' },
  { name: 'Vermelho', value: '#fbe4e4',     dot: '#fbe4e4' },
];

interface ToolbarState {
  bold: boolean; italic: boolean; underline: boolean;
  strikethrough: boolean; code: boolean; isLink: boolean;
  textColor: string; highlight: string;
  align: string;
}
const EMPTY: ToolbarState = {
  bold: false, italic: false, underline: false, strikethrough: false,
  code: false, isLink: false, textColor: 'inherit', highlight: 'transparent',
  align: 'left',
};

export function FloatingToolbarPlugin() {
  const [editor] = useLexicalComposerContext();
  const [state, setState] = useState<ToolbarState>(EMPTY);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [panel, setPanel] = useState<'none' | 'text' | 'highlight'>('none');
  const toolbarRef = useRef<HTMLDivElement>(null);

  const update = useCallback(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection) || selection.isCollapsed()) {
      setPosition(null); return;
    }
    const nativeSel = window.getSelection();
    if (!nativeSel || nativeSel.rangeCount === 0) { setPosition(null); return; }
    const rect = nativeSel.getRangeAt(0).getBoundingClientRect();
    if (rect.width === 0) { setPosition(null); return; }

    const anchor = selection.anchor.getNode();
    const parent = anchor.getParent();
    setState({
      bold: selection.hasFormat('bold'),
      italic: selection.hasFormat('italic'),
      underline: selection.hasFormat('underline'),
      strikethrough: selection.hasFormat('strikethrough'),
      code: selection.hasFormat('code'),
      isLink: $isLinkNode(parent) || $isLinkNode(anchor),
      textColor: $getSelectionStyleValueForProperty(selection, 'color', 'inherit'),
      highlight: $getSelectionStyleValueForProperty(selection, 'background-color', 'transparent'),
      align: 'left',
    });
    const h = toolbarRef.current?.offsetHeight ?? 40;
    setPosition({ top: rect.top - h - 8, left: rect.left + rect.width / 2 });
  }, []);

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(() => editor.getEditorState().read(update)),
      editor.registerCommand(SELECTION_CHANGE_COMMAND, () => { update(); return false; }, COMMAND_PRIORITY_LOW),
    );
  }, [editor, update]);

  if (!position) return null;

  function applyColor(color: string) {
    editor.update(() => {
      const sel = $getSelection();
      if ($isRangeSelection(sel)) $patchStyleText(sel, { color });
    });
    setPanel('none');
  }
  function applyHighlight(bg: string) {
    editor.update(() => {
      const sel = $getSelection();
      if ($isRangeSelection(sel)) $patchStyleText(sel, { 'background-color': bg });
    });
    setPanel('none');
  }

  return (
    <div
      ref={toolbarRef}
      className="npc-floating-toolbar"
      style={{ top: position.top, left: position.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Format */}
      <Btn active={state.bold} label="Negrito ⌘B" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}><Bold size={13} /></Btn>
      <Btn active={state.italic} label="Itálico ⌘I" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}><Italic size={13} /></Btn>
      <Btn active={state.underline} label="Sublinhado ⌘U" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')}><Underline size={13} /></Btn>
      <Btn active={state.strikethrough} label="Tachado" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough')}><Strikethrough size={13} /></Btn>
      <Btn active={state.code} label="Código" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code')}><Code size={13} /></Btn>
      <Btn active={state.isLink} label="Link" onClick={() => editor.dispatchCommand(TOGGLE_LINK_COMMAND, state.isLink ? null : 'https://')}><LinkIcon size={13} /></Btn>
      <Sep />

      {/* Alignment */}
      <Btn active={state.align === 'left'}    label="Esquerda"  onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'left')}><AlignLeft size={13} /></Btn>
      <Btn active={state.align === 'center'}  label="Centro"    onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'center')}><AlignCenter size={13} /></Btn>
      <Btn active={state.align === 'right'}   label="Direita"   onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'right')}><AlignRight size={13} /></Btn>
      <Btn active={state.align === 'justify'} label="Justificar" onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'justify')}><AlignJustify size={13} /></Btn>
      <Sep />

      {/* Text color */}
      <div className="npc-toolbar-color-wrapper">
        <Btn active={false} label="Cor do texto" onClick={() => setPanel(panel === 'text' ? 'none' : 'text')}>
          <span className="npc-toolbar-color-btn-inner">
            <Palette size={13} />
            <span className="npc-toolbar-color-swatch" style={{ background: state.textColor === 'inherit' ? '#37352f' : state.textColor }} />
          </span>
        </Btn>
        {panel === 'text' && (
          <div className="npc-color-panel">
            <div className="npc-color-panel-title">COR DO TEXTO</div>
            <div className="npc-color-grid">
              {TEXT_COLORS.map(c => (
                <button key={c.value} type="button" className="npc-color-swatch-btn"
                  title={c.name} style={{ background: c.dot }} onClick={() => applyColor(c.value)} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Highlight */}
      <div className="npc-toolbar-color-wrapper">
        <Btn active={false} label="Realce" onClick={() => setPanel(panel === 'highlight' ? 'none' : 'highlight')}>
          <span className="npc-toolbar-color-btn-inner">
            <Highlighter size={13} />
            <span className="npc-toolbar-color-swatch"
              style={{ background: state.highlight === 'transparent' ? '#fbf3db' : state.highlight,
                       border: state.highlight === 'transparent' ? '1px solid #ccc' : 'none' }} />
          </span>
        </Btn>
        {panel === 'highlight' && (
          <div className="npc-color-panel npc-color-panel-right">
            <div className="npc-color-panel-title">REALCE</div>
            <div className="npc-color-grid">
              {HIGHLIGHT_COLORS.map(c => (
                <button key={c.value} type="button" className="npc-color-swatch-btn"
                  title={c.name}
                  style={{ background: c.dot, border: 'border' in c ? '1px solid #ddd' : 'none' }}
                  onClick={() => applyHighlight(c.value)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Btn({ active, label, onClick, children }: {
  active: boolean; label: string; onClick: () => void; children: ReactNode;
}) {
  return (
    <button type="button" className={`npc-toolbar-btn ${active ? 'is-active' : ''}`}
      title={label} aria-label={label} onClick={onClick}>
      {children}
    </button>
  );
}

function Sep() {
  return <div className="npc-toolbar-sep" />;
}
