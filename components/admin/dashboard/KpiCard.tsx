'use client';

import React from 'react';

export function KpiCard({
  title,
  value,
  secondary,
  loading,
  error,
  actionArea,
}: {
  title: string;
  value: React.ReactNode;
  secondary?: React.ReactNode;
  loading?: boolean;
  error?: string | null;
  actionArea?: React.ReactNode;
}) {
  if (loading) {
    return (
      <div className="rounded-xl border border-primary/20 bg-white p-5 shadow-md animate-pulse">
        <div className="mb-2 h-4 w-24 rounded bg-gray-200" />
        <div className="h-8 w-36 rounded bg-gray-300" />
        <div className="mt-2 h-3 w-28 rounded bg-gray-200" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-xl border border-red-400 bg-white p-5 shadow-md">
        <div className="mb-2 text-sm font-medium text-red-700">{title}</div>
        <div className="text-sm text-red-700">שגיאה: {error}</div>
      </div>
    );
  }
  return (
    <div className="group relative rounded-xl border-2 border-primary bg-white p-5 shadow-md transition-all duration-200 hover:border-primary/50 hover:shadow-lg">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-medium text-gray-600">{title}</div>
        {actionArea}
      </div>
      <div className="text-3xl font-bold tracking-tight text-gray-900">
        {value}
      </div>
      {secondary ? (
        <div className="mt-2 text-xs text-gray-500">{secondary}</div>
      ) : null}
    </div>
  );
}
