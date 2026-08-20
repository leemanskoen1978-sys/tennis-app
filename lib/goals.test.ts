import {
  GOAL_HORIZONS, HORIZON_LABELS, DEFAULT_SHOT_TYPES, DEFAULT_CHANGE_TYPES,
  shotTypeOptions, changeTypeOptions, goalFor, isEmptyGoal, upsertGoal,
  addOption, removeOption,
} from './goals';
import type { PlayerGoal } from './types';

const goal = (student: string, horizon: PlayerGoal['horizon'], shot?: string): PlayerGoal => ({
  id: `${student}-${horizon}`, student_id: student, horizon, shot_type: shot,
});

describe('horizons', () => {
  it('has exactly the three the coach asked for, in thinking order', () => {
    expect(GOAL_HORIZONS).toEqual(['lessons10', 'lessons20', 'season']);
    expect(HORIZON_LABELS.lessons10).toBe('Binnen 10 lessen');
    expect(HORIZON_LABELS.lessons20).toBe('Binnen 20 lessen');
    expect(HORIZON_LABELS.season).toBe('Einde seizoen');
  });
});

describe('option lists', () => {
  it('falls back to the defaults for a store written before the lists existed', () => {
    expect(shotTypeOptions({})).toEqual([...DEFAULT_SHOT_TYPES]);
    expect(changeTypeOptions({})).toEqual([...DEFAULT_CHANGE_TYPES]);
  });

  it('starts from the five shots and three changes that were asked for', () => {
    expect(DEFAULT_SHOT_TYPES).toEqual(['Forehand', 'Backhand', 'Volley', 'Smash', 'Opslag']);
    expect(DEFAULT_CHANGE_TYPES).toEqual(['Greepwissel', 'Regelmaat', 'Techniek']);
  });

  it('uses the club list once it has been edited', () => {
    expect(shotTypeOptions({ shot_types: ['Lob'] })).toEqual(['Lob']);
  });

  it('respects a list the club emptied on purpose', () => {
    expect(shotTypeOptions({ shot_types: [] })).toEqual([]);
  });
});

describe('addOption', () => {
  it('adds a trimmed choice at the end', () => {
    expect(addOption(['Forehand'], '  Lob ')).toEqual(['Forehand', 'Lob']);
  });
  it('ignores blank input', () => {
    expect(addOption(['Forehand'], '   ')).toEqual(['Forehand']);
  });
  it('does not add the same choice twice, whatever the casing', () => {
    expect(addOption(['Forehand'], 'forehand')).toEqual(['Forehand']);
  });
});

describe('removeOption', () => {
  it('removes just that choice', () => {
    expect(removeOption(['Forehand', 'Lob'], 'Lob')).toEqual(['Forehand']);
  });
  it('leaves the list alone when the choice is not in it', () => {
    expect(removeOption(['Forehand'], 'Lob')).toEqual(['Forehand']);
  });
});

describe('goalFor', () => {
  const goals = [goal('p1', 'lessons10', 'Forehand'), goal('p2', 'lessons10', 'Volley')];

  it('finds the goal of this player for this horizon', () => {
    expect(goalFor(goals, 'p1', 'lessons10')?.shot_type).toBe('Forehand');
  });
  it('does not mix players up', () => {
    expect(goalFor(goals, 'p2', 'lessons10')?.shot_type).toBe('Volley');
  });
  it('returns null when there is nothing yet', () => {
    expect(goalFor(goals, 'p1', 'season')).toBeNull();
  });
});

describe('isEmptyGoal', () => {
  it('is empty with nothing filled in', () => {
    expect(isEmptyGoal({})).toBe(true);
    expect(isEmptyGoal({ notes: '   ' })).toBe(true);
  });
  it('is not empty with any one field filled in', () => {
    expect(isEmptyGoal({ shot_type: 'Forehand' })).toBe(false);
    expect(isEmptyGoal({ change_type: 'Techniek' })).toBe(false);
    expect(isEmptyGoal({ notes: 'Let op de greep' })).toBe(false);
  });
});

describe('upsertGoal', () => {
  it('adds a goal when the player has none for that horizon', () => {
    const out = upsertGoal([], goal('p1', 'lessons10', 'Forehand'));
    expect(out).toHaveLength(1);
  });

  it('replaces rather than duplicates — one goal per horizon', () => {
    const out = upsertGoal(
      [goal('p1', 'lessons10', 'Forehand')],
      goal('p1', 'lessons10', 'Backhand'),
    );
    expect(out).toHaveLength(1);
    expect(out[0].shot_type).toBe('Backhand');
  });

  it('leaves the other horizons and the other players alone', () => {
    const start = [goal('p1', 'season', 'Smash'), goal('p2', 'lessons10', 'Volley')];
    const out = upsertGoal(start, goal('p1', 'lessons10', 'Forehand'));
    expect(out).toHaveLength(3);
    expect(goalFor(out, 'p1', 'season')?.shot_type).toBe('Smash');
    expect(goalFor(out, 'p2', 'lessons10')?.shot_type).toBe('Volley');
  });

  it('drops a goal that has been emptied out instead of storing a blank one', () => {
    const start = [goal('p1', 'lessons10', 'Forehand')];
    const out = upsertGoal(start, { id: 'x', student_id: 'p1', horizon: 'lessons10' });
    expect(out).toEqual([]);
  });
});
