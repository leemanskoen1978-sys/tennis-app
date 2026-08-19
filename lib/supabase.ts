// Supabase client — prepared for later. The running app currently uses the
// in-memory mock in providers/mockStore.ts and does NOT require these env vars.
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anonKey);

export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'anon', {
  auth: { persistSession: false },
});
