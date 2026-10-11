import type { Metadata } from 'next';
import './globals.css';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { ThemeProvider } from '@/components/ThemeProvider';

export const metadata: Metadata = {
  title: 'NGX Robo-Advisor | ML-Enhanced Portfolio Optimisation',
  description: 'A two-stage Graph Attention Network and Reinforcement Learning framework for the Nigerian Stock Exchange. PhD Research at Nasarawa State University Keffi.',
  keywords: ['NGX', 'portfolio optimisation', 'graph attention network', 'reinforcement learning', 'Nigerian Exchange', 'robo-advisor'],
  authors: [{ name: 'Austin Nnamdi Augustus Isichei', url: 'https://datafiedtech.com' }],
  icons: {
    icon:     [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    shortcut: '/favicon.svg',
    apple:    '/favicon.svg',
  },
  openGraph: {
    title: 'NGX Robo-Advisor - ML Portfolio Optimisation',
    description: 'First ML portfolio framework validated on Nigerian Stock Exchange data.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="scroll-smooth">
      <body className="bg-navy text-white antialiased min-h-screen flex flex-col">
        <Nav />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
