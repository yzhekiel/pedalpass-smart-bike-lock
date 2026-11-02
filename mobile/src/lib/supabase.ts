/**
 * Supabase client for the mobile app.
 *
 * Keys come from mobile/.env.local (copy .env.example). Expo only exposes
 * variables that start with EXPO_PUBLIC_. Restart `npx expo start` after editing it.
 * The publishable key is safe to ship in the app — the database security rules (RLS) protect the data.
 */
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** False until the .env.local keys are filled in — the app keeps using mock data until then. */
export const isSupabaseConfigured = Boolean(url && publishableKey);

export const supabase = createClient(url ?? 'http://localhost', publishableKey ?? 'missing-key', {
  auth: {
    storage: AsyncStorage, // keep the user signed in between app launches
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Only refresh the login token while the app is open
AppState.addEventListener('change', (state) => {
  if (!isSupabaseConfigured) return;
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
