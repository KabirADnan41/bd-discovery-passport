import { useId, useRef, useState } from 'react';
import Modal from '../ui/Modal';
import { errorMessage } from '../../lib/authClient';

// Deleting an account is permanent, so it asks for the password again.
export default function DeleteAccountDialog({ open, username, onDelete, onClose }) {
  const uid = useId();
  const passRef = useRef(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleClose = () => {
    setPassword('');
    setError('');
    setBusy(false);
    onClose();
  };

  const submit = async e => {
    e.preventDefault();
    if (!password) {
      setError('Enter your password to confirm.');
      return;
    }
    setBusy(true);
    const r = await onDelete(password);
    setBusy(false);
    if (!r.ok) setError(errorMessage(r));
  };

  return (
    <Modal open={open} labelledBy={`${uid}-title`} onClose={handleClose} initialFocusRef={passRef}>
      <form className="grid gap-4 px-6 pt-6 pb-6" onSubmit={submit} noValidate>
        <h2 id={`${uid}-title`} className="text-[1.3rem] font-semibold">
          Delete the account “{username}”?
        </h2>
        <p className="text-[0.95rem] leading-relaxed text-ink-2">This permanently removes your account and all of its stamps. It cannot be undone.</p>
        <div className="grid gap-1.5">
          <label htmlFor={`${uid}-pass`} className="text-[0.9rem] font-medium">
            Password
          </label>
          <input
            ref={passRef}
            id={`${uid}-pass`}
            name="password"
            type="password"
            autoComplete="current-password"
            className="field-input"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className="text-[0.9rem] font-medium text-stamp">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" className="btn btn-quiet" onClick={handleClose}>
            Keep my account
          </button>
          <button type="submit" className="btn btn-danger" disabled={busy} aria-busy={busy}>
            {busy ? 'Deleting…' : 'Delete account'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
