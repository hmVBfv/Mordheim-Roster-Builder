/* Theme choice (docs/ui.md §4): Chronicle, Parchment, or as the system is set.
   Kept per device; public/theme-boot.js applies it before the first paint. */
import { useSyncExternalStore } from 'react';

export type ThemeChoice = 'chronicle' | 'parchment' | 'system';
export type Theme = 'chronicle' | 'parchment';

export const THEME_KEY = 'mordheim-theme';
export const THEME_CHOICES: { value: ThemeChoice; label: string }[] = [
  { value: 'chronicle', label: 'Chronicle (dark)' },
  { value: 'parchment', label: 'Parchment (light)' },
  { value: 'system', label: 'As the system' },
];

const listeners = new Set<() => void>();

export function readChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'chronicle' || v === 'parchment' || v === 'system') return v;
  } catch { /* storage blocked: the default */ }
  return 'chronicle';
}

export function resolveTheme(choice: ThemeChoice, prefersLight: boolean): Theme {
  if (choice === 'system') return prefersLight ? 'parchment' : 'chronicle';
  return choice;
}

const prefersLight = () => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches;

export function applyTheme(choice: ThemeChoice = readChoice()): Theme {
  const theme = resolveTheme(choice, prefersLight());
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'parchment' ? '#e9dcc0' : '#16181a');
  return theme;
}

export function setChoice(choice: ThemeChoice): void {
  try { localStorage.setItem(THEME_KEY, choice); } catch { /* keeps it for this visit */ }
  applyTheme(choice);
  current = choice;
  listeners.forEach((l) => l());
}

let current: ThemeChoice | null = null;

export function watchSystemTheme(): () => void {
  if (typeof matchMedia !== 'function') return () => {};
  const mq = matchMedia('(prefers-color-scheme: light)');
  const onChange = () => { if (readChoice() === 'system') applyTheme('system'); };
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

export function useThemeChoice(): ThemeChoice {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => (current ??= readChoice()),
  );
}
