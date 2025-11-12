export type ConflictResult<T> = {
  merged: T;
  conflict: boolean;
  source: 'server' | 'local';
  ribbon?: { updatedBy?: string | null; updatedAt?: string | number | Date | null };
};

type Keys = {
  localModifiedAtKey?: string; // e.g., 'modifiedAt'
  serverUpdatedAtKey?: string; // e.g., 'updatedAt'
  serverUpdatedByKey?: string; // e.g., 'updatedBy'
};

function toMs(v: any): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
}

export function resolveConflict<T extends Record<string, any>>(
  local: T,
  server: T,
  keys: Keys = {}
): ConflictResult<T> {
  const localKey = keys.localModifiedAtKey ?? 'modifiedAt';
  const serverKey = keys.serverUpdatedAtKey ?? 'updatedAt';
  const byKey = keys.serverUpdatedByKey ?? 'updatedBy';

  const localTs = toMs(local?.[localKey]);
  const serverTs = toMs(server?.[serverKey]);

  if (serverTs >= localTs) {
    return {
      merged: server,
      conflict: localTs > 0 && serverTs > 0 && serverTs !== localTs,
      source: 'server',
      ribbon: { updatedBy: server?.[byKey] ?? null, updatedAt: server?.[serverKey] ?? null },
    };
  } else {
    return {
      merged: local,
      conflict: true,
      source: 'local',
      ribbon: undefined,
    };
  }
}


