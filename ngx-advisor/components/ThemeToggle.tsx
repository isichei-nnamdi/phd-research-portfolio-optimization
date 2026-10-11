'use client';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from './ThemeProvider';
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button onClick={toggle} aria-label="Toggle theme"
      className="p-2 rounded-lg border-theme border transition-colors hover:border-ngx-light"
      style={{ background: 'var(--hover)' }}>
      {theme === 'dark'
        ? <Sun  className="w-4 h-4" style={{ color: 'var(--goldl)' }} />
        : <Moon className="w-4 h-4" style={{ color: 'var(--t2)' }} />}
    </button>
  );
}
