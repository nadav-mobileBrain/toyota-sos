'use client';

import React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TrendPill } from './TrendPill';
import type { TrendData } from '@/lib/dashboard/queries';

export function KpiCard({
  title,
  value,
  percentage,
  secondary,
  loading,
  error,
  actionArea,
  variant = 'default',
  percentageLabel = 'מסך המתוכננות',
  trend,
  isPositiveGood = true,
}: {
  title: string;
  value: React.ReactNode;
  percentage?: number | null;
  secondary?: React.ReactNode;
  loading?: boolean;
  error?: string | null;
  actionArea?: React.ReactNode;
  variant?: 'default' | 'secondary';
  percentageLabel?: string;
  trend?: TrendData;
  isPositiveGood?: boolean;
}) {
  const isSecondary = variant === 'secondary';

  if (loading) {
    return (
      <Card
        className={cn(
          "animate-pulse border-0 shadow-lg shadow-slate-900/5 relative overflow-hidden",
          isSecondary ? "bg-gradient-to-br from-slate-50/80 to-slate-100/60" : "bg-gradient-to-br from-white/90 to-slate-50/30"
        )}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shimmer" />
        <CardHeader className={cn(isSecondary ? "p-3 pb-2" : "p-4 pb-2")}>
          <div className="h-4 w-24 rounded-md bg-gradient-to-r from-slate-200 to-slate-300 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-pulse" />
          </div>
        </CardHeader>
        <CardContent className={cn(isSecondary ? "p-3 pt-0" : "p-4 pt-0")}>
          <div className="h-8 w-36 rounded-md bg-gradient-to-r from-slate-300 to-slate-400 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-pulse" />
          </div>
          <div className="mt-2 h-3 w-28 rounded-md bg-gradient-to-r from-slate-200 to-slate-300 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-pulse" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-0 border-r-4 border-r-red-300 bg-gradient-to-br from-red-50/80 via-red-25/50 to-white shadow-lg shadow-red-900/5 hover:shadow-xl hover:shadow-red-900/10 transition-all duration-300 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-radial from-red-100/30 to-transparent rounded-full transform translate-x-12 -translate-y-12" />
        <CardHeader className={cn(isSecondary ? "p-3 pb-2" : "p-4 pb-2", "relative z-10")}>
          <CardTitle className="text-sm font-semibold text-red-700 flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className={cn(isSecondary ? "p-3 pt-0" : "p-4 pt-0", "relative z-10")}>
          <div className="text-sm text-red-600 font-medium bg-red-100/50 px-3 py-2 rounded-lg border border-red-200/50">
            שגיאה: {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "group relative border-0 transition-all duration-300 hover:shadow-xl hover:shadow-slate-900/10 hover:scale-[1.02] transform-gpu cursor-pointer overflow-hidden",
        isSecondary
          ? "border-r-4 border-blue-300/60 bg-gradient-to-br from-blue-50/40 via-white/90 to-slate-50/60 shadow-lg shadow-slate-900/5 hover:from-blue-50/60 hover:border-blue-400/80"
          : "bg-gradient-to-br from-white/95 via-white to-slate-50/30 shadow-lg shadow-slate-900/5 hover:from-white hover:to-slate-50/50 border-l-4 border-l-transparent hover:border-l-toyota-red/30"
      )}
    >
      {/* Background Glow Effect */}
      <div className={cn(
        "absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-500",
        isSecondary
          ? "bg-gradient-to-br from-blue-100/20 via-transparent to-blue-50/10"
          : "bg-gradient-to-br from-toyota-red/5 via-transparent to-slate-100/20"
      )} />

      {/* Corner Decoration */}
      <div className={cn(
        "absolute top-0 right-0 w-20 h-20 rounded-full transform translate-x-10 -translate-y-10 transition-all duration-300 group-hover:scale-110",
        isSecondary
          ? "bg-gradient-radial from-blue-100/30 to-transparent"
          : "bg-gradient-radial from-toyota-red/10 to-transparent"
      )} />
      <CardHeader
        className={cn(
          "flex flex-row items-center justify-between space-y-0 relative z-10",
          isSecondary ? "p-3 pb-2" : "p-4 pb-2"
        )}
      >
        <CardTitle
          className={cn(
            "font-semibold text-slate-700 group-hover:text-slate-800 transition-colors duration-200 flex items-center gap-2",
            isSecondary ? "text-xs" : "text-sm"
          )}
        >
          <div className={cn(
            "w-1.5 h-1.5 rounded-full transition-all duration-300 group-hover:scale-125",
            isSecondary ? "bg-blue-400/60 group-hover:bg-blue-500" : "bg-slate-400/60 group-hover:bg-toyota-red/80"
          )} />
          {title}
        </CardTitle>
        {actionArea}
      </CardHeader>
      <CardContent className={cn(isSecondary ? "p-3 pt-0" : "p-4 pt-0", "relative z-10")}>
        <div className="space-y-2">
          <div
            className={cn(
              "font-bold tracking-tight text-slate-900 group-hover:text-slate-800 transition-all duration-200 relative",
              isSecondary ? "text-xl" : "text-3xl"
            )}
          >
            <span className="relative z-10">{value}</span>
            {/* Value Glow Effect */}
            <div className={cn(
              "absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-300 blur-sm",
              isSecondary ? "text-blue-600" : "text-toyota-red"
            )}>
              {value}
            </div>
          </div>

          {/* Trend and Percentage Row */}
          <div className="flex items-center justify-between">
            {percentage !== undefined && percentage !== null && (
              <div
                className={cn(
                  "font-medium text-slate-600 group-hover:text-slate-700 transition-colors duration-200 flex items-center gap-1",
                  isSecondary ? "text-xs" : "text-sm"
                )}
              >
                <div className={cn(
                  "w-1 h-1 rounded-full transition-all duration-300",
                  percentage > 70 ? "bg-green-400 group-hover:bg-green-500" :
                  percentage > 40 ? "bg-yellow-400 group-hover:bg-yellow-500" :
                  "bg-red-400 group-hover:bg-red-500"
                )} />
                <span className="tabular-nums">{percentage}%</span>
                <span className="text-slate-500">{percentageLabel}</span>
              </div>
            )}
            {trend && (
              <TrendPill
                trend={trend}
                isPositiveGood={isPositiveGood}
                size={isSecondary ? 'sm' : 'sm'}
              />
            )}
          </div>

          {secondary && (
            <div className="text-xs text-slate-500 group-hover:text-slate-600 transition-colors duration-200 bg-slate-50/50 group-hover:bg-slate-100/60 px-2 py-1 rounded-md border border-slate-100/50 group-hover:border-slate-200/60">
              {secondary}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
