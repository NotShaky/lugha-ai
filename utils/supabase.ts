import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

type SupabaseLike = SupabaseClient<any, 'public', any>;

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_KEY;

const createMissingConfigClient = (): SupabaseLike => {
  const error = new Error(
    'Supabase environment variables are missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in the root .env file.',
  );

  const missingClient = new Proxy(function () {}, {
    get() {
      return missingClient;
    },
    apply() {
      return Promise.reject(error);
    },
  }) as unknown as SupabaseLike;

  return missingClient;
};

const isWeb = Platform.OS === 'web';
const isBrowser = typeof window !== 'undefined';

const webStorage = {
  getItem: (key: string): string | null => {
    return isBrowser ? window.localStorage.getItem(key) : null;
  },
  setItem: (key: string, value: string): void => {
    if (isBrowser) window.localStorage.setItem(key, value);
  },
  removeItem: (key: string): void => {
    if (isBrowser) window.localStorage.removeItem(key);
  },
};

export const supabase: SupabaseLike = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: isWeb ? webStorage : AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : createMissingConfigClient();