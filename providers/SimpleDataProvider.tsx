import React, {
  createContext, useContext, useEffect, useState, useCallback, useMemo,
} from 'react';
import { filterPendingPayment } from '../lib/payments';
import { loadCurrentUserId, saveCurrentUserId, clearCurrentUserId } from './session';
import { loadStore, saveStore, newId, type StoreData } from './mockStore';
import type {
  User, Court, Booking, Lesson, StudentProgress, Settings,
} from '../lib/types';

interface DataShape {
  users: User[];
  courts: Court[];
  bookings: Booking[];
  lessons: Lesson[];
  progress: StudentProgress[];
  settings: Settings;
  currentUser: User | null;
  loading: boolean;
  error: string | null;
  login: (userId: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  addBooking: (b: Omit<Booking, 'id'>) => Promise<void>;
  updateBooking: (id: string, patch: Partial<Booking>) => Promise<void>;
  deleteBooking: (id: string) => Promise<void>;
  addUser: (u: Omit<User, 'id'>) => Promise<void>;
  addLesson: (l: Omit<Lesson, 'id'>) => Promise<void>;
  addProgress: (p: Omit<StudentProgress, 'id'>) => Promise<void>;
  saveSettings: (s: Settings) => Promise<void>;
  emergencyCleanup: () => Promise<void>;
}

const Ctx = createContext<DataShape | null>(null);

export function SimpleDataProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<StoreData | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Persist and update React state in one place.
  const commit = useCallback(async (next: StoreData) => {
    setStore(next);
    await saveStore(next);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadStore();
      setStore(data);
    } catch (e: any) {
      setError(e?.message ?? 'Kon data niet laden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const data = await loadStore();
      setStore(data);
      setLoading(false);
      const savedId = await loadCurrentUserId();
      if (savedId) {
        const u = data.users.find((x) => x.id === savedId) ?? null;
        setCurrentUser(u);
      }
    })();
  }, []);

  const login = useCallback(async (userId: string) => {
    const u = store?.users.find((x) => x.id === userId) ?? null;
    if (u) {
      setCurrentUser(u);
      await saveCurrentUserId(userId);
    }
  }, [store]);

  const logout = useCallback(async () => {
    setCurrentUser(null);
    await clearCurrentUserId();
  }, []);

  const addBooking = useCallback(async (b: Omit<Booking, 'id'>) => {
    if (!store) return;
    await commit({ ...store, bookings: [...store.bookings, { ...b, id: newId('b') }] });
  }, [store, commit]);

  const updateBooking = useCallback(async (id: string, patch: Partial<Booking>) => {
    if (!store) return;
    await commit({
      ...store,
      bookings: store.bookings.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    });
  }, [store, commit]);

  const deleteBooking = useCallback(async (id: string) => {
    if (!store) return;
    await commit({ ...store, bookings: store.bookings.filter((b) => b.id !== id) });
  }, [store, commit]);

  const addUser = useCallback(async (u: Omit<User, 'id'>) => {
    if (!store) return;
    await commit({ ...store, users: [...store.users, { ...u, id: newId('u') }] });
  }, [store, commit]);

  const addLesson = useCallback(async (l: Omit<Lesson, 'id'>) => {
    if (!store) return;
    await commit({ ...store, lessons: [...store.lessons, { ...l, id: newId('l') }] });
  }, [store, commit]);

  const addProgress = useCallback(async (p: Omit<StudentProgress, 'id'>) => {
    if (!store) return;
    await commit({ ...store, progress: [...store.progress, { ...p, id: newId('p') }] });
  }, [store, commit]);

  const saveSettings = useCallback(async (s: Settings) => {
    if (!store) return;
    await commit({ ...store, settings: s });
  }, [store, commit]);

  // Explicit, confirmed-only cleanup. Removes bookings with an invalid/missing status.
  const emergencyCleanup = useCallback(async () => {
    if (!store) return;
    const valid = new Set(['pending', 'confirmed', 'cancelled', 'completed', 'synchronized']);
    await commit({
      ...store,
      bookings: store.bookings.filter((b) => valid.has(b.status as string)),
    });
  }, [store, commit]);

  const value = useMemo<DataShape>(() => ({
    users: store?.users ?? [],
    courts: store?.courts ?? [],
    bookings: store?.bookings ?? [],
    lessons: store?.lessons ?? [],
    progress: store?.progress ?? [],
    settings: store?.settings ?? { booking_end_time: '21:00', theme: 'light', language: 'nl' },
    currentUser,
    loading,
    error,
    login,
    logout,
    refresh,
    addBooking,
    updateBooking,
    deleteBooking,
    addUser,
    addLesson,
    addProgress,
    saveSettings,
    emergencyCleanup,
  }), [
    store, currentUser, loading, error, login, logout, refresh,
    addBooking, updateBooking, deleteBooking, addUser, addLesson,
    addProgress, saveSettings, emergencyCleanup,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSimpleData(): DataShape {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSimpleData must be used within SimpleDataProvider');
  return ctx;
}

export function usePendingPaymentBookings(): Booking[] {
  const { bookings } = useSimpleData();
  return filterPendingPayment(bookings);
}
