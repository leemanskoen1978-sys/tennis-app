import {
  GOAL_HORIZONS, HORIZON_LABELS, DEFAULT_SHOT_TYPES, DEFAULT_CHANGE_TYPES,
  shotTypeOptions, changeTypeOptions, goalsFor, isEmptyGoal, upsertGoal, removeGoal,
  newGoalId, addOption, removeOption, goalSummary, horizonSummary, filledGoalCount,
  goalCountLabel,
} from './goals';
import type { PlayerGoal } from './types';

const goal = (
  id: string, student: string, horizon: PlayerGoal['horizon'], shot?: string,
): PlayerGoal => ({ id, student_id: student, horizon, shot_type: shot });

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

describe('goalsFor', () => {
  const goals = [
    goal('a', 'p1', 'lessons10', 'Forehand'),
    goal('b', 'p1', 'lessons10', 'Opslag'),
    goal('c', 'p2', 'lessons10', 'Volley'),
    goal('d', 'p1', 'season', 'Smash'),
  ];

  it('gives every goal this player has for this horizon', () => {
    expect(goalsFor(goals, 'p1', 'lessons10').map((g) => g.shot_type))
      .toEqual(['Forehand', 'Opslag']);
  });

  it('does not mix players up', () => {
    expect(goalsFor(goals, 'p2', 'lessons10').map((g) => g.id)).toEqual(['c']);
  });

  it('does not mix horizons up', () => {
    expect(goalsFor(goals, 'p1', 'season').map((g) => g.id)).toEqual(['d']);
  });

  it('is empty when the player has nothing for that horizon yet', () => {
    expect(goalsFor(goals, 'p2', 'season')).toEqual([]);
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

describe('goalSummary', () => {
  it('zet slag en wijziging naast elkaar', () => {
    expect(goalSummary({ shot_type: 'Forehand', change_type: 'Greepwissel' }))
      .toBe('Forehand · Greepwissel');
  });

  it('laat weg wat niet is ingevuld', () => {
    expect(goalSummary({ shot_type: 'Forehand' })).toBe('Forehand');
    expect(goalSummary({ change_type: 'Regelmaat' })).toBe('Regelmaat');
  });

  it('valt terug op de opmerking als slag en wijziging leeg zijn', () => {
    expect(goalSummary({ notes: '  Let op de greep  ' })).toBe('Let op de greep');
  });

  it('houdt het bij de eerste regel van een opmerking', () => {
    expect(goalSummary({ notes: 'Greep\nen verder nog van alles' })).toBe('Greep');
  });

  it('kort een lange opmerking af', () => {
    const long = 'a'.repeat(80);
    const out = goalSummary({ notes: long });
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(61);
  });

  it('is leeg bij een leeg doel', () => {
    expect(goalSummary({})).toBe('');
  });
});

describe('horizonSummary', () => {
  const g = (id: string, shot?: string, change?: string): PlayerGoal => ({
    id, student_id: 'p1', horizon: 'lessons10', shot_type: shot, change_type: change,
  });

  it('is leeg zonder doelen', () => {
    expect(horizonSummary([])).toBe('');
  });

  it('is leeg als er alleen nog lege doelen staan', () => {
    expect(horizonSummary([g('a')])).toBe('');
  });

  it('toont het ene ingevulde doel', () => {
    expect(horizonSummary([g('a', 'Forehand', 'Greepwissel')])).toBe('Forehand · Greepwissel');
  });

  it('beschrijft alleen het eerste doel, ook als er meer zijn — het aantal staat apart', () => {
    expect(horizonSummary([g('a', 'Forehand'), g('b', 'Opslag'), g('c', 'Volley')]))
      .toBe('Forehand');
  });

  it('telt lege doelen niet mee', () => {
    expect(horizonSummary([g('a'), g('b', 'Opslag')])).toBe('Opslag');
  });
});

describe('filledGoalCount', () => {
  const g = (id: string, shot?: string): PlayerGoal => ({
    id, student_id: 'p1', horizon: 'lessons10', shot_type: shot,
  });

  it('is nul zonder doelen', () => {
    expect(filledGoalCount([])).toBe(0);
  });

  it('telt één ingevuld doel', () => {
    expect(filledGoalCount([g('a', 'Forehand')])).toBe(1);
  });

  it('telt meerdere ingevulde doelen', () => {
    expect(filledGoalCount([g('a', 'Forehand'), g('b', 'Opslag'), g('c', 'Volley')])).toBe(3);
  });

  it('telt een mix van ingevulde en lege doelen — alleen de ingevulde tellen mee', () => {
    expect(filledGoalCount([g('a'), g('b', 'Opslag'), g('c')])).toBe(1);
  });
});

describe('goalCountLabel', () => {
  it('gebruikt enkelvoud bij één doel', () => {
    expect(goalCountLabel(1)).toBe('1 doel');
  });

  it('gebruikt meervoud bij nul of meer dan één doel', () => {
    expect(goalCountLabel(0)).toBe('0 doelen');
    expect(goalCountLabel(2)).toBe('2 doelen');
  });
});

describe('newGoalId', () => {
  it('does not hand out the same id twice', () => {
    const ids = new Set(Array.from({ length: 50 }, () => newGoalId()));
    expect(ids.size).toBe(50);
  });
});

describe('upsertGoal', () => {
  it('adds a goal the store has not seen', () => {
    const out = upsertGoal([], goal('a', 'p1', 'lessons10', 'Forehand'));
    expect(out).toHaveLength(1);
  });

  it('holds several goals in one horizon', () => {
    let out = upsertGoal([], goal('a', 'p1', 'lessons10', 'Forehand'));
    out = upsertGoal(out, goal('b', 'p1', 'lessons10', 'Opslag'));
    expect(goalsFor(out, 'p1', 'lessons10')).toHaveLength(2);
  });

  it('replaces a goal in place, so editing does not move it down the list', () => {
    const start = [
      goal('a', 'p1', 'lessons10', 'Forehand'),
      goal('b', 'p1', 'lessons10', 'Opslag'),
    ];
    const out = upsertGoal(start, goal('a', 'p1', 'lessons10', 'Backhand'));
    expect(out.map((g) => g.id)).toEqual(['a', 'b']);
    expect(out[0].shot_type).toBe('Backhand');
  });

  it('leaves the other horizons and the other players alone', () => {
    const start = [goal('a', 'p1', 'season', 'Smash'), goal('b', 'p2', 'lessons10', 'Volley')];
    const out = upsertGoal(start, goal('c', 'p1', 'lessons10', 'Forehand'));
    expect(out).toHaveLength(3);
  });

  it('keeps a goal that has been emptied out — removing is explicit', () => {
    const start = [goal('a', 'p1', 'lessons10', 'Forehand')];
    const out = upsertGoal(start, { id: 'a', student_id: 'p1', horizon: 'lessons10' });
    expect(out).toHaveLength(1);
    expect(out[0].shot_type).toBeUndefined();
  });
});

describe('removeGoal', () => {
  it('removes just that goal', () => {
    const start = [
      goal('a', 'p1', 'lessons10', 'Forehand'),
      goal('b', 'p1', 'lessons10', 'Opslag'),
    ];
    expect(removeGoal(start, 'a').map((g) => g.id)).toEqual(['b']);
  });

  it('leaves the list alone when the goal is not in it', () => {
    const start = [goal('a', 'p1', 'lessons10', 'Forehand')];
    expect(removeGoal(start, 'zzz')).toHaveLength(1);
  });
});
