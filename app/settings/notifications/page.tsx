'use client';

import React, { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/auth';
import { getDriverSession } from '@/lib/auth';

type EventType = 'assigned' | 'updated' | 'started' | 'completed' | 'blocked';

interface Preference {
  id: string;
  event_type: EventType;
  enabled: boolean;
}

export default function NotificationSettingsPage() {
  const [preferences, setPreferences] = useState<Map<EventType, boolean>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  const eventTypes: { type: EventType; label: string; desc: string }[] = [
    { type: 'assigned', label: 'משימה הוקצתה', desc: 'הודעה כשמשימה חדשה מוקצית אליך' },
    { type: 'updated', label: 'משימה עודכנה', desc: 'הודעה כשמשימה שלך עודכנה' },
    { type: 'started', label: 'משימה התחילה', desc: 'הודעה כשנהג התחיל משימה (למנהלים בלבד)' },
    { type: 'completed', label: 'משימה הושלמה', desc: 'הודעה כשמשימה הושלמה (למנהלים בלבד)' },
    { type: 'blocked', label: 'משימה חסומה', desc: 'הודעה כשמשימה חסומה (למנהלים בלבד)' },
  ];

  useEffect(() => {
    const loadPreferences = async () => {
      const supa = createBrowserClient();
      const session = getDriverSession();
      
      if (!session?.userId) {
        setLoading(false);
        return;
      }

      const { data, error } = await supa
        .from('notification_preferences')
        .select('*')
        .eq('user_id', session.userId);

      if (!error && data) {
        const prefs = new Map<EventType, boolean>();
        eventTypes.forEach(({ type }) => {
          const pref = (data as any[]).find((p) => p.event_type === type);
          prefs.set(type, pref?.enabled ?? true);
        });
        setPreferences(prefs);
      }
      setLoading(false);
    };

    loadPreferences();
  }, []);

  const handleToggle = (eventType: EventType) => {
    setPreferences((prev) => new Map(prev).set(eventType, !prev.get(eventType)));
    setSaved(false);
  };

  const handleSave = async () => {
    const supa = createBrowserClient();
    const session = getDriverSession();

    if (!session?.userId) return;

    try {
      const toUpsert = Array.from(preferences.entries()).map(([eventType, enabled]) => ({
        user_id: session.userId,
        event_type: eventType,
        enabled,
      }));

      const { error } = await supa.from('notification_preferences').upsert(toUpsert, { onConflict: 'user_id,event_type' });

      if (!error) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (e) {
      console.error('Failed to save preferences:', e);
    }
  };

  if (loading) return <div className="p-4 text-center">טוען...</div>;

  return (
    <main dir="rtl" className="min-h-screen bg-gradient-to-b from-toyota-50 to-white p-4">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-2 text-toyota-primary">הגדרות התראות</h1>
        <p className="text-sm text-gray-600 mb-6">בחר אילו התראות ברצונך לקבל</p>

        <div className="space-y-4 mb-6">
          {eventTypes.map(({ type, label, desc }) => (
            <div key={type} className="border rounded-lg p-4 bg-white shadow-sm">
              <div className="flex items-center gap-3 mb-1">
                <input
                  type="checkbox"
                  id={type}
                  checked={preferences.get(type) ?? true}
                  onChange={() => handleToggle(type)}
                  className="w-5 h-5 accent-toyota-primary"
                />
                <label htmlFor={type} className="font-medium cursor-pointer">
                  {label}
                </label>
              </div>
              <p className="text-xs text-gray-500 mr-8">{desc}</p>
            </div>
          ))}
        </div>

        <button
          onClick={handleSave}
          className="w-full bg-toyota-primary text-white font-semibold py-3 rounded-lg hover:bg-toyota-600 transition-colors min-h-[44px]"
        >
          שמור הגדרות
        </button>

        {saved && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm text-center">
            ✓ ההגדרות נשמרו בהצלחה
          </div>
        )}

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-xs text-gray-700">
          <p className="font-semibold mb-2">💡 טיפים:</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>כיבוי התראות יעזור לשמור על סוללה</li>
            <li>התראות דחופות (משימה חסומה) תמיד יישלחו</li>
            <li>ניתן לשנות הגדרות בכל זמן</li>
          </ul>
        </div>
      </div>
    </main>
  );
}

