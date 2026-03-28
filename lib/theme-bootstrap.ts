import type { Theme } from '@/contexts/ThemeContext';

export const THEME_STORAGE_KEY = 'theme';

export const getThemeBootstrapScript = (): string => `
(() => {
  try {
    const storedTheme = window.localStorage.getItem('${THEME_STORAGE_KEY}');
    const theme = storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system'
      ? storedTheme
      : 'system';
    const resolvedTheme = theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolvedTheme);
  } catch (_error) {
    document.documentElement.classList.add('light');
  }
})();
`;

export const isThemeValue = (value: unknown): value is Theme => (
    value === 'light' || value === 'dark' || value === 'system'
);
