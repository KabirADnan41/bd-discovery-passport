import { useRef } from 'react';
import Modal from './Modal';

export default function ConfirmDialog({ open, title, children, confirmLabel, cancelLabel = 'Cancel', busy = false, error, onConfirm, onCancel }) {
  const cancelRef = useRef(null); // safest default for a destructive action
  return (
    <Modal open={open} labelledBy="confirm-title" onClose={onCancel} initialFocusRef={cancelRef}>
      <div className="px-6 pt-6 pb-5">
        <h2 id="confirm-title" className="text-[1.3rem] font-semibold">
          {title}
        </h2>
        <div className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">{children}</div>
        {error && (
          <p role="alert" className="mt-3 text-[0.9rem] font-medium text-stamp">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button ref={cancelRef} type="button" className="btn btn-quiet" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
