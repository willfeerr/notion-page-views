'use client';

import {
  ElementNode,
  type LexicalNode,
  type NodeKey,
  type SerializedElementNode,
  type Spread,
  $applyNodeReplacement,
} from 'lexical';

export class ToggleContainerNode extends ElementNode {
  __open: boolean;

  static getType(): string { return 'toggle-container'; }
  static clone(n: ToggleContainerNode): ToggleContainerNode {
    return new ToggleContainerNode(n.__open, n.__key);
  }
  constructor(open = true, key?: NodeKey) { super(key); this.__open = open; }

  createDOM(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'npc-toggle-container';
    el.dataset.open = String(this.__open);
    return el;
  }
  updateDOM(prev: ToggleContainerNode, dom: HTMLElement): boolean {
    if (prev.__open !== this.__open) dom.dataset.open = String(this.__open);
    return false;
  }

  static importJSON(json: Spread<{ open: boolean }, SerializedElementNode>): ToggleContainerNode {
    return new ToggleContainerNode(json.open);
  }
  exportJSON() {
    return { ...super.exportJSON(), type: 'toggle-container', open: this.__open, version: 1 };
  }

  isOpen(): boolean { return this.getLatest().__open; }
  toggleOpen() { this.getWritable().__open = !this.getLatest().__open; }
  setOpen(open: boolean) { this.getWritable().__open = open; }
}

export class ToggleTitleNode extends ElementNode {
  static getType(): string { return 'toggle-title'; }
  static clone(n: ToggleTitleNode): ToggleTitleNode { return new ToggleTitleNode(n.__key); }
  createDOM(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'npc-toggle-title';
    return el;
  }
  updateDOM(): boolean { return false; }
  static importJSON(): ToggleTitleNode { return new ToggleTitleNode(); }
  exportJSON() { return { ...super.exportJSON(), type: 'toggle-title', version: 1 }; }
  isShadowRoot(): boolean { return true; }
}

export class ToggleContentNode extends ElementNode {
  static getType(): string { return 'toggle-content'; }
  static clone(n: ToggleContentNode): ToggleContentNode { return new ToggleContentNode(n.__key); }
  createDOM(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'npc-toggle-content';
    return el;
  }
  updateDOM(): boolean { return false; }
  static importJSON(): ToggleContentNode { return new ToggleContentNode(); }
  exportJSON() { return { ...super.exportJSON(), type: 'toggle-content', version: 1 }; }
}

export function $createToggleContainerNode(open = true): ToggleContainerNode {
  return $applyNodeReplacement(new ToggleContainerNode(open));
}
export function $createToggleTitleNode(): ToggleTitleNode {
  return $applyNodeReplacement(new ToggleTitleNode());
}
export function $createToggleContentNode(): ToggleContentNode {
  return $applyNodeReplacement(new ToggleContentNode());
}
export function $isToggleContainerNode(n: LexicalNode | null | undefined): n is ToggleContainerNode {
  return n instanceof ToggleContainerNode;
}
export function $isToggleTitleNode(n: LexicalNode | null | undefined): n is ToggleTitleNode {
  return n instanceof ToggleTitleNode;
}
export function $isToggleContentNode(n: LexicalNode | null | undefined): n is ToggleContentNode {
  return n instanceof ToggleContentNode;
}
