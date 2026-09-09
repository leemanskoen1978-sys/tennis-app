// In-memory mock backend, persisted to AsyncStorage (localStorage on web).
// Same shape the Supabase layer will later return, so screens don't change.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  BezetUur, Beurtenkaart, Booking, Court, LesGroep, Lesplanning, Lesson, Memo, OuderKind,
  PlayerGoal, SickLeave, StudentProgress, User, Settings,
} from '../lib/types';
import {
  seedUsers, seedCourts, seedBookings, seedLessons, seedProgress, seedRelaties,
  defaultSettings,
} from '../lib/seed';
import { u9Trainings, U9_CATALOGUE_ID } from '../lib/trainings-u9';
import { installCatalogue } from '../lib/catalogue';
import { migrateBookings } from '../lib/migrate';

const STORE_KEY = 'tennis.mockStore.v1';

export interface StoreData {
  users: User[];
  courts: Court[];
  bookings: Booking[];
  beurtenkaarten: Beurtenkaart[];
  lessons: Lesson[];
  progress: StudentProgress[];
  memos: Memo[];
  goals: PlayerGoal[];
  /** De koppelingen ouder-kind, aangevraagd of beslist. Zie lib/types: OuderKind. */
  relaties: OuderKind[];
  /** De lesgroepen van de club, actief en gearchiveerd. Zie lib/types: LesGroep. */
  lesGroepen: LesGroep[];
  /** De ziekmeldingen van de trainers, open én ingetrokken. Zie lib/types: SickLeave. */
  sickLeaves: SickLeave[];
  lesPlanning: Lesplanning[];
  settings: Settings;
  /** Which shipped lesson catalogues have already been added, so a deleted
   *  training stays deleted instead of reappearing on the next load. */
  installed_catalogues?: string[];
}

function freshSeed(): StoreData {
  return {
    users: [...seedUsers],
    courts: [...seedCourts],
    bookings: [...seedBookings],
    beurtenkaarten: [],
    lessons: [...seedLessons],
    progress: [...seedProgress],
    memos: [],
    goals: [],
    relaties: [...seedRelaties],
    // Geen zaaigegevens: een club die begint heeft haar groepen nog niet ingedeeld.
    lesGroepen: [],
    // Ook hier geen zaaigegevens: een club die begint heeft nog niemand ziek gemeld.
    sickLeaves: [],
    lesPlanning: [],
    settings: { ...defaultSettings },
    installed_catalogues: [],
  };
}

/**
 * A store written by an older version has no `goals` key. Reading it back would hand the
 * screens `undefined` where they expect a list, so every collection is filled in on load.
 * Cheap, and it means a new collection never needs a wipe to arrive.
 */
function withDefaults(data: StoreData): StoreData {
  return {
    ...data,
    users: data.users ?? [],
    courts: data.courts ?? [],
    bookings: migrateBookings(data.bookings),
    beurtenkaarten: data.beurtenkaarten ?? [],
    lessons: data.lessons ?? [],
    progress: data.progress ?? [],
    // Een opslag van vóór de memo's heeft dit veld niet; leeg is dan het goede antwoord.
    memos: data.memos ?? [],
    goals: data.goals ?? [],
    // Een opslag van vóór de ouderkoppeling heeft dit veld niet.
    relaties: data.relaties ?? [],
    // Een opslag van vóór de lesgroepen heeft dit veld niet.
    lesGroepen: data.lesGroepen ?? [],
    // Een opslag van vóór de ziekmeldingen heeft dit veld niet. Zonder deze terugval leest
    // elk scherm dat er straks over mapt `undefined` in plaats van een lege lijst, en dan
    // crasht het bij de eerste `.map(...)` — voor iedereen die de app al gebruikte.
    sickLeaves: data.sickLeaves ?? [],
    lesPlanning: data.lesPlanning ?? [],
    settings: { ...defaultSettings, ...data.settings },
  };
}

/**
 * Shipped lesson catalogues are added to whatever store already exists, once each. Seeding
 * only runs on an empty store, so a new catalogue would otherwise never reach anyone who
 * has been using the app — and wiping their bookings to deliver it is not a trade worth
 * making.
 */
function withCatalogues(data: StoreData): StoreData {
  return installCatalogue(data, U9_CATALOGUE_ID, u9Trainings);
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Load the persisted store, seeding on first run. Never auto-deletes corrupt data. */
export async function loadStore(): Promise<StoreData> {
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    if (!raw) {
      const seeded = withCatalogues(freshSeed());
      await saveStore(seeded);
      return seeded;
    }
    const stored = withDefaults(JSON.parse(raw) as StoreData);
    const merged = withCatalogues(stored);
    if (merged !== stored) await saveStore(merged);
    return merged;
  } catch {
    // Parse/read error: surface fresh seed in-memory but do NOT overwrite storage
    // (no automatic cleanup — that is only the explicit emergency button's job).
    return withCatalogues(freshSeed());
  }
}

export async function saveStore(data: StoreData): Promise<void> {
  try {
    await AsyncStorage.setItem(STORE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export async function resetStore(): Promise<StoreData> {
  const seeded = withCatalogues(freshSeed());
  await saveStore(seeded);
  return seeded;
}

/**
 * De bezette uren van één trainer, uit de opslag van dit toestel.
 *
 * Op de lokale opslag is er geen grens tussen wat je mag zien en wat er is: alles staat in
 * deze browser en het is allemaal van jou. Deze functie kan de vraag dus gewoon beantwoorden,
 * en dat is de bedoeling — Reserveren hoort in een demo net zo goed te werken als op de
 * databank, en met dezelfde uitkomst.
 *
 * Waarom hij er dan überhaupt is, terwijl de app de lessen hier toch al heeft: zodat het
 * scherm één weg heeft naar het antwoord in plaats van twee. Zonder deze zou Reserveren
 * moeten weten welke opslag eronder zit, en dat is precies wat providers/backend voorkomt.
 */
export async function bezetteUrenLokaal(
  coachId: string,
  van: Date,
  tot: Date,
): Promise<BezetUur[]> {
  const store = await loadStore();
  const vanMs = van.getTime();
  const totMs = tot.getTime();

  return store.bookings
    .filter((b) => {
      if (b.coach_id !== coachId) return false;
      // Zelfde regel als in de databank (BEZETTE-UREN.sql) en in lib/slots: een afgezegde
      // les houdt geen uur meer bezet.
      if (b.status === 'cancelled') return false;
      const start = new Date(b.start_time).getTime();
      const eind = new Date(b.end_time).getTime();
      if (!Number.isFinite(start) || !Number.isFinite(eind)) return false;
      // Overlap met het venster, niet "begint erin".
      return start < totMs && eind > vanMs;
    })
    .map((b) => ({ start_time: b.start_time, end_time: b.end_time }))
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
}
