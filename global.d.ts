declare global {
  interface Window {
    __SUPABASE_CONFIG__?: {
      url: string;
      key: string;
    };
  }
}

export {};

