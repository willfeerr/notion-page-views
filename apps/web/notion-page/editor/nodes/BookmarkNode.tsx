'use client';

import type { JSX } from 'react';
import {
  $applyNodeReplacement, DecoratorNode,
  type LexicalEditor, type LexicalNode,
  type NodeKey, type SerializedLexicalNode, type Spread, createCommand, type LexicalCommand,
} from 'lexical';
import { ExternalLink, BookmarkIcon } from 'lucide-react';

export type SerializedBookmarkNode = Spread<
  { url: string; title: string; description: string; favicon: string; },
  SerializedLexicalNode
>;

export const INSERT_BOOKMARK_COMMAND: LexicalCommand<{ url: string }> =
  createCommand('INSERT_BOOKMARK_COMMAND');

export class BookmarkNode extends DecoratorNode<JSX.Element> {
  __url: string;
  __title: string;
  __description: string;
  __favicon: string;

  static getType(): string { return 'bookmark'; }
  static clone(n: BookmarkNode): BookmarkNode {
    return new BookmarkNode(n.__url, n.__title, n.__description, n.__favicon, n.__key);
  }
  constructor(url: string, title = '', description = '', favicon = '', key?: NodeKey) {
    super(key);
    this.__url = url; this.__title = title;
    this.__description = description; this.__favicon = favicon;
  }

  createDOM(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'npc-bookmark-wrapper';
    return el;
  }
  updateDOM(): false { return false; }
  isInline(): false { return false; }

  static importJSON(j: SerializedBookmarkNode): BookmarkNode {
    return new BookmarkNode(j.url, j.title, j.description, j.favicon);
  }
  exportJSON(): SerializedBookmarkNode {
    return {
      type: 'bookmark', version: 1,
      url: this.__url, title: this.__title,
      description: this.__description, favicon: this.__favicon,
    };
  }

  decorate(_editor: LexicalEditor): JSX.Element {
    return (
      <BookmarkComponent
        url={this.__url} title={this.__title}
        description={this.__description} favicon={this.__favicon}
      />
    );
  }
}

function BookmarkComponent({ url, title, description, favicon }: {
  url: string; title: string; description: string; favicon: string;
}) {
  const displayTitle = title || url;
  const host = (() => { try { return new URL(url).hostname; } catch { return url; } })();

  return (
    <a
      href={url} target="_blank" rel="noreferrer"
      className="npc-bookmark"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="npc-bookmark-text">
        <div className="npc-bookmark-title">{displayTitle}</div>
        {description && <div className="npc-bookmark-description">{description}</div>}
        <div className="npc-bookmark-url">
          {favicon
            ? <img src={favicon} alt="" className="npc-bookmark-favicon" />
            : <BookmarkIcon size={12} className="npc-bookmark-favicon-placeholder" />
          }
          {host}
          <ExternalLink size={11} className="npc-bookmark-external" />
        </div>
      </div>
    </a>
  );
}

export function $createBookmarkNode(url: string, title = '', description = '', favicon = ''): BookmarkNode {
  return $applyNodeReplacement(new BookmarkNode(url, title, description, favicon));
}
export function $isBookmarkNode(n: LexicalNode | null | undefined): n is BookmarkNode {
  return n instanceof BookmarkNode;
}
