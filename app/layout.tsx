import type { Metadata } from 'next';
import { Baloo_2, Nunito } from 'next/font/google';
import './globals.css';

const baloo = Baloo_2({
  subsets: ['latin'],
  variable: '--font-baloo',
  display: 'swap',
});

const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-nunito',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Coffee Oasis — Order Ahead',
  description: 'Skip the line. Order your coffee ahead.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Coffee Oasis',
    statusBarStyle: 'default',
  },
  icons: {
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${baloo.variable} ${nunito.variable}`}>
      <head>
        <meta name="theme-color" content="#F58220" />
      </head>
      <body>
        {children}
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
          }
          // Suppress Chrome's automatic install banner. Manual install via the
          // browser menu still works. To build an opt-in install button later,
          // stash the event here and call .prompt() on it from the UI.
          window.addEventListener('beforeinstallprompt', e => e.preventDefault());
        `}} />
      </body>
    </html>
  );
}
