import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { AuthProvider } from '@/components/AuthProvider';
import { SupabaseConfigProvider } from '@/components/SupabaseConfigProvider';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { ConnectivityProvider } from '@/components/ConnectivityProvider';
import { OfflineBanner } from '@/components/OfflineBanner';
import { InstallAppButton } from '@/components/InstallAppButton';
import { MixpanelInit } from '@/components/MixpanelInit';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Toyota SOS - Task Management',
  description: 'Toyota field service management system',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#d60b25',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <SupabaseConfigProvider />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.ico" />
        <meta name="theme-color" content="#d60b25" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ServiceWorkerRegister />
        <ConnectivityProvider>
          <MixpanelInit />
          {/* Install prompt button (conditionally rendered) */}
          <div className="fixed top-2 left-2 z-40">
            <InstallAppButton />
          </div>
          <OfflineBanner />
          <AuthProvider>{children}</AuthProvider>
        </ConnectivityProvider>
      </body>
    </html>
  );
}
