import React, {
  createContext, useContext, useEffect, useState, useCallback, useMemo, useRef,
} from 'react';
import { AppState, Platform } from 'react-native';
import { pendingPaymentsFor } from '../lib/payments';
import { loadCurrentUserId, saveCurrentUserId, clearCurrentUserId } from './session';
import { newId, type StoreData } from './mockStore';
import { isCoach, magInElkeAgenda, magKaartenSchrijven } from '../lib/rechten';
import { backend, type AuthMode } from './backend';
import { isHerstelHash, type AanmeldUitkomst } from '../lib/wachtwoord';
import { magStilVerversen } from '../lib/verversen';
import type { AuthGebeurtenis } from './supabaseStore';
import { installCatalogue } from '../lib/catalogue';
import { u9Trainings, U9_CATALOGUE_ID } from '../lib/trainings-u9';
import { upsertGoal, removeGoal } from '../lib/goals';
import { aanvraagVoor } from '../lib/ouderkind';
import { zonderLid } from '../lib/leden';
import {
  SESSIONS_PER_CARD, useSession, releaseSession, removeManualSession,
  planMethodChange, planCancel, planCardDeletion, planParticipantsChange, planSplitChange,
  GROEPSLES_METHOD,
} from '../lib/beurtenkaart';
import { isGroupLesson } from '../lib/groups';
import { zetAanwezigheid, type Aanwezigheid } from '../lib/aanwezigheid';
import { needsApproval } from '../lib/inbox';
import { seriesFrom } from '../lib/series';
import { planSeries, type OvergeslagenSlot, type RecurrenceRule } from '../lib/recurrence';
import type {
  User, Court, Booking, Lesson, Memo, StudentProgress, PlayerGoal, Role, Settings,
  Beurtenkaart, BookingStatus, OuderKind, PaymentMethod, PaymentSplit,
} from '../lib/types';

