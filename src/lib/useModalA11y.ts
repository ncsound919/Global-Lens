import { useEffect, useRef } from 'react';

/**
 * Modal accessibility plumbing: focus the dialog panel on open, lock background
 * scroll, restore scroll on close, and close on Escape. Returns a ref to attach
 * to the dialog panel (tabIndex={-1} so it can receive focus).
 */
export function useModalA11y(onClose: () => void) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return panelRef;
}