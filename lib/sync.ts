// Wat is er veranderd tussen twee toestanden van de opslag?
//
// De app werkt met één snapshot: elke actie rekent uit hoe de hele opslag er daarna
// uitziet en geeft dat door. Dat is de reden dat een beurt afboeken, de les op factuur
// zetten en de kaart bijwerken niet half kunnen slagen — het is één stap.
//
// Op een databank kan dat niet zo: die wil weten wélke rijen er veranderd zijn. Dit bestand
// rekent dat verschil uit. Zo blijft er precies één plek die snapshots vertaalt naar
// rij-bewerkingen, in plaats van dertig acties die het ieder zelf moeten bijhouden — en die
// ene plek is te testen zonder databank.
//
// Verwijderen komt van de vorige kant: staat een rij niet meer in de nieuwe toestand, dan is
// hij weg. Daarom moet de vorige toestand kloppen; hem overslaan zou een verwijdering laten
// verdwijnen in plaats van hem door te geven.

import type {
  Beurtenkaart, Booking, Court, Lesson, PlayerGoal, Settings, StudentProgress, User,
} from './types';

/** De verzamelingen die als rijen in een tabel leven. */
export type SyncTable =
  | 'users' | 'courts' | 'bookings' | 'lessons' | 'progress' | 'goals' | 'beurtenkaarten';

/** Alles wat een rij moet hebben om bij te werken te zijn. */
interface Row {
  id: string;
}

/** Wat er met één tabel moet gebeuren. Lege lijsten betekenen: niets te doen. */
export interface TableChange {
  table: SyncTable;
  /** Rijen die nieuw zijn of veranderd; bij een databank een upsert. */
  upsert: Row[];
  /** Id's die niet meer bestaan. */
  remove: string[];
}

export interface StoreChange {
  tables: TableChange[];
  /** De clubinstellingen, alleen als ze veranderd zijn. */
  settings: Settings | null;
  /** Lessenreeksen die er sinds de vorige toestand bij zijn gekomen. */
  catalogues: string[];
  /** Valt er iets te schrijven? Zo niet, dan hoeft er geen verbinding open. */
  empty: boolean;
}

/** De vorm van de opslag die dit bestand nodig heeft — bewust niet meer dan dat. */
export interface SyncableStore {
  users: User[];
  courts: Court[];
  bookings: Booking[];
  lessons: Lesson[];
  progress: StudentProgress[];
  goals: PlayerGoal[];
  beurtenkaarten: Beurtenkaart[];
  settings: Settings;
  installed_catalogues?: string[];
}

/**
 * Diepe gelijkheid, met sleutels in willekeurige volgorde.
 *
 * `JSON.stringify` vergelijken zou hier niet werken: de acties bouwen hun rijen met een
 * spread ({ ...booking, status }), en dan staat `status` opeens achteraan. De rij is dan
 * identiek maar de tekst niet, en elke actie zou elke rij als gewijzigd doorgeven.
 */
export function sameRow(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, i) => sameRow(item, b[i]));
  }

  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  // Een sleutel die er niet is en een sleutel met `undefined` zijn hetzelfde: de app laat
  // een leeg veld weg, de databank geeft het terug als null → undefined.
  const keys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
  for (const key of keys) {
    const av = ao[key];
    const bv = bo[key];
    if (av === undefined && bv === undefined) continue;
    if (!sameRow(av, bv)) return false;
  }
  return true;
}

function changeFor<T extends Row>(table: SyncTable, before: T[], after: T[]): TableChange {
  const wasById = new Map(before.map((row) => [row.id, row]));
  const upsert = after.filter((row) => {
    const was = wasById.get(row.id);
    return was === undefined || !sameRow(was, row);
  });
  const stillThere = new Set(after.map((row) => row.id));
  const remove = before.filter((row) => !stillThere.has(row.id)).map((row) => row.id);
  return { table, upsert, remove };
}

/**
 * Het verschil tussen twee toestanden.
 *
 * Zonder vorige toestand (de eerste keer opslaan) telt alles als nieuw: dat is precies wat
 * je wilt als een lege databank gevuld moet worden.
 */
export function diffStores(
  previous: SyncableStore | null,
  next: SyncableStore,
): StoreChange {
  const before: SyncableStore = previous ?? {
    users: [], courts: [], bookings: [], lessons: [], progress: [], goals: [],
    beurtenkaarten: [], settings: next.settings, installed_catalogues: [],
  };

  const tables: TableChange[] = [
    changeFor('users', before.users, next.users),
    changeFor('courts', before.courts, next.courts),
    changeFor('bookings', before.bookings, next.bookings),
    changeFor('lessons', before.lessons, next.lessons),
    changeFor('progress', before.progress, next.progress),
    changeFor('goals', before.goals, next.goals),
    changeFor('beurtenkaarten', before.beurtenkaarten, next.beurtenkaarten),
  ].filter((c) => c.upsert.length > 0 || c.remove.length > 0);

  const settings = previous === null || !sameRow(before.settings, next.settings)
    ? next.settings
    : null;

  const known = new Set(before.installed_catalogues ?? []);
  const catalogues = (next.installed_catalogues ?? []).filter((id) => !known.has(id));

  return {
    tables,
    settings,
    catalogues,
    empty: tables.length === 0 && settings === null && catalogues.length === 0,
  };
}
