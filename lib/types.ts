// Shared data model (spec §4).

export type Role = 'player' | 'coach' | 'parent';
export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'synchronized';
export type PaymentStatus = 'paid' | 'unpaid' | 'invoice' | null;
export type TrainingType = 'techniek' | 'tactiek' | 'fysiek' | 'mentaal' | 'match';

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
}

export interface Court {
  id: string;
  name: string;
  number: number;
  indoor: boolean;
  hourly_rate: number;
}

export interface Booking {
  id: string;
  player_id: string;
  coach_id: string;
  court_id: string;
  start_time: string; // ISO
  end_time: string; // ISO
  status: BookingStatus;
  payment_status: PaymentStatus;
  notes?: string;
  actual_start_time?: string;
  actual_end_time?: string;
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

export interface Settings {
  booking_end_time: string;
  theme?: 'light' | 'dark';
  language?: 'nl' | 'en';
  notifications?: Record<string, boolean>;
  blocked_popups_until?: string | null;
}
