import { createServiceRoleClient } from '@/lib/auth';

export type FlagRow = { key: string; enabled: boolean; updated_at: string; updated_by: string | null };

export async function listFlags() {
  const supa = createServiceRoleClient();
  // NOTE: Historical schema uses "flag_name" instead of "key"
  // Alias "flag_name" -> "key" to keep API stable for clients.
  const { data, error } = await supa
    .from('feature_flags')
    .select('key:flag_name,enabled,updated_at,updated_by')
    .order('flag_name', { ascending: true });
  if (error) return { status: 500, body: { error: error.message } };
  return { status: 200, body: { data: (data as FlagRow[]) ?? [] } };
}

export async function setFlag(key: string, enabled: boolean, actorId?: string | null) {
  const supa = createServiceRoleClient();
  // Store under legacy column "flag_name" and alias back to "key" in the response.
  const upsert = { flag_name: key, enabled, updated_by: actorId ?? null, updated_at: new Date().toISOString() };
  const { data, error } = await supa
    .from('feature_flags')
    .upsert(upsert, { onConflict: 'flag_name' })
    .select('key:flag_name,enabled,updated_at,updated_by')
    .single();
  if (error) return { status: 500, body: { error: error.message } };
  return { status: 200, body: { data } };
}


