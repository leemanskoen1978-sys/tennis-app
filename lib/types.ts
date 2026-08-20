// Shared data model (spec §4).

export type Role = 'player' | 'coach' | 'parent';
export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'synchronized';
/**
 * Hoe een les betaald wordt. Eén veld, geen aparte status: 'open' betekent dat er nog
 * niets is afgesproken en houdt de les in de werklijst van Beheer → Betalingen.
 */
export type PaymentMethod =
  | 'open'
  | 'cash'
  | 'invoice'
  | 'qr'
  | 'beurtenkaart'
  | 'sponsor';
export type TrainingType = 'techniek' | 'tactiek' | 'fysiek' | 'mentaal' | 'match';

/**
 * Wie de factuur van een groepsles krijgt. Een groepsles gaat altijd op factuur — beurtenkaart
 * en sponsorbudget zijn er voor privélessen — dus dit is het enige dat er nog te kiezen valt:
 *  - 'together': één factuur voor het hele bedrag, naar de betaler (`Booking.player_id`).
 *  - 'separate': elke speler krijgt zijn eigen deel gefactureerd.
 *
 * Bij een les met één speler heeft dit geen betekenis — dan is er niets te verdelen — en
 * gedraagt de app zich altijd als 'together'.
 */
export type PaymentSplit = 'together' | 'separate';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  phone?: string;
  bio?: string;
  preferred_court_id?: string;
  working_hours?: { start: string; end: string };
  working_days?: number[];
  notification_settings?: Record<string, boolean>;
  /** Coach only, display-only: revenue is computed from the court rate, not from this. */
  hourly_rate?: number;
  /** Speler: de betaalwijze die een nieuwe les standaard krijgt. */
  default_payment_method?: PaymentMethod;
  /**
   * Speler: het bedrag uit zijn sponsorcontract, in euro's. Leeg betekent: geen
   * sponsorcontract. Wat er nog van over is, telt `lib/sponsor.ts` uit de gesponsorde
   * lessen — net als bij de beurtenkaart is er geen apart saldo dat kan gaan afwijken.
   */
  sponsor_budget?: number;
}

/**
 * Eén stap van de groepstaffel van een terrein: "tot en met `max_players` spelers kost een
 * uur les `rate`".
 *
 * `rate` is het TOTAAL voor de les, niet het bedrag per speler. Vier spelers op een baan van
 * € 45 leveren dus € 45 op en geen € 180. Dat is precies het punt waar iemand later verkeerd
 * gokt, dus het staat hier met zoveel woorden: de betaler betaalt dit bedrag, de anderen
 * betalen niets.
 */
export interface CourtGroupRate {
  /** Tot en met hoeveel spelers deze stap geldt. */
  max_players: number;
  /** Het totaalbedrag per uur voor de hele les, in euro's. */
  rate: number;
}

export interface Court {
  id: string;
  name: string;
  number: number;
  indoor: boolean;
  /** Het gewone uurtarief: wat één speler (of een les zonder staffel) per uur kost. */
  hourly_rate: number;
  /**
   * De groepstaffel, bijvoorbeeld [{ max_players: 2, rate: 30 }, { max_players: 4, rate: 45 }]:
   * "tot 2 spelers € 30, tot 4 spelers € 45". Leeg of afwezig betekent: geen staffel, en dan
   * geldt `hourly_rate` voor elke groepsgrootte — precies zoals de app zich altijd gedroeg.
   *
   * De volgorde van de stappen doet er niet toe; `rateForGroup` in lib/payments sorteert ze
   * zelf en kiest de laagste stap die groot genoeg is.
   */
  group_rates?: CourtGroupRate[];
}

