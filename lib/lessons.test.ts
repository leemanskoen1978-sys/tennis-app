import { visibleLessonsFor } from './lessons';
import type { Lesson, User } from './types';

const lesson = (id: string, studentId?: string): Lesson => ({
  id,
  title: id,
  uploaded_by: 'u-koen',
  student_id: studentId,
});

const coach: User = { id: 'u-koen', email: 'k@x.be', name: 'Koen', role: 'coach' };
const speler: User = { id: 'u-mathis', email: 'm@x.be', name: 'Mathis', role: 'player' };

const alles = [lesson('algemeen'), lesson('voor-mathis', 'u-mathis'), lesson('voor-lotte', 'u-lotte')];

describe('visibleLessonsFor', () => {
  it('laat een trainer alles zien', () => {
    expect(visibleLessonsFor(alles, coach).map((l) => l.id)).toEqual([
      'algemeen', 'voor-mathis', 'voor-lotte',
    ]);
  });

  it('laat een speler alleen zijn eigen lessen zien', () => {
    expect(visibleLessonsFor(alles, speler).map((l) => l.id)).toEqual(['voor-mathis']);
  });

  it('houdt het clubmateriaal weg bij een speler', () => {
    // Het boekje van de club hangt aan niemand; dat is gereedschap van de trainer.
    expect(visibleLessonsFor(alles, speler).map((l) => l.id)).not.toContain('algemeen');
  });

  it('laat zonder gebruiker niets zien', () => {
    expect(visibleLessonsFor(alles, null)).toEqual([]);
  });
});
