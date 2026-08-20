import React, {
  createContext, useContext, useEffect, useState, useCallback, useMemo,
} from 'react';
import { pendingPaymentsFor } from '../lib/payments';
import { loadCurrentUserId, saveCurrentUserId, clearCurrentUserId } from './session';
import { loadStore, saveStore, resetStore, newId, type StoreData } from './mockStore';
import { upsertGoal, removeGoal } from '../lib/goals';
import {
  SESSIONS_PER_CARD, usableCardFor, useSession, releaseSession, removeManualSession,
} from '../lib/beurtenkaart';
import type {
  User, Court, Booking, Lesson, StudentProgress, PlayerGoal, Settings,
  Beurtenkaart, PaymentMethod,
} from '../lib/types';

interface DataShape {
  users: User[];
  courts: Court[];
  bookings: Booking[];
  lessons: Lesson[];
  progress: StudentProgress[];
  goals: PlayerGoal[];
  beurtenkaarten: Beurtenkaart[];
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
  /** Zet de betaalwijze en houdt de beurtenkaart in de pas. */
  setPaymentMethod: (bookingId: string, method: PaymentMethod) => Promise<void>;
  addBeurtenkaart: (playerId: string) => Promise<void>;
  updateBeurtenkaart: (id: string, patch: Pick<Beurtenkaart, 'remarks'>) => Promise<void>;
  /** Handmatig een beurt af- of bijboeken op het kaartscherm. */
  addCardSession: (id: string) => Promise<void>;
  removeCardSession: (id: string) => Promise<void>;
  /** Verwijdert de kaart; lessen die eraan hingen vallen terug op 'open'. */
  deleteBeurtenkaart: (id: string) => Promise<void>;
  addUser: (u: Omit<User, 'id'>) => Promise<void>;
  /** `role` blijft erbuiten: van een trainer een speler maken raakt boekingen,
   *  lessen en voortgang, en is geen formulierdetail. */
  updateUser: (id: string, patch: Partial<Omit<User, 'id' | 'role'>>) => Promise<void>;
  addLesson: (l: Omit<Lesson, 'id'>) => Promise<void>;
  updateLesson: (id: string, patch: Partial<Lesson>) => Promise<void>;
  deleteLesson: (id: string) => Promise<void>;
  addProgress: (p: Omit<StudentProgress, 'id'>) => Promise<void>;
  /** Store a goal under its own id — a horizon holds as many as the coach wants. */
  saveGoal: (goal: PlayerGoal) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  saveSettings: (s: Settings) => Promise<void>;
  emergencyCleanup: () => Promise<void>;
}

const Ctx = createContext<DataShape | null>(null);

const nowISO = () => new Date().toISOString();

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

