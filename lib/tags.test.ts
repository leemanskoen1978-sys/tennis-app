import {
  ALL_TAGS,
  availableTags,
  exerciseTags,
  filterExercises,
  filterLessons,
  lessonTags,
  parseTagInput,
  tagsForText,
} from './tags';
import { u9Trainings } from './trainings-u9';
import type { Lesson } from './types';

const lesson = (extra: Partial<Lesson>): Lesson => ({
  id: 'l1',
  title: 'Test',
  uploaded_by: 'u-koen',
  ...extra,
});

describe('tagsForText', () => {
  it('herkent slagen in gewone zinnen', () => {
    expect(tagsForText('Werken aan de forehand en de backhand')).toEqual(
      expect.arrayContaining(['Forehand', 'Backhand']),
    );
  });

  it('herkent de afkortingen uit het boekje', () => {
    expect(tagsForText('Beide spelers moeten zowel FH als BH met slice spelen')).toEqual(
      expect.arrayContaining(['Forehand', 'Backhand', 'Slice']),
    );
  });

  it('slaat niet aan op een afkorting die in een woord verstopt zit', () => {
    // "fh" in "ofhankelijk" of "bh" in "abhang" mag geen slagtag opleveren.
    expect(tagsForText('een ofhankelijke abhang')).toEqual([]);
  });

  it('negeert accenten en hoofdletters', () => {
    expect(tagsForText('COÖRDINATIE')).toContain('Coördinatie');
  });
});

describe('lessonTags', () => {
  it('zet eigen tags vooraan en vult aan met wat uit de tekst volgt', () => {
    const tags = lessonTags(
      lesson({ tags: ['U9'], description: 'Oefening op de volley aan het net' }),
    );
    expect(tags[0]).toBe('U9');
    expect(tags).toContain('Volley');
  });

  it('herhaalt een tag niet die de trainer zelf al gaf', () => {
    const tags = lessonTags(lesson({ tags: ['forehand'], description: 'forehand kruis' }));
    expect(tags.filter((t) => t.toLowerCase() === 'forehand')).toHaveLength(1);
  });

  it('leest ook de tabel met oefeningen', () => {
    const tags = lessonTags(
      lesson({
        exercises: [
          {
            nr: '1', duration: "10'", situation: 'basislijnspel', purpose: 'AANVALLEN',
            description: 'Speler 1 start met opslag', quality: '', organisation: '',
          },
        ],
      }),
    );
    expect(tags).toEqual(expect.arrayContaining(['Opslag', 'Basislijnspel', 'Aanvallen']));
  });
});

describe('filterLessons', () => {
  const lessons = [
    lesson({ id: 'a', title: 'Volley aan het net' }),
    lesson({ id: 'b', title: 'Forehand aanvallen vanuit de basislijn' }),
    lesson({ id: 'c', title: 'Forehand verdedigen' }),
  ];

  it('geeft alles terug zonder zoekterm of tag', () => {
    expect(filterLessons(lessons, {})).toHaveLength(3);
  });

  it('combineert tags als EN, niet als OF', () => {
    const found = filterLessons(lessons, { tags: ['Forehand', 'Aanvallen'] });
    expect(found.map((l) => l.id)).toEqual(['b']);
  });

  it('zoekt op tekst en op tagnaam', () => {
    expect(filterLessons(lessons, { query: 'net' }).map((l) => l.id)).toEqual(['a']);
    expect(filterLessons(lessons, { query: 'verdedigen' }).map((l) => l.id)).toEqual(['c']);
  });

  it('vraagt om alle woorden uit de zoekterm', () => {
    expect(filterLessons(lessons, { query: 'forehand net' })).toHaveLength(0);
  });
});

describe('filterExercises', () => {
  it('geeft de losse oefening terug, met de les waar hij uit komt', () => {
    const hits = filterExercises(u9Trainings, { tags: ['Volley'] });
    expect(hits.length).toBeGreaterThan(0);
    for (const hit of hits) {
      expect(exerciseTags(hit.exercise)).toContain('Volley');
      expect(hit.lesson.exercises).toContain(hit.exercise);
    }
  });
});

describe('de meegeleverde U9-trainingen', () => {
  it('krijgt allemaal minstens één tag zonder dat iemand ze invulde', () => {
    const zonder = u9Trainings.filter((l) => lessonTags(l).length === 0);
    expect(zonder).toEqual([]);
  });

  it('levert een filterbalk op met de slagen erin', () => {
    const tags = availableTags(u9Trainings);
    expect(tags).toEqual(expect.arrayContaining(['Forehand', 'Backhand', 'Opslag']));
    // Alleen tags die de app kent en die echt voorkomen.
    expect(tags.every((t) => ALL_TAGS.includes(t))).toBe(true);
  });

  it('geeft niet elke training dezelfde tags', () => {
    const eerste = lessonTags(u9Trainings[0]).join('|');
    expect(u9Trainings.some((l) => lessonTags(l).join('|') !== eerste)).toBe(true);
  });
});

describe('parseTagInput', () => {
  it('splitst op komma en haalt dubbele eruit', () => {
    expect(parseTagInput('forehand, Netspel , forehand')).toEqual(['Forehand', 'Netspel']);
  });

  it('houdt een eigen woord dat de app niet kent', () => {
    expect(parseTagInput('U9')).toEqual(['U9']);
  });

  it('geeft een lege lijst bij lege invoer', () => {
    expect(parseTagInput('  ,  ')).toEqual([]);
  });
});
