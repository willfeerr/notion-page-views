import { useEffect, type RefObject } from 'react';

/** Calls `handler` on mousedown outside `ref`, and on Escape. Only active while `active` is true. */
export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  handler: () => void,
  active: boolean,
) {
  useEffect(() => {
    if (!active) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (ref.current && !ref.current.contains(target)) {
        handler();
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') handler();
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [active, handler, ref]);
}
