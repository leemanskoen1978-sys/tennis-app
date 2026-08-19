import type { User, Court, Settings, Booking, Lesson, StudentProgress } from './types';

// Fixed ids so the mock store has stable relations across reloads.
export const seedUsers: User[] = [
  { id: 'u-koen', name: 'Koen', email: 'koen@example.com', role: 'coach' },
  // A second coach, sharing Mathis with Koen. Without one you cannot see what the app
  // does now: shared dossiers, "who wrote this" labels, and money staying per coach.
  { id: 'u-sanne', name: 'Sanne', email: 'sanne@example.com', role: 'coach' },
  { id: 'u-mathis', name: 'Mathis', email: 'mathis@example.com', role: 'player' },
  { id: 'u-test', name: 'Test', email: 'test@example.com', role: 'player' },
];

export const seedCourts: Court[] = [
  { id: 'court-1', name: 'Baan 1', number: 1, indoor: false, hourly_rate: 30 },
  { id: 'court-2', name: 'Baan 2', number: 2, indoor: true, hourly_rate: 35 },
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
    status: 'confirmed', payment_status: null, notes: 'Techniektraining',
  },
  {
    id: 'b-2', player_id: 'u-test', coach_id: 'u-koen', court_id: 'court-2',
    start_time: futureISO(3, 14), end_time: futureISO(3, 15),
    status: 'confirmed', payment_status: 'paid',
  },
  {
    id: 'b-3', player_id: 'u-mathis', coach_id: 'u-koen', court_id: 'court-1',
    start_time: futureISO(-2, 9), end_time: futureISO(-2, 10),
    status: 'completed', payment_status: null, notes: 'Match play',
  },
  // Sanne's side: Mathis trains with both, so his dossier is genuinely shared.
  {
    id: 'b-4', player_id: 'u-mathis', coach_id: 'u-sanne', court_id: 'court-2',
    start_time: futureISO(4, 16), end_time: futureISO(4, 17),
    status: 'confirmed', payment_status: null, notes: 'Tactiek',
  },
  {
    id: 'b-5', player_id: 'u-test', coach_id: 'u-sanne', court_id: 'court-1',
    start_time: futureISO(-1, 11), end_time: futureISO(-1, 12),
    status: 'completed', payment_status: 'paid',
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
