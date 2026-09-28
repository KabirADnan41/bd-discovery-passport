import { useCallback, useEffect, useState } from 'react';

export const THEME_KEY = 'bd-discovery-passport:theme';
export const THEMES = ['system', 'light', 'dark'];
const THEME_COLOR = { light: '#f3ebdd', dark: '#0e1a16' };

const readPref = () => {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return THEMES.includes(v) ? v : 'system';
  } catch {
    return 'system';
  }
};

/** Theme preference (system / light / dark), applied as <html data-theme>. */
export function useTheme() {
  const [pref, setPref] = useState(readPref);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const root = document.documentElement;
    const apply = () => {
      const theme = pref === 'system' ? (media.matches ? 'dark' : 'light') : pref;
      if (root.getAttribute('data-theme') !== theme) {
        // switch instantly: suppress transitions for the frame the tokens change
        root.setAttribute('data-theme-switching', '');
        requestAnimationFrame(() => requestAnimationFrame(() => root.removeAttribute('data-theme-switching')));
      }
      root.setAttribute('data-theme', theme);
      for (const meta of document.querySelectorAll('meta[name="theme-color"]')) meta.setAttribute('content', THEME_COLOR[theme]);
    };
    apply();
    if (pref !== 'system') return undefined;
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [pref]);

  const choose = useCallback(next => {
    setPref(next);
    try {
      if (next === 'system') localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, next);
    } catch {
      // preference simply won't persist
    }
  }, []);

  return { pref, choose };
}
