'use client';

import {
  type EditorConfig, type NodeKey, type SerializedLexicalNode, type Spread,
  DecoratorNode, type LexicalEditor,
  $applyNodeReplacement, createCommand, type LexicalCommand,
} from 'lexical';
import type { JSX } from 'react';
import { useState } from 'react';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import type { HeadingTagType } from '@lexical/rich-text';

export type SerializedToggleHeadingNode = Spread<
  { tag: HeadingTagType; open: boolean },
  SerializedLexicalNode
>;

export const INSERT_TOGGLE_HEADING_COMMAND: LexicalCommand<{ tag: HeadingTagType }> =
  createCommand('INSERT_TOGGLE_HEADING_COMMAND');

/**
 * Toggle Heading — a heading (h1/h2/h3) that collapses the content below it.
 * Implemented as a DecoratorNode so it can manage its own open/closed state
 * and render both the heading and the collapse arrow.
 *
 * Content collapsing is visual-only via CSS on a wrapper div — the Lexical nodes
 * beneath it remain in the tree so they're always serialized/synced correctly.
 */
export class ToggleHeadingNode extends DecoratorNode<JSX.Element> {
  __tag: HeadingTagType;
  __open: boolean;

  static getType(): string { return 'toggle-heading'; }
  static clone(n: ToggleHeadingNode): ToggleHeadingNode {
    return new ToggleHeadingNode(n.__tag, n.__open, n.__key);
  }

  constructor(tag: HeadingTagType = 'h1', open = true, key?: NodeKey) {
    super(key);
    this.__tag = tag;
    this.__open = open;
  }

  createDOM(_: EditorConfig): HTMLElement {
    const el = document.createElement('div');
    el.className = `npc-toggle-heading npc-toggle-heading-${this.__tag}`;
    el.dataset.open = String(this.__open);
    return el;
  }
  updateDOM(prev: ToggleHeadingNode, dom: HTMLElement): boolean {
    if (prev.__open !== this.__open) dom.dataset.open = String(this.__open);
    if (prev.__tag !== this.__tag) {
      dom.className = `npc-toggle-heading npc-toggle-heading-${this.__tag}`;
    }
    return false;
  }
  isInline(): boolean { return false; }

  static importJSON(j: SerializedToggleHeadingNode): ToggleHeadingNode {
    return new ToggleHeadingNode(j.tag, j.open);
  }
  exportJSON(): SerializedToggleHeadingNode {
    return { type: 'toggle-heading', version: 1, tag: this.__tag, open: this.__open };
  }

  getTag(): HeadingTagType { return this.getLatest().__tag; }
  isOpen(): boolean { return this.getLatest().__open; }

  toggleOpen() {
    const w = this.getWritable();
    w.__open = !this.getLatest().__open;
  }

  decorate(_editor: LexicalEditor): JSX.Element {
    return (
      <ToggleHeadingComponent
        nodeKey={this.__key}
        tag={this.__tag}
        open={this.__open}
      />
    );
  }
}

function ToggleHeadingComponent({ nodeKey, tag, open }: {
  nodeKey: NodeKey; tag: HeadingTagType; open: boolean;
}) {
  const [editor] = useLexicalComposerContext();
  const [, setSelected] = useLexicalNodeSelection(nodeKey);
  const [localOpen, setLocalOpen] = useState(open);

  function toggle() {
    const next = !localOpen;
    setLocalOpen(next);
    editor.update(() => {
      const node = editor.getEditorState()._nodeMap.get(nodeKey);
      if (node instanceof ToggleHeadingNode) node.toggleOpen();
    });
  }

  const Tag = tag as 'h1' | 'h2' | 'h3';

  return (
    <Tag
      className={`npc-editor-${tag} npc-toggle-heading-title`}
      onClick={() => setSelected(true)}
    >
      <button
        type="button"
        className={`npc-toggle-heading-arrow ${localOpen ? 'is-open' : ''}`}
        onClick={(e) => { e.stopPropagation(); toggle(); }}
        contentEditable={false}
        aria-label={localOpen ? 'Colapsar' : 'Expandir'}
      >▶</button>
      <span className="npc-toggle-heading-content" contentEditable suppressContentEditableWarning />
    </Tag>
  );
}

export function $createToggleHeadingNode(tag: HeadingTagType = 'h1', open = true): ToggleHeadingNode {
  return $applyNodeReplacement(new ToggleHeadingNode(tag, open));
}
export function $isToggleHeadingNode(n: unknown): n is ToggleHeadingNode {
  return n instanceof ToggleHeadingNode;
}
