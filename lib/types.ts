// Shared data model (spec §4).

import type { Aanwezigheden } from './aanwezigheid';

/**
 * Twee rollen, geen drie. "Ouder" was er ooit een, en dat werkte averechts: een ouder die
 * zelf tennist moest kiezen tussen zijn eigen lessen zien óf die van zijn kind. Ouderschap
 * is geen rol maar een band tussen twee mensen, en die staat in `OuderKind` hieronder —
 * los van je rol, dus een speler én een trainer kunnen hun kind volgen.
 */
export type Role = 'player' | 'coach';
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
  /**
   * Wat de speler of zijn ouder aan de trainer kwijt wil: een blessure, een periode waarin
   * hij er niet is, iets waar de trainer rekening mee houdt.
   *
   * Bij de speler en niet bij een les, want het gaat zelden over één uur — en een trainer
   * die elke les moet openen om te zien of er iets in staat, leest het niet. Het staat op
   * zijn dossier, zolang het er staat.
   *
   * Dit is het enige veld dat een ouder op het account van zijn kind mag schrijven; de
   * databank bewaakt dat mee (`bewaak_gebruikersvelden` in supabase-schema.sql).
   */
  note_for_coach?: string;
  preferred_court_id?: string;
  /**
   * De boekingstijd van deze trainer: tussen welke uren er bij hem geboekt kan worden.
   * Leeg betekent "de tijd van de club" — zie `booking_end_time` in `Settings`.
   *
   * Dit is de standaard. Wijkt een periode daarvan af (een zomerrooster, een maand waarin
   * hij later begint), dan staat dat in `booking_periods` hieronder.
   */
  working_hours?: { start: string; end: string };
  /**
   * Periodes waarin voor deze trainer iets anders geldt dan zijn standaard. Leeg of afwezig
   * is het gewone geval: het hele jaar dezelfde uren. Zie lib/boekingstijd — de enige plek
   * die uitrekent welke uren op een bepaalde dag gelden.
   */
  booking_periods?: Boekingsperiode[];
  working_days?: number[];
  notification_settings?: Record<string, boolean>;
  /**
   * Beheert deze gebruiker de club? Bewust een vinkje en geen vierde rol: wie de club
   * beheert is meestal ook gewoon trainer, met zijn eigen agenda en zijn eigen spelers.
   * Was het een rol, dan raakte hij dat allemaal kwijt. Zie lib/rechten.
   *
   * Wat het geeft: werken in de agenda van elke trainer. De databank bewaakt dat zelf —
   * `is_admin()` in supabase-schema.sql.
   */
  is_admin?: boolean;
  /**
   * Wat deze trainer per uur verdient. Alleen ter informatie: de omzet loopt op het
   * uurtarief van de baan, niet hierop.
   *
   * In de databank staat dit NIET in de gebruikersrij maar in een eigen tabel
   * (`coach_rates`), want RLS kan geen enkele kolom afschermen en de ledenlijst staat open
   * voor iedereen die ingelogd is. De opslag plakt het bij het laden terug op de gebruiker,
   * zodat de rest van de app er niets van merkt. Leeg betekent dus twee dingen die op
   * hetzelfde neerkomen: niet ingevuld, óf niet aan jou.
   */
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
  /**
   * Wanneer de trainer deze aanvraag heeft geweigerd. Alleen gezet langs die ene weg
   * (`rejectBooking`), en dat is precies waarvoor het veld bestaat: een geweigerde
   * aanvraag en een les die later gewoon is afgezegd staan allebei op 'cancelled', en
   * zonder dit onderscheid kan de app de speler niet vertellen wat er met zijn vraag is
   * gebeurd. De datum doet ook het tweede werk: na een week is het geen nieuws meer.
   */
  rejected_at?: string;
  /**
   * Wie er die dag effectief stond: speler-id → 'aanwezig' of 'afwezig'. Een speler die er
   * niet in staat, is niet afgevinkt — en dat is iets anders dan afwezig. Zie
   * lib/aanwezigheid, de enige plek waar dit veld gelezen en geschreven wordt.
   */
  attendance?: Aanwezigheden;
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

