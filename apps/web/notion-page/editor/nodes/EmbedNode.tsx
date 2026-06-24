'use client';

import type { JSX } from 'react';
import {
  $applyNodeReplacement, DecoratorNode,
  type LexicalEditor, type LexicalNode,
  type NodeKey, type SerializedLexicalNode, type Spread, createCommand, type LexicalCommand,
} from 'lexical';
import { useState } from 'react';
import { ExternalLink, Video } from 'lucide-react';
import { WorkspaceComponent } from './WorkspaceComponentNode';

export type EmbedType = 'youtube' | 'page' | 'board' | 'generic';

export type SerializedEmbedNode = Spread<
  { url: string; embedType: EmbedType; title?: string },
  SerializedLexicalNode
>;

export const INSERT_EMBED_COMMAND: LexicalCommand<{ url: string }> =
  createCommand('INSERT_EMBED_COMMAND');

function classifyUrl(url: string): EmbedType {
  try {
    const u = new URL(url);
    const workspaceType = u.searchParams.get('component') ?? u.searchParams.get('embed');
    if (workspaceType === 'page' || workspaceType === 'board') return workspaceType;
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) return 'youtube';
  } catch { /* ignore */ }
  return 'generic';
}

function toEmbedUrl(url: string, type: EmbedType): string {
  if (type === 'youtube') {
    try {
      const u = new URL(url);
      const vid = u.searchParams.get('v') ?? u.pathname.split('/').pop() ?? '';
      return `https://www.youtube.com/embed/${vid}`;
    } catch { /* ignore */ }
  }
  return url;
}

export class EmbedNode extends DecoratorNode<JSX.Element> {
  __url: string;
  __embedType: EmbedType;
  __title: string;

  static getType(): string { return 'embed'; }
  static clone(n: EmbedNode): EmbedNode {
    return new EmbedNode(n.__url, n.__embedType, n.__title, n.__key);
  }
  constructor(url: string, type: EmbedType = 'generic', title = '', key?: NodeKey) {
    super(key); this.__url = url; this.__embedType = type; this.__title = title;
  }

  createDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'npc-embed-wrapper';
    return span;
  }
  updateDOM(): false { return false; }
  isInline(): boolean { return false; }

  static importJSON(j: SerializedEmbedNode): EmbedNode {
    return new EmbedNode(j.url, j.embedType, j.title);
  }
  exportJSON(): SerializedEmbedNode {
    return { type: 'embed', version: 1, url: this.__url, embedType: this.__embedType, title: this.__title };
  }

  decorate(_editor: LexicalEditor): JSX.Element {
    return <EmbedComponent url={this.__url} embedType={this.__embedType} title={this.__title} />;
  }
}

function EmbedComponent({ url, embedType, title }: { url: string; embedType: EmbedType; title: string }) {
  const [error, setError] = useState(false);
  const embedUrl = toEmbedUrl(url, embedType);

  if (embedType === 'youtube') {
    return (
      <div className="npc-embed npc-embed-youtube">
        <div className="npc-embed-header">
          <Video size={14} className="npc-embed-type-icon" />
          <span className="npc-embed-title">{title || 'YouTube'}</span>
          <a href={url} target="_blank" rel="noreferrer" className="npc-embed-link-btn"><ExternalLink size={12} /></a>
        </div>
        <div className="npc-embed-ratio">
          {error
            ? <div className="npc-embed-error">Não foi possível carregar o vídeo.</div>
            : <iframe src={embedUrl} title={title || 'YouTube embed'}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen className="npc-embed-iframe" onError={() => setError(true)} />
          }
        </div>
      </div>
    );
  }

  if (embedType === 'page' || embedType === 'board') {
    let targetId = url;
    try { targetId = new URL(url).searchParams.get('id') || url; } catch { /* use raw value */ }
    return <WorkspaceComponent componentType={embedType} targetId={targetId} title={title} />;
  }

  return (
    <div className="npc-embed npc-embed-generic">
      <div className="npc-embed-header">
        <ExternalLink size={14} className="npc-embed-type-icon" />
        <a href={url} target="_blank" rel="noreferrer" className="npc-embed-generic-link">
          {title || url}
        </a>
      </div>
    </div>
  );
}

export function $createEmbedNode(url: string): EmbedNode {
  const type = classifyUrl(url);
  return $applyNodeReplacement(new EmbedNode(url, type, ''));
}
export function $isEmbedNode(n: LexicalNode | null | undefined): n is EmbedNode { return n instanceof EmbedNode; }
