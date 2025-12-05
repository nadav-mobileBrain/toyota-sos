import { getSupabaseConfig } from '@/lib/getSupabaseConfig';

export function SupabaseConfigProvider() {
  const { url, key } = getSupabaseConfig();

  // Use JSON.stringify to safely serialize config values and prevent XSS
  const configScript = `
    window.__SUPABASE_CONFIG__ = ${JSON.stringify({ url, key })};
  `;

  return (
    <script
      dangerouslySetInnerHTML={{ __html: configScript }}
      suppressHydrationWarning
    />
  );
}