/**
 * Een opname over één speler, gemaakt tijdens een les.
 *
 * Een memo is nadrukkelijk géén voortgangsnotitie: hij telt nergens als notitie mee en
 * bestaat om uitgewerkt te worden. Zodra dat gebeurt, verdwijnt hij. Juist omdat hij
 * tijdelijk is, mag de audio hier gewoon in de rij staan — de voorraad blijft klein omdat
 * de uitwerklijst een wérklijst is en geen archief.
 */
export interface Memo {
  id: string;
  student_id: string;
  coach_id: string;
  /**
   * De les waarin hij is opgenomen — een `Booking`, niet een `Lesson`. Dat is een andere
   * vraag dan `StudentProgress.lesson_id`, dat naar het lesmateriaal wijst. Leeg mag: een
   * memo buiten een les om, of een memo waarvan de les intussen geschrapt is.
   */
  booking_id?: string;
  /** De opname zelf: een data-URL, net als `StudentProgress.voice_memo_uri`. */
  audio_uri: string;
  duration_ms: number;
  created_at: string; // ISO
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

/**
 * Een periode waarin de club geen les geeft: een schoolvakantie, een feestdag, een week
 * waarin de banen op zijn.
 *
 * De dagen staan als `jjjj-mm-dd` en niet als tijdstip. Een vakantie is een dag op de
 * kalender en geen moment op de klok — met een ISO-tijdstip zou "2 november" afhankelijk
 * van de tijdzone op 1 november kunnen beginnen, en dan valt de maandagles er net buiten.
 * Zo blijft het ook vergelijkbaar met een simpele tekstvergelijking.
 */
export interface Vakantie {
  id: string;
  /** Hoe hij heet op het scherm: "Herfstvakantie", "Wapenstilstand". */
  naam: string;
  /** De eerste dag zonder les, als jjjj-mm-dd. */
  van: string;
  /** De laatste dag zonder les, meegerekend. Eén dag: gelijk aan `van`. */
  tot: string;
}

/**
 * Een periode waarin voor één trainer andere boekingstijden gelden — of helemaal geen.
 *
 * De dagen staan als `jjjj-mm-dd`, om dezelfde reden als bij `Vakantie`: dit is een stuk
 * kalender en geen moment op de klok, en zo blijft het tijdzoneloos te vergelijken.
 *
 * Het verschil met een vakantie: een vakantie sluit de hele club, dit geldt voor één
 * trainer. Vandaar dat het bij hem staat en niet bij de clubinstellingen.
 */
export interface Boekingsperiode {
  id: string;
  /** Waarvoor deze periode er is: "Zomerrooster", "Cursus". Mag leeg blijven. */
  naam?: string;
  /** De eerste dag, als jjjj-mm-dd. */
  van: string;
  /** De laatste dag, meegerekend. Eén dag: gelijk aan `van`. */
  tot: string;
  /**
   * De uren die in deze periode gelden. Leeg betekent iets anders dan "de standaard": het
   * betekent dat deze trainer die dagen géén les geeft. Een periode zonder uren én zonder
   * die betekenis zou nergens voor dienen — dan laat je hem gewoon weg.
   */
  uren?: { start: string; end: string };
}

export interface Settings {
  booking_end_time: string;
  /**
   * De dagen waarop de club geen les geeft. Leeg of afwezig betekent: het hele jaar door
   * les — precies zoals de app zich gedroeg voordat dit bestond.
   */
  vakanties?: Vakantie[];
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

/**
 * Welke ouder bij welk kind hoort.
 *
 * Wie een kind wil volgen vraagt het aan, een trainer beslist — dezelfde vorm als een
 * lesaanvraag, en om dezelfde reden: zonder die stap kon iedereen het dossier van elk kind
 * van de club openen door de naam te kiezen.
 *
 * Een geweigerde aanvraag blijft staan in plaats van te verdwijnen, zodat de ouder te horen
 * krijgt wat er met zijn vraag gebeurd is.
 */
export interface OuderKind {
  id: string;
  parent_id: string;
  child_id: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at?: string;
  decided_at?: string;
  /** De trainer die besliste. Leeg zolang er niets beslist is. */
  decided_by?: string;
}
