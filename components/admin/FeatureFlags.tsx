'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { getFlags, setFlag as apiSetFlag, subscribe } from '@/lib/flags';

export function FeatureFlags() {
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState('');

  useEffect(() => {
    setLoading(true);
    getFlags()
      .then((obj) => setFlags(obj))
      .catch((e) => setError(e?.message || 'שגיאה בטעינת דגלים'))
      .finally(() => setLoading(false));
    const unsub = subscribe((snapshot) => setFlags(snapshot));
    return () => {
      unsub();
    };
  }, []);

  const keys = useMemo(() => Object.keys(flags).sort(), [flags]);

  const toggle = async (key: string) => {
    setError(null);
    try {
      await apiSetFlag(key, !flags[key]);
    } catch (e: any) {
      setError(e?.message || 'עדכון נכשל');
    }
  };

  const addNew = async () => {
    const k = newKey.trim();
    if (!k) return;
    setNewKey('');
    setError(null);
    try {
      // by convention: creating sets false first then toggles true if desired
      await apiSetFlag(k, true);
    } catch (e: any) {
      setError(e?.message || 'יצירה נכשלה');
    }
  };

  return (
    <section dir="rtl" className="w-full max-w-2xl">
      <h2 className="mb-3 text-lg font-semibold">ניהול דגלי פיצ'רים</h2>
      {loading ? <div role="status">טוען...</div> : null}
      {error ? <div role="alert" className="mb-2 text-sm text-red-600">{error}</div> : null}

      <div className="mb-3 flex items-center gap-2">
        <input
          aria-label="מפתח דגל חדש"
          className="rounded border border-gray-300 p-2 text-sm flex-1"
          placeholder="הוסף דגל (מפתח)"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
        />
        <button
          type="button"
          className="rounded border px-3 py-2 text-sm hover:bg-gray-50"
          onClick={addNew}
        >
          הוסף
        </button>
      </div>

      <ul className="divide-y rounded border bg-white">
        {keys.length === 0 ? (
          <li className="p-3 text-sm text-gray-500">אין דגלים עדיין.</li>
        ) : null}
        {keys.map((k) => (
          <li key={k} className="flex items-center justify-between p-3">
            <div className="flex flex-col">
              <span className="font-mono text-sm">{k}</span>
              <span className="text-xs text-gray-500">{flags[k] ? 'פעיל' : 'כבוי'}</span>
            </div>
            <button
              type="button"
              className={
                'rounded px-3 py-1 text-sm ' +
                (flags[k] ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-200 hover:bg-gray-300')
              }
              onClick={() => toggle(k)}
              aria-label={`החלף דגל ${k}`}
            >
              {flags[k] ? 'Disable' : 'Enable'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default FeatureFlags;


