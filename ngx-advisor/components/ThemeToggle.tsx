'use client';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from './ThemeProvider';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button onClick={toggle} aria-label="Toggle light/dark mode"
      className="p-2 rounded-lg border border-slate-border transition-all duration-200
                 hover:border-ngx hover:bg-ngx/10"
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
      {theme === 'dark'
        ? <Sun  className="w-4 h-4 text-gold" />
        : <Moon className="w-4 h-4 text-slate-400" />}
    </button>
  );
}
