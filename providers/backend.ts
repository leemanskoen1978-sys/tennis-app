// Waar de gegevens vandaan komen: de databank van de club, of de opslag van dit toestel.
//
// Deze keuze staat hier en nergens anders. De schermen en de provider praten met één vorm —
// laden, opslaan, in- en uitloggen — en merken niet welke van de twee eronder zit. Zonder
// sleutels in .env is dat de lokale opslag, met sleutels Supabase.
//
// De lokale kant blijft bestaan en is geen dood hout: hij draagt de demo zonder internet,
// het werken aan een scherm zonder project, en de bestaande manier van inloggen (kies een
// profiel). Wat hij niet kan, is samenwerken — twee toestellen weten niets van elkaar.

import { supabaseConfigured } from '../lib/supabase';
import {
  bezetteUrenLokaal, loadStore, saveStore, resetStore, type StoreData,
} from './mockStore';
import {
  bezetteUrenUitSupabase, currentAppUserId, loadFromSupabase, onAuthChange, saveToSupabase,
  signIn, signOut, signUp, stuurHerstelmail, zetNieuwWachtwoord, type AuthGebeurtenis,
} from './supabaseStore';
import type { AanmeldUitkomst } from '../lib/wachtwoord';
import type { BezetUur } from '../lib/types';

/**
 * Hoe je in deze opzet binnenkomt.
 *  - 'profiel': je kiest een naam uit een lijst; er is geen wachtwoord (lokale opslag).
 *  - 'wachtwoord': e-mailadres en wachtwoord, echte accounts (Supabase).
 */
export type AuthMode = 'profiel' | 'wachtwoord';

export interface Backend {
  /** Voor de foutmelding en het inlogscherm: waar praat de app mee? */
  kind: 'lokaal' | 'supabase';
  authMode: AuthMode;
  /** Alles ophalen wat de ingelogde gebruiker mag zien. */
  load: () => Promise<StoreData>;
  /**
   * De nieuwe toestand bewaren. `previous` is wat er stond, en is nodig om te zien wat er
   * weg is: een rij die verdwijnt, is anders niet te onderscheiden van een rij die er nooit
   * was. De lokale opslag heeft hem niet nodig en negeert hem.
   */
  save: (previous: StoreData | null, next: StoreData) => Promise<void>;
  reset: () => Promise<StoreData>;
  /** Het id van de ingelogde gebruiker in de app, of null als er niemand ingelogd is. */
  currentUserId: () => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<AanmeldUitkomst>;
  signOut: () => Promise<void>;
  /** Roept terug als de login verandert; geeft de opzegging terug. */
  onAuthChange: (handler: (wat: AuthGebeurtenis) => void) => () => void;
  /** Een herstelmail sturen. Geeft nooit weg of het adres bestaat. */
  stuurHerstelmail: (email: string) => Promise<void>;
  /** Het nieuwe wachtwoord zetten; kan alleen binnen de sessie die de herstellink opende. */
  zetNieuwWachtwoord: (wachtwoord: string) => Promise<void>;
  /**
   * Wanneer deze trainer bezet is, in dit venster — alleen tijdstippen, geen namen.
   *
   * De enige leesweg hier die niet bij het opstarten meekomt. `load` haalt op wat je mag zien
   * en dat is voor een speler alleen zijn eigen agenda; dit beantwoordt de andere vraag, die
   * over iemands drukte gaat en niet over zijn lessen. Zie BEZETTE-UREN.sql.
   *
   * `null` betekent "ik weet het niet" en is iets anders dan een lege lijst: een club die het
   * SQL-bestand nog niet draaide, heeft deze bron niet. Dan hoort het scherm dat te zeggen in
   * plaats van te doen alsof de dag leeg is.
   */
  bezetteUren: (coachId: string, van: Date, tot: Date) => Promise<BezetUur[] | null>;
}

const localBackend: Backend = {
  kind: 'lokaal',
  authMode: 'profiel',
  load: loadStore,
  save: (_previous, next) => saveStore(next),
  reset: resetStore,
  // Bij de profielkeuze houdt de provider zelf bij wie er gekozen is (providers/session);
  // deze kant weet dat niet.
  currentUserId: async () => null,
  signIn: async () => {
    throw new Error('Inloggen met wachtwoord vraagt een Supabase-project.');
  },
  signUp: async () => {
    throw new Error('Aanmelden vraagt een Supabase-project.');
  },
  signOut: async () => {},
  onAuthChange: () => () => {},
  stuurHerstelmail: async () => {
    throw new Error('Wachtwoorden bestaan alleen met een databank.');
  },
  zetNieuwWachtwoord: async () => {
    throw new Error('Wachtwoorden bestaan alleen met een databank.');
  },
  // Lokaal is er geen grens tussen wat je mag zien en wat er is: alles staat in deze browser.
  // Deze kant kan de vraag dus altijd beantwoorden, en geeft nooit null.
  bezetteUren: bezetteUrenLokaal,
};

const supabaseBackend: Backend = {
  kind: 'supabase',
  authMode: 'wachtwoord',
  load: loadFromSupabase,
  save: saveToSupabase,
  reset: async () => {
    // Bewust niet mogelijk: de noodknop wist de opslag van dit toestel, en dat is iets heel
    // anders dan de gegevens van de hele club weggooien.
    throw new Error('Opnieuw beginnen kan alleen op de lokale opslag, niet op de databank.');
  },
  currentUserId: currentAppUserId,
  signIn,
  signUp,
  signOut,
  onAuthChange,
  stuurHerstelmail,
  zetNieuwWachtwoord,
  bezetteUren: bezetteUrenUitSupabase,
};

export const backend: Backend = supabaseConfigured ? supabaseBackend : localBackend;
