import type {
  User, Court, Settings, Booking, Lesson, OuderKind, StudentProgress,
} from './types';

// Fixed ids so the mock store has stable relations across reloads.
export const seedUsers: User[] = [
  // De trainers hebben een uurtarief, en bewust een ander dan het baantarief: alleen zo
  // laat de demo meteen zien dat "wat de speler betaalt" en "wat de trainer krijgt" twee
  // verschillende bedragen zijn, en dat de club er iets aan overhoudt. Ze verschillen ook
  // onderling, zodat het rapport een echte uitsplitsing per trainer toont.
  { id: 'u-koen', name: 'Koen', email: 'koen@example.com', role: 'coach', hourly_rate: 22 },
  // A second coach, sharing Mathis with Koen. Without one you cannot see what the app
  // does now: shared dossiers, "who wrote this" labels, and money staying per coach.
  { id: 'u-sanne', name: 'Sanne', email: 'sanne@example.com', role: 'coach', hourly_rate: 26 },
  { id: 'u-mathis', name: 'Mathis', email: 'mathis@example.com', role: 'player' },
  { id: 'u-test', name: 'Test', email: 'test@example.com', role: 'player' },
  // Een ouder met twee kinderen, want met één kind is de kindkiezer onzichtbaar en is niet
  // te proberen wat er gebeurt als je wisselt. Zie providers/kindkeuze.
  { id: 'u-wim', name: 'Wim', email: 'wim@example.com', role: 'parent' },
];

/**
 * De koppelingen ouder-kind van de demo: Wim hoort bij Mathis en bij Test.
 *
 * Allebei goedgekeurd, zodat de app meteen te proberen is. De aanvraagkant — een ouder die
 * vraagt en een trainer die beslist — zie je door in Beheer → Ouders en kinderen een
 * koppeling los te maken en hem opnieuw aan te vragen.
 */
export const seedRelaties: OuderKind[] = [
  { id: 'ok-wim-mathis', parent_id: 'u-wim', child_id: 'u-mathis', status: 'approved' },
  { id: 'ok-wim-test', parent_id: 'u-wim', child_id: 'u-test', status: 'approved' },
];

// De banen hebben meteen een groepstaffel, zodat een groepsles te proberen is zonder eerst
// bij Beheer → Banen tarieven in te vullen. Tot 2 spelers is dat gewoon het uurtarief — "1 en
// 2 spelers is hetzelfde" — en vanaf 3 geldt het hogere bedrag. Elk bedrag is het TOTAAL voor
// de les, niet per speler.
export const seedCourts: Court[] = [
  {
    id: 'court-1', name: 'Baan 1', number: 1, indoor: false, hourly_rate: 30,
    group_rates: [{ max_players: 2, rate: 30 }, { max_players: 4, rate: 45 }],
  },
  {
    id: 'court-2', name: 'Baan 2', number: 2, indoor: true, hourly_rate: 35,
    group_rates: [{ max_players: 2, rate: 35 }, { max_players: 4, rate: 52 }],
  },
];

export const defaultSettings: Settings = {
  booking_end_time: '21:00',
  theme: 'light',
  language: 'nl',
  notifications: {},
  blocked_popups_until: null,
};

// A future date at a given hour, `daysAhead` from today (local time).
function futureISO(daysAhead: number, hour: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

/** Demo content so the UI looks alive without a database. */
export const seedBookings: Booking[] = [
  {
    id: 'b-1', player_id: 'u-mathis', coach_id: 'u-koen', court_id: 'court-1',
    start_time: futureISO(2, 10), end_time: futureISO(2, 11),
    status: 'confirmed', payment_method: 'open', notes: 'Techniektraining',
  },
  {
    id: 'b-2', player_id: 'u-test', coach_id: 'u-koen', court_id: 'court-2',
    start_time: futureISO(3, 14), end_time: futureISO(3, 15),
    status: 'confirmed', payment_method: 'cash',
  },
  {
    id: 'b-3', player_id: 'u-mathis', coach_id: 'u-koen', court_id: 'court-1',
    start_time: futureISO(-2, 9), end_time: futureISO(-2, 10),
    status: 'completed', payment_method: 'open', notes: 'Match play',
  },
  // Sanne's side: Mathis trains with both, so his dossier is genuinely shared.
  {
    id: 'b-4', player_id: 'u-mathis', coach_id: 'u-sanne', court_id: 'court-2',
    start_time: futureISO(4, 16), end_time: futureISO(4, 17),
    status: 'confirmed', payment_method: 'open', notes: 'Tactiek',
  },
  {
    id: 'b-5', player_id: 'u-test', coach_id: 'u-sanne', court_id: 'court-1',
    start_time: futureISO(-1, 11), end_time: futureISO(-1, 12),
    status: 'completed', payment_method: 'cash',
  },
];

export const seedLessons: Lesson[] = [
  {
    id: 'l-1', title: 'Forehand basis', url: 'https://youtu.be/forehand',
    description: 'Grip, stance en follow-through.', uploaded_by: 'u-koen', coach_id: 'u-koen',
  },
  {
    id: 'l-2', title: 'Serveren', description: 'Toss en ritme.',
    uploaded_by: 'u-koen', coach_id: 'u-koen', student_id: 'u-mathis',
  },
  {
    id: 'l-3', title: 'Slice en variatie', description: 'Snijden zonder snelheid te verliezen.',
    uploaded_by: 'u-sanne', coach_id: 'u-sanne',
  },
  {
    id: 'l-4', title: 'Spel lezen', description: 'Positie kiezen op de returnzijde.',
    uploaded_by: 'u-sanne', coach_id: 'u-sanne', student_id: 'u-mathis', status: 'gepland',
  },
];

export const seedProgress: StudentProgress[] = [
  {
    id: 'p-1', student_id: 'u-mathis', coach_id: 'u-koen', training_type: 'techniek',
    rating: 4, notes: 'Sterke forehand, backhand mag stabieler.', homework: '20 min muurtraining',
  },
  {
    id: 'p-2', student_id: 'u-mathis', coach_id: 'u-sanne', training_type: 'tactiek',
    rating: 3, notes: 'Kiest te vaak de veilige bal op breakpunt.', homework: 'Twee sets spelen',
  },
];
