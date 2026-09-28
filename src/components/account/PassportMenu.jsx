import { useCallback, useEffect, useRef, useState } from 'react';
import { THEMES } from '../../hooks/useTheme';

const THEME_LABEL = { system: 'Auto', light: 'Light', dark: 'Dark' };
const SYNC_LABEL = {
  saved: 'All stamps saved to your account.',
  error: 'Some stamps are not saved yet. We will retry on your next stamp.',
};
// Popover API: Chrome 114+, Safari 17+, Firefox 125+. Older browsers (e.g. iOS 16) get a React-state fallback.
const SUPPORTS_POPOVER = typeof HTMLElement !== 'undefined' && Object.hasOwn(HTMLElement.prototype, 'popover');

// Masthead menu built on the native Popover API: the browser handles Escape, outside clicks
// and aria-expanded on the toggle button, with no positioning library.
export default function PassportMenu({ account, sync, theme, discoveredCount, onOpenChange, onOpenAuth, onSignOut, onDeleteAccount, onReset }) {
  const popoverRef = useRef(null);
  const [open, setOpenState] = useState(false);
  // The page needs to know, so its Escape handler leaves Escape to the open menu.
  const setOpen = useCallback(
    next => {
      setOpenState(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );
  const close = () => (SUPPORTS_POPOVER ? popoverRef.current?.hidePopover() : setOpen(false));
  // Close the menu, then act. Called from event handlers only (never during render).
  const act = fn => {
    close();
    fn();
  };
  const signedIn = account.status === 'signed-in';

  // Fallback only: Escape closes the menu, as the native popover would.
  useEffect(() => {
    if (SUPPORTS_POPOVER || !open) return undefined;
    const onKey = e => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  const trigger = SUPPORTS_POPOVER ? { popoverTarget: 'passport-menu' } : { 'aria-expanded': open, onClick: () => setOpen(!open) };
  const panel = SUPPORTS_POPOVER ? { popover: 'auto', onToggle: e => setOpen(e.newState === 'open') } : { hidden: !open };

  return (
    <>
      <button type="button" {...trigger} aria-controls="passport-menu" className="btn btn-quiet max-w-[11rem] px-4">
        <span className="truncate">{signedIn ? account.username : 'Menu'}</span>
      </button>

      <div
        id="passport-menu"
        ref={popoverRef}
        {...panel}
        aria-label="Passport menu"
        className="menu-popover m-0 w-[min(calc(100vw-2rem),22rem)] overscroll-contain rounded-[12px] border border-rule bg-paper p-0 text-ink shadow-[var(--shadow-paper)]"
      >
        <section className="border-b border-rule px-5 pt-5 pb-4">
          <h2 className="text-[0.78rem] font-medium tracking-[0.12em] text-ink-3 uppercase">Account</h2>
          {account.status === 'checking' && <p className="mt-2 text-[0.92rem] text-ink-2">Checking your account…</p>}
          {account.status === 'unavailable' && (
            <p className="mt-2 text-[0.92rem] text-ink-2">Accounts are unavailable right now. Your stamps are saved in this browser.</p>
          )}
          {account.status === 'guest' && (
            <>
              <p className="mt-2 text-[0.92rem] leading-relaxed text-ink-2">
                Your stamps are saved in this browser only. With an account they stay separate from anyone else on this device and follow you
                to other devices.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="btn btn-solid" onClick={() => act(() => onOpenAuth('signin'))}>
                  Sign in
                </button>
                <button type="button" className="btn btn-quiet" onClick={() => act(() => onOpenAuth('signup'))}>
                  Create account
                </button>
              </div>
            </>
          )}
          {signedIn && (
            <>
              <p className="mt-2 text-[0.92rem]">
                Signed in as <strong className="font-semibold">{account.username}</strong>
              </p>
              <p className={`mt-1 text-[0.85rem] ${sync === 'error' ? 'font-medium text-stamp' : 'text-ink-3'}`}>{SYNC_LABEL[sync] ?? SYNC_LABEL.saved}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" className="btn btn-quiet" onClick={() => act(onSignOut)}>
                  Sign out
                </button>
                <button type="button" className="btn min-h-11 px-3 text-[0.85rem] text-stamp underline underline-offset-4" onClick={() => act(onDeleteAccount)}>
                  Delete account
                </button>
              </div>
            </>
          )}
        </section>

        <fieldset className="border-b border-rule px-5 pt-4 pb-4">
          <legend className="float-left mb-2 w-full text-[0.78rem] font-medium tracking-[0.12em] text-ink-3 uppercase">Appearance</legend>
          <div className="clear-both grid grid-cols-3 gap-1 rounded-full border border-rule-strong p-1">
            {THEMES.map(t => (
              <label key={t} className="theme-option">
                <input type="radio" name="theme" value={t} checked={theme.pref === t} onChange={() => theme.choose(t)} className="sr-only" />
                <span>{THEME_LABEL[t]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <section className="px-5 pt-4 pb-5">
          <button type="button" className="btn btn-quiet w-full" onClick={() => act(onReset)} disabled={discoveredCount === 0}>
            Reset passport
          </button>
        </section>
      </div>
    </>
  );
}
