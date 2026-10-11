import type { Metadata } from 'next';
import './globals.css';
import { Nav }           from '@/components/Nav';
import { Footer }        from '@/components/Footer';
import { ThemeProvider } from '@/components/ThemeProvider';

export const metadata: Metadata = {
  title:       'Nairafolio | ML-Enhanced NGX Portfolio Optimisation',
  description: 'A two-stage Graph Attention Network and Reinforcement Learning framework for the Nigerian Exchange. PhD Research at Nasarawa State University Keffi.',
  icons: { icon: '/favicon.svg', shortcut: '/favicon.svg', apple: '/favicon.svg' },
  openGraph: {
    title:       'Nairafolio - ML Portfolio Optimisation for the NGX',
    description: 'First ML portfolio framework validated on Nigerian Stock Exchange data.',
    type:        'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body style={{ background: 'var(--bg)', color: 'var(--t1)' }}
            className="antialiased min-h-screen flex flex-col">
        <ThemeProvider>
          <Nav />
          <main className="flex-1">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
