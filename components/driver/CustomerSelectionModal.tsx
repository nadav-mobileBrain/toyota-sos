'use client';

import React, { useState, useEffect } from 'react';
import { SaveIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type CustomerSelectionModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stops: {
    id: string;
    clientName?: string | null;
    address: string;
    is_picked_up?: boolean;
  }[];
  onSubmit: (updates: { id: string; is_picked_up: boolean }[]) => Promise<void>;
};

export function CustomerSelectionModal({
  open,
  onOpenChange,
  stops,
  onSubmit,
}: CustomerSelectionModalProps) {
  const [selections, setSelections] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize selections when modal opens or stops change
  useEffect(() => {
    if (open) {
      const initial: Record<string, boolean> = {};
      stops.forEach((stop) => {
        // Default to true if undefined, or use existing value
        initial[stop.id] = stop.is_picked_up ?? true;
      });
      setSelections(initial);
      setError(null);
    }
  }, [open, stops]);

  if (!open) return null;

  const handleToggle = (stopId: string) => {
    setSelections((prev) => ({
      ...prev,
      [stopId]: !prev[stopId],
    }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const updates = Object.entries(selections).map(([id, is_picked_up]) => ({
        id,
        is_picked_up,
      }));
      await onSubmit(updates);
      onOpenChange(false);
    } catch (err) {
      setError('אירעה שגיאה בשמירה. אנא נסה שוב.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">
            בחר לקוחות שנאספו
          </h2>
          <button
            onClick={() => onOpenChange(false)}
            className="text-gray-400 hover:text-gray-500 transition-colors"
            disabled={submitting}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <p className="text-sm text-gray-600 mb-4">
            אנא סמן את הלקוחות שנאספו בפועל בנסיעה זו:
          </p>

          <div className="space-y-3">
            {stops.map((stop, index) => (
              <div
                key={stop.id}
                className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => handleToggle(stop.id)}
              >
                <div className="flex h-5 items-center">
                  <input
                    type="checkbox"
                    className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={selections[stop.id] ?? true}
                    onChange={() => handleToggle(stop.id)}
                    onClick={(e) => e.stopPropagation()}
                    disabled={submitting}
                  />
                </div>
                <div className="flex-1 text-sm">
                  <div className="font-medium text-gray-900">
                    {stop.clientName || `לקוח ללא שם (${index + 1})`}
                  </div>
                  <div className="text-gray-500 mt-0.5">{stop.address}</div>
                </div>
              </div>
            ))}
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-md">
              {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            ביטול
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {submitting ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent ml-2" />
                שומר...
              </>
            ) : (
              <>
                <SaveIcon className="w-4 h-4 ml-2" />
                אישור והתחל נסיעה
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
