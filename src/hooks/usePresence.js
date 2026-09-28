import { useEffect, useState } from 'react';

/**
 * Keeps the last non-null `value` rendered for `exitMs` after it becomes null, so an element can
 * play its exit transition before unmounting. Returns [shownValue, isExiting].
 * `value` must be a primitive (an id), not an object rebuilt on every render.
 */
export function usePresence(value, exitMs) {
  const [state, setState] = useState({ shown: value, exiting: false, prev: value });

  let current = state;
  if (value !== state.prev) {
    // Adjusting state while rendering (React's "derived state from previous render" pattern).
    current = value != null ? { shown: value, exiting: false, prev: value } : { shown: state.shown, exiting: state.shown != null, prev: value };
    setState(current);
  }

  useEffect(() => {
    if (!current.exiting) return undefined;
    const timer = setTimeout(() => setState(s => (s.prev == null ? { ...s, shown: null, exiting: false } : s)), exitMs);
    return () => clearTimeout(timer);
  }, [current.exiting, exitMs]);

  return [current.shown, current.exiting];
}
