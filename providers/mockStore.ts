// In-memory mock backend, persisted to AsyncStorage (localStorage on web).
// Same shape the Supabase layer will later return, so screens don't change.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Booking, Court, Lesson, StudentProgress, User, Settings } from '../lib/types';
import {
  seedUsers, seedCourts, seedBookings, seedLessons, seedProgress, defaultSettings,
} from '../lib/seed';

const STORE_KEY = 'tennis.mockStore.v1';

export interface StoreData {
  users: User[];
  courts: Court[];
  bookings: Booking[];
  lessons: Lesson[];
  progress: StudentProgress[];
  settings: Settings;
}

function freshSeed(): StoreData {
  return {
    users: [...seedUsers],
    courts: [...seedCourts],
    bookings: [...seedBookings],
    lessons: [...seedLessons],
    progress: [...seedProgress],
    settings: { ...defaultSettings },
  };
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Load the persisted store, seeding on first run. Never auto-deletes corrupt data. */
export async function loadStore(): Promise<StoreData> {
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    if (!raw) {
      const seeded = freshSeed();
      await saveStore(seeded);
      return seeded;
    }
    return JSON.parse(raw) as StoreData;
  } catch {
    // Parse/read error: surface fresh seed in-memory but do NOT overwrite storage
    // (no automatic cleanup — that is only the explicit emergency button's job).
    return freshSeed();
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
  const seeded = freshSeed();
  await saveStore(seeded);
  return seeded;
}
