'use client';

import type { JSX } from 'react';
import {
  $applyNodeReplacement, $getNodeByKey, DecoratorNode,
  type LexicalEditor, type LexicalNode,
  type NodeKey, type SerializedLexicalNode, type Spread, createCommand, type LexicalCommand,
} from 'lexical';
import { useEffect, useRef, useState } from 'react';
import katex from 'katex';

export type SerializedMathNode = Spread<{ latex: string; inline: boolean }, SerializedLexicalNode>;

export const INSERT_MATH_COMMAND: LexicalCommand<{ latex: string; inline?: boolean }> =
  createCommand('INSERT_MATH_COMMAND');

export class MathNode extends DecoratorNode<JSX.Element> {
  __latex: string;
  __inline: boolean;

  static getType(): string { return 'math'; }
  static clone(n: MathNode): MathNode { return new MathNode(n.__latex, n.__inline, n.__key); }
  constructor(latex = '', inline = false, key?: NodeKey) { super(key); this.__latex = latex; this.__inline = inline; }

  createDOM(): HTMLElement {
    const el = document.createElement(this.__inline ? 'span' : 'div');
    el.className = this.__inline ? 'npc-math-inline' : 'npc-math-block';
    return el;
  }
  updateDOM(): false { return false; }
  isInline(): boolean { return this.__inline; }

  static importJSON(j: SerializedMathNode): MathNode { return new MathNode(j.latex, j.inline); }
  exportJSON(): SerializedMathNode {
    return { type: 'math', version: 1, latex: this.__latex, inline: this.__inline };
  }

  setLatex(latex: string): void {
    this.getWritable().__latex = latex;
  }

  decorate(_editor: LexicalEditor): JSX.Element {
    return <MathComponent nodeKey={this.__key} editor={_editor} latex={this.__latex} inline={this.__inline} />;
  }
}

function MathComponent({ nodeKey, editor, latex, inline }: {
  nodeKey: NodeKey; editor: LexicalEditor; latex: string; inline: boolean;
}) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const [editing, setEditing] = useState(!latex);
  const [draft, setDraft] = useState(latex);

  useEffect(() => setDraft(latex), [latex]);

  function save() {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isMathNode(node)) node.setLatex(draft);
    });
    setEditing(false);
  }

  useEffect(() => {
    if (!editing && containerRef.current && latex) {
      try {
        katex.render(latex, containerRef.current, { displayMode: !inline, throwOnError: false });
      } catch { /* silently ignore */ }
    }
  }, [editing, latex, inline]);

  if (editing) {
    return (
      <span className="npc-math-editor" contentEditable={false}>
        <input autoFocus className="npc-math-input" value={draft}
          placeholder="LaTeX, ex: E = mc^2"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); save(); }
            if (e.key === 'Escape') setEditing(false);
          }}
          onBlur={save}
        />
      </span>
    );
  }

  return (
    <span ref={containerRef} className={inline ? 'npc-math-rendered-inline' : 'npc-math-rendered-block'}
      onClick={() => setEditing(true)} title="Clique para editar">
      {!latex && <span className="npc-math-placeholder">math</span>}
    </span>
  );
}

export function $createMathNode(latex = '', inline = false): MathNode {
  return $applyNodeReplacement(new MathNode(latex, inline));
}
export function $isMathNode(n: LexicalNode | null | undefined): n is MathNode { return n instanceof MathNode; }
