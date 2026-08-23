// De verbinding met Supabase.
//
// Zonder sleutels in .env draait de app op de lokale opslag (providers/mockStore). Deze
// client bestaat dan wel, maar wordt nergens aangesproken — zie providers/backend, dat die
// keuze op één plek maakt. Zo blijft de app zonder project of zonder internet gewoon
// starten, en hoeven de tests geen databank.

import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { resolveSupabaseConfig } from './supabase-config';

const config = resolveSupabaseConfig(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
);

/** Zijn de sleutels gezet? Zo niet, dan gebruikt de app zijn eigen opslag. */
export const supabaseConfigured = config.configured;

/**
 * Het adres van het project. Nodig om te weten onder welke sleutel de sessie in de opslag
 * staat — zie `wisBewaardeSessie` in providers/supabaseStore.
 */
export const supabaseUrl = config.url;

export const supabase = createClient(config.url, config.anonKey, {
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
