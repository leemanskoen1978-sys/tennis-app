import {
  participantIdsOf, groupSize, isGroupLesson, lessonPlayerIds, playsIn,
  shortGroupLabel, groupSizeLabel,
} from './groups';
import type { Booking } from './types';

const base: Booking = {
  id: 'b1', player_id: 'p1', coach_id: 'koen', court_id: 'court-1',
  start_time: '2026-08-20T10:00:00.000Z', end_time: '2026-08-20T11:00:00.000Z',
  status: 'confirmed', payment_method: 'open',
};

describe('participantIdsOf', () => {
  it('is empty for a plain lesson', () => {
    expect(participantIdsOf(base)).toEqual([]);
    expect(participantIdsOf({ ...base, participant_ids: [] })).toEqual([]);
  });

  it('keeps the order the coach picked them in', () => {
    expect(participantIdsOf({ ...base, participant_ids: ['p3', 'p2'] })).toEqual(['p3', 'p2']);
  });

  it('drops duplicates, blanks and the payer himself', () => {
    expect(participantIdsOf({ ...base, participant_ids: ['p2', 'p2', '', '  ', 'p1'] }))
      .toEqual(['p2']);
  });
});

describe('groupSize', () => {
  it('counts the payer plus the extra participants', () => {
    expect(groupSize(base)).toBe(1);
    expect(groupSize({ ...base, participant_ids: ['p2'] })).toBe(2);
    expect(groupSize({ ...base, participant_ids: ['p2', 'p3', 'p4'] })).toBe(4);
  });

  it('is never smaller than one', () => {
    expect(groupSize({ ...base, participant_ids: ['p1', ''] })).toBe(1);
  });

  it('counts a participant who no longer exists in the member list', () => {
    // De les is met vier mensen gegeven; een verwijderd account verandert dat niet.
    expect(groupSize({ ...base, participant_ids: ['weg-1', 'weg-2', 'weg-3'] })).toBe(4);
  });
});

describe('isGroupLesson', () => {
  it('is only true from two players on', () => {
    expect(isGroupLesson(base)).toBe(false);
    expect(isGroupLesson({ ...base, participant_ids: ['p1'] })).toBe(false);
    expect(isGroupLesson({ ...base, participant_ids: ['p2'] })).toBe(true);
  });
});

describe('lessonPlayerIds', () => {
  it('puts the payer first', () => {
    expect(lessonPlayerIds({ ...base, participant_ids: ['p3', 'p2'] }))
      .toEqual(['p1', 'p3', 'p2']);
  });
});

describe('playsIn', () => {
  it('is true for the payer and for every participant', () => {
    const groep = { ...base, participant_ids: ['p2', 'p3'] };
    expect(playsIn(groep, 'p1')).toBe(true);
    expect(playsIn(groep, 'p3')).toBe(true);
    expect(playsIn(groep, 'p9')).toBe(false);
  });

  it('is false for someone not on the court', () => {
    expect(playsIn(base, 'p2')).toBe(false);
  });
});

describe('shortGroupLabel', () => {
  it('is just the name for one player', () => {
    expect(shortGroupLabel('Mathis', 1)).toBe('Mathis');
  });

  it('adds how many join him', () => {
    expect(shortGroupLabel('Mathis', 3)).toBe('Mathis +2');
  });
});

describe('groupSizeLabel', () => {
  it('says it in Dutch, singular and plural', () => {
    expect(groupSizeLabel(1)).toBe('1 speler');
    expect(groupSizeLabel(4)).toBe('4 spelers');
  });
});
