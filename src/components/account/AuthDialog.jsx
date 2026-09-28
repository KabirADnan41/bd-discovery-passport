import { useId, useRef, useState } from 'react';
import Modal from '../ui/Modal';
import { checkNewCredentials, errorMessage } from '../../lib/authClient';

const COPY = {
  signin: { title: 'Sign in to your passport', submit: 'Sign in', switchText: 'New here?', switchLabel: 'Create an account' },
  signup: { title: 'Create your passport account', submit: 'Create account', switchText: 'Already have an account?', switchLabel: 'Sign in' },
};

function Field({ id, label, hint, children }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-[0.9rem] font-medium">
        {label}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-[0.8rem] leading-snug text-ink-3">
          {hint}
        </p>
      )}
    </div>
  );
}


export default function AuthDialog({ mode, guestCount, onSwitchMode, onSubmit, onClose }) {
  const uid = useId();
  const firstFieldRef = useRef(null);
  const passwordRef = useRef(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // Protective default (Privacy's Blueprint): on sign-up the guest stamps are almost certainly yours; on
  // sign-in on a shared device they may be someone else's, so merging is opt-in there.
  const [mergeChoice, setMergeChoice] = useState(null);
  const mergeGuest = mergeChoice ?? mode === 'signup';
  const [agreed, setAgreed] = useState(false);
  const agreeRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const copy = COPY[mode ?? 'signin'];

  // The dialog stays mounted (so the browser restores focus on close); clear secrets whenever it closes.
  const handleClose = () => {
    setPassword('');
    setShowPassword(false);
    setMergeChoice(null);
    setAgreed(false);
    setError('');
    setBusy(false);
    onClose();
  };

  const submit = async e => {
    e.preventDefault();
    const problem =
      mode === 'signup'
        ? checkNewCredentials(username, password)
        : !username.trim()
          ? { field: 'username', message: 'Enter your username.' }
          : !password
            ? { field: 'password', message: 'Enter your password.' }
            : null;
    if (!problem && mode === 'signup' && !agreed) {
      setError('Please tick the box to agree to the terms before creating an account.');
      agreeRef.current?.focus();
      return;
    }
    if (problem) {
      setError(problem.message);
      (problem.field === 'username' ? firstFieldRef : passwordRef).current?.focus(); // focus the first error
      return;
    }
    setBusy(true);
    setError('');
    const result = await onSubmit(mode, username, password, guestCount > 0 && mergeGuest);
    setBusy(false);
    if (!result.ok) {
      setError(errorMessage(result));
      (result.status === 409 ? firstFieldRef : passwordRef).current?.focus();
    }
  };

  return (
    <Modal open={Boolean(mode)} labelledBy={`${uid}-title`} onClose={handleClose} initialFocusRef={firstFieldRef}>
      <form className="grid gap-5 px-6 pt-6 pb-6" onSubmit={submit} noValidate>
        <div>
          <h2 id={`${uid}-title`} className="text-[1.3rem] leading-tight font-semibold">
            {copy.title}
          </h2>
          <p className="mt-1.5 text-[0.9rem] leading-relaxed text-ink-2">
            {mode === 'signup'
              ? 'Keeps your stamps separate from anyone else using this device, and lets you continue on another one.'
              : 'Your stamps follow you to any device you sign in on.'}
          </p>
        </div>

        <Field id={`${uid}-user`} label="Username" hint={mode === 'signup' ? '3 to 24 characters: a to z, 0 to 9, - or _. Please avoid your real name.' : null}>
          <input
            ref={firstFieldRef}
            id={`${uid}-user`}
            className="field-input"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={24}
            value={username}
            onChange={e => setUsername(e.target.value)}
            aria-describedby={mode === 'signup' ? `${uid}-user-hint` : undefined}
          />
        </Field>

        <Field
          id={`${uid}-pass`}
          label="Password"
          hint={mode === 'signup' ? 'At least 10 characters. There is no email reset, so keep it somewhere safe.' : null}
        >
          <input
            ref={passwordRef}
            id={`${uid}-pass`}
            className="field-input"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            maxLength={128}
            value={password}
            onChange={e => setPassword(e.target.value)}
            aria-describedby={mode === 'signup' ? `${uid}-pass-hint` : undefined}
          />
        </Field>
        <label className="-mt-2 flex min-h-11 items-center gap-2.5 text-[0.9rem] text-ink-2">
          <input type="checkbox" className="size-4 accent-[var(--text-primary)]" checked={showPassword} onChange={e => setShowPassword(e.target.checked)} />
          Show password
        </label>

        {guestCount > 0 && (
          <label className="-mt-3 flex min-h-11 items-center gap-2.5 text-[0.9rem] text-ink-2">
            <input type="checkbox" className="size-4 accent-[var(--text-primary)]" checked={mergeGuest} onChange={e => setMergeChoice(e.target.checked)} />
            Add the {guestCount} {guestCount === 1 ? 'stamp' : 'stamps'} collected in this browser to this account
          </label>
        )}

        {mode === 'signup' && (
          <label className="-mt-3 flex min-h-11 items-start gap-2.5 pt-2.5 text-[0.9rem] text-ink-2">
            <input ref={agreeRef} type="checkbox" className="mt-0.5 size-4 shrink-0 accent-[var(--text-primary)]" checked={agreed} onChange={e => setAgreed(e.target.checked)} />
            <span>
              I agree to the{' '}
              <a className="link text-ink" href="/terms/" target="_blank" rel="noopener">
                terms of use<span className="sr-only"> (opens in a new tab)</span>
              </a>{' '}
              and have read the{' '}
              <a className="link text-ink" href="/privacy/" target="_blank" rel="noopener">
                privacy notice<span className="sr-only"> (opens in a new tab)</span>
              </a>
              .
            </span>
          </label>
        )}

        {error && (
          <p role="alert" className="text-[0.9rem] font-medium text-stamp">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[0.88rem] text-ink-3">
            {copy.switchText}{' '}
            <button type="button" className="link font-medium text-ink" onClick={() => { setError(''); onSwitchMode(mode === 'signup' ? 'signin' : 'signup'); }}>
              {copy.switchLabel}
            </button>
          </p>
          <div className="flex gap-3">
            <button type="button" className="btn btn-quiet" onClick={handleClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-solid" disabled={busy} aria-busy={busy}>
              {busy ? 'Securing…' : copy.submit}
            </button>
          </div>
        </div>
        <p className="text-[0.75rem] leading-relaxed text-ink-3">
          We keep your username, a scrambled check of your password and your stamps, plus short-lived sign-in and security records. Your
          username is never shown to anyone else, and your password is scrambled in this browser before it is sent.{' '}
          <a className="link" href="/privacy/" target="_blank" rel="noopener">
            Full privacy notice<span className="sr-only"> (opens in a new tab)</span>
          </a>
        </p>
      </form>
    </Modal>
  );
}
