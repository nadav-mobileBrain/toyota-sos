import type { Metadata, Viewport } from 'next';
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
import { AppLogo } from '@/components/AppLogo';
import './globals.css';

const geistSans = Geist({
  variable: '--font-sans',
  subsets: ['latin'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  display: 'swap',
});

const heebo = Heebo({
  variable: '--font-serif',
  subsets: ['hebrew', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
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
        className={`${geistSans.variable} ${geistMono.variable} ${heebo.variable} font-serif antialiased`}
      >
        <ServiceWorkerRegister />
        <ConnectivityProvider>
          <MixpanelInit />
          {/* App Logo */}
          <AppLogo />
          <OfflineBanner />
          <AuthProvider>
            {/* Install prompt button (conditionally rendered based on role) */}
            <div className="fixed top-2 left-2 z-40">
              <InstallAppButton />
            </div>
            {children}
          </AuthProvider>
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
                fontFamily: 'var(--font-serif)',
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