/**
 * Eén les. Bij een groepsles staan er meerdere spelers op de baan, maar betaalt er één.
 *
 * `player_id` is die betaler, en dat blijft het hart van de les: aan hem hangen de
 * betaalwijze, de beurtenkaart, het sponsorbudget en de regel "per speler" in het rapport.
 * De extra deelnemers in `participant_ids` staan daarom apart en niet in één lijst met de
 * betaler. Was het één lijst, dan zou elke plek die vandaag "de speler van deze les" vraagt
 * (beurt afboeken, sponsorbudget, omzet per speler) opnieuw moeten kiezen wíe daarvan bedoeld
 * wordt, en dat is precies het soort keuze dat op vijf schermen vijf antwoorden krijgt.
 *
 * Kiest de trainer voor apart factureren (`payment_split`), dan krijgt elke speler zijn eigen
 * deel van dezelfde ene les — nog steeds één boeking, alleen verdeeld over meer facturen.
 */
export interface Booking {
  id: string;
  /** De speler die betaalt. Ook bij een groepsles: één les, één rekening. */
  player_id: string;
  /**
   * De andere spelers die meedoen, zonder de betaler. Leeg of afwezig is een gewone les
   * voor één speler. De groepsgrootte is dus 1 + het aantal hierin — zie `groupSize`
   * in lib/groups, dat is de enige plek die dat mag uitrekenen.
   */
  participant_ids?: string[];
  coach_id: string;
  court_id: string;
  start_time: string; // ISO
  end_time: string; // ISO
  status: BookingStatus;
  /**
   * De betaalwijze van de les. Bij een groepsles is dat altijd 'invoice': beurtenkaart en
   * sponsorbudget gelden alleen voor een privéles, en cash of QR laat zich niet over vier
   * spelers verdelen. Die regel wordt afgedwongen in `planMethodChange` (lib/beurtenkaart) —
   * de enige weg waarlangs een betaalwijze wordt vastgesteld.
   */
  payment_method: PaymentMethod;
  /** De kaart die de beurt voor deze les droeg — alleen gezet bij 'beurtenkaart'. */
  beurtenkaart_id?: string;
  /**
   * Eén factuur voor de hele les, of ieder zijn deel. Leeg betekent 'together': zo gedroeg
   * elke les zich voordat groepslessen bestonden, en zo blijft een oude opslag zich gedragen.
   */
  payment_split?: PaymentSplit;
  /**
   * Alle lessen uit dezelfde herhaalreeks delen dit nummer. Leeg bij een losse les.
   *
   * Meer is een reeks niet: elke les blijft een gewone boeking die je los kunt verzetten of
   * schrappen zonder de rest te raken. Zie `seriesFrom` in lib/series — de enige plek die
   * uitrekent welke lessen "vanaf deze les" bij elkaar horen.
   */
  series_id?: string;
  notes?: string;
  /**
   * Wie deze les aanmaakte. Bepaalt bij het boeken of de les meteen vaststaat of eerst op
   * goedkeuring wacht — zie `initialStatusFor` in lib/inbox. Leeg bij lessen van vóór dit
   * veld; die stonden er al en veranderen dus nergens door.
   */
  created_by?: string;
  actual_start_time?: string;
  actual_end_time?: string;
}

export type CourtOrientation = 'vertical' | 'horizontal';
export type CourtObjectType = 'cone' | 'player' | 'racket';

export interface CourtStroke {
  id: string;
  d: string; // SVG path in the drawing's own coordinate space
  color: string;
}

export interface CourtObject {
  id: string;
  type: CourtObjectType;
  x: number;
  y: number;
}

/**
 * A court situation, stored as the scene itself rather than a picture: it stays small,
 * scales to any screen without blurring, and can be reopened later.
 * All coordinates are in the width x height space the drawing was made in.
 */
export interface CourtDrawing {
  width: number;
  height: number;
  orientation: CourtOrientation;
  strokes: CourtStroke[];
  objects: CourtObject[];
}

export type LessonStatus = 'gepland' | 'gegeven';

/** Where the file physically lives. 'local' = data URL in the store, 'drive' = Google Drive file. */
export type AttachmentSource = 'local' | 'drive';

