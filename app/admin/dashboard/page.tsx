'use client';

import { NavBar } from '@/components/ui/tubelight-navbar';
import { DashboardKPIs } from '@/components/admin/dashboard/DashboardKPIs';
import { PeriodProvider } from '@/components/admin/dashboard/PeriodContext';
import { PeriodFilter } from '@/components/admin/dashboard/PeriodFilter';
import { DashboardCharts } from '@/components/admin/DashboardCharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { LayoutDashboardIcon } from 'lucide-react';

export default function AdminDashboardPage() {
  const navItems = [
    { name: 'דשבורד', url: '/admin/dashboard', icon: 'LayoutDashboard' },
    { name: 'משימות', url: '/admin/tasks', icon: 'ClipboardList' },
    { name: 'יומן', url: '/admin/calendar', icon: 'Calendar' },
    { name: 'נהגים', url: '/admin/drivers', icon: 'Users' },
    { name: 'מנהלים', url: '/admin/admins', icon: 'ShieldCheck' },
    { name: 'רכבים', url: '/admin/vehicles', icon: 'Car' },
  ];

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-linear-to-br from-slate-50/50 via-white to-blue-50/30 relative overflow-hidden"
    >
      {/* Background Pattern */}
      <div className="absolute inset-0  bg-linear-to-br from-toyota-red/[0.02] via-transparent to-toyota-blue/[0.03] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-toyota-red/5 via-transparent to-transparent pointer-events-none" />
      <NavBar items={navItems} className="z-40" />
      <PeriodProvider>
        <div className="relative z-10 mx-auto mt-20 max-w-7xl space-y-8 p-4 sm:mt-24 sm:p-6 lg:p-8">
          {/* Header Section */}
          <div className="text-center space-y-4">
            <div className="relative">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl flex items-center justify-center gap-3 group">
                <div className="relative">
                  <LayoutDashboardIcon className="w-8 h-8 text-toyota-red drop-shadow-sm group-hover:scale-110 transition-transform duration-200" />
                  <div className="absolute inset-0 w-8 h-8 bg-toyota-red/20 rounded-lg blur-md group-hover:blur-lg transition-all duration-200" />
                </div>
                <span className="bg-linear-to-r from-slate-900 via-slate-700 to-slate-900 bg-clip-text text-transparent">
                  דשבורד ניהול משימות
                </span>
              </h1>
              <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-24 h-1 bg-linear-to-r from-toyota-red via-toyota-red/60 to-transparent rounded-full" />
            </div>
            <p className="text-lg text-slate-600 font-medium tracking-wide">
              ניהול ומעקב משימות עבור צוות טויוטה
            </p>
          </div>

          <div className="relative">
            <Separator className="my-8 bg-linear-to-r from-transparent via-slate-200 to-transparent" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-white px-4 py-1 rounded-full border border-slate-100 shadow-sm">
                <div className="w-2 h-2 bg-toyota-red/30 rounded-full" />
              </div>
            </div>
          </div>

          {/* Period Filter Card */}
          <Card className="group border-0 shadow-lg shadow-slate-900/5 bg-white/90 backdrop-blur-md hover:shadow-xl hover:shadow-slate-900/10 transition-all duration-300 border-l-4 border-l-toyota-red/30">
            <CardHeader className="pb-4 bg-linear-to-r from-toyota-red/5 to-transparent">
              <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <div className="w-2 h-2 bg-toyota-red rounded-full shadow-sm" />
                סינון תקופה
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <PeriodFilter />
            </CardContent>
          </Card>

          {/* KPIs Section */}
          <Card className="group border-0 shadow-lg shadow-slate-900/5 bg-linear-to-br from-white via-white/95 to-slate-50/50 backdrop-blur-md hover:shadow-xl hover:shadow-slate-900/10 transition-all duration-300 border-l-4 border-l-toyota-blue/40">
            <CardHeader className="pb-4 bg-linear-to-r from-toyota-blue/5 to-transparent relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-radial from-toyota-blue/10 to-transparent rounded-full transform translate-x-16 -translate-y-16" />
              <CardTitle className="text-xl font-bold text-slate-800 flex items-center gap-3 relative z-10">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-toyota-blue rounded-full shadow-sm" />
                  <div className="w-2 h-2 bg-toyota-blue/60 rounded-full" />
                </div>
                מדדי ביצוע עיקריים
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <DashboardKPIs />
            </CardContent>
          </Card>

          {/* Charts Section */}
          <Card className="group border-0 shadow-lg shadow-slate-900/5 bg-linear-to-br from-white via-slate-50/30 to-white/95 backdrop-blur-md hover:shadow-xl hover:shadow-slate-900/10 transition-all duration-300 border-l-4 border-l-slate-400/40">
            <CardHeader className="pb-4 bg-linear-to-r from-slate-100/50 to-transparent relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-linear-conic from-slate-100/20 via-transparent to-slate-100/10 rounded-full transform translate-x-20 -translate-y-20" />
              <CardTitle className="text-xl font-bold text-slate-800 flex items-center gap-3 relative z-10">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-linear-to-r from-slate-500 to-slate-400 rounded-full shadow-sm" />
                  <div className="w-2 h-2 bg-slate-400/60 rounded-full" />
                  <div className="w-1 h-1 bg-slate-300/80 rounded-full" />
                </div>
                דוחות ותרשימים
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <DashboardCharts />
            </CardContent>
          </Card>
        </div>
      </PeriodProvider>
    </div>
  );
}
