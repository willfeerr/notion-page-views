import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useClickOutside } from '../useClickOutside';

interface PopoverProps {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  children: (props: { close: () => void }) => ReactNode;
  align?: 'left' | 'right';
}

/** Self-contained dropdown: renders a trigger and, when open, a panel anchored below it. */
export function Popover({ trigger, children, align = 'left' }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(wrapperRef, close, open);

  return (
    <div className="npc-popover-wrapper" ref={wrapperRef}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div className={`npc-popover-panel npc-popover-${align}`} role="menu">
          {children({ close })}
        </div>
      )}
    </div>
  );
}
