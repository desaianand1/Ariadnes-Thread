export type Theme = 'light' | 'dark' | 'system';

export function getTheme(): Theme {
  return (localStorage.getItem('theme') as Theme) || 'system';
}

export function setTheme(theme: Theme) {
  localStorage.setItem('theme', theme);
  updateTheme();
}

export function updateTheme() {
  const theme = getTheme();
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  document.documentElement.classList.toggle('dark', isDark);
}

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (getTheme() === 'system') {
    updateTheme();
  }
});
