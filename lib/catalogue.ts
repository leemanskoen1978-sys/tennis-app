// Adding a shipped set of lessons to a store that is already in use.

import type { Lesson } from './types';

/** The slice of the store this touches. Kept narrow so it is testable without a store. */
export interface CatalogueTarget {
  lessons: Lesson[];
  installed_catalogues?: string[];
}

/**
 * Add a catalogue's lessons once, and remember that it happened.
 *
 * Seeding only runs on an empty store, so anyone already using the app would never see a
 * newly shipped catalogue. Adding it on load fixes that — but it has to be recorded, or a
 * training the coach deliberately deleted would come back every time the app starts.
 *
 * Returns the same object when there is nothing to do, so the caller can skip a write.
 */
export function installCatalogue<T extends CatalogueTarget>(
  store: T,
  catalogueId: string,
  lessons: Lesson[],
): T {
  const installed = store.installed_catalogues ?? [];
  if (installed.includes(catalogueId)) return store;

  // Guard against a half-installed store from an interrupted earlier run.
  const known = new Set(store.lessons.map((l) => l.id));
  const missing = lessons.filter((l) => !known.has(l.id));

  return {
    ...store,
    lessons: [...store.lessons, ...missing],
    installed_catalogues: [...installed, catalogueId],
  };
}