export interface LessonAttachment {
  id: string;
  name: string;
  mime: string; // 'application/pdf' for now
  size: number; // bytes
  source: AttachmentSource;
  uri: string; // data URL ('local') or Drive webViewLink ('drive')
  drive_file_id?: string; // set once the file lives in Google Drive
}

/**
 * One row of a training table: the columns of the KDT session plan, each kept as its own
 * field rather than one blob, so a screen can label them and a search can reach them.
 */
export interface TrainingExercise {
  nr: string;           // N°
  duration: string;     // Duur, e.g. "20'"
  situation: string;    // Situatie
  purpose: string;      // Bedoeling
  description: string;  // Omschrijving
  quality: string;      // Kwaliteit
  organisation: string; // Organ./Mat.
}

/** One line of running commentary a coach adds to a court situation over time. */
export interface ExplanationPoint {
  id: string;
  text: string;
}

export interface Lesson {
  id: string;
  title: string;
  url?: string;
  description?: string;
  uploaded_by: string;
  student_id?: string;
  coach_id?: string;
  status?: LessonStatus; // part of a player's plan: planned vs given
  attachments?: LessonAttachment[]; // PDFs etc. — see docs/lesson-attachments.md
  drawing?: CourtDrawing; // a court situation drawn on the Tekenveld
  explanation?: ExplanationPoint[]; // notes about that situation, added one at a time
  // A full session plan: one page of the club's training booklet.
  /**
   * Eigen tags van de trainer. De rest van de tags leidt `lib/tags` af uit de tekst, dus
   * dit veld is alleen voor wat er niet in de tekst staat — leeg is de normale toestand.
   */
  tags?: string[];
  training_number?: number;      // its place in the series
  duration_minutes?: number;     // 90 for a KDT session
  focus_points?: string[];       // Aandachtspunten training
  materials?: string[];          // Materiaal per terrein
  exercises?: TrainingExercise[];
}

export interface StudentProgress {
  id: string;
  student_id: string;
  coach_id: string;
  training_type: TrainingType;
  notes?: string;
  rating?: number;
  skills?: Record<string, number>;
  homework?: string;
  voice_memo_uri?: string;
  lesson_id?: string; // optional link to a lesson in the player's plan
  created_at?: string; // ISO — set when the entry is created (for timelines/reports)
}

/** How far ahead a goal looks. Three fixed horizons — the coach picks the content. */
export type GoalHorizon = 'lessons10' | 'lessons20' | 'season';

/**
 * What a player is working towards. A horizon holds as many goals as the coach wants —
 * a backhand grip change and more regularity on the serve are two goals, not one.
 *
 * The two types are plain strings rather than a union, because the club adds its own
 * options in Beheer — a union would mean a code change for every new one.
 */
export interface PlayerGoal {
  id: string;
  student_id: string;
  horizon: GoalHorizon;
  shot_type?: string;   // Type slag — from Settings.shot_types
  change_type?: string; // Type wijziging — from Settings.change_types
  notes?: string;       // Opmerkingen
}

export interface Settings {
  booking_end_time: string;
  shot_types?: string[];   // choices for a goal's Type slag
  change_types?: string[]; // choices for a goal's Type wijziging
  theme?: 'light' | 'dark';
  language?: 'nl' | 'en';
  notifications?: Record<string, boolean>;
  blocked_popups_until?: string | null;
}

/** Eén gebruikte beurt van een kaart. `booking_id` is leeg bij een handmatige beurt. */
export interface BeurtenkaartUse {
  booking_id: string;
  date: string; // ISO
}

/**
 * Een kaart van tien beurten. De beurten staan als lijst en niet als teller, zodat de
 * geschiedenis zichtbaar blijft en een beurt bij annulering terug kan.
 */
export interface Beurtenkaart {
  id: string;
  player_id: string;
  total_sessions: number;
  remarks?: string;
  created_at: string; // ISO
  uses: BeurtenkaartUse[];
}
