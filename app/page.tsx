'use client';

import React, { useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { LogInIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

// Glow Component
const glowVariants = cva('absolute w-full', {
  variants: {
    variant: {
      top: 'top-0',
      above: '-top-[128px]',
      bottom: 'bottom-0',
      below: '-bottom-[128px]',
      center: 'top-[50%]',
    },
  },
  defaultVariants: {
    variant: 'top',
  },
});

const Glow = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof glowVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(glowVariants({ variant }), className)}
    {...props}
  >
    <div
      className={cn(
        'absolute left-1/2 h-[256px] w-[60%] -translate-x-1/2 scale-[2.5] rounded-[50%] bg-[radial-gradient(ellipse_at_center,color-mix(in_oklch,var(--primary),transparent_50%)_10%,transparent_60%)] sm:h-[512px]',
        variant === 'center' && '-translate-y-1/2'
      )}
    />
    <div
      className={cn(
        'absolute left-1/2 h-[128px] w-[40%] -translate-x-1/2 scale-[2] rounded-[50%] bg-[radial-gradient(ellipse_at_center,color-mix(in_oklch,var(--primary),transparent_70%)_10%,transparent_60%)] sm:h-[256px]',
        variant === 'center' && '-translate-y-1/2'
      )}
    />
  </div>
));
Glow.displayName = 'Glow';

export default function Home() {
  const router = useRouter();
  const { session, loading } = useAuth();
  // Derived state to prevent flash of content while redirecting
  const isRedirecting = !loading && !!session;

  // Auto-redirect if already logged in
  useEffect(() => {
    if (isRedirecting && session) {
      if (session.role === 'driver') {
        router.replace('/driver');
      } else if (
        session.role === 'admin' ||
        session.role === 'manager' ||
        session.role === 'viewer'
      ) {
        router.replace('/admin/dashboard');
      }
    }
  }, [isRedirecting, session, router]);

  if (loading || isRedirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background relative overflow-hidden font-sans">
      <style>{`
        @keyframes appear {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes appear-zoom {
          0% { opacity: 0; transform: scale(0.98); }
          100% { opacity: 1; transform: scale(1); }
        }
        
        .animate-appear {
          animation: appear 0.5s ease-out forwards;
        }
        
        .animate-appear-zoom {
          animation: appear-zoom 0.8s ease-out forwards;
        }
      `}</style>

      <div className="relative z-10 flex flex-col items-center text-center space-y-10 px-4 max-w-3xl mx-auto w-full">
        {/* App Icon */}
        <div className="relative group animate-appear opacity-0">
          <div className="absolute inset-0 bg-primary rounded-[2.5rem] blur-xl opacity-20 group-hover:opacity-30 transition-opacity duration-500" />
          <div className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-[2.5rem] shadow-2xl overflow-hidden transition-transform duration-500 group-hover:scale-105">
            <Image
              src="/icons/icon-fresh-192.png"
              alt="Toyota S.O.S App Icon"
              fill
              className="object-cover"
              priority
            />
          </div>
        </div>

        <div className="space-y-4 w-full">
          {/* Brand Name */}
          <div className="animate-appear opacity-0 [animation-delay:150ms]">
            <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-black font-semibold text-sm tracking-wider uppercase border border-primary/20">
              Toyota S.O.S
            </span>
          </div>

          {/* Hebrew Title */}
          <h1 className="animate-appear opacity-0 [animation-delay:300ms] text-4xl sm:text-5xl md:text-6xl font-bold text-foreground tracking-tight leading-tight">
            אפליקציית הנהגים של טויוטה חדרה sos
          </h1>

          {/* Subtitle */}
          <p className="animate-appear opacity-0 [animation-delay:450ms] text-lg text-muted-foreground max-w-xl mx-auto">
            מערכת מתקדמת לניהול משימות ושינוע רכבים
          </p>
        </div>

        {/* CTA Button */}
        <div className="animate-appear opacity-0 [animation-delay:600ms] pt-4 w-full max-w-xs sm:max-w-sm z-20">
          <Button
            size="lg"
            className="w-full bg-blue-600 hover:bg-primary/90 text-white h-14 text-lg font-medium rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0"
            onClick={() => router.push('/auth/login')}
          >
            התחברות
            <LogInIcon className="w-4 h-4 mr-2" />
          </Button>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-8 text-center space-y-2 text-gray-400 text-xs z-10 animate-appear opacity-0 [animation-delay:800ms]">
        <p>
          &copy; {new Date().getFullYear()} Toyota S.O.S. All rights reserved.
        </p>
        <p>Version 1.0.2</p>
        <p>Developed By Nadav Galili</p>
      </div>

      {/* Background Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <Glow
          variant="center"
          className="animate-appear-zoom opacity-0 [animation-delay:800ms]"
        />
      </div>
    </main>
  );
}
