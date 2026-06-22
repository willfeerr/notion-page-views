'use client';

import {
  type EditorConfig,
  ElementNode,
  type LexicalNode,
  type NodeKey,
  type SerializedElementNode,
  type Spread,
} from 'lexical';

export type CalloutColor =
  | 'gray' | 'brown' | 'orange' | 'yellow' | 'green'
  | 'blue' | 'purple' | 'pink' | 'red' | 'default';

export type SerializedCalloutNode = Spread<
  { emoji: string; calloutColor: CalloutColor },
  SerializedElementNode
>;

/** Notion-style callout box: emoji icon + colored background. */
export class CalloutNode extends ElementNode {
  __emoji: string;
  __calloutColor: CalloutColor;

  static getType(): string { return 'callout'; }

  static clone(node: CalloutNode): CalloutNode {
    return new CalloutNode(node.__emoji, node.__calloutColor, node.__key);
  }

  constructor(emoji = '💡', color: CalloutColor = 'gray', key?: NodeKey) {
    super(key);
    this.__emoji = emoji;
    this.__calloutColor = color;
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const el = document.createElement('div');
    el.className = `npc-callout npc-callout-${this.__calloutColor}`;
    el.dataset.lexicalCallout = 'true';
    el.dataset.emoji = this.__emoji;
    return el;
  }

  updateDOM(prev: CalloutNode, dom: HTMLElement): boolean {
    if (prev.__calloutColor !== this.__calloutColor) {
      dom.className = `npc-callout npc-callout-${this.__calloutColor}`;
    }
    if (prev.__emoji !== this.__emoji) dom.dataset.emoji = this.__emoji;
    return false;
  }

  static importJSON(json: SerializedCalloutNode): CalloutNode {
    const node = $createCalloutNode(json.emoji, json.calloutColor);
    node.setFormat(json.format);
    node.setIndent(json.indent);
    node.setDirection(json.direction);
    return node;
  }

  exportJSON(): SerializedCalloutNode {
    return {
      ...super.exportJSON(),
      emoji: this.__emoji,
      calloutColor: this.__calloutColor,
      type: 'callout',
      version: 1,
    };
  }

  getEmoji(): string { return this.getLatest().__emoji; }
  getCalloutColor(): CalloutColor { return this.getLatest().__calloutColor; }

  setEmoji(emoji: string) {
    const writable = this.getWritable();
    writable.__emoji = emoji;
  }

  setCalloutColor(color: CalloutColor) {
    const writable = this.getWritable();
    writable.__calloutColor = color;
  }
}

export function $createCalloutNode(emoji = '💡', color: CalloutColor = 'gray'): CalloutNode {
  return new CalloutNode(emoji, color);
}

export function $isCalloutNode(node: LexicalNode | null | undefined): node is CalloutNode {
  return node instanceof CalloutNode;
}
