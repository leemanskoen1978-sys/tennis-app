// Goals per player: one per horizon, with the choices the club maintains itself.

import type { GoalHorizon, PlayerGoal, Settings } from './types';

/** The three horizons, in the order a coach thinks about them. */
export const GOAL_HORIZONS: readonly GoalHorizon[] = ['lessons10', 'lessons20', 'season'] as const;

export const HORIZON_LABELS: Record<GoalHorizon, string> = {
  lessons10: 'Binnen 10 lessen',
  lessons20: 'Binnen 20 lessen',
  season: 'Einde seizoen',
};

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

/** The goal a player has for this horizon, or null when none is set yet. */
export function goalFor(
  goals: PlayerGoal[],
  studentId: string,
  horizon: GoalHorizon,
): PlayerGoal | null {
  return goals.find((g) => g.student_id === studentId && g.horizon === horizon) ?? null;
}

/** A goal with nothing filled in is not a goal; it is stored as absent. */
export function isEmptyGoal(g: Pick<PlayerGoal, 'shot_type' | 'change_type' | 'notes'>): boolean {
  return !g.shot_type && !g.change_type && !(g.notes ?? '').trim();
}

/**
 * Put a goal in its place: replace the one for this player and horizon, add it when there
 * is none, drop it when it has been emptied out. One goal per horizon is the whole rule,
 * so it lives here rather than in a screen.
 */
export function upsertGoal(goals: PlayerGoal[], goal: PlayerGoal): PlayerGoal[] {
  const others = goals.filter(
    (g) => !(g.student_id === goal.student_id && g.horizon === goal.horizon),
  );
  if (isEmptyGoal(goal)) return others;
  return [...others, goal];
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
