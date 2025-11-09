// Server-side only - reads environment variables
// This file should ONLY be imported on the server side

export function getSupabaseConfig() {
  const env = process.env.NEXT_PUBLIC_ENVIRONMENT || 'PROD';
  
  const url =
    process.env[`NEXT_PUBLIC_SUPABASE_URL_${env.toUpperCase()}`] ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const key =
    process.env[`NEXT_PUBLIC_SUPABASE_ANON_KEY_${env.toUpperCase()}`] ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error(
      `Missing Supabase URL. Please set NEXT_PUBLIC_SUPABASE_URL_${env.toUpperCase()} in .env.local`
    );
  }

  if (!key) {
    throw new Error(
      `Missing Supabase Anon Key. Please set NEXT_PUBLIC_SUPABASE_ANON_KEY_${env.toUpperCase()} in .env.local`
    );
  }

  return { url, key, env };
}

