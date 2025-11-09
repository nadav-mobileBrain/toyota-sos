import { getSupabaseConfig } from '@/lib/getSupabaseConfig';

export function SupabaseConfigProvider() {
  const { url, key } = getSupabaseConfig();

  const configScript = `
    window.__SUPABASE_CONFIG__ = {
      url: "${url}",
      key: "${key}"
    };
  `;

  return (
    <script
      dangerouslySetInnerHTML={{ __html: configScript }}
      suppressHydrationWarning
    />
  );
}

