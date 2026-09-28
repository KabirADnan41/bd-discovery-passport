import { useCallback, useEffect, useRef, useState } from 'react';
import { addStamps } from '../lib/authClient';
import { clearDiscovered } from '../lib/discoveryStorage';

// Clear the guest copy once every merged guest stamp is on the server.
function clearGuestIfSynced(guestToClear, synced) {
  if (guestToClear.current?.every(id => synced.current.has(id))) {
    clearDiscovered();
    guestToClear.current = null;
  }
}

/**
 * Keeps the account's copy of the passport in step with the screen while `source` is 'account'.
 * Uploads are unions on the server, so retries are safe. `restart()` begins a new sync session
 * (sign-in, sign-out, reset): responses to requests sent before it are ignored.
 */
export function usePassportSync(discovered, source) {
  const synced = useRef(new Set()); // stamps the server already has
  const inflight = useRef(new Set()); // stamps being uploaded right now
  const epoch = useRef(0);
  const guestToClear = useRef(null); // merged guest stamps: the guest copy is cleared once the server has them
  const [status, setStatus] = useState('saved');

  const restart = useCallback((serverIds = [], mergedGuestIds = []) => {
    epoch.current += 1;
    inflight.current = new Set();
    synced.current = new Set(serverIds);
    guestToClear.current = mergedGuestIds.length ? mergedGuestIds : null;
    clearGuestIfSynced(guestToClear, synced); // merged stamps that the account already had need no upload
    setStatus('saved');
  }, []);

  useEffect(() => {
    if (source !== 'account') return;
    const unsynced = discovered.filter(id => !synced.current.has(id) && !inflight.current.has(id));
    if (!unsynced.length) return;
    const started = epoch.current;
    unsynced.forEach(id => inflight.current.add(id));
    addStamps(unsynced).then(r => {
      if (started !== epoch.current) return; // signed out, switched account or reset meanwhile
      unsynced.forEach(id => inflight.current.delete(id));
      if (r.ok) {
        r.data.discovered.forEach(id => synced.current.add(id));
        clearGuestIfSynced(guestToClear, synced);
      }
      setStatus(r.ok ? 'saved' : 'error');
    });
  }, [discovered, source]);

  return { status, restart };
}
