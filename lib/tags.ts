// Tags op lesmateriaal: waar gaat deze oefening over?
//
// De 51 trainingen uit het KDT-boekje zijn nooit met de hand getagd en dat gaat ook niet
// gebeuren — samen zijn het ruim 250 oefeningen. Daarom worden tags afgeleid uit de tekst
// die er al staat (titel, aandachtspunten, situatie/bedoeling/omschrijving van elke
// oefening). Zo is de databank vanaf de eerste dag te filteren op "forehand" of "opslag",
// zonder invoerwerk.
//
// Afgeleide tags worden niet opgeslagen: het herkennen gebeurt bij het lezen. Was het
// opgeslagen, dan zou een betere regel hier pas gelden voor lessen die daarna zijn
// gemaakt — precies het soort verschil dat niemand later nog kan verklaren.
//
// Een trainer kan er zelf tags bij zetten (`Lesson.tags`); die tellen even zwaar mee.

import { t } from './i18n';
import type { Lesson, TrainingExercise } from './types';

/**
 * Eén tag met de woorden die hem herkennen.
 *
 * De patronen staan als losse woorden en niet als losse regex, zodat de lijst leesbaar
 * blijft voor wie tennis kent maar geen regex. Een patroon matcht op woordgrens, anders
 * zou "fh" ook aanslaan op elk woord waar die twee letters toevallig in staan.
 */
interface TagRule {
  tag: string;
  /** Groep waarin de tag in de filterbalk staat. */
  group: TagGroup;
  patterns: readonly string[];
}

export type TagGroup = 'slag' | 'spel' | 'thema';

export const TAG_GROUP_LABELS: Record<TagGroup, string> = {
  slag: 'Slag',
  spel: 'Spelsituatie',
  thema: 'Thema',
};

/** Hetzelfde label, in de taal die de gebruiker gekozen heeft. */
export function tagGroupLabel(group: TagGroup): string {
  return t(TAG_GROUP_LABELS[group]);
}

/**
 * De woordenlijst. Nederlands én de termen uit het boekje (dat schrijft "T2", "bal 4",
 * "kerkhof"), want de tekst die hier doorheen gaat is die van het boekje zelf.
 */
const RULES: readonly TagRule[] = [
  // --- Slagen ---
  { tag: 'Forehand', group: 'slag', patterns: ['forehand', 'fh', 'voorhand'] },
  { tag: 'Backhand', group: 'slag', patterns: ['backhand', 'bh', 'achterhand'] },
  { tag: 'Opslag', group: 'slag', patterns: ['opslag', 'service', 'serveren', 'opslagspeler', 'ospeler', 'effectopslag'] },
  { tag: 'Terugslag', group: 'slag', patterns: ['terugslag', 'return', 'tspeler'] },
  { tag: 'Volley', group: 'slag', patterns: ['volley', 'volleys', 'halfvolley', 'netbal'] },
  { tag: 'Smash', group: 'slag', patterns: ['smash', 'smashen'] },
  { tag: 'Lob', group: 'slag', patterns: ['lob', 'lobben', 'lobbal'] },
  { tag: 'Slice', group: 'slag', patterns: ['slice', 'gesneden'] },
  { tag: 'Dropshot', group: 'slag', patterns: ['dropshot', 'dropbal', 'stopbal'] },
  { tag: 'Topspin', group: 'slag', patterns: ['topspin', 'lift', 'liftbal'] },

  // --- Spelsituaties ---
  { tag: 'Basislijnspel', group: 'spel', patterns: ['basislijnspel', 'basislijn', 'grondslagen'] },
  { tag: 'Netspel', group: 'spel', patterns: ['netspel', 'netbasis', 'netaanval', 'opkomen', 'aanvalszone'] },
  { tag: 'Aanvallen', group: 'spel', patterns: ['aanvallen', 'aanval', 'aanvalsbal'] },
  { tag: 'Verdedigen', group: 'spel', patterns: ['verdedigen', 'verdediging', 'verdedigend'] },
  { tag: 'Uitwisselen', group: 'spel', patterns: ['uitwisselen', 'rally', 'rallys', 'uitwisseling'] },
  { tag: 'Punt starten', group: 'spel', patterns: ['punt starten', 'bal 3', 'bal 4', 'b4', 't2', 'o1', 'starten van het punt'] },
  { tag: 'Dubbelspel', group: 'spel', patterns: ['dubbelspel', 'dubbel', 'dubbelterrein'] },
  { tag: 'Wedstrijdvorm', group: 'spel', patterns: ['wedstrijd', 'wedstrijdvorm', 'tornooi', 'tiebreak', 'game', 'match'] },

  // --- Thema's ---
  { tag: 'Coördinatie', group: 'thema', patterns: ['coordinatie', 'coordinatief'] },
  { tag: 'Voetenwerk', group: 'thema', patterns: ['benenspel', 'voetenwerk', 'splitstep', 'verplaatsing', 'herplaatsen', 'speelbasis'] },
  { tag: 'Techniek', group: 'thema', patterns: ['techniek', 'greep', 'greepwissel', 'hamergreep', 'zwaaivorm', 'balcontact'] },
  { tag: 'Tactiek', group: 'thema', patterns: ['tactiek', 'tactisch', 'tactische', 'spelplan'] },
  { tag: 'Fysiek', group: 'thema', patterns: ['fysiek', 'conditie', 'uithouding', 'kracht', 'snelheid', 'lenigheid'] },
  { tag: 'Mentaal', group: 'thema', patterns: ['mentaal', 'concentratie', 'focus', 'zelfvertrouwen'] },
  { tag: 'Opwarming', group: 'thema', patterns: ['opwarming', 'opwarmen', 'inspelen'] },
  { tag: 'Kist', group: 'thema', patterns: ['kist', 'aanspelen', 'aangespeeld'] },
];

