import { createClient, SupabaseClient } from '@supabase/supabase-js';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;

let clientInstance: SupabaseClient | null = null;
let configLoaded = false;

async function loadSupabaseConfig(): Promise<{ url: string; anonKey: string }> {
  const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/supabase-config`);
  if (!response.ok) {
    throw new Error('Failed to load Supabase config');
  }
  const data = await response.json();
  return { url: data.url, anonKey: data.anonKey };
}

export async function initSupabaseClient(): Promise<SupabaseClient> {
  if (clientInstance && configLoaded) {
    return clientInstance;
  }

  const config = await loadSupabaseConfig();
  clientInstance = createClient(config.url, config.anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
    },
  });
  configLoaded = true;
  return clientInstance;
}

export function getSupabaseClient(): SupabaseClient {
  if (!clientInstance) {
    throw new Error('Supabase client not initialized. Call initSupabaseClient first.');
  }
  return clientInstance;
}

export function clearSupabaseClient(): void {
  clientInstance = null;
  configLoaded = false;
}
