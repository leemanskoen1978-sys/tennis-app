// Goals per player: one per horizon, with the choices the club maintains itself.

import { t } from './i18n';
import type { GoalHorizon, PlayerGoal, Settings } from './types';

/** The three horizons, in the order a coach thinks about them. */
export const GOAL_HORIZONS: readonly GoalHorizon[] = ['lessons10', 'lessons20', 'season'] as const;

export const HORIZON_LABELS: Record<GoalHorizon, string> = {
  lessons10: 'Binnen 10 lessen',
  lessons20: 'Binnen 20 lessen',
  season: 'Einde seizoen',
};

/** Hetzelfde label, in de taal die de gebruiker gekozen heeft. */
export function horizonLabel(horizon: GoalHorizon): string {
  return t(HORIZON_LABELS[horizon]);
}

/** Starting choices. The club adds its own in Beheer; these are only the first ones. */
export const DEFAULT_SHOT_TYPES: readonly string[] = [
  'Forehand', 'Backhand', 'Volley', 'Smash', 'Opslag',
] as const;

export const DEFAULT_CHANGE_TYPES: readonly string[] = [
  'Greepwissel', 'Regelmaat', 'Techniek',
] as const;

/**
 * The choices to offer. A store written before these lists existed has neither, and an
 * empty list would leave a coach with nothing to pick — so missing falls back to the
 * defaults, while a list the club has deliberately edited is used as-is.
 */
export function shotTypeOptions(settings: Pick<Settings, 'shot_types'>): string[] {
  return settings.shot_types ?? [...DEFAULT_SHOT_TYPES];
}

export function changeTypeOptions(settings: Pick<Settings, 'change_types'>): string[] {
  return settings.change_types ?? [...DEFAULT_CHANGE_TYPES];
}

/** Every goal this player has for this horizon, in the order they were added. */
export function goalsFor(
  goals: PlayerGoal[],
  studentId: string,
  horizon: GoalHorizon,
): PlayerGoal[] {
  return goals.filter((g) => g.student_id === studentId && g.horizon === horizon);
}

/** Nothing filled in yet. Used to decide what to show, never to throw a goal away. */
export function isEmptyGoal(g: Pick<PlayerGoal, 'shot_type' | 'change_type' | 'notes'>): boolean {
  return !g.shot_type && !g.change_type && !(g.notes ?? '').trim();
}

/** Een lange opmerking past niet op één regel; hierna volgt een beletselteken. */
const SUMMARY_MAX = 60;

function shorten(text: string): string {
  const oneLine = text.trim().split('\n')[0].trim();
  return oneLine.length > SUMMARY_MAX ? `${oneLine.slice(0, SUMMARY_MAX).trimEnd()}…` : oneLine;
}

/**
 * Eén doel in één regel: de slag en de wijziging, want dat is waar een trainer een doel aan
 * herkent. Staat daar nog niets, dan draagt de opmerking de regel — beter iets herkenbaars
 * dan een lege regel bij een doel dat wel degelijk is ingevuld.
 */
export function goalSummary(
  g: Pick<PlayerGoal, 'shot_type' | 'change_type' | 'notes'>,
): string {
  const parts = [g.shot_type, g.change_type].filter((p): p is string => !!p);
  if (parts.length > 0) return parts.join(' · ');
  return shorten(g.notes ?? '');
}

/**
 * Wat er van een horizon op de compacte regel staat. Alleen ingevulde doelen tellen mee: een
 * zojuist toegevoegd, nog leeg doel mag de regel niet vullen. Het aantal staat er inmiddels
 * apart naast (zie filledGoalCount), dus deze regel beschrijft alleen nog het eerste doel.
 */
export function horizonSummary(goals: PlayerGoal[]): string {
  const filled = goals.filter((g) => !isEmptyGoal(g));
  return filled.length === 0 ? '' : goalSummary(filled[0]);
}

/**
 * Hoeveel doelen onder deze horizon zijn ingevuld — voor de badge naast de horizonnaam.
 * Zelfde telling als horizonSummary: een nog leeg doel telt niet mee.
 */
export function filledGoalCount(goals: PlayerGoal[]): number {
  return goals.filter((g) => !isEmptyGoal(g)).length;
}

/** "1 doel" tegenover "3 doelen" — het label op die badge. */
export function goalCountLabel(count: number): string {
  return count === 1 ? t('1 doel') : t('{n} doelen', { n: count });
}

export function newGoalId(): string {
  return `goal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Store a goal under its own id: replace it where it stands, or add it at the end.
 *
 * A horizon holds as many goals as the coach wants, so nothing is displaced by writing
 * another one. Replacing in place matters: a goal must not jump to the bottom of the list
 * the moment you edit a field.
 *
 * An emptied-out goal is kept, not dropped. With an explicit "Doel toevoegen" and a
 * Verwijderen next to each goal, a card that vanishes while you are clearing a field is a
 * surprise rather than a convenience.
 */
export function upsertGoal(goals: PlayerGoal[], goal: PlayerGoal): PlayerGoal[] {
  const known = goals.some((g) => g.id === goal.id);
  return known ? goals.map((g) => (g.id === goal.id ? goal : g)) : [...goals, goal];
}

/** Removing a goal is always explicit. */
export function removeGoal(goals: PlayerGoal[], id: string): PlayerGoal[] {
  return goals.filter((g) => g.id !== id);
}

/** Adding a choice in Beheer: trimmed, never blank, never a duplicate (ignoring case). */
export function addOption(options: string[], raw: string): string[] {
  const value = raw.trim();
  if (value === '') return options;
  if (options.some((o) => o.toLowerCase() === value.toLowerCase())) return options;
  return [...options, value];
}

/**
 * Removing a choice only removes it from the list. Goals that already point at it keep
 * their text — a club renaming its vocabulary should not silently blank out what a coach
 * agreed with a player.
 */
export function removeOption(options: string[], value: string): string[] {
  return options.filter((o) => o !== value);
}