/** Alle tags die de app kent, in de volgorde van de lijst hierboven. */
export const ALL_TAGS: readonly string[] = RULES.map((r) => r.tag);

export function tagGroup(tag: string): TagGroup | undefined {
  return RULES.find((r) => r.tag === tag)?.group;
}

/**
 * Tekst klaarmaken om woorden in te zoeken: kleine letters, accenten eraf, en alles wat
 * geen letter of cijfer is wordt een spatie. Daardoor valt "FH/BH" uiteen in twee woorden
 * en hoeft elk patroon alleen nog met spaties eromheen gezocht te worden.
 */
export function normalise(text: string): string {
  return ` ${text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;
}

/** Alle tekst van een les op één hoop — dat is waar de tags uit komen. */
export function lessonText(lesson: Lesson): string {
  const parts: string[] = [lesson.title];
  if (lesson.description) parts.push(lesson.description);
  if (lesson.focus_points) parts.push(...lesson.focus_points);
  if (lesson.materials) parts.push(...lesson.materials);
  if (lesson.exercises) parts.push(...lesson.exercises.map(exerciseText));
  return parts.join(' ');
}

/** Dezelfde hoop, maar dan voor één oefening uit de tabel. */
export function exerciseText(ex: TrainingExercise): string {
  return [ex.situation, ex.purpose, ex.description, ex.quality, ex.organisation].join(' ');
}

/** De tags die in een stuk tekst herkend worden, in de volgorde van de woordenlijst. */
export function tagsForText(text: string): string[] {
  const haystack = normalise(text);
  return RULES.filter((rule) =>
    rule.patterns.some((p) => haystack.includes(` ${normalise(p).trim()} `)),
  ).map((r) => r.tag);
}

/**
 * De tags van een les: eerst wat de trainer zelf opgaf, daarna wat er uit de tekst volgt.
 *
 * De eigen tags staan vooraan omdat ze het meest bewust gekozen zijn; dubbele worden
 * weggelaten zodat "Forehand" niet twee keer in de filterbalk verschijnt.
 */
export function lessonTags(lesson: Lesson): string[] {
  const manual = (lesson.tags ?? []).map((t) => t.trim()).filter((t) => t.length > 0);
  const derived = tagsForText(lessonText(lesson));
  const seen = new Set(manual.map((t) => t.toLowerCase()));
  return [...manual, ...derived.filter((t) => !seen.has(t.toLowerCase()))];
}

/** De tags van één oefening — daarmee kan de databank ook de losse oefening tonen. */
export function exerciseTags(ex: TrainingExercise): string[] {
  return tagsForText(exerciseText(ex));
}

/**
 * Hoe vaak elke tag voorkomt in deze lessen. De filterbalk toont alleen tags die er
 * echt zijn: een chip die nul resultaten oplevert is een dode knop.
 */
export function tagCounts(lessons: Lesson[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const lesson of lessons) {
    for (const tag of lessonTags(lesson)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * De tags die de filterbalk laat zien: alleen tags die voorkomen, in de vaste volgorde
 * van de woordenlijst (eigen tags van de trainer erachteraan, alfabetisch).
 */
export function availableTags(lessons: Lesson[]): string[] {
  const counts = tagCounts(lessons);
  const known = ALL_TAGS.filter((t) => counts.has(t));
  const extra = [...counts.keys()]
    .filter((t) => !ALL_TAGS.includes(t))
    .sort((a, b) => a.localeCompare(b, 'nl'));
  return [...known, ...extra];
}

/**
 * Zoeken en filteren in één stap.
 *
 * Meerdere tags werken als EN: "Forehand" plus "Aanvallen" geeft de lessen waarin allebei
 * voorkomt. Dat is wat een trainer bedoelt als hij twee dingen aanvinkt — met OF wordt de
 * lijst juist langer bij elke klik, en dat voelt als een kapot filter.
 *
 * De zoektekst kijkt naar dezelfde tekst als de tags plus de tagnamen zelf, dus typen
 * werkt ook als je de chip niet ziet staan.
 */
export function filterLessons(
  lessons: Lesson[],
  { query = '', tags = [] }: { query?: string; tags?: string[] },
): Lesson[] {
  const words = normalise(query).trim().split(' ').filter((w) => w.length > 0);
  return lessons.filter((lesson) => {
    const own = lessonTags(lesson);
    if (!tags.every((t) => own.includes(t))) return false;
    if (words.length === 0) return true;
    const haystack = normalise(`${lessonText(lesson)} ${own.join(' ')}`);
    return words.every((w) => haystack.includes(w));
  });
}

/** Eén oefening met de les waar hij uit komt — het resultaat van een oefening-zoekactie. */
export interface ExerciseHit {
  lesson: Lesson;
  exercise: TrainingExercise;
  tags: string[];
}

/**
 * Zoeken op oefeningniveau. "Zoek een oefening op forehand" is de vraag waarvoor de
 * databank bestaat, en die vraag gaat over de losse oefening — niet over de training van
 * anderhalf uur waar hij toevallig in staat.
 */
export function filterExercises(
  lessons: Lesson[],
  { query = '', tags = [] }: { query?: string; tags?: string[] },
): ExerciseHit[] {
  const words = normalise(query).trim().split(' ').filter((w) => w.length > 0);
  const hits: ExerciseHit[] = [];
  for (const lesson of lessons) {
    for (const exercise of lesson.exercises ?? []) {
      const own = exerciseTags(exercise);
      if (!tags.every((t) => own.includes(t))) continue;
      if (words.length > 0) {
        const haystack = normalise(`${exerciseText(exercise)} ${lesson.title} ${own.join(' ')}`);
        if (!words.every((w) => haystack.includes(w))) continue;
      }
      hits.push({ lesson, exercise, tags: own });
    }
  }
  return hits;
}

/** Tags van losse oefeningen tellen, voor de filterbalk in de oefeningenweergave. */
export function exerciseTagCounts(lessons: Lesson[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const lesson of lessons) {
    for (const ex of lesson.exercises ?? []) {
      for (const tag of exerciseTags(ex)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return counts;
}

/** Dezelfde vaste volgorde als `availableTags`, maar dan voor oefeningen. */
export function availableExerciseTags(lessons: Lesson[]): string[] {
  const counts = exerciseTagCounts(lessons);
  return ALL_TAGS.filter((t) => counts.has(t));
}

/** Vrije invoer ("forehand, netspel") naar een nette lijst tags. */
export function parseTagInput(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input.split(',')) {
    const t = raw.trim();
    if (t.length === 0) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    // Een bekende tag krijgt de schrijfwijze uit de woordenlijst, zodat "forehand" en
    // "Forehand" niet als twee chips naast elkaar eindigen.
    const known = ALL_TAGS.find((k) => k.toLowerCase() === key);
    out.push(known ?? t);
  }
  return out;
}
