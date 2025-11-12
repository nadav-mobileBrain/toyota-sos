import { createServiceRoleClient } from '@/lib/auth';

export type FlagRow = { key: string; enabled: boolean; updated_at: string; updated_by: string | null };

export async function listFlags() {
  const supa = createServiceRoleClient();
  const { data, error } = await supa.from('feature_flags').select('key,enabled,updated_at,updated_by').order('key', { ascending: true });
  if (error) return { status: 500, body: { error: error.message } };
  return { status: 200, body: { data: (data as FlagRow[]) ?? [] } };
}

export async function setFlag(key: string, enabled: boolean, actorId?: string | null) {
  const supa = createServiceRoleClient();
  const upsert = { key, enabled, updated_by: actorId ?? null, updated_at: new Date().toISOString() };
  const { data, error } = await supa.from('feature_flags').upsert(upsert, { onConflict: 'key' }).select('key,enabled,updated_at,updated_by').single();
  if (error) return { status: 500, body: { error: error.message } };
  return { status: 200, body: { data } };
}


