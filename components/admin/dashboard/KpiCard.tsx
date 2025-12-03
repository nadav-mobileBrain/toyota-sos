'use client';

import React from 'react';

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
}) {
  if (loading) {
    return (
      <div
        className={`rounded-xl border border-gray-200 bg-white shadow-sm animate-pulse ${
          variant === 'secondary' ? 'p-3' : 'p-5'
        }`}
      >
        <div className="mb-2 h-4 w-24 rounded bg-gray-200" />
        <div className="h-8 w-36 rounded bg-gray-300" />
        <div className="mt-2 h-3 w-28 rounded bg-gray-200" />
      </div>
    );
  }
  if (error) {
    return (
      <div
        className={`rounded-xl border border-red-400 bg-white shadow-md ${
          variant === 'secondary' ? 'p-3' : 'p-5'
        }`}
      >
        <div className="mb-2 text-sm font-medium text-red-700">{title}</div>
        <div className="text-sm text-red-700">שגיאה: {error}</div>
      </div>
    );
  }

  const isSecondary = variant === 'secondary';

  return (
    <div
      className={`group relative rounded-xl bg-white transition-all duration-200 hover:shadow-xl ${
        isSecondary
          ? 'border-r-4 border-blue-200 bg-gray-50 p-3 shadow-sm'
          : 'border border-gray-200 p-5 shadow-sm'
      }`}
    >
      <div
        className={`flex items-center justify-between ${
          isSecondary ? 'mb-1' : 'mb-3'
        }`}
      >
        <div
          className={`font-medium text-gray-600 ${
            isSecondary ? 'text-xs' : 'text-sm'
          }`}
        >
          {title}
        </div>
        {actionArea}
      </div>
      <div
        className={`font-bold tracking-tight text-gray-900 ${
          isSecondary ? 'text-xl' : 'text-3xl'
        }`}
      >
        {value}
      </div>
      {percentage !== undefined && percentage !== null ? (
        <div
          className={`font-medium text-gray-500 ${
            isSecondary ? 'mt-0.5 text-xs' : 'mt-1 text-sm'
          }`}
        >
          {percentage}% {percentageLabel}
        </div>
      ) : null}
      {secondary ? (
        <div className="mt-2 text-xs text-gray-500">{secondary}</div>
      ) : null}
    </div>
  );
}
