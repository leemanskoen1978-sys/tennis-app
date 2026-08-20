import React, {
  createContext, useContext, useEffect, useState, useCallback, useMemo, useRef,
} from 'react';
import { pendingPaymentsFor } from '../lib/payments';
import { loadCurrentUserId, saveCurrentUserId, clearCurrentUserId } from './session';
import { loadStore, saveStore, resetStore, newId, type StoreData } from './mockStore';
import { upsertGoal, removeGoal } from '../lib/goals';
import {
  SESSIONS_PER_CARD, useSession, releaseSession, removeManualSession,
  planMethodChange, planCancel, planCardDeletion, planParticipantsChange, planSplitChange,
  GROEPSLES_METHOD,
} from '../lib/beurtenkaart';
import { isGroupLesson } from '../lib/groups';
import { seriesFrom } from '../lib/series';
import { planSeries, type RecurrenceRule, type SeriesSlot } from '../lib/recurrence';
import type {
  User, Court, Booking, Lesson, StudentProgress, PlayerGoal, Settings,
  Beurtenkaart, PaymentMethod, PaymentSplit,
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
  /** Het tarief en de groepstaffel van een baan bijstellen; `id`, naam en nummer blijven. */
  updateCourt: (id: string, patch: Partial<Omit<Court, 'id'>>) => Promise<void>;
  addBooking: (b: Omit<Booking, 'id'>) => Promise<Booking | null>;
  /** Maakt de hele reeks aan. Geeft terug wat er gemaakt is en wat er is overgeslagen wegens een botsing. */
  addBookingSeries: (base: Omit<Booking, 'id'>, rule: RecurrenceRule) => Promise<{ created: Booking[]; skipped: SeriesSlot[] }>;
  /** Annuleert deze les en alle latere uit dezelfde reeks. */
  cancelSeriesFrom: (bookingId: string) => Promise<void>;
  /** Verwijdert deze les en alle latere uit dezelfde reeks. */
  deleteSeriesFrom: (bookingId: string) => Promise<void>;
  /** `payment_method`, `beurtenkaart_id`, `participant_ids` en `payment_split` blijven
   *  erbuiten: die lopen uitsluitend via `setPaymentMethod`, `setParticipants` en
   *  `setPaymentSplit` — de plekken die de beurtenkaart en de factuurregel in de pas houden. */
  updateBooking: (
    id: string,
    patch: Partial<Omit<Booking, 'payment_method' | 'beurtenkaart_id' | 'participant_ids' | 'payment_split'>>,
  ) => Promise<void>;
  /**
   * De deelnemers van een les zetten. Geeft de melding terug als het geld erdoor veranderde
   * (een beurt die terugkomt, een les die naar factuur gaat), of `null` als er niets te
   * melden viel. Zie `planParticipantsChange`.
   */
  setParticipants: (bookingId: string, participantIds: string[]) => Promise<string | null>;
  /** Bij een groepsles: één factuur voor de betaler of ieder zijn deel. */
  setPaymentSplit: (bookingId: string, split: PaymentSplit) => Promise<void>;
  deleteBooking: (id: string) => Promise<void>;
  /** Zet de betaalwijze en houdt de beurtenkaart in de pas. */
  /** `false` bij een geweigerde keuze: onbekende boeking, geannuleerde les, geen kaart met
   *  beurten over, of een sponsorbudget dat deze les niet meer draagt. */
  setPaymentMethod: (bookingId: string, method: PaymentMethod) => Promise<boolean>;
  addBeurtenkaart: (playerId: string) => Promise<void>;
  updateBeurtenkaart: (id: string, patch: Pick<Beurtenkaart, 'remarks'>) => Promise<void>;
  /** Handmatig een beurt af- of bijboeken op het kaartscherm. */
  addCardSession: (id: string) => Promise<void>;
  removeCardSession: (id: string) => Promise<void>;
  /** Verwijdert de kaart; lessen die eraan hingen vallen terug op 'open'. */
  deleteBeurtenkaart: (id: string) => Promise<void>;
  /** Geeft de aangemaakte gebruiker terug, zodat de aanroeper hem meteen kan kiezen. */
  addUser: (u: Omit<User, 'id'>) => Promise<User | null>;
  /** `role` blijft erbuiten: van een trainer een speler maken raakt boekingen,
   *  lessen en voortgang, en is geen formulierdetail. */
  updateUser: (id: string, patch: Partial<Omit<User, 'id' | 'role'>>) => Promise<void>;
  addLesson: (l: Omit<Lesson, 'id'>) => Promise<void>;
  updateLesson: (id: string, patch: Partial<Lesson>) => Promise<void>;
  deleteLesson: (id: string) => Promise<void>;
  addProgress: (p: Omit<StudentProgress, 'id'>) => Promise<void>;
  /** Een beoordeling of notitie rechtzetten. `student_id`, `coach_id` en `created_at`
   *  blijven erbuiten: een gecorrigeerde notitie is niet ineens een nieuwe, hoort nog
   *  bij dezelfde speler, en blijft van wie hem opschreef. */
  updateProgress: (
    id: string,
    patch: Partial<Omit<StudentProgress, 'id' | 'student_id' | 'coach_id' | 'created_at'>>,
  ) => Promise<void>;
  /** Onomkeerbaar: alleen achter een bevestiging in beeld brengen. */
  deleteProgress: (id: string) => Promise<void>;
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

/** Een verwijderde les mag geen beurt blijven opeten. */
function releaseCardFor(data: StoreData, booking: Booking | undefined): Beurtenkaart[] {
  if (!booking?.beurtenkaart_id) return data.beurtenkaarten;
  return data.beurtenkaarten.map((c) =>
    c.id === booking.beurtenkaart_id ? releaseSession(c, booking.id) : c,
  );
}

/**
 * Wat de trainer te lezen krijgt als de bodem van een beurtenkaart of een sponsorcontract
 * niet tot het eind van de reeks reikt. De lessen bestaan wel — ze staan op 'Open' — dus dit
 * is geen foutmelding maar de mededeling dat er nog een rekening open staat.
 */
function refusedSeriesNotice(refused: number, total: number, method: PaymentMethod): string {
  const pot = method === 'beurtenkaart' ? 'de beurtenkaart' : 'het sponsorbudget';
  const paste = refused === 1 ? 'paste' : 'pasten';
  const staat = refused === 1 ? 'staat' : 'staan';
  return `${refused} van de ${total} lessen ${paste} niet meer op ${pot} en ${staat} op “Open”. `
    + 'Je vindt ze in Beheer → Betalingen.';
}

export function SimpleDataProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<StoreData | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Elke actie leest hieruit in plaats van uit de snapshot van zijn render: twee snelle
  // klikken achter elkaar schrijven anders allebei dezelfde oude store terug en wist de
  // laatste de eerste — met een verdwenen beurt tot gevolg.
  const storeRef = useRef<StoreData | null>(null);

  // Persist then update state; surface any failure instead of swallowing it.
  const commit = useCallback(async (next: StoreData) => {
    const previous = storeRef.current;
    // De ref loopt vooruit op de state: het wegschrijven is async, en een volgende actie
    // moet meteen op deze wijziging verder kunnen bouwen.
    storeRef.current = next;
    try {
      await saveStore(next);
      setStore(next);
    } catch (e: unknown) {
      storeRef.current = previous;
      setError(e instanceof Error ? e.message : 'Opslaan mislukt');
      throw e;
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadStore();
      storeRef.current = data;
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
      storeRef.current = data;
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

  const updateCourt = useCallback(async (id: string, patch: Partial<Omit<Court, 'id'>>) => {
    const store = storeRef.current;
    if (!store) return;
    await commit({
      ...store,
      courts: store.courts.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });
  }, [commit]);

  const addBooking = useCallback(async (b: Omit<Booking, 'id'>): Promise<Booking | null> => {
    const store = storeRef.current;
    if (!store) return null;
    if (overlaps(b, store.bookings)) {
      setError('Dit tijdslot is al geboekt bij deze coach.');
      return null;
    }
    // Een groepsles gaat altijd op factuur; hier staat die regel ook voor een nieuwe les,
    // zodat er geen les op cash of op een beurt kan ontstaan die naderhand geweigerd wordt.
    const created: Booking = {
      ...b,
      payment_method: isGroupLesson(b) ? GROEPSLES_METHOD : b.payment_method,
      beurtenkaart_id: isGroupLesson(b) ? undefined : b.beurtenkaart_id,
      id: newId('b'),
    };
    await commit({ ...store, bookings: [...store.bookings, created] });
    return created;
  }, [commit]);

  /**
   * Een hele herhaalreeks aanmaken.
   *
   * Alle lessen gaan in één `commit` de opslag in. Een lus met een commit per les zou ze één
   * voor één laten verschijnen en kunnen stranden op les zeven, met een halve reeks als
   * resultaat; hier bestaat de reeks straks helemaal of helemaal niet.
   *
   * De betaalwijze loopt langs dezelfde bewaakte weg als in `BookingModal`: beurtenkaart en
   * sponsor hebben een bodem, dus de les wordt niet met die betaalwijze aangemaakt maar via
   * `planMethodChange` per les afgeboekt — met de al aangemaakte lessen van deze reeks
   * meegeteld, zodat beurt elf en de euro's van les twaalf tegen dezelfde bodem lopen als in
   * de app. Past een les er niet meer in (tien beurten, twaalf lessen), dan wordt hij niet
   * overgeslagen maar aangemaakt op 'Open': de les gaat gewoon door, komt in de werklijst van
   * Beheer → Betalingen, en de trainer krijgt te lezen om hoeveel lessen het gaat. Stilzwijgend
   * gratis lesgeven of stilzwijgend lessen laten verdwijnen zijn allebei erger.
   */
  const addBookingSeries = useCallback(async (
    base: Omit<Booking, 'id'>,
    rule: RecurrenceRule,
  ): Promise<{ created: Booking[]; skipped: SeriesSlot[] }> => {
    const store = storeRef.current;
    if (!store) return { created: [], skipped: [] };

    const plan = planSeries(base.start_time, base.end_time, rule, base.coach_id, store.bookings);
    if (plan.usable.length === 0) {
      setError('Elk moment van deze reeks is al geboekt bij deze coach.');
      return { created: [], skipped: plan.skipped };
    }

    const seriesId = newId('r');
    const group = isGroupLesson(base);
    // Dezelfde afweging als in het boekingsvenster; bij een groepsles komt hij niet voor,
    // want die gaat altijd op factuur.
    const guarded = !group
      && (base.payment_method === 'beurtenkaart' || base.payment_method === 'sponsor');
    const player = store.users.find((u) => u.id === base.player_id);

    let cards = store.beurtenkaarten;
    let bookings = store.bookings;
    const created: Booking[] = [];
    let refused = 0;

    for (const slot of plan.usable) {
      const fresh: Booking = {
        ...base,
        id: newId('b'),
        series_id: seriesId,
        start_time: slot.start_time,
        end_time: slot.end_time,
        payment_method: group ? GROEPSLES_METHOD : (guarded ? 'open' : base.payment_method),
        // Een kaart wordt per les gekozen door `planMethodChange`; een meegegeven id zou
        // twaalf lessen aan dezelfde ene beurt hangen.
        beurtenkaart_id: undefined,
      };
      let final = fresh;
      if (guarded) {
        const paid = planMethodChange(cards, fresh, base.payment_method, {
          player,
          bookings,
          courts: store.courts,
        });
        if (paid.error) {
          refused += 1;
        } else {
          cards = paid.cards;
          final = { ...fresh, payment_method: base.payment_method, beurtenkaart_id: paid.cardId };
        }
      }
      bookings = [...bookings, final];
      created.push(final);
    }

    setError(refused === 0 ? null : refusedSeriesNotice(refused, created.length, base.payment_method));
    await commit({ ...store, beurtenkaarten: cards, bookings });
    return { created, skipped: plan.skipped };
  }, [commit]);

  /**
   * Deze les en alle latere uit de reeks annuleren, in één keer. Per les precies wat
   * `updateBooking` met status 'cancelled' doet — `planCancel` beslist over de beurt — maar
   * met de kaarten die onderweg meegroeien, zodat twaalf teruggegeven beurten ook echt
   * twaalf beurten zijn en niet twaalf keer dezelfde kaart uit de beginstand.
   */
  const cancelSeriesFrom = useCallback(async (bookingId: string) => {
    const store = storeRef.current;
    if (!store) return;
    let cards = store.beurtenkaarten;
    const patches = new Map<string, Partial<Booking>>();
    for (const booking of seriesFrom(store.bookings, bookingId)) {
      const plan = planCancel(cards, booking);
      cards = plan.cards;
      patches.set(booking.id, { status: 'cancelled', ...(plan.patch ?? {}) });
    }
    await commit({
      ...store,
      beurtenkaarten: cards,
      bookings: store.bookings.map((b) => {
        const patch = patches.get(b.id);
        return patch ? { ...b, ...patch } : b;
      }),
    });
  }, [commit]);

  /** Idem, maar weg is weg — dezelfde teruggave als `deleteBooking`, over de hele staart. */
  const deleteSeriesFrom = useCallback(async (bookingId: string) => {
    const store = storeRef.current;
    if (!store) return;
    const doomed = seriesFrom(store.bookings, bookingId);
    let cards = store.beurtenkaarten;
    for (const booking of doomed) {
      cards = releaseCardFor({ ...store, beurtenkaarten: cards }, booking);
    }
    const gone = new Set(doomed.map((b) => b.id));
    await commit({
      ...store,
      beurtenkaarten: cards,
      bookings: store.bookings.filter((b) => !gone.has(b.id)),
    });
  }, [commit]);

  const updateBooking = useCallback(async (
    id: string,
    patch: Partial<Omit<Booking, 'payment_method' | 'beurtenkaart_id' | 'participant_ids' | 'payment_split'>>,
  ) => {
    const store = storeRef.current;
    if (!store) return;
    const booking = store.bookings.find((b) => b.id === id);
    // De beslissing rond de beurt zit in `planCancel`; hier wordt hij alleen gecommit.
    const plan = booking && patch.status === 'cancelled'
      ? planCancel(store.beurtenkaarten, booking)
      : null;
    await commit({
      ...store,
      beurtenkaarten: plan ? plan.cards : store.beurtenkaarten,
      bookings: store.bookings.map((b) =>
        b.id === id ? { ...b, ...patch, ...(plan?.patch ?? {}) } : b,
      ),
    });
  }, [commit]);

  const deleteBooking = useCallback(async (id: string) => {
    const store = storeRef.current;
    if (!store) return;
    const booking = store.bookings.find((b) => b.id === id);
    await commit({
      ...store,
      beurtenkaarten: releaseCardFor(store, booking),
      bookings: store.bookings.filter((b) => b.id !== id),
    });
  }, [commit]);

  const setParticipants = useCallback(async (
    bookingId: string,
    participantIds: string[],
  ): Promise<string | null> => {
    const store = storeRef.current;
    if (!store) return null;
    const booking = store.bookings.find((b) => b.id === bookingId);
    if (!booking) return null;
    // De beslissing zelf zit in `planParticipantsChange`; hier wordt hij alleen gecommit.
    const plan = planParticipantsChange(store.beurtenkaarten, booking, participantIds);
    await commit({
      ...store,
      beurtenkaarten: plan.cards,
      bookings: store.bookings.map((b) => (b.id === bookingId ? { ...b, ...plan.patch } : b)),
    });
    return plan.notice;
  }, [commit]);

  const setPaymentSplit = useCallback(async (bookingId: string, split: PaymentSplit) => {
    const store = storeRef.current;
    if (!store) return;
    const booking = store.bookings.find((b) => b.id === bookingId);
    if (!booking) return;
    const patch = planSplitChange(booking, split);
    await commit({
      ...store,
      bookings: store.bookings.map((b) => (b.id === bookingId ? { ...b, ...patch } : b)),
    });
  }, [commit]);

  const setPaymentMethod = useCallback(async (bookingId: string, method: PaymentMethod): Promise<boolean> => {
    const store = storeRef.current;
    if (!store) return false;
    const booking = store.bookings.find((b) => b.id === bookingId);
    if (!booking) return false;

    // De beslissing zelf zit in `planMethodChange`; hier wordt hij alleen gecommit. Het
    // sponsorbudget hoort erbij: de speler met zijn contractbedrag, alle lessen (om te zien
    // wat er al verlest is) en de tarieven.
    const plan = planMethodChange(store.beurtenkaarten, booking, method, {
      player: store.users.find((u) => u.id === booking.player_id),
      bookings: store.bookings,
      courts: store.courts,
    });
    if (plan.error) {
      setError(plan.error);
      return false;
    }

    setError(null);
    await commit({
      ...store,
      beurtenkaarten: plan.cards,
      bookings: store.bookings.map((b) =>
        b.id === bookingId ? { ...b, payment_method: method, beurtenkaart_id: plan.cardId } : b,
      ),
    });
    return true;
  }, [commit]);

  const addBeurtenkaart = useCallback(async (playerId: string) => {
    const store = storeRef.current;
    if (!store) return;
    const card: Beurtenkaart = {
      id: newId('k'),
      player_id: playerId,
      total_sessions: SESSIONS_PER_CARD,
      created_at: nowISO(),
      uses: [],
    };
    await commit({ ...store, beurtenkaarten: [...store.beurtenkaarten, card] });
  }, [commit]);

  const updateBeurtenkaart = useCallback(async (id: string, patch: Pick<Beurtenkaart, 'remarks'>) => {
    const store = storeRef.current;
    if (!store) return;
    await commit({
      ...store,
      beurtenkaarten: store.beurtenkaarten.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });
  }, [commit]);

  const addCardSession = useCallback(async (id: string) => {
    const store = storeRef.current;
    if (!store) return;
    await commit({
      ...store,
      beurtenkaarten: store.beurtenkaarten.map((c) =>
        c.id === id ? useSession(c, '', nowISO()) : c,
      ),
    });
  }, [commit]);

  const removeCardSession = useCallback(async (id: string) => {
    const store = storeRef.current;
    if (!store) return;
    await commit({
      ...store,
      beurtenkaarten: store.beurtenkaarten.map((c) => (c.id === id ? removeManualSession(c) : c)),
    });
  }, [commit]);

  const deleteBeurtenkaart = useCallback(async (id: string) => {
    const store = storeRef.current;
    if (!store) return;
    // De beslissing zelf zit in `planCardDeletion`; hier wordt hij alleen gecommit.
    const plan = planCardDeletion(store.beurtenkaarten, store.bookings, id);
    await commit({ ...store, beurtenkaarten: plan.cards, bookings: plan.bookings });
  }, [commit]);

  const addUser = useCallback(async (u: Omit<User, 'id'>): Promise<User | null> => {
    const store = storeRef.current;
    if (!store) return null;
    const created: User = { ...u, id: newId('u') };
    await commit({ ...store, users: [...store.users, created] });
    return created;
  }, [commit]);

  const updateUser = useCallback(
    async (id: string, patch: Partial<Omit<User, 'id' | 'role'>>) => {
      const store = storeRef.current;
      if (!store) return;
      await commit({
        ...store,
        users: store.users.map((u) => (u.id === id ? { ...u, ...patch } : u)),
      });
    },
    [commit],
  );

  const addLesson = useCallback(async (l: Omit<Lesson, 'id'>) => {
    const store = storeRef.current;
    if (!store) return;
    await commit({ ...store, lessons: [...store.lessons, { ...l, id: newId('l') }] });
  }, [commit]);

  const updateLesson = useCallback(async (id: string, patch: Partial<Lesson>) => {
    const store = storeRef.current;
    if (!store) return;
    await commit({
      ...store,
      lessons: store.lessons.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    });
  }, [commit]);

  const deleteLesson = useCallback(async (id: string) => {
    const store = storeRef.current;
    if (!store) return;
    await commit({ ...store, lessons: store.lessons.filter((l) => l.id !== id) });
  }, [commit]);

  const addProgress = useCallback(async (p: Omit<StudentProgress, 'id'>) => {
    const store = storeRef.current;
    if (!store) return;
    const entry: StudentProgress = { ...p, id: newId('p'), created_at: p.created_at ?? nowISO() };
    await commit({ ...store, progress: [...store.progress, entry] });
  }, [commit]);

  const updateProgress = useCallback(async (
    id: string,
    patch: Partial<Omit<StudentProgress, 'id' | 'student_id' | 'coach_id' | 'created_at'>>,
  ) => {
    const store = storeRef.current;
    if (!store) return;
    await commit({
      ...store,
      progress: store.progress.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    });
  }, [commit]);

  const deleteProgress = useCallback(async (id: string) => {
    const store = storeRef.current;
    if (!store) return;
    await commit({ ...store, progress: store.progress.filter((p) => p.id !== id) });
  }, [commit]);

  const saveGoal = useCallback(async (goal: PlayerGoal) => {
    const store = storeRef.current;
    if (!store) return;
    await commit({ ...store, goals: upsertGoal(store.goals, goal) });
  }, [commit]);

  const deleteGoal = useCallback(async (id: string) => {
    const store = storeRef.current;
    if (!store) return;
    await commit({ ...store, goals: removeGoal(store.goals, id) });
  }, [commit]);

  const saveSettings = useCallback(async (s: Settings) => {
    const store = storeRef.current;
    if (!store) return;
    await commit({ ...store, settings: s });
  }, [commit]);

  // Emergency recovery: resets everything to the seed. Destructive by design and
  // ONLY reachable behind an explicit confirmation — never automatic.
  const emergencyCleanup = useCallback(async () => {
    const seeded = await resetStore();
    storeRef.current = seeded;
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
    updateCourt,
    addBooking,
    addBookingSeries,
    cancelSeriesFrom,
    deleteSeriesFrom,
    updateBooking,
    deleteBooking,
    setParticipants,
    setPaymentSplit,
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
    updateProgress,
    deleteProgress,
    saveGoal,
    deleteGoal,
    saveSettings,
    emergencyCleanup,
  }), [
    store, currentUser, loading, error, clearError, login, logout, refresh,
    updateCourt, addBooking, addBookingSeries, cancelSeriesFrom, deleteSeriesFrom,
    updateBooking, deleteBooking, setParticipants, setPaymentSplit,
    setPaymentMethod, addBeurtenkaart,
    updateBeurtenkaart, addCardSession, removeCardSession, deleteBeurtenkaart,
    addUser, updateUser, addLesson,
    updateLesson, deleteLesson, addProgress, updateProgress, deleteProgress,
    saveGoal, deleteGoal, saveSettings, emergencyCleanup,
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
