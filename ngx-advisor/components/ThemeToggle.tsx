'use client';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from './ThemeProvider';
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button onClick={toggle} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      className="p-2 rounded-lg border border-line bg-subtle text-ink-2 transition-colors hover:text-ink hover:border-ink-3">
      {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}
