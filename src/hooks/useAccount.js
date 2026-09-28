import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteAccount, derivePasswordKey, fetchMe, logIn, logOut, signUp } from '../lib/authClient';

const GUEST = { status: 'guest', username: null };

// Web Crypto only exists on secure origins (https or localhost). Fail with a clear message, never hang.
const NO_CRYPTO = { ok: false, status: -1, data: { error: 'This browser cannot protect your password here. Please open the site over https://.' } };
const deriveOrFail = (username, password) => derivePasswordKey(username, password).catch(() => null);

/**
 * Account status: 'checking' | 'guest' | 'signed-in' | 'unavailable' (no API, e.g. plain `vite dev`
 * or an outage). The game works in every state; only where stamps are stored changes.
 * On page load it reports what it found: `onRestored(discovered)` for a live session, `onGuest()` otherwise.
 * Sign-in, sign-out and deletion return their result to the caller, which decides what to load.
 */
export function useAccount({ onRestored, onGuest } = {}) {
  const [account, setAccount] = useState({ ...GUEST, status: 'checking' });
  const callbacks = useRef({ onRestored, onGuest });
  useEffect(() => {
    callbacks.current = { onRestored, onGuest };
  });

  useEffect(() => {
    let alive = true;
    fetchMe().then(r => {
      if (!alive) return;
      if (r.ok && r.data.signedIn) {
        setAccount({ status: 'signed-in', username: r.data.username });
        callbacks.current.onRestored?.(r.data.discovered);
      } else {
        setAccount({ ...GUEST, status: r.ok ? 'guest' : 'unavailable' });
        callbacks.current.onGuest?.();
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const authenticate = useCallback(async (mode, username, password) => {
    const key = await deriveOrFail(username, password);
    if (!key) return NO_CRYPTO;
    const r = await (mode === 'signup' ? signUp : logIn)(username, key);
    if (r.ok) setAccount({ status: 'signed-in', username: r.data.username });
    return r;
  }, []);

  const signOut = useCallback(async () => {
    const r = await logOut();
    if (r.ok) setAccount(GUEST);
    return r;
  }, []);

  const remove = useCallback(
    async password => {
      const key = await deriveOrFail(account.username, password);
      if (!key) return NO_CRYPTO;
      const r = await deleteAccount(key);
      if (r.ok) setAccount(GUEST);
      return r;
    },
    [account.username],
  );

  return { ...account, authenticate, signOut, remove };
}
