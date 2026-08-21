// De spraakmemo: ruw materiaal dat een trainer op de baan inspreekt.
//
// Alles wat over een memo te beslissen valt staat hier, en niet in de knop of in het
// scherm. De knop op de baan en de uitwerklijst stellen dezelfde vragen — is deze opname
// het bewaren waard, hoe lang duurt hij, wie is er nog niet uitgewerkt — en die vragen
// horen één antwoord te hebben.

import type { Memo, StudentProgress } from './types';

/**
 * Korter dan dit is geen memo maar een misgreep: op een baan raak je het scherm weleens
 * aan met je duim terwijl je een bal opraapt. Die opname verdwijnt zonder mededeling.
 */
export const MIN_MEMO_MS = 1000;

/**
 * Langer dan dit kapt de knop af. Een memo is een zin of twee; wie een minuut praat, is
 * eigenlijk een notitie aan het maken en kan dat beter 's avonds doen.
 */
export const MAX_MEMO_MS = 60_000;

/** Vanaf hier telt de knop zichtbaar af, zodat de afkap niemand verrast. */
export const WAARSCHUW_VANAF_MS = 50_000;

/** Is deze opname het bewaren waard? */
export function opnameDeugt(durationMs: number): boolean {
  return Number.isFinite(durationMs) && durationMs >= MIN_MEMO_MS;
}

/** Hoe lang hij duurt, zoals een speler het toont: "0:08", "1:05". */
export function memoDuur(durationMs: number): string {
  const totaal = Math.max(0, Math.floor(durationMs / 1000));
  const minuten = Math.floor(totaal / 60);
  const seconden = totaal % 60;
  return `${minuten}:${String(seconden).padStart(2, '0')}`;
}

/**
 * Hoeveel seconden er nog zijn voor de knop afkapt, of `null` zolang dat nog niet
 * interessant is. Zo hoeft de knop de grenzen niet te kennen en hoeft dit bestand niets
 * van een knop te weten.
 */
export function resterend(durationMs: number): number | null {
  if (durationMs < WAARSCHUW_VANAF_MS) return null;
  return Math.max(0, Math.ceil((MAX_MEMO_MS - durationMs) / 1000));
}

/** De memo's die deze trainer nog moet uitwerken: oudste eerst. */
export function uitTeWerken(memos: Memo[], coachId: string): Memo[] {
  return memos
    .filter((m) => m.coach_id === coachId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/**
 * Heeft deze speler al een memo in déze les? Dat is op een baan de enige vraag die telt:
 * wie heb ik al gehad. Een memo zonder les telt niet mee — die hoort bij geen enkel
 * vakje op het scherm.
 */
export function heeftMemo(memos: Memo[], bookingId: string, studentId: string): boolean {
  return memos.some((m) => m.booking_id === bookingId && m.student_id === studentId);
}

/** De velden waarmee de notitie begint die uit deze memo voortkomt. */
export interface MemoPreset {
  student_id: string;
  voice_memo_uri: string;
  /**
   * Het moment van de **opname**, niet van het uitwerken. Een notitie die 's avonds
   * getypt wordt gaat over wat er die middag gebeurde, en hoort in het dossier op die
   * middag te staan.
   */
  created_at: string;
}

export function memoNaarNotitie(memo: Memo): MemoPreset {
  return {
    student_id: memo.student_id,
    voice_memo_uri: memo.audio_uri,
    created_at: memo.created_at,
  };
}

/** Dat de velden op elkaar passen, bewaakt TypeScript hiermee en niet een test. */
export type NotitieUitMemo = Pick<StudentProgress, 'student_id' | 'voice_memo_uri' | 'created_at'>;
