// In-memory mock backend, persisted to AsyncStorage (localStorage on web).
// Same shape the Supabase layer will later return, so screens don't change.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Booking, Court, Lesson, StudentProgress, User, Settings } from '../lib/types';
import {
  seedUsers, seedCourts, seedBookings, seedLessons, seedProgress, defaultSettings,
} from '../lib/seed';
import { u9Trainings, U9_CATALOGUE_ID } from '../lib/trainings-u9';
import { installCatalogue } from '../lib/catalogue';

const STORE_KEY = 'tennis.mockStore.v1';

export interface StoreData {
  users: User[];
  courts: Court[];
  bookings: Booking[];
  lessons: Lesson[];
  progress: StudentProgress[];
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
    lessons: [...seedLessons],
    progress: [...seedProgress],
    settings: { ...defaultSettings },
    installed_catalogues: [],
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
    const stored = JSON.parse(raw) as StoreData;
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
