'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  BLUR_COMMAND, COMMAND_PRIORITY_LOW, FOCUS_COMMAND, SELECTION_CHANGE_COMMAND,
} from 'lexical';
import { mergeRegister } from '@lexical/utils';
import type { CollabConfig } from '../types';

interface CursorPosition { top: number; left: number }

export function LocalCursorLabelPlugin({ user }: Pick<CollabConfig, 'user'>) {
  const [editor] = useLexicalComposerContext();
  const [position, setPosition] = useState<CursorPosition | null>(null);
  const frameRef = useRef<number | null>(null);

  const updatePosition = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const root = editor.getRootElement();
      const selection = window.getSelection();
      if (!root || !selection?.rangeCount || !selection.anchorNode || !root.contains(selection.anchorNode)) {
        setPosition(null);
        return;
      }
      const range = selection.getRangeAt(0).cloneRange();
      const rect = range.getBoundingClientRect();
      if (!Number.isFinite(rect.left) || !Number.isFinite(rect.top)) {
        setPosition(null);
        return;
      }
      setPosition({ left: rect.left, top: rect.top });
    });
  }, [editor]);

  useEffect(() => {
    const onViewportChange = () => updatePosition();
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
    const unregister = mergeRegister(
      editor.registerUpdateListener(updatePosition),
      editor.registerCommand(SELECTION_CHANGE_COMMAND, () => { updatePosition(); return false; }, COMMAND_PRIORITY_LOW),
      editor.registerCommand(FOCUS_COMMAND, () => { updatePosition(); return false; }, COMMAND_PRIORITY_LOW),
      editor.registerCommand(BLUR_COMMAND, () => { setPosition(null); return false; }, COMMAND_PRIORITY_LOW),
    );
    return () => {
      unregister();
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [editor, updatePosition]);

  if (!position) return null;
  return createPortal(
    <span className="npc-local-cursor-label" style={{ background: user.color, left: position.left, top: position.top }}>
      {user.name} · {user.location ?? 'Corpo do documento'}
    </span>,
    document.body,
  );
}
