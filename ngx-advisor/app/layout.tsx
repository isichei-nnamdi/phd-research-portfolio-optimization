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

// Applies the saved theme before first paint so light-mode users never see a dark flash.
const themeScript = `try{if(localStorage.getItem('nf-theme')==='light')document.documentElement.classList.add('light')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased min-h-screen flex flex-col">
        <ThemeProvider>
          <Nav />
          <main className="flex-1">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
