import React, {
  createContext, useContext, useEffect, useState, useCallback, useMemo,
} from 'react';
import { filterPendingPayment } from '../lib/payments';
import { loadCurrentUserId, saveCurrentUserId, clearCurrentUserId } from './session';
import { loadStore, saveStore, resetStore, newId, type StoreData } from './mockStore';
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
  clearError: () => void;
  login: (userId: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  addBooking: (b: Omit<Booking, 'id'>) => Promise<Booking | null>;
  updateBooking: (id: string, patch: Partial<Booking>) => Promise<void>;
  deleteBooking: (id: string) => Promise<void>;
  addUser: (u: Omit<User, 'id'>) => Promise<void>;
  addLesson: (l: Omit<Lesson, 'id'>) => Promise<void>;
  addProgress: (p: Omit<StudentProgress, 'id'>) => Promise<void>;
  saveSettings: (s: Settings) => Promise<void>;
  emergencyCleanup: () => Promise<void>;
}

const Ctx = createContext<DataShape | null>(null);

/** Two bookings clash when same coach + overlapping time window (and not cancelled). */
function overlaps(a: Pick<Booking, 'coach_id' | 'start_time' | 'end_time' | 'status'>, list: Booking[]): boolean {
  const aStart = new Date(a.start_time).getTime();
  const aEnd = new Date(a.end_time).getTime();
  return list.some((b) => {
    if (b.status === 'cancelled' || b.coach_id !== a.coach_id) return false;
    const bStart = new Date(b.start_time).getTime();
    const bEnd = new Date(b.end_time).getTime();
    return aStart < bEnd && bStart < aEnd;
  });
}

export function SimpleDataProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<StoreData | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Persist then update state; surface any failure instead of swallowing it.
  const commit = useCallback(async (next: StoreData) => {
    try {
      await saveStore(next);
      setStore(next);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Opslaan mislukt');
      throw e;
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadStore();
      setStore(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Kon data niet laden');
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
      if (savedId && data.users.some((u) => u.id === savedId)) {
        setCurrentUserId(savedId);
      }
    })();
  }, []);

  const login = useCallback(async (userId: string) => {
    setCurrentUserId(userId);
    await saveCurrentUserId(userId);
  }, []);

  const logout = useCallback(async () => {
    setCurrentUserId(null);
    await clearCurrentUserId();
  }, []);

  const addBooking = useCallback(async (b: Omit<Booking, 'id'>): Promise<Booking | null> => {
    if (!store) return null;
    if (overlaps(b, store.bookings)) {
      setError('Dit tijdslot is al geboekt bij deze coach.');
      return null;
    }
    const created: Booking = { ...b, id: newId('b') };
    await commit({ ...store, bookings: [...store.bookings, created] });
    return created;
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

  // Emergency recovery: resets everything to the seed. Destructive by design and
  // ONLY reachable behind an explicit confirmation — never automatic.
  const emergencyCleanup = useCallback(async () => {
    const seeded = await resetStore();
    setStore(seeded);
    setCurrentUserId(null);
    await clearCurrentUserId();
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const currentUser = useMemo(
    () => store?.users.find((u) => u.id === currentUserId) ?? null,
    [store, currentUserId],
  );

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
    clearError,
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
    store, currentUser, loading, error, clearError, login, logout, refresh,
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
  return useMemo(() => filterPendingPayment(bookings), [bookings]);
}
