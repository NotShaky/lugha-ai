import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

// Replace these with your actual Supabase URL and Anon Key!
const supabaseUrl = 'https://kpncjxfyzfgtxsyrrnbc.supabase.co';
const supabaseAnonKey = 'sb_publishable_2b677eiHDDHLCxOVFTrKqg_7T11eOo7';

const isWeb = Platform.OS === 'web';
const isBrowser = typeof window !== 'undefined';

// Expo web renders on the server too, where `window` does not exist.
// This adapter prevents SSR crashes by returning empty storage on the server.
const webStorage = {
  getItem: (key: string) => Promise.resolve(isBrowser ? window.localStorage.getItem(key) : null),
  setItem: (key: string, value: string) => Promise.resolve(isBrowser ? window.localStorage.setItem(key, value) : undefined),
  removeItem: (key: string) => Promise.resolve(isBrowser ? window.localStorage.removeItem(key) : undefined),
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: isWeb ? webStorage : AsyncStorage,
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});