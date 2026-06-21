'use client';

/**
 * Floating link editor — appears when cursor is inside a LinkNode.
 * Shows the URL with edit/open/remove buttons, like Notion's link popover.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getSelection, $isRangeSelection, SELECTION_CHANGE_COMMAND, COMMAND_PRIORITY_LOW,
} from 'lexical';
import {
  $isLinkNode, TOGGLE_LINK_COMMAND, 
} from '@lexical/link';
import { $findMatchingParent, mergeRegister } from '@lexical/utils';
import { ExternalLink, Edit3, Trash2, Check, X } from 'lucide-react';
import { useClickOutside } from '../useClickOutside';

export function LinkEditorPlugin() {
  const [editor] = useLexicalComposerContext();
  const [linkUrl, setLinkUrl] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState('');
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useClickOutside(popoverRef, () => {
    setPosition(null);
    setIsEditing(false);
  }, !!position);

  const updateLinkEditor = useCallback(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) { setPosition(null); return; }

    const node = selection.anchor.getNode();
    const linkNode = $isLinkNode(node)
      ? node
      : $findMatchingParent(node, $isLinkNode);

    if (!linkNode) { setPosition(null); return; }

    setLinkUrl(linkNode.getURL());
    const dom = editor.getElementByKey(linkNode.getKey());
    if (!dom) { setPosition(null); return; }

    const rect = dom.getBoundingClientRect();
    setPosition({ top: rect.bottom + 8, left: rect.left });
  }, [editor]);

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(() => {
        editor.getEditorState().read(updateLinkEditor);
      }),
      editor.registerCommand(SELECTION_CHANGE_COMMAND, () => {
        editor.getEditorState().read(updateLinkEditor);
        return false;
      }, COMMAND_PRIORITY_LOW),
    );
  }, [editor, updateLinkEditor]);

  function saveEdit() {
    if (editDraft.trim()) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, editDraft.trim());
    }
    setIsEditing(false);
  }

  function removeLink() {
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    setPosition(null);
  }

  if (!position) return null;

  return createPortal(
    <div
      ref={popoverRef}
      className="npc-link-editor"
      style={{ top: position.top, left: position.left }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {isEditing ? (
        <div className="npc-link-edit-row">
          <input
            autoFocus
            className="npc-link-edit-input"
            value={editDraft}
            onChange={(e) => setEditDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveEdit();
              if (e.key === 'Escape') setIsEditing(false);
            }}
          />
          <button type="button" className="npc-link-edit-btn" onClick={saveEdit} title="Salvar">
            <Check size={13} strokeWidth={2.5} />
          </button>
          <button type="button" className="npc-link-edit-btn" onClick={() => setIsEditing(false)} title="Cancelar">
            <X size={13} strokeWidth={2.5} />
          </button>
        </div>
      ) : (
        <div className="npc-link-view-row">
          <a href={linkUrl} target="_blank" rel="noreferrer" className="npc-link-url-preview">
            {linkUrl}
          </a>
          <button
            type="button"
            className="npc-link-action-btn"
            title="Abrir link"
            onClick={() => window.open(linkUrl, '_blank')}
          >
            <ExternalLink size={13} />
          </button>
          <div className="npc-link-sep" />
          <button
            type="button"
            className="npc-link-action-btn"
            title="Editar link"
            onClick={() => { setEditDraft(linkUrl); setIsEditing(true); }}
          >
            <Edit3 size={13} />
          </button>
          <button
            type="button"
            className="npc-link-action-btn npc-link-action-danger"
            title="Remover link"
            onClick={removeLink}
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </div>,
    document.body,
  );
}