interface DataShape {
  users: User[];
  courts: Court[];
  bookings: Booking[];
  lessons: Lesson[];
  progress: StudentProgress[];
  memos: Memo[];
  goals: PlayerGoal[];
  beurtenkaarten: Beurtenkaart[];
  /** De koppelingen ouder-kind: aangevraagd, goedgekeurd of geweigerd. Zie lib/ouderkind. */
  relaties: OuderKind[];
  settings: Settings;
  currentUser: User | null;
  loading: boolean;
  error: string | null;
  clearError: () => void;
  /**
   * Hoe je binnenkomt: met een wachtwoord (Supabase) of door een profiel te kiezen (lokale
   * opslag). Het inlogscherm leest dit; de rest van de app heeft er niets mee te maken.
   */
  authMode: AuthMode;
  /** Profielkeuze — alleen bij de lokale opslag. */
  login: (userId: string) => Promise<void>;
  /** Inloggen met e-mailadres en wachtwoord. Gooit een leesbare fout bij een misser. */
  signIn: (email: string, password: string) => Promise<void>;
  /** Een account aanmaken. Bestond het e-mailadres al bij de club, dan wordt het gekoppeld. */
  signUp: (email: string, password: string, name: string) => Promise<AanmeldUitkomst>;
  /**
   * `true` vanaf de klik op de link uit een herstelmail tot het nieuwe wachtwoord gezet is.
   * De indeling (`app/_layout.tsx`) leest dit om iemand naar `/nieuw-wachtwoord` te sturen —
   * die persoon ís al ingelogd, maar heeft nog geen wachtwoord gekozen.
   */
  herstelBezig: boolean;
  /** Een herstelmail sturen. Geeft nooit weg of het adres bestaat bij de club. */
  stuurHerstelmail: (email: string) => Promise<void>;
  /** Het nieuwe wachtwoord zetten, en de herstelvlag uitzetten na een gelukte wijziging. */
  zetNieuwWachtwoord: (wachtwoord: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Het tarief en de groepstaffel van een baan bijstellen; `id`, naam en nummer blijven. */
  updateCourt: (id: string, patch: Partial<Omit<Court, 'id'>>) => Promise<void>;
  addBooking: (b: Omit<Booking, 'id'>) => Promise<Booking | null>;
  /** Maakt de hele reeks aan. Geeft terug wat er gemaakt is en wat er is overgeslagen wegens een botsing. */
  addBookingSeries: (base: Omit<Booking, 'id'>, rule: RecurrenceRule) => Promise<{ created: Booking[]; skipped: OvergeslagenSlot[] }>;
  /** Annuleert deze les en alle latere uit dezelfde reeks. */
  cancelSeriesFrom: (bookingId: string) => Promise<void>;
  /** Verwijdert deze les en alle latere uit dezelfde reeks. */
  deleteSeriesFrom: (bookingId: string) => Promise<void>;
  /** `payment_method`, `beurtenkaart_id`, `participant_ids`, `payment_split` en
   *  `attendance` blijven erbuiten: die lopen uitsluitend via `setPaymentMethod`,
   *  `setParticipants`, `setPaymentSplit` en `setAanwezigheid` — de plekken die de
   *  beurtenkaart, de factuurregel en de afvinklijst in de pas houden. */
  updateBooking: (
    id: string,
    patch: Partial<Omit<Booking, 'payment_method' | 'beurtenkaart_id' | 'participant_ids' | 'payment_split' | 'attendance'>>,
  ) => Promise<void>;
  /**
   * De deelnemers van een les zetten. Geeft de melding terug als het geld erdoor veranderde
   * (een beurt die terugkomt, een les die naar factuur gaat), of `null` als er niets te
   * melden viel. Zie `planParticipantsChange`.
   */
  setParticipants: (bookingId: string, participantIds: string[]) => Promise<string | null>;
  /** Bij een groepsles: één factuur voor de betaler of ieder zijn deel. */
  setPaymentSplit: (bookingId: string, split: PaymentSplit) => Promise<void>;
  /**
   * Eén speler aanwezig of afwezig vinken; `null` (of opnieuw dezelfde knop) wist de
   * aantekening — zie `zetAanwezigheid` in lib/aanwezigheid.
   *
   * Alleen de trainer van de les en de beheerder mogen dit; de bewaking staat hier en
   * niet alleen in het scherm, met dezelfde grens in de databank (`bewaak_betaalvelden`).
   */
  setAanwezigheid: (
    bookingId: string,
    playerId: string,
    waarde: Aanwezigheid | null,
  ) => Promise<void>;
  deleteBooking: (id: string) => Promise<void>;
  /**
   * De trainer keurt een aangevraagde les goed; pas daarna gaat hij door. Alleen de trainer
   * van die les kan dat, en alleen zolang de les nog op goedkeuring wacht.
   */
  approveBooking: (id: string) => Promise<void>;
  /** De trainer wijst de aanvraag af: de les wordt geannuleerd en het uur komt weer vrij. */
  rejectBooking: (id: string) => Promise<void>;
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
  /**
   * `role` en `is_admin` blijven er expliciet buiten. Een rol geef je bewust in Beheer, en
   * wie de club beheert bepaalt de beheerder zelf — niet een scherm dat toevallig een veld
   * meestuurt. De databank denkt er hetzelfde over: een trigger weigert elke wijziging van
   * `is_admin` die niet van een beheerder komt.
   */
  updateUser: (id: string, patch: Partial<Omit<User, 'id' | 'role' | 'is_admin'>>) => Promise<void>;
  /**
   * De rol van een lid omzetten. Apart van `updateUser` omdat het geen formulierdetail is:
   * zie `rolWisselBezwaar` in lib/leden voor wanneer het beter niet kan.
   */
  setUserRole: (id: string, role: Role) => Promise<void>;
  /**
   * Het beheerdersvinkje zetten of afnemen. Ook apart, en om dezelfde reden als hierboven:
   * dit geeft iemand de sleutel van de club. De databank bewaakt hem mee — alleen een
   * beheerder komt langs `bewaak_is_admin`.
   */
  setBeheerder: (id: string, aan: boolean) => Promise<void>;
  /**
   * Een lid verwijderen, met alles wat aan hem hing: zijn lessen, zijn dossier, zijn
   * kaarten. Zie `zonderLid` in lib/leden — dat is dezelfde opruiming die de databank met
   * `on delete cascade` doet, hier nagespeeld zodat het scherm niet naar rijen blijft
   * kijken die niet meer bestaan.
   */
  deleteUser: (id: string) => Promise<void>;
  /**
   * Een ouder vraagt een kind aan zijn profiel te koppelen. De aanvraag begint op 'pending';
   * een trainer beslist. Vraagt hij het over een kind waar al een aanvraag over loopt, dan
   * gebeurt er niets — de vraag is al gesteld.
   */
  vraagKindAan: (childId: string) => Promise<void>;
  /** De trainer beslist over zo'n aanvraag. */
  beslisOverKind: (relatieId: string, goedgekeurd: boolean) => Promise<void>;
  /** De koppeling of de aanvraag weghalen. Een ouder mag zijn eigen vraag intrekken. */
  wisRelatie: (relatieId: string) => Promise<void>;
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
  /** Een opname bewaren. `id` en `created_at` worden hier gezet. */
  addMemo: (memo: Omit<Memo, 'id' | 'created_at'>) => Promise<void>;
  /** Weggooien zonder er een notitie van te maken. Onomkeerbaar. */
  deleteMemo: (id: string) => Promise<void>;
  /**
   * De memo uitwerken: de notitie erbij, de memo weg — in één opslag.
   *
   * Dat is geen nettigheid maar de kern: zouden dit twee opslagen zijn, dan bestaat er een
   * moment waarop de tweede kan mislukken, en houd je een dubbele notitie of een memo die
   * al uitgewerkt is. Dezelfde reden waarom een beurt afboeken en de les op factuur zetten
   * één stap zijn.
   */
  werkMemoUit: (memoId: string, notitie: Omit<StudentProgress, 'id'>) => Promise<void>;
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
 * Geeft deze gebruiker de beurt van een verwijderde les zélf terug, of doet de databank dat?
 *
 * Een speler en een ouder mogen een beurtenkaart niet bewerken — wie zijn eigen beurten kan
 * terugzetten, geeft zichzelf gratis lessen. Bij hen doet de databank het, in een trigger die
 * aan de verwijdering vastzit (`geef_beurt_terug` in supabase-schema.sql). Zou de app het
 * hier tóch proberen, dan weigert RLS die ene schrijfactie en valt de hele verwijdering om.
 *
 * Zonder databank is er geen trigger en is de app zelf de waarheid; daar doet ze het altijd.
 */
function geeftZelfDeBeurtTerug(user: User | null | undefined): boolean {
  return backend.kind === 'lokaal' || magKaartenSchrijven(user);
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

/**
 * Duidt de URL bij het opstarten al op een herstellink? Nodig als aanvulling op het
 * `'herstel'`-event van `onAuthChange` hieronder: dat event vuurt maar één keer, vlak na het
 * openen van de link. Ververst iemand de pagina daarna — vóór hij een wachtwoord koos — dan
 * is dat event al voorbij en zou de vlag zonder deze aanvulling ineens weer op `false` staan,
 * terwijl de sessie nog steeds een onafgemaakt herstel is.
 */
function herstelUitUrl(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined' && !!window.location
    && isHerstelHash(window.location.hash);
}

export function SimpleDataProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<StoreData | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [herstelBezig, setHerstelBezig] = useState<boolean>(herstelUitUrl);

  // Elke actie leest hieruit in plaats van uit de snapshot van zijn render: twee snelle
  // klikken achter elkaar schrijven anders allebei dezelfde oude store terug en wist de
  // laatste de eerste — met een verdwenen beurt tot gevolg.
  const storeRef = useRef<StoreData | null>(null);

  // De drie dingen die `magStilVerversen` moet weten en die geen state hoeven te zijn: ze
  // sturen geen enkel scherm aan, ze beantwoorden alleen de vraag "mag er nu opgehaald
  // worden". Als state zouden ze bij elke schrijfactie de hele boom hertekenen.
  const laatsteLading = useRef<number>(0);
  const ladingBezig = useRef(false);
  const schrijfBezig = useRef(false);

  // Persist then update state; surface any failure instead of swallowing it.
  const commit = useCallback(async (next: StoreData) => {
    const previous = storeRef.current;
    // De ref loopt vooruit op de state: het wegschrijven is async, en een volgende actie
    // moet meteen op deze wijziging verder kunnen bouwen.
    storeRef.current = next;
    // Zolang dit loopt, haalt de stille verversing niets op: de databank heeft deze
    // wijziging nog niet, en het antwoord zou de stand van ervoor terugzetten.
    schrijfBezig.current = true;
    try {
      await backend.save(previous, next);
      setStore(next);
    } catch (e: unknown) {
      storeRef.current = previous;
      setError(e instanceof Error ? e.message : 'Opslaan mislukt');
      throw e;
    } finally {
      schrijfBezig.current = false;
    }
  }, []);

  /**
   * Het lessenboekje van de club toevoegen aan een opslag die het nog niet heeft.
   *
   * De trainer die als eerste inlogt, brengt het mee. `uploaded_by` en `coach_id` wijzen
   * daarbij naar hém: in de databank moet een les naar een bestaande gebruiker verwijzen, en
   * de vaste naam uit het bestand hoort bij niemand.
   */
  const withCatalogue = useCallback((data: StoreData, coachId: string): StoreData => (
    installCatalogue(
      data,
      U9_CATALOGUE_ID,
      u9Trainings.map((l) => ({ ...l, uploaded_by: coachId, coach_id: coachId })),
    )
  ), []);

  /**
   * Ophalen wat deze gebruiker mag zien, en het boekje aanvullen als hij trainer is.
   *
   * Bij de databank valt er zonder login niets op te halen: RLS geeft dan lege lijsten
   * terug. Daarom blijft de opslag leeg tot er iemand ingelogd is — het inlogscherm heeft
   * geen gegevens nodig.
   */
  const loadFor = useCallback(async (userId: string | null): Promise<StoreData> => {
    const data = await backend.load();
    const me = userId === null ? null : data.users.find((u) => u.id === userId) ?? null;
    if (!isCoach(me)) return data;
    const merged = withCatalogue(data, me.id);
    if (merged !== data) {
      // Het boekje is nu ook van deze club: meteen bewaren, anders staat het er de volgende
      // keer weer niet en probeert de app het opnieuw.
      //
      // Maar het mag het opstarten niet tegenhouden. Dit is een extraatje bij het laden —
      // een lessenboekje dat meekomt — en geen reden om iedereen op het inlogscherm te
      // laten staan als de databank die ene schrijfactie weigert. Wat er wél binnenkwam,
      // gaat gewoon door; de volgende start probeert het opnieuw.
      try {
        await backend.save(data, merged);
      } catch (e: unknown) {
        console.warn('Lessenboekje niet kunnen bewaren:', e);
        return data;
      }
    }
    return merged;
  }, [withCatalogue]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    ladingBezig.current = true;
    try {
      const id = backend.authMode === 'wachtwoord'
        ? await backend.currentUserId()
        : currentUserId;
      const data = await loadFor(id);
      storeRef.current = data;
      setStore(data);
      setCurrentUserId(id);
      laatsteLading.current = Date.now();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Kon data niet laden');
    } finally {
      ladingBezig.current = false;
      setLoading(false);
    }
  }, [currentUserId, loadFor]);

  /**
   * Hetzelfde ophalen, maar zonder dat het scherm het merkt.
   *
   * Niet `refresh`: die zet `loading` aan, en daar hangt het laadscherm van de hele app
   * aan. Elke keer dat je terugkomt op je tabblad de spinner over je scherm krijgen is
   * erger dan de verouderde lijst die het moest oplossen.
   *
   * Een mislukte poging blijft ook stil. Ze is niet gevraagd, dus een rode regel zou gaan
   * over iets waar de gebruiker op dat moment niets mee te maken heeft; het scherm dat er
   * al stond, klopte een minuut geleden nog. De volgende keer terugkomen probeert opnieuw,
   * en een echte actie geeft zijn fout gewoon zelf.
   */
  const stilVerversen = useCallback(async () => {
    if (!magStilVerversen({
      ingelogd: currentUserId !== null,
      laadt: ladingBezig.current,
      schrijft: schrijfBezig.current,
      sindsLaatsteLading: Date.now() - laatsteLading.current,
    })) return;

    ladingBezig.current = true;
    try {
      const data = await loadFor(currentUserId);
      storeRef.current = data;
      setStore(data);
      laatsteLading.current = Date.now();
    } catch (e: unknown) {
      console.warn('Stil verversen mislukt:', e);
    } finally {
      ladingBezig.current = false;
    }
  }, [currentUserId, loadFor]);

  /**
   * Terugkomen bij de app is het moment om opnieuw op te halen: het tabblad weer op de
   * voorgrond, of de app op de telefoon weer geopend. `AppState` doet allebei — op web
   * hangt hij aan de zichtbaarheid van het tabblad, op een toestel aan de app zelf — dus
   * hier staat één regel voor beide.
   */
  useEffect(() => {
    const terug = (): void => { void stilVerversen(); };
    // `AppState` geeft op web niets terug als het document geen zichtbaarheid kent (een
    // test zonder DOM); dan is er ook niets af te melden.
    const sub = AppState.addEventListener('change', (stand) => {
      if (stand === 'active') terug();
    });

    // Op web hangt `AppState` alleen aan de zichtbaarheid van het tabblad. Wie naar een
    // ánder programma ging en terugkomt terwijl het tabblad al zichtbaar was, valt daar
    // buiten — en dat is juist de langste afwezigheid. `focus` vangt dat op. Vuren ze
    // allebei, dan houdt de pauze in `magStilVerversen` de tweede tegen.
    const web = Platform.OS === 'web' && typeof window !== 'undefined';
    if (web) window.addEventListener('focus', terug);

    return () => {
      sub?.remove();
      if (web) window.removeEventListener('focus', terug);
    };
  }, [stilVerversen]);

  // Opstarten, en daarna bij elke wisseling van login opnieuw. Die twee zijn hetzelfde werk:
  // uitzoeken wie er is en dan ophalen wat hij mag zien. Bij de lokale opslag verandert de
  // login nooit vanzelf, dus daar gebeurt dit één keer.
  useEffect(() => {
    let stopped = false;

    const start = async (): Promise<void> => {
      ladingBezig.current = true;
      try {
        const id = backend.authMode === 'wachtwoord'
          ? await backend.currentUserId()
          : await loadCurrentUserId();
        // Zonder login is er niets op te halen bij de databank; lokaal wél, want daar kiest
        // de gebruiker zijn profiel uit de lijst die in die opslag staat.
        const data = backend.authMode === 'wachtwoord' && id === null
          ? null
          : await loadFor(id);
        if (stopped) return;
        if (data) {
          storeRef.current = data;
          setStore(data);
        }
        // Een profiel dat niet (meer) bestaat, is geen geldige login.
        const known = id !== null && (data?.users.some((u) => u.id === id) ?? false);
        setCurrentUserId(known ? id : null);
        laatsteLading.current = Date.now();
      } catch (e: unknown) {
        if (!stopped) setError(e instanceof Error ? e.message : 'Kon data niet laden');
      } finally {
        ladingBezig.current = false;
        if (!stopped) setLoading(false);
      }
    };

    void start();
    const unsubscribe = backend.onAuthChange((wat: AuthGebeurtenis) => {
      // De sessie van een herstellink is een echte sessie: gewoon meenemen in het ophalen
      // hieronder, net als elke andere wisseling. Alleen de vlag hierboven is nieuw.
      if (wat === 'herstel') setHerstelBezig(true);

      // Uitgelogd is uitgelogd: hier wordt niets meer opgehaald.
      //
      // Dit stond er ooit anders: ook bij 'weg' liep `start()` nog een keer, "om te kijken
      // wie er nu is". Maar dat wegschrijven van de sessie gebeurt niet op hetzelfde
      // moment als dit event, en dan zag `currentUserId()` de sessie die net aan het
      // verdwijnen was nog één keer staan. Gevolg: je drukte op uitloggen, kwam op het
      // inlogscherm, en werd meteen terug naar het dashboard gezet. Op een telefoon viel
      // dat altijd verkeerd, omdat het daar net iets trager gaat.
      //
      // De vlag moet hier ook uit: anders blijft de indeling deze gebruiker naar
      // /nieuw-wachtwoord sturen terwijl er geen sessie meer is om iets in op te slaan.
      if (wat === 'weg') {
        setHerstelBezig(false);
        storeRef.current = null;
        setStore(null);
        setCurrentUserId(null);
        setError(null);
        setLoading(false);
        return;
      }

      void start();
    });

    return () => {
      stopped = true;
      unsubscribe();
    };
  }, [loadFor]);

  const login = useCallback(async (userId: string) => {
    setCurrentUserId(userId);
    await saveCurrentUserId(userId);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    // Het ophalen gebeurt niet hier: `onAuthChange` hierboven merkt de nieuwe login en haalt
    // op wat erbij hoort. Zou dit het ook doen, dan stonden er twee ladingen door elkaar.
    await backend.signIn(email, password);
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    setError(null);
    return backend.signUp(email, password, name);
  }, []);

  const stuurHerstelmail = useCallback(async (email: string) => {
    setError(null);
    await backend.stuurHerstelmail(email);
  }, []);

  const zetNieuwWachtwoord = useCallback(async (wachtwoord: string) => {
    setError(null);
    await backend.zetNieuwWachtwoord(wachtwoord);
    // Gelukt: de vlag mag weer uit, anders blijft de indeling deze gebruiker naar
    // /nieuw-wachtwoord sturen terwijl hij net een wachtwoord koos.
    setHerstelBezig(false);
  }, []);

  const logout = useCallback(async () => {
    setCurrentUserId(null);
    await clearCurrentUserId();
    if (backend.authMode === 'wachtwoord') {
      // Wat er in het geheugen stond, was van de vorige gebruiker: weg ermee vóór het
      // afmelden, anders ziet de volgende op hetzelfde toestel diens lessen nog even staan
      // als het afmelden traag is.
      storeRef.current = null;
      setStore(null);
      // Lukt het afmelden bij de databank niet (geen netwerk op de baan), dan blijft de app
      // toch uitgelogd. Andersom — wél afgemeld maar nog binnen in de app — is de fout die
      // je niet wilt.
      try {
        await backend.signOut();
      } catch (e: unknown) {
        console.warn('Afmelden bij de databank mislukt:', e);
      }
    }
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
  ): Promise<{ created: Booking[]; skipped: OvergeslagenSlot[] }> => {
    const store = storeRef.current;
    if (!store) return { created: [], skipped: [] };

    const plan = planSeries(
      base.start_time, base.end_time, rule, base.coach_id, store.bookings,
      store.settings.vakanties ?? [],
    );
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
    if (geeftZelfDeBeurtTerug(store.users.find((u) => u.id === currentUserId))) {
      for (const booking of doomed) {
        cards = releaseCardFor({ ...store, beurtenkaarten: cards }, booking);
      }
    }
    const gone = new Set(doomed.map((b) => b.id));
    await commit({
      ...store,
      beurtenkaarten: cards,
      bookings: store.bookings.filter((b) => !gone.has(b.id)),
    });
  }, [commit, currentUserId]);

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
    const zelf = geeftZelfDeBeurtTerug(store.users.find((u) => u.id === currentUserId));
    await commit({
      ...store,
      beurtenkaarten: zelf ? releaseCardFor(store, booking) : store.beurtenkaarten,
      bookings: store.bookings.filter((b) => b.id !== id),
    });
  }, [commit, currentUserId]);

  /**
   * Goedkeuren of weigeren. Beide lopen via `updateBooking`, zodat een geweigerde les langs
   * dezelfde annuleerweg gaat als elke andere: de beurt van een beurtenkaart komt daar terug
   * en hoeft hier niet nog een keer geregeld te worden.
   *
   * De bewaking staat hier en niet in het scherm: alleen de trainer van die les beslist, en
   * alleen zolang er nog niets beslist is. Zo kan een tweede tik of een oud scherm geen
   * geannuleerde les alsnog bevestigen.
   */
  const decideBooking = useCallback(async (id: string, status: BookingStatus) => {
    const store = storeRef.current;
    if (!store || !currentUserId) return;
    const booking = store.bookings.find((b) => b.id === id);
    // Een beheerder beslist over de hele club; een trainer alleen over zijn eigen agenda.
    const magAlles = magInElkeAgenda(store.users.find((u) => u.id === currentUserId));
    if (!booking || !needsApproval(booking, currentUserId, magAlles)) return;
    // Bij een weigering blijft het tijdstip achter: alleen daaraan is later te zien dat
    // deze les niet is afgezegd maar afgewezen, en dat is wat de speler te horen krijgt.
    await updateBooking(id, status === 'cancelled' ? { status, rejected_at: nowISO() } : { status });
  }, [currentUserId, updateBooking]);

  const approveBooking = useCallback(
    (id: string) => decideBooking(id, 'confirmed'),
    [decideBooking],
  );
  const rejectBooking = useCallback(
    (id: string) => decideBooking(id, 'cancelled'),
    [decideBooking],
  );

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

  const setAanwezigheid = useCallback(async (
    bookingId: string,
    playerId: string,
    waarde: Aanwezigheid | null,
  ) => {
    const store = storeRef.current;
    if (!store || !currentUserId) return;
    const booking = store.bookings.find((b) => b.id === bookingId);
    if (!booking) return;
    // Wie er stond, weet de trainer die er zelf bij was. Een beheerder mag in elke agenda.
    const magAlles = magInElkeAgenda(store.users.find((u) => u.id === currentUserId));
    if (!magAlles && booking.coach_id !== currentUserId) return;
    const patch = zetAanwezigheid(booking, playerId, waarde);
    await commit({
      ...store,
      bookings: store.bookings.map((b) => (b.id === bookingId ? { ...b, ...patch } : b)),
    });
  }, [commit, currentUserId]);

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

  const setUserRole = useCallback(async (id: string, role: Role) => {
    const store = storeRef.current;
    if (!store) return;
    await commit({
      ...store,
      users: store.users.map((u) => (u.id === id ? { ...u, role } : u)),
    });
  }, [commit]);

  const setBeheerder = useCallback(async (id: string, aan: boolean) => {
    const store = storeRef.current;
    if (!store) return;
    await commit({
      ...store,
      users: store.users.map((u) => (u.id === id ? { ...u, is_admin: aan } : u)),
    });
  }, [commit]);

  const deleteUser = useCallback(async (id: string) => {
    const store = storeRef.current;
    if (!store) return;
    // De databank ruimt zijn lessen en zijn dossier zelf op (`on delete cascade`); dit is
    // dezelfde opruiming aan deze kant, zodat het scherm niet blijft staan met lessen van
    // iemand die er niet meer is.
    await commit(zonderLid(store, id));
  }, [commit]);

  // ---------------------------------------------------------------------------
  // Ouder en kind
  //
  // De ouder vraagt, de trainer beslist. Dezelfde vorm als een lesaanvraag, en om dezelfde
  // reden: zonder die stap kon iedereen die zich als ouder aanmeldt het dossier van elk
  // kind van de club openen door de naam te kiezen. Zie lib/ouderkind.
  // ---------------------------------------------------------------------------

  const vraagKindAan = useCallback(async (childId: string) => {
    const store = storeRef.current;
    if (!store || !currentUserId) return;
    // Al gevraagd is gevraagd: een tweede rij zou de trainer dezelfde beslissing nog eens
    // laten nemen, en de databank staat er maar één toe per paar.
    if (aanvraagVoor(currentUserId, childId, store.relaties)) return;
    const nieuw: OuderKind = {
      id: newId('ok'),
      parent_id: currentUserId,
      child_id: childId,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    await commit({ ...store, relaties: [...store.relaties, nieuw] });
  }, [commit, currentUserId]);

  const beslisOverKind = useCallback(async (relatieId: string, goedgekeurd: boolean) => {
    const store = storeRef.current;
    if (!store) return;
    await commit({
      ...store,
      relaties: store.relaties.map((r) => (r.id === relatieId
        ? {
          ...r,
          status: goedgekeurd ? 'approved' as const : 'rejected' as const,
          decided_at: new Date().toISOString(),
          ...(currentUserId ? { decided_by: currentUserId } : {}),
        }
        : r)),
    });
  }, [commit, currentUserId]);

  const wisRelatie = useCallback(async (relatieId: string) => {
    const store = storeRef.current;
    if (!store) return;
    await commit({ ...store, relaties: store.relaties.filter((r) => r.id !== relatieId) });
  }, [commit]);

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

  const addMemo = useCallback(async (memo: Omit<Memo, 'id' | 'created_at'>) => {
    const store = storeRef.current;
    if (!store) return;
    const entry: Memo = { ...memo, id: newId('memo'), created_at: nowISO() };
    await commit({ ...store, memos: [...store.memos, entry] });
  }, [commit]);

  const deleteMemo = useCallback(async (id: string) => {
    const store = storeRef.current;
    if (!store) return;
    await commit({ ...store, memos: store.memos.filter((m) => m.id !== id) });
  }, [commit]);

  const werkMemoUit = useCallback(async (
    memoId: string,
    notitie: Omit<StudentProgress, 'id'>,
  ) => {
    const store = storeRef.current;
    if (!store) return;
    const entry: StudentProgress = {
      ...notitie,
      id: newId('p'),
      created_at: notitie.created_at ?? nowISO(),
    };
    // Eén commit: de notitie erbij en de memo weg, of geen van beide.
    await commit({
      ...store,
      progress: [...store.progress, entry],
      memos: store.memos.filter((m) => m.id !== memoId),
    });
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
    const seeded = await backend.reset();
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
    memos: store?.memos ?? [],
    goals: store?.goals ?? [],
    beurtenkaarten: store?.beurtenkaarten ?? [],
    relaties: store?.relaties ?? [],
    settings: store?.settings ?? { booking_end_time: '21:00', theme: 'light', language: 'nl' },
    currentUser,
    loading,
    error,
    clearError,
    authMode: backend.authMode,
    login,
    signIn,
    signUp,
    herstelBezig,
    stuurHerstelmail,
    zetNieuwWachtwoord,
    logout,
    refresh,
    updateCourt,
    addBooking,
    addBookingSeries,
    cancelSeriesFrom,
    deleteSeriesFrom,
    updateBooking,
    deleteBooking,
    approveBooking,
    rejectBooking,
    setParticipants,
    setPaymentSplit,
    setAanwezigheid,
    setPaymentMethod,
    addBeurtenkaart,
    updateBeurtenkaart,
    addCardSession,
    removeCardSession,
    deleteBeurtenkaart,
    addUser,
    updateUser,
    setUserRole,
    setBeheerder,
    deleteUser,
    vraagKindAan,
    beslisOverKind,
    wisRelatie,
    addLesson,
    updateLesson,
    deleteLesson,
    addProgress,
    updateProgress,
    deleteProgress,
    addMemo,
    deleteMemo,
    werkMemoUit,
    saveGoal,
    deleteGoal,
    saveSettings,
    emergencyCleanup,
  }), [
    store, currentUser, loading, error, clearError, login, signIn, signUp,
    herstelBezig, stuurHerstelmail, zetNieuwWachtwoord, logout, refresh,
    updateCourt, addBooking, addBookingSeries, cancelSeriesFrom, deleteSeriesFrom,
    updateBooking, deleteBooking, approveBooking, rejectBooking,
    setParticipants, setPaymentSplit, setAanwezigheid,
    setPaymentMethod, addBeurtenkaart,
    updateBeurtenkaart, addCardSession, removeCardSession, deleteBeurtenkaart,
    addUser, updateUser, setUserRole, setBeheerder, deleteUser,
    vraagKindAan, beslisOverKind, wisRelatie, addLesson,
    updateLesson, deleteLesson, addProgress, updateProgress, deleteProgress,
    addMemo, deleteMemo, werkMemoUit,
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
/**
 * Wis bij binnenkomst de foutmelding die een ánder scherm achterliet.
 *
 * De fout is één globale bak, dus zonder dit begroet Historiek je met een melding over een
 * boeking die je op Agenda probeerde. Alleen bij het openen: een melding van dit scherm
 * zelf hoort te blijven staan. Drie schermen schreven deze useEffect los uit.
 */
export function useSchoneLei(): void {
  const { clearError } = useSimpleData();
  useEffect(() => {
    clearError();
    // Bewust leeg: alleen bij het openen, niet bij elke hertekening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function usePendingPaymentBookings(): Booking[] {
  const { currentUser, bookings } = useSimpleData();
  return useMemo(() => pendingPaymentsFor(currentUser, bookings), [currentUser, bookings]);
}
