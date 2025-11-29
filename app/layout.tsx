import type { Metadata, Viewport } from 'next';
import Image from 'next/image';
import { Geist, Geist_Mono } from 'next/font/google';
import { Heebo } from 'next/font/google';
import { AuthProvider } from '@/components/AuthProvider';
import { SupabaseConfigProvider } from '@/components/SupabaseConfigProvider';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { ConnectivityProvider } from '@/components/ConnectivityProvider';
import { OfflineBanner } from '@/components/OfflineBanner';
import { InstallAppButton } from '@/components/InstallAppButton';
import { MixpanelInit } from '@/components/MixpanelInit';
import { Toaster } from '@/lib/toast';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const heebo = Heebo({
  variable: '--font-hebrew',
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Toyota SOS -ניהול נהגים',
  description: 'מערכת ניהול משימות ושינוע רכבים',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: 'var(--primary)',
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
        <meta name="theme-color" content="var(--primary)" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${heebo.variable} antialiased`}
      >
        <ServiceWorkerRegister />
        <ConnectivityProvider>
          <MixpanelInit />
          {/* Install prompt button (conditionally rendered) */}
          <div className="fixed top-2 left-2 z-40">
            <InstallAppButton />
          </div>
          {/* App Logo */}
          <div className="absolute top-4 right-4 z-50">
            <Image
              src="/icons/icon-192.png"
              alt="Toyota SOS"
              width={78}
              height={78}
              className="rounded-xl shadow-md bg-white/90 backdrop-blur-sm"
            />
          </div>
          <OfflineBanner />
          <AuthProvider>{children}</AuthProvider>
          <Toaster
            position="top-center"
            reverseOrder={false}
            gutter={8}
            containerClassName=""
            containerStyle={{}}
            toastOptions={{
              // Default options for all toasts
              className: '',
              duration: 4000,
              style: {
                background: '#fff',
                color: '#363636',
                fontFamily: 'var(--font-hebrew)',
                direction: 'rtl',
              },
              // Success toast
              success: {
                duration: 4000,
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#fff',
                },
              },
              // Error toast
              error: {
                duration: 5000,
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff',
                },
              },
              // Loading toast
              loading: {
                iconTheme: {
                  primary: '#3b82f6',
                  secondary: '#fff',
                },
              },
            }}
          />
        </ConnectivityProvider>
      </body>
    </html>
  );
}
