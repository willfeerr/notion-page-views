'use client';

import type { JSX } from 'react';
import {
  $applyNodeReplacement, DecoratorNode,
  type LexicalEditor, type LexicalNode,
  type NodeKey, type SerializedLexicalNode, type Spread,
} from 'lexical';

export type SerializedMentionNode = Spread<
  { mentionId: string; mentionName: string; mentionType: 'person' | 'page' },
  SerializedLexicalNode
>;

export class MentionNode extends DecoratorNode<JSX.Element> {
  __mentionId: string;
  __mentionName: string;
  __mentionType: 'person' | 'page';

  static getType(): string { return 'mention'; }
  static clone(n: MentionNode): MentionNode {
    return new MentionNode(n.__mentionId, n.__mentionName, n.__mentionType, n.__key);
  }
  constructor(id: string, name: string, type: 'person' | 'page' = 'person', key?: NodeKey) {
    super(key);
    this.__mentionId = id; this.__mentionName = name; this.__mentionType = type;
  }

  createDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'npc-mention';
    return span;
  }
  updateDOM(): false { return false; }
  isInline(): boolean { return true; }

  static importJSON(j: SerializedMentionNode): MentionNode {
    return new MentionNode(j.mentionId, j.mentionName, j.mentionType);
  }
  exportJSON(): SerializedMentionNode {
    return { type: 'mention', version: 1, mentionId: this.__mentionId, mentionName: this.__mentionName, mentionType: this.__mentionType };
  }

  decorate(_editor: LexicalEditor): JSX.Element {
    return (
      <span className={`npc-mention-chip npc-mention-${this.__mentionType}`} contentEditable={false}>
        {this.__mentionType === 'person' ? '@' : ''}{this.__mentionName}
      </span>
    );
  }
}

export function $createMentionNode(id: string, name: string, type: 'person' | 'page' = 'person'): MentionNode {
  return $applyNodeReplacement(new MentionNode(id, name, type));
}
export function $isMentionNode(n: LexicalNode | null | undefined): n is MentionNode { return n instanceof MentionNode; }
