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
          // Suppress Chrome's automatic install banner, but stash the event so
          // our own opt-in "Add to home screen" button can trigger it on demand.
          window.__coInstallPrompt = null;
          window.addEventListener('beforeinstallprompt', function (e) {
            e.preventDefault();
            window.__coInstallPrompt = e;
            window.dispatchEvent(new Event('co-installable'));
          });
          window.addEventListener('appinstalled', function () {
            window.__coInstallPrompt = null;
            window.dispatchEvent(new Event('co-installed'));
          });
        `}} />
      </body>
    </html>
  );
}
