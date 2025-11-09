'use client';

import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      {/* Header with subtle branding */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-toyota-primary rounded-lg" />
            <span className="text-xl font-bold text-gray-900">
              Toyota S.O.S
            </span>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push('/auth/login')}
            className="text-sm"
          >
            Sign In
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
        <div className="text-center space-y-8">
          {/* Main heading */}
          <div className="space-y-4">
            <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 leading-tight">
              Field Service Excellence
            </h1>
            <h2 className="text-4xl font-bold text-toyota-primary">
              Toyota S.O.S
            </h2>
            <p className="text-2xl text-center  mt-4">מערכת ניהול משימות שדה</p>
          </div>

          {/* Subtitle */}
          <div className="max-w-2xl mx-auto">
            <p className="text-lg sm:text-xl text-gray-600 leading-relaxed">
              Streamline your field operations with real-time task management,
              driver coordination, and comprehensive reporting—all designed for
              Toyota fast-paced environment.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
            <Button
              size="lg"
              className="bg-toyota-primary hover:bg-red-700 text-white px-8 py-6 text-lg font-semibold"
              onClick={() => router.push('/auth/login')}
            >
              Get Started
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="px-8 py-6 text-lg font-semibold"
              onClick={() => {
                // Scroll to features
                document
                  .getElementById('features')
                  ?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Learn More
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section
        id="features"
        className="bg-white py-20 border-t border-gray-200"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 text-center mb-16">
            Key Features
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="p-8 bg-gray-50 rounded-lg border border-gray-200 hover:border-toyota-primary transition">
              <div className="w-12 h-12 bg-toyota-primary rounded-lg flex items-center justify-center mb-4">
                <span className="text-white text-xl">📋</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Task Management
              </h3>
              <p className="text-gray-600">
                Assign, track, and complete field tasks with real-time updates
                and status monitoring.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-8 bg-gray-50 rounded-lg border border-gray-200 hover:border-toyota-primary transition">
              <div className="w-12 h-12 bg-toyota-primary rounded-lg flex items-center justify-center mb-4">
                <span className="text-white text-xl">🚗</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Driver Coordination
              </h3>
              <p className="text-gray-600">
                Efficiently manage drivers, schedules, and route optimization
                for maximum productivity.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-8 bg-gray-50 rounded-lg border border-gray-200 hover:border-toyota-primary transition">
              <div className="w-12 h-12 bg-toyota-primary rounded-lg flex items-center justify-center mb-4">
                <span className="text-white text-xl">📊</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Analytics & Reports
              </h3>
              <p className="text-gray-600">
                Get insights into performance metrics, completion rates, and
                team productivity.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">
            Ready to optimize your field operations?
          </h2>
          <Button
            size="lg"
            className="bg-toyota-primary hover:bg-red-700 text-white px-8 py-6 text-lg font-semibold"
            onClick={() => router.push('/auth/login')}
          >
            Sign In Now
          </Button>
        </div>
      </section>
    </main>
  );
}
