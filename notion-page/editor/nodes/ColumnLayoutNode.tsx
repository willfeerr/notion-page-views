'use client';

import {
  $applyNodeReplacement, ElementNode,
  type EditorConfig, type LexicalNode, type NodeKey,
  type SerializedElementNode, type Spread, createCommand, type LexicalCommand,
} from 'lexical';

export type ColumnCount = 2 | 3 | 4;

export type SerializedColumnLayoutNode = Spread<
  { columnCount: ColumnCount }, SerializedElementNode
>;

export const INSERT_COLUMN_LAYOUT_COMMAND: LexicalCommand<{ columns: ColumnCount }> =
  createCommand('INSERT_COLUMN_LAYOUT_COMMAND');

/** Container for column layout — children are ColumnNode instances. */
export class ColumnLayoutNode extends ElementNode {
  __columnCount: ColumnCount;

  static getType(): string { return 'column-layout'; }
  static clone(n: ColumnLayoutNode): ColumnLayoutNode {
    return new ColumnLayoutNode(n.__columnCount, n.__key);
  }
  constructor(cols: ColumnCount = 2, key?: NodeKey) { super(key); this.__columnCount = cols; }

  createDOM(_: EditorConfig): HTMLElement {
    const el = document.createElement('div');
    el.className = `npc-column-layout npc-columns-${this.__columnCount}`;
    return el;
  }
  updateDOM(prev: ColumnLayoutNode, dom: HTMLElement): boolean {
    if (prev.__columnCount !== this.__columnCount) {
      dom.className = `npc-column-layout npc-columns-${this.__columnCount}`;
    }
    return false;
  }

  static importJSON(j: SerializedColumnLayoutNode): ColumnLayoutNode {
    return new ColumnLayoutNode(j.columnCount);
  }
  exportJSON(): SerializedColumnLayoutNode {
    return { ...super.exportJSON(), type: 'column-layout', columnCount: this.__columnCount, version: 1 };
  }
  isShadowRoot(): boolean { return false; }
}

/** A single column inside ColumnLayoutNode. */
export class ColumnNode extends ElementNode {
  static getType(): string { return 'column'; }
  static clone(n: ColumnNode): ColumnNode { return new ColumnNode(n.__key); }

  createDOM(_: EditorConfig): HTMLElement {
    const el = document.createElement('div');
    el.className = 'npc-column';
    return el;
  }
  updateDOM(): false { return false; }

  static importJSON(): ColumnNode { return new ColumnNode(); }
  exportJSON() { return { ...super.exportJSON(), type: 'column', version: 1 }; }
}

export function $createColumnLayoutNode(cols: ColumnCount = 2): ColumnLayoutNode {
  return $applyNodeReplacement(new ColumnLayoutNode(cols));
}
export function $createColumnNode(): ColumnNode {
  return $applyNodeReplacement(new ColumnNode());
}
export function $isColumnLayoutNode(n: LexicalNode | null | undefined): n is ColumnLayoutNode {
  return n instanceof ColumnLayoutNode;
}
export function $isColumnNode(n: LexicalNode | null | undefined): n is ColumnNode {
  return n instanceof ColumnNode;
}
