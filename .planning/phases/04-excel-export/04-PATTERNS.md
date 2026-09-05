# Phase 4: Excel-export - Pattern Map

**Mapped:** 2026-09-06
**Files analyzed:** 8 (new/modified)
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `lib/xlsx.ts` (extend: add `buildWorkbook`) | utility (byte-level writer) | transform | `lib/xlsx.ts::buildXlsx` (itself — extend in place, do not replace) | exact |
| `lib/xlsx.test.ts` (extend) | test | transform | `lib/xlsx.test.ts::describe('buildXlsx', ...)` | exact |
| `lib/export-trainingen.ts` (new) | service (pure assembly) | transform / batch | `lib/csv.ts` (`csvRows`, `CSV_COLUMNS`, `toXlsx`) | exact (role + flow) |
| `lib/export-trainingen.test.ts` (new) | test | transform | `lib/xlsx.test.ts` (zip-reading round-trip pattern) + `lib/csv.test.ts` (row-assembly fixtures) | exact |
| `lib/datetime.ts` (extend: ISO week helper) | utility | transform | `lib/datetime.ts` (itself, existing helpers) | exact |
| `lib/datetime.test.ts` (extend) | test | transform | `lib/datetime.test.ts` (itself, existing style) | exact |
| `app/admin/export.tsx` (new, name at Claude's discretion) | route/screen (controller-ish) | request-response (user-triggered file generation) | `app/agenda/historiek.tsx` (period + export screen) and `app/admin/reports.tsx` (admin report screen shape) | exact (two strong analogs, combine) |
| `app/admin/index.tsx` (modify: add tile) | route/screen | request-response | existing admin tile list (same conditional block used for `lesgroepen`/`leden`) | role-match |

## Pattern Assignments

### `lib/xlsx.ts` — add `buildWorkbook(bladen: XlsxBlad[])` alongside `buildXlsx`

**Analog:** the file's own existing `buildXlsx` (D-07 requires a **new** function, not a signature change — see CONTEXT.md D-07 and RESEARCH.md Pitfall 1).

**Why a new function and not a changed signature (verbatim reasoning to preserve in the new code's comment):**
`lib/csv.ts::toXlsx` and `historiek.tsx` call `buildXlsx({ naam, koppen, rijen, breedtes })` today (a single `XlsxBlad`), and `lib/xlsx.test.ts`'s `describe('buildXlsx', ...)` block asserts on that exact single-sheet shape (six fixed zip entries ending in `sheet1.xml`). CONTEXT.md D-07: *"Meerdere bladen komen als een **nieuwe** functie `buildWorkbook` naast het bestaande `buildXlsx`, niet als een gewijzigde signatuur. `lib/csv.ts` en Historiek roepen `buildXlsx` vandaag aan met hun eigen tests eromheen; die mogen hier niet voor omvallen."*

**The three fixed strings that become loops** — quoted verbatim from `lib/xlsx.ts:369-401` (`buildXlsx`), each hardcodes exactly one sheet:

1. `[Content_Types].xml` — hardcodes one `<Override>` for `sheet1.xml`:
```typescript
const contentTypes = `${KOP}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
  + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
  + '<Default Extension="xml" ContentType="application/xml"/>'
  + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
  + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
  + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
  + '</Types>';
```

2. `xl/workbook.xml` — hardcodes one `<sheet>` entry:
```typescript
const workbook = `${KOP}<workbook xmlns="${HOOFD_NS}" xmlns:r="${REL_NS}">`
  + `<sheets><sheet name="${xml(naam)}" sheetId="1" r:id="rId1"/></sheets>`
  + '</workbook>';
```

3. `xl/_rels/workbook.xml.rels` — hardcodes `rId1 → sheet1.xml`, `rId2 → styles.xml`:
```typescript
const workbookRels = `${KOP}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
  + `<Relationship Id="rId1" Type="${REL_NS}/worksheet" Target="worksheets/sheet1.xml"/>`
  + `<Relationship Id="rId2" Type="${REL_NS}/styles" Target="styles.xml"/>`
  + '</Relationships>';
```

...and the zip call itself only ever includes one `xl/worksheets/sheet1.xml` entry:
```typescript
return zip([
  { naam: '[Content_Types].xml', inhoud: utf8(contentTypes) },
  { naam: '_rels/.rels', inhoud: utf8(rels) },
  { naam: 'xl/workbook.xml', inhoud: utf8(workbook) },
  { naam: 'xl/_rels/workbook.xml.rels', inhoud: utf8(workbookRels) },
  { naam: 'xl/styles.xml', inhoud: utf8(stijlenXml()) },
  { naam: 'xl/worksheets/sheet1.xml', inhoud: utf8(bladXml({ ...blad, naam })) },
]);
```

**Everything else is already sheet-count-agnostic** and must NOT be touched: `zip()`, `crc32()`, `utf8()`, `bladXml()` (already takes one `XlsxBlad` and knows nothing about workbook structure), `stijlenXml()` (styles are shared across sheets), `celXml()`, `datumNaarSerie()`, `kolomLetter()`, `bladnaam()`.

**New concern `buildWorkbook` introduces that `buildXlsx` never had:** sheet-name collision within one workbook. `bladnaam()` today only cleans illegal characters and truncates to 31 — it sanitizes one name in isolation, never checks against sibling names. For this phase's four fixed names ("Lessen", "Uren per trainer", "Aanwezigheid", "Groepen") collision won't occur in practice, but `buildWorkbook` should still de-duplicate (e.g. append " (2)") defensively since it is a general-purpose function now.

**The Dutch header comment explaining why this writer is hand-written** (top of `lib/xlsx.ts:1-13`) — preserve/extend this, do not replace it, when adding `buildWorkbook`'s own doc comment:
```typescript
// Een xlsx-bestand schrijven, zonder pakket erbij.
//
// Waarom niet gewoon een bibliotheek: een xlsx-schrijver van de plank kost een megabyte in
// de webbundel, en van die megabyte gebruikt deze app één blad met twaalf kolommen. Wat
// hieronder staat is precies dat ene blad. Het is bovendien te testen zonder Excel — de
// tests lezen het bestand weer uit elkaar.
//
// Een xlsx is een zip met een handvol XML-bestanden erin. Beide helften staan hier: eerst
// de zip, dan de XML.
//
// Wat dit oplevert tegenover de CSV: een bedrag is een getal en niet de tekst "45,00", en
// een datum is een datum. Een trainer kan dus een kolom optellen en op datum sorteren
// zonder eerst te moeten uitleggen aan Excel wat er staat.
```
When `buildWorkbook` is added, its own comment should explain specifically why it exists *next to* `buildXlsx` (cite D-07's reasoning above) rather than repeating this block.

**Sketch of the required shape** (from RESEARCH.md, illustrating scope — not exact code):
```typescript
export function buildWorkbook(bladen: XlsxBlad[]): Uint8Array {
  const namen = dedupeBladNamen(bladen.map((b) => bladnaam(b.naam))); // NEW helper needed
  const contentTypes = ... // one <Override> per sheetN.xml, loop 1..bladen.length
  const workbook = ...     // one <sheet name=".." sheetId="N" r:id="rIdN"/> per sheet
  const workbookRels = ... // rId1..rIdN → worksheets/sheetN.xml, then rId(N+1) → styles.xml
  return zip([
    { naam: '[Content_Types].xml', ... },
    { naam: '_rels/.rels', ... },
    { naam: 'xl/workbook.xml', ... },
    { naam: 'xl/_rels/workbook.xml.rels', ... },
    { naam: 'xl/styles.xml', ... },
    ...bladen.map((b, i) => ({
      naam: `xl/worksheets/sheet${i + 1}.xml`,
      inhoud: utf8(bladXml({ ...b, naam: namen[i] })),
    })),
  ]);
}
```

---

### `lib/xlsx.test.ts` — extend with a `buildWorkbook` describe block, same zip-reading technique

**Analog:** the file's own `describe('buildXlsx', ...)` block (`lib/xlsx.test.ts:260-338`) and the hand-rolled zip reader above it (`lib/xlsx.test.ts:1-91`).

**Core pattern to replicate exactly — read the built file back apart via the from-scratch minimal zip reader, never trust the writer's own internal state:**
```typescript
// Source: lib/xlsx.test.ts:83-91 (existing helper, reuse as-is — do not duplicate)
function inhoudVan(bytes: Uint8Array, naam: string): string {
  const ingang = leesZip(bytes).find((i) => i.naam === naam);
  if (!ingang) throw new Error(`${naam} zit niet in het bestand`);
  return tekst(ingang.inhoud);
}
```

**The existing single-sheet assertions to mirror for N sheets** (`lib/xlsx.test.ts:286-326`):
```typescript
it('bevat precies de onderdelen die een werkmap nodig heeft', () => {
  expect(leesZip(bestand).map((i) => i.naam)).toEqual([
    '[Content_Types].xml',
    '_rels/.rels',
    'xl/workbook.xml',
    'xl/_rels/workbook.xml.rels',
    'xl/styles.xml',
    'xl/worksheets/sheet1.xml',
  ]);
});

it('noemt elk onderdeel in [Content_Types].xml', () => {
  const types = inhoudVan(bestand, '[Content_Types].xml');
  expect(types).toContain('/xl/workbook.xml');
  expect(types).toContain('/xl/worksheets/sheet1.xml');
  expect(types).toContain('/xl/styles.xml');
});

it('wijst vanuit de werkmap naar het blad en de opmaak', () => {
  const rels = inhoudVan(bestand, 'xl/_rels/workbook.xml.rels');
  expect(rels).toContain('Target="worksheets/sheet1.xml"');
  expect(rels).toContain('Target="styles.xml"');
});
```

**New assertions needed for `buildWorkbook`:** the zip lists `sheet1.xml..sheetN.xml` in order; `[Content_Types].xml` lists all N `Override`s; `xl/workbook.xml` lists all N `<sheet>` entries with the right names in the right order (tab order matters — this is what a beheerder sees); `xl/_rels/workbook.xml.rels` has `rId1..rIdN → worksheets/sheetN.xml` then one more `rId → styles.xml`; existing `buildXlsx` describe block must be left completely untouched and still pass.

---

### `lib/export-trainingen.ts` (new) — the four-sheet assembly

**Analog:** `lib/csv.ts` (column-table pattern) + `lib/reports.ts` (never-recompute-money rule) + `lib/lesgever.ts` (attribution) + `lib/aanwezigheid.ts` (three states) + `lib/lesgroepen.ts`/`lib/groups.ts` (group/participant model).

**Imports pattern to follow** (from `lib/csv.ts:1-16`, adjusted for the new file's actual dependencies):
```typescript
import { groupSize, lessonPlayerIds, shortGroupLabel } from './groups';
import { formatEuro } from './money';
import { bookingMinutes, bookingPrice, coachPayout } from './payments';
import { payoutsByCoach } from './reports';
import { lesgeverId } from './lesgever';
import { aanwezigheidVan } from './aanwezigheid';
import { actieveGroepen, lessenVanGroep } from './lesgroepen';
import { bookingStatusLabel } from './status';
import { t } from './i18n';
import { buildWorkbook, type XlsxBlad, type XlsxCel } from './xlsx';
import type { Booking, Court, LesGroep, User } from './types';
```

**Core column-table pattern** (from `lib/csv.ts:41-95`, the pattern to repeat for every one of the four sheets — do not invent four bespoke row-builders):
```typescript
export interface CsvColumn {
  label: string;
  value: (row: CsvRow) => string;
  getal?: (row: CsvRow) => number;
  geld?: boolean;
  datum?: (row: CsvRow) => Date;
  breedte: number;
}

// De enige bron van waarheid voor kolommen: kop én cel staan hier naast elkaar, zodat het
// scherm en het bestand niet uit elkaar kunnen schuiven als de volgorde verandert.
export const CSV_COLUMNS: readonly CsvColumn[] = [
  { label: 'Datum', value: (r) => r.date, datum: (r) => new Date(r.start), breedte: 12 },
  ...
];
```

**The generic cell-mapper to reuse verbatim** (from `lib/csv.ts::toXlsx`, `lib/csv.ts:173-183`) — this is the ~12-line function that decides `soort` generically with no sheet-specific branching, and it must be copy-pasted (or factored into a tiny shared helper in `lib/xlsx.ts` or `lib/export-trainingen.ts`) for all four sheets rather than writing four bespoke cell-builders:
```typescript
rijen: rows.map((r) => CSV_COLUMNS.map((c): XlsxCel => {
  if (c.datum) {
    const d = c.datum(r);
    if (!Number.isNaN(d.getTime())) return { soort: 'datum', waarde: d };
  }
  if (c.getal) {
    const n = c.getal(r);
    if (Number.isFinite(n)) return { soort: c.geld ? 'geld' : 'getal', waarde: n };
  }
  return { soort: 'tekst', waarde: c.value(r) };
})),
```

**Precompute lookup Maps once, outside the per-row loop** — mandatory given realistic scale (~1400 rows for one coach's season). From `lib/csv.ts::csvRows` (`lib/csv.ts:107-142`):
```typescript
export function csvRows(bookings: Booking[], users: User[], courts: Court[]): CsvRow[] {
  const nameById = new Map(users.map((u) => [u.id, u.name]));
  const rateById = new Map(users.map((u) => [u.id, u.hourly_rate]));
  const courtById = new Map(courts.map((c) => [c.id, c]));

  return [...bookings]
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    .map((b) => {
      const start = new Date(b.start_time);
      const minutes = bookingMinutes(b);
      const court = courtById.get(b.court_id);
      const size = groupSize(b);
      return {
        ...
        coach: nameById.get(b.coach_id) ?? t('Onbekend'),
        player: shortGroupLabel(nameById.get(b.player_id) ?? t('Onbekend'), size),
        ...
      };
    });
}
```
The new "Lessen" builder needs the same three maps (`nameById`, a `Map<string, LesGroep>` for group name/level, and `Map<string, Court>`), built once before any `.flatMap()`/`.map()` over bookings — never `.find()` inside a per-row loop.

**Lesson attribution — the ONLY place to ask "who taught this":** never re-derive with `b.taught_by_id ?? b.coach_id` inline. Call through `lesgeverId` (`lib/lesgever.ts:25-27`, verbatim):
```typescript
/**
 * Wie deze les werkelijk gaf: de vervanger als die er is, anders de vaste trainer.
 * Dit is de ENIGE plek die deze vraag beantwoordt — zie het kopcommentaar hierboven.
 *
 * De meegegeven boeking blijft onaangeroerd: het antwoord wordt berekend, `coach_id` wordt
 * nooit overschreven.
 */
export function lesgeverId(b: LesgeverBoeking): string {
  return b.taught_by_id ?? b.coach_id;
}
```
The module's own header comment (`lib/lesgever.ts:1-11`) states the exact incident this guards against — quote it in the new export module's own comment when it calls through `lesgeverId`/`payoutsByCoach`:
```
// "Wie gaf deze les écht" is precies één vraag met precies één antwoord, en dat antwoord
// hoort maar op één plek te staan. ... Wie hier een tweede antwoord naast
// zet — een `b.taught_by_id ?? b.coach_id` in een scherm of een rapport — krijgt dat gat
// terug op de plek die hij vergat mee te wijzigen.
```

**"Uren per trainer" sheet must go through `payoutsByCoach` in full, not recompute** — `lib/reports.ts:159-188`, verbatim (this already resolves `lesgeverId` correctly — confirmed landed in the current repo, `lib/reports.ts:167`):
```typescript
export function payoutsByCoach(bookings: Booking[], users: User[]): CoachTotal[] {
  const byId = new Map(users.map((u) => [u.id, u]));
  const totals = new Map<string, CoachTotal>();

  for (const b of countedBookings(bookings)) {
    // Wie de les gaf, niet van wie hij is: zowel de groeperingssleutel als het tarief moeten
    // mee. Verhuist alleen het tarief, dan staat het bedrag van de vervanger op de regel van
    // de vaste trainer — dan klopt het totaal wel en de uitbetaling niet.
    const lesgever = lesgeverId(b);
    const coach = byId.get(lesgever);
    const row = totals.get(lesgever) ?? {
      coachId: lesgever,
      name: coach?.name ?? t('Onbekend'),
      lessons: 0,
      amount: 0,
      missingRate: coach?.hourly_rate === undefined,
    };
    row.lessons += 1;
    if (PAYABLE_STATUSES.includes(b.status)) {
      row.amount += coachPayout(b, coach?.hourly_rate);
    }
    totals.set(lesgever, row);
  }

  return [...totals.values()]
    .map((r) => ({ ...r, amount: euro(r.amount) }))
    .sort((a, b) => (b.amount - a.amount) || a.name.localeCompare(b.name, 'nl'));
}
```
`CoachTotal` (`lib/reports.ts:131-144`) already has `coachId`, `name`, `lessons`, `amount`, `missingRate` — exactly the columns "Uren per trainer" needs, plus a small new aggregation for total **hours** (`bookingMinutes(b) / 60`, summed per coach — not currently pre-summed anywhere in `lib/reports.ts`, so this is legitimately new code, but it must sum via `lesgeverId(b)` as the grouping key, matching `payoutsByCoach`'s own grouping, and must call `bookingMinutes` from `lib/payments.ts`, never reimplement duration math). `missingRate` must be surfaced on the sheet (a flag column or a note), never silently dropped — see CONVENTIONS.md's Error Handling section: *"een missing/invalid business value must be visibly flagged, never defaulted quietly."* **No revenue/price-per-lesson column belongs on this sheet** (D-05).

**Attendance — the three states and the field to read (`lib/aanwezigheid.ts:19-42`, verbatim):**
```typescript
/** Wat er per speler genoteerd kan staan. Niets genoteerd is `undefined` — zie hierboven. */
export type Aanwezigheid = 'aanwezig' | 'afwezig';

/** De aantekeningen van één les: speler-id → aanwezig of afwezig. */
export type Aanwezigheden = Record<string, Aanwezigheid>;

/**
 * Wat er voor deze speler genoteerd staat, of `null` als er niets staat.
 *
 * Alleen voor wie meespeelt. Wie uit de les gehaald werd kan nog een aantekening in het
 * veld hebben staan (`zetAanwezigheid` ruimt die pas op bij de volgende wijziging), en die
 * hoort nergens meer mee te tellen.
 */
export function aanwezigheidVan(
  b: AanwezigheidBooking,
  playerId: string,
): Aanwezigheid | null {
  if (!lessonPlayerIds(b).includes(playerId)) return null;
  const waarde = b.attendance?.[playerId];
  return waarde === 'aanwezig' || waarde === 'afwezig' ? waarde : null;
}
```
Three states → three cell outcomes on the "Aanwezigheid" sheet: `'aanwezig'`, `'afwezig'`, or `null` (nothing filled in yet) — the third state is not an error, it is the normal starting state of every lesson and must map to a genuinely blank cell (not `'0'`, not `'undefined'`), which is exactly what "leeg afdrukbaar" (D-12) means for a substitute filling in the sheet by hand.

**Attendance row set — the historical trap to avoid (RESEARCH.md Pitfall 4, PITFALLS.md Pitfall 1):** rows must be the union of `lessonPlayerIds(booking)` across the group's lessons **in the chosen period**, never `LesGroep.roster` (which is "now," not "then"). Use `lessenVanGroep(bookings, group.id)` (`lib/lesgroepen.ts:65-71`) filtered to the period, then `.flatMap(lessonPlayerIds)` (`lib/groups.ts:57-59`), never `group.roster`.

**"Groepen" sheet source functions** — `lib/lesgroepen.ts`:
```typescript
/** De groepen die de club dit moment lesgeeft. */
export function actieveGroepen(groepen: LesGroep[]): LesGroep[] {
  return groepen.filter((g) => !g.archived);
}
```
Combined with `lessenVanGroep` (quoted above) for per-group lesson counts within the period, and `LesGroep` fields directly (`name`, `level`, `weekday`, `start_hour`, `coach_id`, `roster.length`, `id` for `Groep-ID`) — `lib/types.ts:509-538`.

**Private-lesson handling on "Lessen" (D-08, locked):** a booking with no `group_id` gets an empty `Groep` cell and `Type les` = `t('Privéles')` — this is now a locked decision (CONTEXT.md D-08), not an open question; do not leave it ambiguous in the implementation.

**Round-trip fidelity (D-02/D-07):** the "Lessen" sheet's required columns and order must match `.planning/IMPORT-SJABLOON.md` exactly: `Datum`, `Uur`, `Groep`, `Coach`, `Leerling` (required); `Groep-ID`, `Type les`, `E-mail leerling`, `Baan` (optional, import reads them); `Weekdag`, `Weeknr`, `Locatie` (write blank per D-09), `Indoor/Outdoor` (optional, import ignores but export writes per D-10). A group lesson of N players expands into N rows sharing the same date/hour, via `lessonPlayerIds(b)` — one row per lesson × student, matching `koen.xlsx`'s own shape (IMPORT-SJABLOON.md: *"Eén regel per les × leerling... een groepsles van zes staat er als zes regels met dezelfde datum en hetzelfde uur"*). Build this as a single `.flatMap()` pass over bookings, not a nested re-scan.

---

### `lib/export-trainingen.test.ts` (new)

**Analog:** `lib/xlsx.test.ts`'s zip-reading pattern (reuse the same `leesZip`/`inhoudVan`/`tekst` helpers, or import them if exported, or duplicate the small reader — check whether `lib/xlsx.test.ts` exports its reader before duplicating) + `lib/csv.ts`'s row-assembly fixtures style. No `jest.mock`/`jest.fn` — pure functions, plain-object fixtures, exactly like every other `lib/*.test.ts` (CONVENTIONS.md Testing rule).

**What to assert (from RESEARCH.md's own test map):** four sheets in the produced workbook with the right names and order; "Lessen" sheet has exactly IMPORT-SJABLOON.md's required column headers with correct values (round-trip test — same technique as `xlsx.test.ts`'s own zip reader, not trusting the writer's internal state); "Uren per trainer" numbers match `payoutsByCoach` output for the same bookings, with no revenue column present; "Aanwezigheid" pivot uses `participant_ids` from the period's actual lessons, not current `LesGroep.roster` (a test that changes a group's current roster and confirms a past period's exported sheet is unaffected); "Groepen" one row per group with correct counts and `Groep-ID`.

---

### `lib/datetime.ts` (extend) — ISO week-number helper

**Analog:** the file's own existing helpers (style match required, D-11).

**File-header comment style to match** (`lib/datetime.ts:1-8`, verbatim):
```typescript
// Eén plek voor datum- en tijdopmaak. De taal komt uit de instellingen (lib/i18n): in het
// Engels wordt "di 18 aug" vanzelf "Tue 18 Aug", zonder eigen maandtabel.
//
// Eén plek voor datum- en tijdopmaak. Zonder deze module schreef elk scherm zijn eigen
// `toLocaleString('nl-BE')`, en dan stond er ergens "18/8/2026, 09:00:00": seconden die
// niemand leest, een maand met één cijfer en geen weekdag — terwijl een trainer juist aan
// "di 18 aug" denkt en niet aan een getal. De dossierschermen deden het al goed; die vorm
// staat hier nu voor de hele app.
```

**Function shape to match** (`lib/datetime.ts:31-42`, e.g. `formatDay`):
```typescript
/** Een dag met weekdag erbij: "di 18 aug". */
export function formatDay(iso: Moment): string {
  const d = parse(iso);
  if (!d) return t(UNKNOWN_DAY);
  return d.toLocaleDateString(currentLocale(), { weekday: 'short', day: '2-digit', month: 'short' });
}
```
The new ISO-week function should follow this shape: JSDoc one-liner in Dutch, explicit param/return types, a documented behavior for the invalid/edge case (D-11 explicitly calls out the year-boundary case: *"Weeknr is het ISO-weeknummer... inclusief de jaarwissel, want daar gaat een zelfgeschreven weeknummer altijd mis"*). Decide whether it belongs in `lib/datetime.ts` (date-formatting home) — RESEARCH.md's structure sketch also considered it — and whether the internal ISO-week math helper stays unexported (matching the "if nothing outside the file imports it, don't export it" convention, e.g. `sameRow`/`crc32`-style unexported internals).

**Test style to match** (`lib/datetime.test.ts:1-18`, verbatim — note the header comment explaining local-time semantics, which the week-number test needs too since a week boundary at midnight is exactly where a local-vs-UTC bug would hide):
```typescript
// De ISO-strings hier staan bewust zonder tijdzone ("2026-08-18T09:00:00"): die worden als
// lokale tijd gelezen, precies zoals de app de start- en eindtijd van een les opslaat. Met
// een Z erachter zou de test van de tijdzone van de machine afhangen.

describe('formatDay', () => {
  it('zet de weekdag voor de dag en de maand', () => {
    expect(formatDay('2026-08-18T09:00:00')).toBe('di 18 aug');
  });

  it('geeft iets leesbaars bij een onbruikbare datum', () => {
    expect(formatDay('geen datum')).toBe(UNKNOWN_DAY);
  });
});
```
The new `describe('isoWeeknummer', ...)` (or chosen name) block must include an explicit year-boundary case (a date in the last days of December that belongs to week 1 of the next ISO year, and vice versa for early January belonging to week 52/53 of the previous year) — this is the exact case D-11 names as the reason a helper is needed instead of trusting hand-rolled math elsewhere.

---

### `app/admin/export.tsx` (new)

**Analog 1 (closer, functional):** `app/agenda/historiek.tsx` — already **is** a period + Excel/CSV export screen.

**Analog 2 (admin-gate shape):** `app/admin/lesgroepen/index.tsx` and `app/admin/reports.tsx` (admin-only report screen).

**Imports/screen shape pattern** (`app/agenda/historiek.tsx:1-30`, condensed to what's reusable):
```typescript
import { PeriodPicker } from '../../components/ui/PeriodPicker';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { useAgendaScope } from '../../providers/agendaScope';
import { csvRows, toCsv, toXlsx } from '../../lib/csv'; // → replace with lib/export-trainingen equivalents
import {
  bookingsInPeriod, currentPeriod, pastBookings, periodFilename, periodLabel, type Period,
} from '../../lib/period';
import { shareCsv, shareXlsx, xlsxWordtOndersteund } from '../../lib/share';
import { isAdmin } from '../../lib/rechten'; // admin gate, not isCoach/magClubcijfersZien
```

**Admin boundary — the exact pattern to copy (D-06, `app/admin/lesgroepen/index.tsx:60-68`, verbatim):**
```typescript
// De grens staat hier, en niet alleen op de tegel in Beheer: een verborgen tegel is geen
// toegangscontrole, want een trainer kan de link gewoon intikken (TOEG-01). De databank
// weigert hem daarna ook — dit zorgt dat hij het scherm niet eens te zien krijgt.
if (!isAdmin(currentUser)) {
  return (
    <Screen scroll={false}>
      <Text style={styles.muted}>{t('Lesgroepen zijn alleen voor de beheerder.')}</Text>
    </Screen>
  );
}
```
Adapt the Dutch sentence to this screen's own subject (e.g. `t('Exporteren is alleen voor de beheerder.')`), but keep the exact structure: early return, `Screen scroll={false}`, before any other screen logic runs — not merely a hidden tile in `app/admin/index.tsx`.

**Export button + web-only gating pattern** (`app/agenda/historiek.tsx:139-149` per RESEARCH.md, verbatim):
```typescript
{xlsxWordtOndersteund ? (
  <Button
    label={t('Excel (.xlsx)')}
    variant="primary"
    disabled={rows.length === 0}
    icon={<Download size={16} color={tennisColors.onFill} />}
    onPress={() => { void exporteer(() => shareXlsx(xlsxNaam, toXlsx(rows))); }}
  />
) : null}
```
Replace `toXlsx(rows)` with the new `buildWorkbook`-based four-sheet assembly from `lib/export-trainingen.ts`. On mobile (`!xlsxWordtOndersteund`), follow Historiek's own precedent: hide the button rather than show-then-throw (this is Claude's discretion per CONTEXT.md, but Historiek's existing behavior is the established default to match unless the plan decides otherwise).

**Error-handling wrapper pattern** (`app/agenda/historiek.tsx`, the `exporteer` local function referenced in RESEARCH.md): a local `exportError` state distinct from the provider's global `error`, with try/catch around the async share call — mirrors CONVENTIONS.md's Error Handling section (`try`/`catch` around I/O that can fail unpredictably, captured into local state and surfaced in the UI, never swallowed).

**Period picker reuse** (`app/admin/reports.tsx:67-69`, verbatim):
```typescript
const [period, setPeriod] = useState<Period>(() => currentPeriod());
const shown = useMemo(() => bookingsInPeriod(allowed, period), [allowed, period]);
```
This export screen always covers **all** trainers (D-01: the export is club-wide, not scoped to one coach), so `CoachFilter`/`useAgendaScope`'s coach-scoping is **not** applicable here the way it is in `historiek.tsx`/`reports.tsx` — use `useSimpleData()` directly for `bookings`/`users`/`courts`/`lesGroepen`, filtered only by period.

---

### `app/admin/index.tsx` (modify: add tile)

**Analog:** the existing admin-only tile conditional block used for `lesgroepen`/`leden` (same file, same pattern — read the existing tile list before adding a new entry; follow the one-tile-per-admin-screen convention noted in RESEARCH.md's own recommendation).

## Shared Patterns

### Never recompute money — call through the single source of truth
**Source:** `lib/reports.ts::payoutsByCoach`, `lib/payments.ts::coachPayout`/`bookingMinutes`/`bookingPrice`
**Apply to:** `lib/export-trainingen.ts` exclusively — the "Lessen" sheet's price/pay columns and the "Uren per trainer" sheet must call these functions, never reimplement duration/price/pay math. Verbatim warning from `lib/reports.ts`'s own header comment (`lib/reports.ts:12-14`):
```
// 3. Omzet en trainersloon zijn twee verschillende bedragen. Omzet loopt op het uurtarief
//    van de baan (wat de speler betaalt), het trainersloon op het uurtarief van de trainer
//    (wat hij krijgt). Ze mogen nooit in elkaar geschoven worden.
```

### Never re-derive "who taught this" — one function, one place
**Source:** `lib/lesgever.ts::lesgeverId`
**Apply to:** `lib/export-trainingen.ts` ("Lessen" sheet's teacher column, "Uren per trainer" grouping key) — must call `lesgeverId(b)` or go through `payoutsByCoach` (which already calls it), never write `b.taught_by_id ?? b.coach_id` inline anywhere in the new export code.

### Precompute lookup Maps once, never `.find()` inside a per-row loop
**Source:** `lib/csv.ts::csvRows` (`nameById`, `rateById`, `courtById`), `lib/reports.ts::courtsById`
**Apply to:** every sheet-building function in `lib/export-trainingen.ts` — `Map<userId, User>`, `Map<courtId, Court>`, `Map<groupId, LesGroep>` built once before any per-booking loop, mandatory at the realistic scale (~1400+ rows) named in CONTEXT.md's Specific Ideas.

### Historical roster, never current roster
**Source:** `lib/lesgroepen.ts`'s own header comment + `lib/groups.ts::lessonPlayerIds`
**Apply to:** the "Aanwezigheid" sheet's row set (who was actually in the group during the exported period) — read `Booking.participant_ids` via `lessonPlayerIds`, never `LesGroep.roster`.

### Delivery via `lib/share.ts`, never `lib/bestand.ts`
**Source:** `lib/share.ts::shareXlsx`, `xlsxWordtOndersteund`
**Apply to:** `app/admin/export.tsx` — `lib/bestand.ts` only reads user-supplied files (Phase 5's import concern); this phase's file delivery is `shareXlsx`/`xlsxWordtOndersteund`, exactly as `historiek.tsx` already uses them (CONTEXT.md D-13 is an explicit correction of the original phase brief).

### Admin gate on the screen itself, not only the tile
**Source:** `app/admin/lesgroepen/index.tsx`'s `isAdmin(currentUser)` early return
**Apply to:** `app/admin/export.tsx` — D-06 requires this exact pattern since there is no new table/RLS policy to fall back on for this phase.

### Dutch identifiers, Dutch WHY-comments, Dutch UI strings via `t()`
**Source:** CONVENTIONS.md + every file above
**Apply to:** all new code in this phase. Comments must explain *why*, often naming the incident prevented — e.g. `lib/lesgever.ts`'s header comment names the exact double-payment-style bug class this file prevents; any new export code touching money/attribution should carry a comment of the same character, not a restated "what." Example of the required tone (`lib/afvinken.ts`, quoted in CONVENTIONS.md):
```ts
/**
 * En hoe lang erna. Een les die net gedaan is blijft nog een halfuur staan: vergat de
 * trainer af te vinken, dan vindt hij ze terug zonder ergens een datum te moeten kiezen.
 * Langer niet — dan zou de les van deze ochtend nog boven de les van straks staan.
 */
export const NA_MS = 30 * 60_000;
```
All new user-visible strings go through `t('Nederlandse zin')` — no hardcoded English UI text, no symbolic translation keys.

## No Analog Found

None. Every file in scope has a strong, directly-applicable analog already in the codebase — this phase is explicitly an extension of existing, tested patterns (RESEARCH.md's own conclusion: "Every calculation this phase needs already exists and is already tested elsewhere"). The one genuinely novel piece of logic — the "Aanwezigheid" pivot shape (players × lesson-date columns) — has no *direct* precedent as a full pattern, but its two building blocks (`lessenVanGroep` + `lessonPlayerIds` + `aanwezigheidVan`) are all existing, tested functions being composed in a new shape, not new domain logic; the exact row/column layout is Claude's discretion per RESEARCH.md Open Question 4/5, informed by D-12 (locked: same table, real data, always — not a suppress-data toggle).

## Metadata

**Analog search scope:** `lib/xlsx.ts`, `lib/xlsx.test.ts`, `lib/csv.ts`, `lib/reports.ts`, `lib/lesgever.ts`, `lib/aanwezigheid.ts`, `lib/share.ts`, `lib/datetime.ts`, `lib/datetime.test.ts`, `lib/lesgroepen.ts`, `lib/groups.ts`, `lib/period.ts`, `lib/payments.ts`, `lib/status.ts`, `lib/types.ts`, `app/admin/reports.tsx`, `app/agenda/historiek.tsx`, `app/admin/lesgroepen/index.tsx`
**Files scanned:** 18 read in full or targeted excerpt
**Pattern extraction date:** 2026-09-06
