'use client';

/**
 * Block-level context menu: appears as a ⋮ button next to the drag handle.
 * Wraps DraggableBlockPlugin_EXPERIMENTAL from @lexical/react and adds
 * a "Transform to" submenu + Delete / Duplicate actions.
 */

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { DraggableBlockPlugin_EXPERIMENTAL } from '@lexical/react/LexicalDraggableBlockPlugin';
import {
  $getNodeByKey, $getRoot, $createParagraphNode, $isElementNode,
  type LexicalNode,
} from 'lexical';
import { $createHeadingNode, $createQuoteNode } from '@lexical/rich-text';
import { $createCodeNode } from '@lexical/code';
import {
  GripVertical, MoreHorizontal, Heading1, Heading2, Heading3,
  Pilcrow, Quote, Code, Trash2, Copy,
} from 'lucide-react';
import { useClickOutside } from '../useClickOutside';

const MENU_TARGET_LINE_CLASS = 'npc-drag-target-line';
const DRAG_HANDLE_CLASS = 'npc-drag-handle';

interface BlockMenuProps {
  anchorElem: HTMLElement;
}

type TransformItem = {
  label: string;
  icon: typeof Pilcrow;
  transform: (node: LexicalNode) => LexicalNode;
};

const TRANSFORMS: TransformItem[] = [
  { label: 'Parágrafo', icon: Pilcrow, transform: () => $createParagraphNode() },
  { label: 'Título 1', icon: Heading1, transform: () => $createHeadingNode('h1') },
  { label: 'Título 2', icon: Heading2, transform: () => $createHeadingNode('h2') },
  { label: 'Título 3', icon: Heading3, transform: () => $createHeadingNode('h3') },
  { label: 'Citação', icon: Quote, transform: () => $createQuoteNode() },
  { label: 'Código', icon: Code, transform: () => $createCodeNode() },
];

export function BlockMenuPlugin({ anchorElem }: BlockMenuProps) {
  const [editor] = useLexicalComposerContext();
  const menuRef = useRef<HTMLDivElement>(null);
  const targetLineRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [activeNodeKey, setActiveNodeKey] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  useClickOutside(popoverRef, () => setMenuOpen(false), menuOpen);

  function resolveNodeKeyFromPoint(clientX: number, clientY: number): string | null {
    const elementAtPoint = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    const elementKey = elementAtPoint?.closest('[data-lexical-node-key]')?.getAttribute('data-lexical-node-key');
    if (elementKey) return elementKey;

    let resolvedKey: string | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;
    editor.getEditorState().read(() => {
      for (const child of $getRoot().getChildren()) {
        const domEl = editor.getElementByKey(child.getKey());
        if (!domEl) continue;
        const rect = domEl.getBoundingClientRect();
        if (clientY >= rect.top - 6 && clientY <= rect.bottom + 6) {
          resolvedKey = child.getKey();
          closestDistance = 0;
          break;
        }
        const distance = Math.abs(clientY - (rect.top + rect.height / 2));
        if (distance < closestDistance) {
          closestDistance = distance;
          resolvedKey = child.getKey();
        }
      }
    });
    return resolvedKey;
  }

  function openMenu(e: React.MouseEvent, nodeKey: string | null) {
    if (!nodeKey) return;
    e.preventDefault();
    e.stopPropagation();
    setActiveNodeKey(nodeKey);
    setMenuPos({ top: e.clientY, left: e.clientX + 10 });
    setMenuOpen(true);
  }

  function transformNode(transform: TransformItem['transform']) {
    if (!activeNodeKey) return;
    editor.update(() => {
      const node = $getNodeByKey(activeNodeKey);
      if (!node) return;
      const newNode = transform(node);
      if ($isElementNode(node) && $isElementNode(newNode)) {
        node.getChildren().forEach((child) => newNode.append(child));
      }
      node.replace(newNode);
    });
    setMenuOpen(false);
  }

  function duplicateNode() {
    if (!activeNodeKey) return;
    editor.update(() => {
      const node = $getNodeByKey(activeNodeKey);
      if (!node) return;
      const cloned = $createParagraphNode(); // simple para fallback — real duplicate needs per-node logic
      node.insertAfter(cloned);
    });
    setMenuOpen(false);
  }

  function deleteNode() {
    if (!activeNodeKey) return;
    editor.update(() => { $getNodeByKey(activeNodeKey)?.remove(); });
    setMenuOpen(false);
  }

  const dragMenu = (
    <div ref={menuRef} className={DRAG_HANDLE_CLASS}>
      <GripVertical size={16} strokeWidth={1.5} className="npc-drag-grip" />
      <button
        type="button"
        className="npc-block-menu-btn"
        title="Ações do bloco"
        onClick={(e) => openMenu(e, resolveNodeKeyFromPoint(e.clientX + 42, e.clientY))}
      >
        <MoreHorizontal size={14} />
      </button>
    </div>
  );

  const targetLine = (
    <div ref={targetLineRef} className={MENU_TARGET_LINE_CLASS} />
  );

  return (
    <>
      <DraggableBlockPlugin_EXPERIMENTAL
        anchorElem={anchorElem}
        menuRef={menuRef}
        targetLineRef={targetLineRef}
        menuComponent={dragMenu}
        targetLineComponent={targetLine}
        isOnMenu={(el) => el.closest(`.${DRAG_HANDLE_CLASS}`) !== null}
      />
      {menuOpen && createPortal(
        <div ref={popoverRef} className="npc-block-context-menu" style={{ top: menuPos.top, left: menuPos.left }}>
          <div className="npc-block-menu-group-label">Transformar em</div>
          {TRANSFORMS.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.label} type="button" className="npc-block-menu-item" onClick={() => transformNode(t.transform)}>
                <Icon size={14} />{t.label}
              </button>
            );
          })}
          <div className="npc-block-menu-sep" />
          <button type="button" className="npc-block-menu-item" onClick={duplicateNode}>
            <Copy size={14} />Duplicar
          </button>
          <button type="button" className="npc-block-menu-item npc-block-menu-item-danger" onClick={deleteNode}>
            <Trash2 size={14} />Deletar
          </button>
        </div>,
        document.body,
      )}
    </>
  );
}
