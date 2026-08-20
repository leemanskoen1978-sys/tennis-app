// De verbinding met Supabase.
//
// Zonder sleutels in .env draait de app op de lokale opslag (providers/mockStore). Deze
// client bestaat dan wel, maar wordt nergens aangesproken — zie providers/backend, dat die
// keuze op één plek maakt. Zo blijft de app zonder project of zonder internet gewoon
// starten, en hoeven de 531 tests geen databank.

import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Zijn de sleutels gezet? Zo niet, dan gebruikt de app zijn eigen opslag. */
export const supabaseConfigured = Boolean(url && anonKey);

export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'anon', {
  auth: {
    // De sessie hoort de app te overleven: wie de app dichtdoet en morgen weer opent, is nog
    // ingelogd. Op het web doet Supabase dat zelf met localStorage; op een telefoon bestaat
    // dat niet en moet AsyncStorage het doen.
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    // Alleen het web krijgt een sessie via de URL terug (na een bevestigingsmail).
    detectSessionInUrl: Platform.OS === 'web',
  },
});
