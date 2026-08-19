import { installCatalogue, type CatalogueTarget } from './catalogue';
import { u9Trainings, U9_CATALOGUE_ID } from './trainings-u9';
import type { Lesson } from './types';

const lesson = (id: string, title: string): Lesson => ({
  id, title, uploaded_by: 'u-koen',
});

describe('installCatalogue', () => {
  it('adds the lessons to a store that has none', () => {
    const out = installCatalogue<CatalogueTarget>({ lessons: [] }, 'cat-1', [lesson('a', 'A'), lesson('b', 'B')]);
    expect(out.lessons.map((l) => l.id)).toEqual(['a', 'b']);
    expect(out.installed_catalogues).toEqual(['cat-1']);
  });

  it('keeps the lessons that were already there', () => {
    const mine = lesson('mine', 'Eigen les');
    const out = installCatalogue<CatalogueTarget>({ lessons: [mine] }, 'cat-1', [lesson('a', 'A')]);
    expect(out.lessons.map((l) => l.id)).toEqual(['mine', 'a']);
  });

  it('does nothing the second time, so a deleted training stays deleted', () => {
    const once = installCatalogue<CatalogueTarget>({ lessons: [] }, 'cat-1', [lesson('a', 'A'), lesson('b', 'B')]);
    const afterDelete = { ...once, lessons: once.lessons.filter((l) => l.id !== 'a') };
    const twice = installCatalogue(afterDelete, 'cat-1', [lesson('a', 'A'), lesson('b', 'B')]);
    expect(twice).toBe(afterDelete);
    expect(twice.lessons.map((l) => l.id)).toEqual(['b']);
  });

  it('fills the gaps of an interrupted install without duplicating', () => {
    const half: CatalogueTarget = { lessons: [lesson('a', 'A')] };
    const out = installCatalogue(half, 'cat-1', [lesson('a', 'A'), lesson('b', 'B')]);
    expect(out.lessons.map((l) => l.id)).toEqual(['a', 'b']);
  });

  it('leaves other catalogues alone', () => {
    const out = installCatalogue<CatalogueTarget>(
      { lessons: [], installed_catalogues: ['other'] },
      'cat-1',
      [lesson('a', 'A')],
    );
    expect(out.installed_catalogues).toEqual(['other', 'cat-1']);
  });
});

describe('u9Trainings', () => {
  it('has one lesson per page of the booklet', () => {
    expect(u9Trainings).toHaveLength(51);
  });

  it('numbers the trainings 1 to 51 with unique ids', () => {
    expect(u9Trainings.map((l) => l.training_number)).toEqual(
      Array.from({ length: 51 }, (_, i) => i + 1),
    );
    expect(new Set(u9Trainings.map((l) => l.id)).size).toBe(51);
  });

  it('lasts an hour and a half per training', () => {
    expect(u9Trainings.every((l) => l.duration_minutes === 90)).toBe(true);
  });

  it('gives every training a title and the focus points as description', () => {
    for (const l of u9Trainings) {
      expect(l.title.length).toBeGreaterThan(0);
      expect(l.description).toBe((l.focus_points ?? []).join(' '));
      expect((l.focus_points ?? []).length).toBeGreaterThan(0);
    }
  });

  it('carries the exercise table with every column filled in where the booklet has one', () => {
    for (const l of u9Trainings) {
      expect((l.exercises ?? []).length).toBeGreaterThan(0);
      for (const e of l.exercises ?? []) {
        expect(e.nr).not.toBe('');
        expect(e.duration).not.toBe('');
        expect(e.description.length).toBeGreaterThan(20);
      }
    }
  });

  it('is available to everyone: no training is tied to one player', () => {
    expect(u9Trainings.every((l) => l.student_id === undefined)).toBe(true);
  });

  it('uses a stable catalogue id', () => {
    expect(U9_CATALOGUE_ID).toBe('u9-kdt-v1');
  });
});
