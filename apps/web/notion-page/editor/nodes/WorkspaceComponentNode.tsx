'use client';

import type { JSX } from 'react';
import {
  $applyNodeReplacement, createCommand, DecoratorNode,
  type LexicalCommand, type LexicalEditor, type LexicalNode,
  type NodeKey, type SerializedLexicalNode, type Spread,
} from 'lexical';
import { ArrowRight, Columns3, FileText } from 'lucide-react';

export type WorkspaceComponentType = 'page' | 'board';

export type SerializedWorkspaceComponentNode = Spread<
  { componentType: WorkspaceComponentType; targetId: string; title?: string },
  SerializedLexicalNode
>;

export const INSERT_WORKSPACE_COMPONENT_COMMAND: LexicalCommand<{
  componentType: WorkspaceComponentType;
  targetId: string;
  title?: string;
}> = createCommand('INSERT_WORKSPACE_COMPONENT_COMMAND');

export class WorkspaceComponentNode extends DecoratorNode<JSX.Element> {
  __componentType: WorkspaceComponentType;
  __targetId: string;
  __title: string;

  static getType(): string { return 'workspace-component'; }

  static clone(node: WorkspaceComponentNode): WorkspaceComponentNode {
    return new WorkspaceComponentNode(node.__componentType, node.__targetId, node.__title, node.__key);
  }

  constructor(componentType: WorkspaceComponentType, targetId: string, title = '', key?: NodeKey) {
    super(key);
    this.__componentType = componentType;
    this.__targetId = targetId;
    this.__title = title;
  }

  createDOM(): HTMLElement {
    const element = document.createElement('div');
    element.className = 'npc-workspace-component-wrapper';
    return element;
  }

  updateDOM(): false { return false; }
  isInline(): boolean { return false; }

  static importJSON(value: SerializedWorkspaceComponentNode): WorkspaceComponentNode {
    return new WorkspaceComponentNode(value.componentType, value.targetId, value.title);
  }

  exportJSON(): SerializedWorkspaceComponentNode {
    return {
      type: 'workspace-component', version: 1,
      componentType: this.__componentType, targetId: this.__targetId, title: this.__title,
    };
  }

  decorate(_editor: LexicalEditor): JSX.Element {
    return <WorkspaceComponent componentType={this.__componentType} targetId={this.__targetId} title={this.__title} />;
  }
}

export function WorkspaceComponent({ componentType, targetId, title }: {
  componentType: WorkspaceComponentType;
  targetId: string;
  title?: string;
}) {
  const Icon = componentType === 'board' ? Columns3 : FileText;
  const label = componentType === 'board' ? 'Board' : 'Pagina';

  function openTarget() {
    window.dispatchEvent(new CustomEvent('skrbe:open-workspace-component', {
      detail: { componentType, targetId },
    }));
  }

  return (
    <button type="button" className={`npc-workspace-component is-${componentType}`} onClick={openTarget}>
      <span className="npc-workspace-component-icon"><Icon size={17} strokeWidth={1.7} /></span>
      <span className="npc-workspace-component-copy">
        <strong>{title || targetId}</strong>
        <small>{label} do workspace</small>
      </span>
      <ArrowRight size={15} className="npc-workspace-component-open" />
    </button>
  );
}

export function $createWorkspaceComponentNode(
  componentType: WorkspaceComponentType,
  targetId: string,
  title = '',
): WorkspaceComponentNode {
  return $applyNodeReplacement(new WorkspaceComponentNode(componentType, targetId, title));
}

export function $isWorkspaceComponentNode(node: LexicalNode | null | undefined): node is WorkspaceComponentNode {
  return node instanceof WorkspaceComponentNode;
}
