import { useCallback, useEffect, useMemo, useReducer } from 'react';
import { DISTRICT_IDS } from '../lib/districtData';
import { clearDiscovered, loadDiscovered, saveDiscovered } from '../lib/discoveryStorage';

/**
 * State transitions, exported for unit tests. `source` says where the passport lives:
 * 'pending' (still checking for a signed-in session), 'guest' (this browser) or 'account' (the server).
 */
export function discoveryReducer(state, action) {
  switch (action.type) {
    case 'activate': {
      if (!DISTRICT_IDS.has(action.id)) return state;
      const isNew = !state.discovered.includes(action.id);
      return {
        ...state,
        discovered: isNew ? [...state.discovered, action.id] : state.discovered,
        selectedId: action.id,
        justDiscoveredId: isNew ? action.id : null,
      };
    }
    case 'load': {
      // Switch the passport's source; an open page stays open and counts as discovered there too.
      const discovered = (action.discovered ?? state.discovered).filter(id => DISTRICT_IDS.has(id));
      if (state.selectedId && !discovered.includes(state.selectedId)) discovered.push(state.selectedId);
      return { ...state, discovered, source: action.source };
    }
    case 'close':
      return { ...state, selectedId: null, justDiscoveredId: null };
    case 'reset':
      return { ...state, discovered: [], selectedId: null, justDiscoveredId: null };
    default:
      return state;
  }
}

// A shared link (?district=54) opens that passport page on arrival, which counts as discovering it.
const init = () => {
  const base = { discovered: loadDiscovered(DISTRICT_IDS), selectedId: null, justDiscoveredId: null, source: 'pending' };
  const linked = new URLSearchParams(window.location.search).get('district');
  return linked ? discoveryReducer(base, { type: 'activate', id: linked }) : base;
};

/** Discovery game state. Only a 'guest' passport is written to localStorage. */
export function useDiscoveryState() {
  const [state, dispatch] = useReducer(discoveryReducer, undefined, init);

  useEffect(() => {
    if (state.source !== 'guest') return;
    if (state.discovered.length) saveDiscovered(state.discovered);
    else clearDiscovered();
  }, [state.discovered, state.source]);

  const discoveredSet = useMemo(() => new Set(state.discovered), [state.discovered]);
  const activate = useCallback(id => dispatch({ type: 'activate', id }), []);
  /** load(source, discovered?): switch to 'guest' or 'account'; omitting `discovered` keeps the current stamps. */
  const load = useCallback((source, discovered) => dispatch({ type: 'load', source, discovered }), []);
  const close = useCallback(() => dispatch({ type: 'close' }), []);
  const reset = useCallback(() => dispatch({ type: 'reset' }), []);

  return { ...state, discoveredSet, activate, load, close, reset };
}
