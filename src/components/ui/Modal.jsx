import { useEffect, useRef } from 'react';

/**
 * Native modal <dialog>: the browser traps focus, handles Escape and makes the page inert.
 * `initialFocusRef` receives focus on open; the browser restores focus to the opener on close.
 */
export default function Modal({ open, labelledBy, onClose, initialFocusRef, children, className = '' }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog.open) {
      dialog.showModal();
      initialFocusRef?.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, initialFocusRef]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onClose={onClose}
      className={`modal m-auto w-[min(92vw,27rem)] rounded-[12px] bg-paper p-0 text-ink shadow-[var(--shadow-paper)] ${className}`}
    >
      {children}
    </dialog>
  );
}
