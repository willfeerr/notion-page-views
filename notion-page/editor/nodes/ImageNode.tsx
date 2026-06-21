'use client';

import type { JSX } from 'react';
import {
  $applyNodeReplacement, $getNodeByKey, DecoratorNode,
  type DOMConversionMap, type DOMExportOutput,
  type LexicalEditor, type LexicalNode,
  type NodeKey, type SerializedLexicalNode, type Spread, createCommand, type LexicalCommand,
} from 'lexical';
import { useEffect, useState } from 'react';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';

export type SerializedImageNode = Spread<
  { src: string; altText: string; caption?: string; width?: number | 'auto'; },
  SerializedLexicalNode
>;

export const INSERT_IMAGE_COMMAND: LexicalCommand<{ src: string; altText?: string }> =
  createCommand('INSERT_IMAGE_COMMAND');

export class ImageNode extends DecoratorNode<JSX.Element> {
  __src: string;
  __altText: string;
  __caption: string;
  __width: number | 'auto';

  static getType(): string { return 'image'; }
  static clone(n: ImageNode): ImageNode {
    return new ImageNode(n.__src, n.__altText, n.__caption, n.__width, n.__key);
  }
  constructor(src: string, alt = '', caption = '', width: number | 'auto' = 'auto', key?: NodeKey) {
    super(key);
    this.__src = src;
    this.__altText = alt;
    this.__caption = caption;
    this.__width = width;
  }

  createDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'npc-image-wrapper';
    return span;
  }
  updateDOM(): false { return false; }
  isInline(): boolean { return false; }

  static importJSON(j: SerializedImageNode): ImageNode {
    return $createImageNode({ src: j.src, altText: j.altText, caption: j.caption, width: j.width });
  }
  exportJSON(): SerializedImageNode {
    return { type: 'image', version: 1, src: this.__src, altText: this.__altText, caption: this.__caption, width: this.__width };
  }
  exportDOM(): DOMExportOutput {
    const el = document.createElement('img');
    el.src = this.__src; el.alt = this.__altText;
    return { element: el };
  }
  static importDOM(): DOMConversionMap { return {}; }

  setCaption(caption: string): void {
    this.getWritable().__caption = caption;
  }

  decorate(_editor: LexicalEditor): JSX.Element {
    return (
      <ImageComponent
        nodeKey={this.__key}
        editor={_editor}
        src={this.__src}
        altText={this.__altText}
        caption={this.__caption}
        width={this.__width}
      />
    );
  }
}

function ImageComponent({ nodeKey, editor, src, altText, caption, width }: {
  nodeKey: NodeKey; editor: LexicalEditor; src: string; altText: string; caption: string;
  width: number | 'auto';
}) {
  const [isSelected, setSelected] = useLexicalNodeSelection(nodeKey);
  const [editingCaption, setEditingCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState(caption);

  useEffect(() => setCaptionDraft(caption), [caption]);

  function saveCaption() {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isImageNode(node)) node.setCaption(captionDraft);
    });
    setEditingCaption(false);
  }

  return (
    <figure
      className={`npc-image-figure ${isSelected ? 'is-selected' : ''}`}
      style={{ width: width === 'auto' ? '100%' : `${width}px` }}
      onClick={() => setSelected(!isSelected)}
    >
      <img src={src} alt={altText} className="npc-image-img" draggable={false} />
      <figcaption className="npc-image-caption">
        {editingCaption ? (
          <input autoFocus className="npc-image-caption-input" value={captionDraft}
            onChange={(e) => setCaptionDraft(e.target.value)}
            onBlur={saveCaption}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveCaption(); } }}
          />
        ) : (
          <span className={captionDraft ? 'npc-image-caption-text' : 'npc-image-caption-placeholder'}
            onClick={(e) => { e.stopPropagation(); setEditingCaption(true); }}>
            {captionDraft || 'Adicionar legenda…'}
          </span>
        )}
      </figcaption>
    </figure>
  );
}

export function $createImageNode({ src, altText = '', caption = '', width = 'auto' }: {
  src: string; altText?: string; caption?: string; width?: number | 'auto';
}): ImageNode {
  return $applyNodeReplacement(new ImageNode(src, altText, caption, width));
}
export function $isImageNode(n: LexicalNode | null | undefined): n is ImageNode { return n instanceof ImageNode; }