/** Een geannuleerde of verwijderde les mag geen beurt blijven opeten. */
function releaseCardFor(data: StoreData, booking: Booking | undefined): Beurtenkaart[] {
  if (!booking?.beurtenkaart_id) return data.beurtenkaarten;
  return data.beurtenkaarten.map((c) =>
    c.id === booking.beurtenkaart_id ? releaseSession(c, booking.id) : c,
  );
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
    const booking = store.bookings.find((b) => b.id === id);
    const cancelling = patch.status === 'cancelled' && booking?.status !== 'cancelled';
    const cards = cancelling ? releaseCardFor(store, booking) : store.beurtenkaarten;
    await commit({
      ...store,
      beurtenkaarten: cards,
      bookings: store.bookings.map((b) =>
        b.id === id
          ? {
            ...b,
            ...patch,
            ...(cancelling
              ? { payment_method: 'open' as PaymentMethod, beurtenkaart_id: undefined }
              : {}),
          }
          : b,
      ),
    });
  }, [store, commit]);

  const deleteBooking = useCallback(async (id: string) => {
    if (!store) return;
    const booking = store.bookings.find((b) => b.id === id);
    await commit({
      ...store,
      beurtenkaarten: releaseCardFor(store, booking),
      bookings: store.bookings.filter((b) => b.id !== id),
    });
  }, [store, commit]);

  const setPaymentMethod = useCallback(async (bookingId: string, method: PaymentMethod) => {
    if (!store) return;
    const booking = store.bookings.find((b) => b.id === bookingId);
    if (!booking) return;

    let cards = store.beurtenkaarten;
    let cardId = booking.beurtenkaart_id;

    // Weg van de beurtenkaart: de beurt komt terug voor hij ergens anders heen kan.
    if (cardId && method !== 'beurtenkaart') {
      cards = cards.map((c) => (c.id === cardId ? releaseSession(c, bookingId) : c));
      cardId = undefined;
    }

    // Dezelfde kaart nog eens kiezen kost geen tweede beurt: `cardId` staat er al.
    if (method === 'beurtenkaart' && !cardId) {
      const card = usableCardFor(cards, booking.player_id);
      if (!card) {
        setError('Geen beurtenkaart met beurten over voor deze speler.');
        return;
      }
      cards = cards.map((c) => (c.id === card.id ? useSession(c, bookingId, booking.start_time) : c));
      cardId = card.id;
    }

    setError(null);
    await commit({
      ...store,
      beurtenkaarten: cards,
      bookings: store.bookings.map((b) =>
        b.id === bookingId ? { ...b, payment_method: method, beurtenkaart_id: cardId } : b,
      ),
    });
  }, [store, commit]);

  const addBeurtenkaart = useCallback(async (playerId: string) => {
    if (!store) return;
    const card: Beurtenkaart = {
      id: newId('k'),
      player_id: playerId,
      total_sessions: SESSIONS_PER_CARD,
      created_at: nowISO(),
      uses: [],
    };
    await commit({ ...store, beurtenkaarten: [...store.beurtenkaarten, card] });
  }, [store, commit]);

  const updateBeurtenkaart = useCallback(async (id: string, patch: Pick<Beurtenkaart, 'remarks'>) => {
    if (!store) return;
    await commit({
      ...store,
      beurtenkaarten: store.beurtenkaarten.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });
  }, [store, commit]);

  const addCardSession = useCallback(async (id: string) => {
    if (!store) return;
    await commit({
      ...store,
      beurtenkaarten: store.beurtenkaarten.map((c) =>
        c.id === id ? useSession(c, '', nowISO()) : c,
      ),
    });
  }, [store, commit]);

  const removeCardSession = useCallback(async (id: string) => {
    if (!store) return;
    await commit({
      ...store,
      beurtenkaarten: store.beurtenkaarten.map((c) => (c.id === id ? removeManualSession(c) : c)),
    });
  }, [store, commit]);

  const deleteBeurtenkaart = useCallback(async (id: string) => {
    if (!store) return;
    await commit({
      ...store,
      beurtenkaarten: store.beurtenkaarten.filter((c) => c.id !== id),
      // Lessen verliezen hun beurt, dus ze moeten opnieuw afgehandeld worden.
      bookings: store.bookings.map((b) =>
        b.beurtenkaart_id === id
          ? { ...b, payment_method: 'open' as PaymentMethod, beurtenkaart_id: undefined }
          : b,
      ),
    });
  }, [store, commit]);

  const addUser = useCallback(async (u: Omit<User, 'id'>) => {
    if (!store) return;
    await commit({ ...store, users: [...store.users, { ...u, id: newId('u') }] });
  }, [store, commit]);

  const updateUser = useCallback(
    async (id: string, patch: Partial<Omit<User, 'id' | 'role'>>) => {
      if (!store) return;
      await commit({
        ...store,
        users: store.users.map((u) => (u.id === id ? { ...u, ...patch } : u)),
      });
    },
    [store, commit],
  );

  const addLesson = useCallback(async (l: Omit<Lesson, 'id'>) => {
    if (!store) return;
    await commit({ ...store, lessons: [...store.lessons, { ...l, id: newId('l') }] });
  }, [store, commit]);

  const updateLesson = useCallback(async (id: string, patch: Partial<Lesson>) => {
    if (!store) return;
    await commit({
      ...store,
      lessons: store.lessons.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    });
  }, [store, commit]);

  const deleteLesson = useCallback(async (id: string) => {
    if (!store) return;
    await commit({ ...store, lessons: store.lessons.filter((l) => l.id !== id) });
  }, [store, commit]);

  const addProgress = useCallback(async (p: Omit<StudentProgress, 'id'>) => {
    if (!store) return;
    const entry: StudentProgress = { ...p, id: newId('p'), created_at: p.created_at ?? nowISO() };
    await commit({ ...store, progress: [...store.progress, entry] });
  }, [store, commit]);

  const saveGoal = useCallback(async (goal: PlayerGoal) => {
    if (!store) return;
    await commit({ ...store, goals: upsertGoal(store.goals, goal) });
  }, [store, commit]);

  const deleteGoal = useCallback(async (id: string) => {
    if (!store) return;
    await commit({ ...store, goals: removeGoal(store.goals, id) });
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
    goals: store?.goals ?? [],
    beurtenkaarten: store?.beurtenkaarten ?? [],
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
    setPaymentMethod,
    addBeurtenkaart,
    updateBeurtenkaart,
    addCardSession,
    removeCardSession,
    deleteBeurtenkaart,
    addUser,
    updateUser,
    addLesson,
    updateLesson,
    deleteLesson,
    addProgress,
    saveGoal,
    deleteGoal,
    saveSettings,
    emergencyCleanup,
  }), [
    store, currentUser, loading, error, clearError, login, logout, refresh,
    addBooking, updateBooking, deleteBooking, setPaymentMethod, addBeurtenkaart,
    updateBeurtenkaart, addCardSession, removeCardSession, deleteBeurtenkaart,
    addUser, updateUser, addLesson,
    updateLesson, deleteLesson, addProgress, saveGoal, deleteGoal, saveSettings, emergencyCleanup,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSimpleData(): DataShape {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSimpleData must be used within SimpleDataProvider');
  return ctx;
}

/** Payments the current user may handle — scoped to them. Money stays per coach. */
export function usePendingPaymentBookings(): Booking[] {
  const { currentUser, bookings } = useSimpleData();
  return useMemo(() => pendingPaymentsFor(currentUser, bookings), [currentUser, bookings]);
}
