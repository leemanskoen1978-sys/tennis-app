# Phase 5: Excel-import van trainingen - Pattern Map

**Mapped:** 2026-09-06
**Files analyzed:** 8 (new) + 2 (extended)
**Analogs found:** 10 / 10

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `lib/xlsx-lezen.ts` (zip+inflate half) | utility | file-I/O (byte transform) | `lib/xlsx.ts` (the `zip()`/`crc32`/`utf8` half, mirrored) | exact (inverse of an existing hand-written format) |
| `lib/xlsx-lezen.ts` (sharedStrings/sheet XML parse) | utility | transform | `lib/xlsx.ts::bladXml` (inverse), `lib/xlsx.test.ts::leesZip`/`tekst` (already a reader, just for tests) | exact |
| `lib/xlsx-lezen.ts` (`serieNaarDatum`/`fractieNaarTijd`) | utility | transform | `lib/xlsx.ts::datumNaarSerie` (inverse) | exact |
| `lib/xlsx-lezen.test.ts` | test | — | `lib/xlsx.test.ts` | exact |
| `lib/import-trainingen.ts` (`leesKopregelLessen`, `planImportLessen`) | service (pure plan) | CRUD (dry-run) | `lib/import-leden.ts` | exact |
| `lib/import-trainingen.ts` (`pasImportLessenToe`) | service (executor) | CRUD (batch write via provider) | `lib/import-leden.ts::pasImportToe` | exact |
| `lib/import-trainingen.test.ts` | test | — | `lib/import-leden.test.ts` | exact |
| `lib/students.ts` (extend: order-insensitive name match, D-22) | utility | transform | `lib/students.ts::normalizeName`/`nameExists` (itself — same file grows) | exact (same-file extension) |
| `lib/bestand.ts` (extend: `kiesBinairBestand`) | utility | file-I/O | `lib/bestand.ts::kiesTekstbestand` (itself — same file grows) | exact (same-file extension) |
| `app/admin/trainingen-import.tsx` | component (screen) | request-response (plan-then-commit UI) | `app/admin/leden-import.tsx` | exact |
| `providers/SimpleDataProvider.tsx` (new action(s) for the import, e.g. `pasImportLessenToe`-calling wrapper or reused `addUser`/direct table writes) | provider | event-driven (commit) | `providers/SimpleDataProvider.tsx::addBookingSeries`, `::addUser`/`::updateUser` | exact |
| `lib/lesgroepen.ts`, `lib/recurrence.ts`, `lib/vakanties.ts` | (unchanged, reused as-is) | — | — | n/a — do not modify, only import |

## Pattern Assignments

### `lib/xlsx-lezen.ts` (new) — the zip/inflate/XML reader half

**Analog:** `lib/xlsx.ts` (the writer, read in full — this is the mirror image) plus `lib/xlsx.test.ts::leesZip`/`tekst` (an existing *test-only* stored-zip reader that must be generalized, not copied as-is, since it never handles compression method 8/deflate).

**Header-comment pattern to imitate** (`lib/xlsx.ts` lines 1-13):
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
```
The reader's own header comment must state the mirror-image reasoning explicitly: this reads
what Excel itself produces (deflated), not what this app's own writer produces (stored) — and
must say why a stored-only reader (the pattern in `lib/xlsx.test.ts`) is not enough, quoting the
same "elke lezer die zip kent" reasoning inverted.

**`utf8()` — the "don't assume it's everywhere" argument to invoke for the deflate decision** (lines 35-39):
```typescript
/**
 * UTF-8, met de hand. `TextEncoder` bestaat tegenwoordig overal, maar "tegenwoordig overal"
 * is precies het soort aanname dat pas op een toestel van iemand anders omvalt. Dit is kort
 * genoeg om die vraag niet te hoeven stellen.
 */
```
This is the exact rhetorical pattern D-18/RESEARCH.md's "Don't Hand-Roll" table wants applied to
`DecompressionStream`: quote or closely paraphrase this reasoning when explaining why a
hand-written inflate is used instead of `DecompressionStream('deflate-raw')`.

**`crc32` — full function to reuse verbatim, not reimplement** (lines 75-95):
```typescript
/** De tabel die crc32 snel maakt; één keer opgebouwd, niet per aanroep. */
const CRC_TABEL: Uint32Array = (() => {
  const tabel = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    tabel[n] = c >>> 0;
  }
  return tabel;
})();

/** De controlesom die elke zip-ingang bij zich draagt. */
export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABEL[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}
```
The reader should `import { crc32 } from './xlsx'` (or wherever it ends up exported from) rather
than writing a second CRC table — same anti-duplication discipline CONVENTIONS.md and RESEARCH.md
apply to `groepSleutel`/`botstMet`. If `crc32` isn't currently exported for cross-file use, check;
it already is (`export function crc32`).

**Local file header + central directory layout — the exact byte offsets to invert** (lines 146-215, `zip()`):
```typescript
const kop = schrijver(30 + naam.length);
kop.u32(0x04034b50); // lokale kop
kop.u16(20); // benodigde versie
kop.u16(0x0800); // vlag: de bestandsnaam staat in UTF-8
kop.u16(0); // opslagmethode: geen compressie
kop.u16(DOS_TIJD);
kop.u16(DOS_DATUM);
kop.u32(som);
kop.u32(ingang.inhoud.length);
kop.u32(ingang.inhoud.length);
kop.u16(naam.length);
kop.u16(0); // geen extra veld
kop.blok(naam);
...
const rij = schrijver(46 + naam.length);
rij.u32(0x02014b50); // rij in de centrale map
...
staart.u32(0x06054b50); // einde van de centrale map
```
The reader's central-directory walker (per `lib/xlsx.test.ts::leesZip`, generalized) must read
the **compression-method field at offset 10** in both the local header and the central-directory
record (currently hardcoded to `0` by the writer) and branch: `0` → pass through, `8` → call
`inflate()`. This is Pitfall 1 in RESEARCH.md — the existing test-only reader never needed this
branch.

**The existing test-only zip reader — generalize, do not throw away** (`lib/xlsx.test.ts` lines 39-87):
```typescript
// ---------------------------------------------------------------------------
// Een minimale zip-lezer, alleen voor deze tests.
//
// De schrijver testen tegen zijn eigen aannames zegt niets; hij moet leesbaar zijn voor een
// programma dat het formaat kent en niet dit bestand. Daarom wordt hier alleen de centrale
// map gevolgd — precies wat Excel ook doet — in plaats van de bytes na te tellen die de
// schrijver zelf net heeft neergezet.
// ---------------------------------------------------------------------------
function u16(b: Uint8Array, at: number): number { return b[at] | (b[at + 1] << 8); }
function u32(b: Uint8Array, at: number): number {
  return (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0;
}
function leesZip(bytes: Uint8Array): GelezenIngang[] {
  let eind = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (u32(bytes, i) === 0x06054b50) { eind = i; break; }
  }
  if (eind < 0) throw new Error('geen zip: het einde van de centrale map ontbreekt');
  const aantal = u16(bytes, eind + 10);
  let pos = u32(bytes, eind + 16);
  ...
}
```
Keep the same reasoning comment ("moet leesbaar zijn voor een programma dat het formaat kent")
but promote this from test-only to the real reader in `lib/xlsx-lezen.ts`, adding the
method-8 branch. Same variable naming style (`u16`, `u32`, `eind`, `pos`, `aantal`).

**`datumNaarSerie` — invert for `serieNaarDatum`/`fractieNaarTijd`** (lines 250-262):
```typescript
/**
 * Een datum als het getal dat Excel eronder verstaat: het aantal dagen sinds 30 december
 * 1899. Die dag en niet 1 januari 1900, omdat Excel gelooft dat 1900 een schrikkeljaar was;
 * één dag verschuiven maakt de rest van de tabel weer gelijk.
 *
 * Geteld op de kalenderdag zoals je hem op de klok ziet, niet op UTC — anders staat een les
 * van 's avonds laat in het bestand op de dag ervoor.
 */
export function datumNaarSerie(d: Date): number {
  const dagen = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
    - Date.UTC(1899, 11, 30);
  return Math.round(dagen / 86_400_000);
}
```
The inverse (`serieNaarDatum`) must carry the same 1899-12-30-epoch-quirk comment (do not
rederive without restating why), and `fractieNaarTijd` must implement D-20's
round-total-minutes-first rule (see RESEARCH.md Code Examples — already drafted there,
verified against `koen.xlsx`'s real fractions `0.58333333333333337`→14:00 and `0.625`→15:00).

**`kolomLetter` — reuse if the reader needs to go from column letter back to index**, i.e. write
the inverse `letterNaarKolom`; same style, same file (`lib/xlsx.ts` lines 239-248 for the forward
function to mirror).

---

### `lib/xlsx-lezen.test.ts` (new)

**Analog:** `lib/xlsx.test.ts` in full.

**Known-vector style to imitate** (lines 95-108):
```typescript
describe('crc32', () => {
  // De bekende waarden uit de specificatie; hiermee staat vast dat de tabel klopt.
  it('geeft 0 voor niets', () => {
    expect(crc32(new Uint8Array(0))).toBe(0);
  });
  it('komt uit op de bekende waarde voor "123456789"', () => {
    expect(crc32(bytesVan('123456789'))).toBe(0xcbf43926);
  });
```
The inflate implementation needs the equivalent: known DEFLATE test vectors (stored block,
fixed-Huffman block, dynamic-Huffman block) asserted against known output bytes, in the same
"deze bekende waarde bewijst de tabel/implementatie klopt" style — not just round-trip tests
against the app's own writer.

**Round-trip style to imitate** (lines 169-195, `describe('zip', ...)`):
```typescript
it('levert twee keer achter elkaar hetzelfde bestand', () => {
  expect(Array.from(zip(ingangen))).toEqual(Array.from(zip(ingangen)));
});
```
For the reader: "leest `koen.xlsx` twee keer achter elkaar hetzelfde uit" is the reader's
equivalent determinism assertion.

**The mandatory real-fixture test** — new, no existing analog in this test file, but IMP-10/D-19
require: `fs.readFileSync` the real `koen.xlsx` from repo root, run it through the reader, and
assert byte-exact known values: 1398 data rows, header
`Datum/Weekdag/Weeknr/Uur/Type les/Groep/Coach/Leerling/Locatie/Indoor/Outdoor`, `A2` serial
`46274` → 9 sep 2026, a time fraction `0.625` → 15:00. This test must exist and pass **before**
any `lib/import-trainingen.ts` code is written (D-19 — build and prove the reader first).

---

### `lib/import-trainingen.ts` (new) — the dry-run plan/execute pair

**Analog:** `lib/import-leden.ts` in full — this is, per the phase brief, the single most
important analog. Copy its *whole shape*, not just individual functions.

**File-header comment — the exact pattern to imitate, adapted for lessons** (lines 1-6):
```typescript
// Een ledenlijst uit Excel omzetten naar leden van de club.
//
// Wat hier staat is alle regelgeving van de import en niets anders: geen databank, geen
// scherm, geen bestand. Het scherm geeft rijen tekst en de huidige ledenlijst, en krijgt
// een plan terug van wat er zou gebeuren. Dat is waarom de trainer het resultaat kan zien
// vóór er iets weggeschreven wordt — en waarom die belofte hier te testen valt.
```
`lib/import-trainingen.ts` must open with the same structure: what this file is (trainingen uit
Excel omzetten naar lesgroepen, spelers en lessen), the same "geen databank, geen scherm, geen
bestand" boundary statement, and the same "waarom testbaar" closing sentence — this is exactly
D-10's requirement, worded almost identically already in `.planning/IMPORT-SJABLOON.md`'s closing
paragraph ("Zelfde belofte als `lib/import-leden.ts`...").

**`Kolommen` + `metKolomvelden` + compile-time header/field binding — copy this exact device** (lines 66-89):
```typescript
/** Waar staat welke kolom? De index per veld; ontbrekende optionele kolommen staan er niet in. */
export interface Kolommen {
  naam: number;
  email: number;
  rol?: number;
  telefoon?: number;
  uurtarief?: number;
}

// Knoopt LEDEN_KOPPEN vast aan de velden van `Kolommen`: een kop die daar niet in past, is
// een tikfout in dit bestand en geeft een compilefout in plaats van een stille breuk bij het
// draaien van de import. Een gewone functie in plaats van `satisfies`, want Jest's
// Babel-transform (nog) niet overweg kan met dat trefwoord.
function metKolomvelden<T extends readonly (keyof Kolommen)[]>(koppen: T): T {
  return koppen;
}
```
`lib/import-trainingen.ts` needs its own `KolommenLessen` interface with fields for
`datum`/`uur`/`groep`/`coach`/`leerling` (required) and `groepId`/`typeLes`/`emailLeerling`/`baan`
(optional) — mirroring `Kolommen`'s required-vs-optional split from D-04 — and the same
`metKolomvelden`-style compile-time binding device, with the same Babel/`satisfies` caveat
comment (still true, same toolchain).

**`KOPNAMEN` Map for header aliasing — reuse the `Map`-not-object rationale verbatim** (lines 98-119):
```typescript
/**
 * Andere schrijfwijzen die we aannemen. ...
 *
 * Een `Map` in plaats van een object-literal, om dezelfde twee redenen als bij `ROLNAMEN`:
 * geen ingebouwde Object-eigenschap kan hier ooit een kolom lijken te zijn, en de
 * sleutel/waarde-typen blijven bij het compileren gecontroleerd.
 */
const KOPNAMEN = new Map<string, keyof Kolommen>([
  ['naam', 'naam'], ['name', 'naam'],
  ['email', 'email'], ['e-mail', 'email'], ...
]);
```
The lessons importer's header-aliasing map (`Datum`/`Uur`/`Groep`/`Coach`/`Leerling`/`Groep-ID`/
`Type les`/`E-mail leerling`/`Baan`, D-04's exact literal Dutch labels from
`.planning/IMPORT-SJABLOON.md`) must be built the same way — a `Map`, not an object literal, with
the same prototype-pollution rationale comment carried over (do not silently drop it as
"obvious").

**`leesKopregel` — the exact structure to mirror, including its `Kopregel` result shape** (lines 121-170):
```typescript
export interface Kopregel {
  /** `null` als naam of email ontbreekt: dan valt er niets te importeren. */
  kolommen: Kolommen | null;
  /** Koppen die er stonden en die we niet thuis konden brengen, precies zoals in het bestand. */
  nietHerkend: string[];
  /** Koppen die we herkenden, maar niet lazen omdat diezelfde kolom er al was. */
  dubbel: string[];
}

export function leesKopregel(kopregel: readonly string[]): Kopregel {
  const gevonden: Partial<Record<keyof Kolommen, number>> = {};
  const nietHerkend: string[] = [];
  const dubbel: string[] = [];
  kopregel.forEach((kop, i) => {
    const schoon = kop.trim().toLowerCase().replace(/\s+/g, '');
    if (!schoon) return;
    const veld = KOPNAMEN.get(schoon);
    if (!veld) { nietHerkend.push(kop.trim()); return; }
    if (gevonden[veld] === undefined) { gevonden[veld] = i; } else { dubbel.push(kop.trim()); }
  });
  const { naam, email } = gevonden;
  const kolommen = naam === undefined || email === undefined ? null : { ...gevonden, naam, email };
  return { kolommen, nietHerkend, dubbel };
}
```
`leesKopregelLessen` must return the equivalent `KopregelLessen` shape (`kolommen | null`,
`nietHerkend`, `dubbel`) with the required set being `datum`+`uur`+`groep`+`coach`+`leerling`
per D-04 (note: five required fields here, vs. two in the ledenimport — adjust the "is `kolommen`
null" check accordingly, still "any required field missing → null but still return nietHerkend/dubbel").
D-04's "Onbekende kolommen worden genegeerd, niet afgekeurd" is exactly `nietHerkend`'s existing
non-blocking behavior — no new logic needed there, just apply the pattern.

**`ImportFout` — the `{vars}`-placeholder discipline, copy verbatim as the reason pattern** (lines 176-190):
```typescript
/** Eén regel die niet verwerkt wordt, met de reden in gewone taal. */
export interface ImportFout {
  /** Het regelnummer zoals de trainer het in Excel ziet: de kopregel is regel 1. */
  regel: number;
  /**
   * De reden, als vaste zin met eventuele plaatshouders van de vorm `{naam}` — nooit als
   * kant-en-klare tekst met een waarde er al in geplakt. ... Het scherm doet `t(reden, vars)`,
   * precies zoals `lib/i18n.ts` bedoeld is.
   */
  reden: string;
  vars?: Record<string, string | number>;
}
```
D-09's error/warning shapes (fouten met regelnummer en reden) must use this exact
`ImportFout`-with-`vars` shape, not string-concatenated messages — this is what makes `t()`
translation of reasons work at all, and it directly satisfies D-09's "wat niet gelezen kon
worden met regelnummer en reden."

**`ImportPlan` — the top-level dry-run result shape to mirror, adapted for D-09's group/count summary** (lines 198-218):
```typescript
export interface ImportPlan {
  nieuw: Omit<User, 'id'>[];
  bijgewerkt: ImportBijwerking[];
  fouten: ImportFout[];
  nietHerkend: string[];
  dubbel: string[];
  waarschuwingen: ImportFout[];
}
```
The lessons plan needs the equivalent top-level fields per D-09: lesgroepen
nieuw/bijgewerkt/ongewijzigd (with counts AND enough detail per group — naam, dag, uur, trainer,
aantal spelers, per IMPORT-SJABLOON.md's droogloop section), spelers nieuw, lessen
ingepland/overgeslagen-wegens-vakantie/botsend-met-bezette-trainer-of-baan, plus `fouten`/
`waarschuwingen`/`nietHerkend`/`dubbel` in the same `ImportFout[]`/`string[]` shapes as above.
Call this e.g. `ImportPlanLessen`.

**`bestandAfgekeurd` — the "reject the whole file, not row-by-row" predicate, same shape** (lines 265-281):
```typescript
export function bestandAfgekeurd(plan: ImportPlan): boolean {
  return (
    plan.nieuw.length === 0
    && plan.bijgewerkt.length === 0
    && plan.waarschuwingen.length === 0
    && plan.fouten.length === 1
    && plan.fouten[0].regel === 1
  );
}
```
An equivalent whole-file-rejection predicate for the lessons importer (empty file, or header
missing a required column) should follow the same "exactly one error, on line 1, and nothing
else happened" shape.

**`planImport`'s row loop — the sequencing discipline to copy exactly** (lines 287-486, especially
the ordering comments at lines 306-307, 355-359, 409-412, 447-449, 462-467): read this whole
function before writing `planImportLessen`. Key sequencing rules that must carry over unchanged:
1. Read the header first and keep `nietHerkend`/`dubbel` **even if** the header is rejected
   (lines 306-315) — "juist als de kopregel niet deugt, heeft de trainer die lijstjes nodig."
2. A row failing on one field must not mark its dedup key as "seen" — a later row with the same
   key should still be considered fresh (lines 409-412, `gezien.set` placed *after* all
   `continue`-triggering checks). For the lessons importer this maps directly onto D-11's lesson
   key and D-02's group key: a row that errors out must not "claim" the group/lesson slot.
3. Warnings are appended only for rows that survived every rejection check (lines 447-449) — a
   row that's going to be dropped anyway must not *also* carry a warning.
4. A fully-empty row is silently skipped, not an error (lines 340-343) — same rule applies to a
   blank separator row in a lessons sheet.

**`voorbeeldLedenCsv` — the template-generator pattern for IMP-01** (lines 488-499):
```typescript
/**
 * Het voorbeeldbestand. Twee regels en niet één: een speler zonder tarief en een trainer
 * mét, zodat een trainer ziet dat een lege cel gewoon mag. Puntkomma's, want dat is wat
 * Nederlandse Excel zelf schrijft en dus wat er straks terugkomt.
 */
export function voorbeeldLedenCsv(): string {
  return [
    LEDEN_KOPPEN.join(';'),
    'Jonas Peeters;jonas@voorbeeld.be;speler;0470 12 34 56;',
    'Sofie Maes;sofie@voorbeeld.be;trainer;;45',
  ].join('\n');
}
```
IMP-01's template must follow the same "two rows, showing an optional-field-empty case and an
optional-field-filled case" discipline, but built via `lib/xlsx.ts::buildXlsx` (an .xlsx template,
not CSV, since IMPORT-SJABLOON.md's format is column-typed Excel, not the ledenimport's CSV) —
call it e.g. `voorbeeldTrainingenXlsx()`, reusing `bladLessen`'s column style from
`lib/export-trainingen.ts` (04-02-PLAN.md) where the column set overlaps.

**`pasImportToe` — the executor pattern, sequencing and per-item try/catch to copy exactly** (lines 518-565):
```typescript
export async function pasImportToe(
  plan: ImportPlan,
  acties: ImportActies,
  voortgang?: (klaar: number, totaal: number) => void,
): Promise<ImportUitslag> {
  const totaal = plan.nieuw.length + plan.bijgewerkt.length;
  let klaar = 0;
  let toegevoegd = 0;
  let bijgewerkt = 0;
  let mislukt = 0;

  for (const lid of plan.nieuw) {
    try {
      if (await acties.addUser(lid)) toegevoegd++; else mislukt++;
    } catch {
      mislukt++;
    }
    klaar++;
    voortgang?.(klaar, totaal);
  }
  for (const b of plan.bijgewerkt) {
    try {
      await acties.updateUser(b.bestaand.id, b.wijzigingen);
      bijgewerkt++;
    } catch {
      mislukt++;
    }
    klaar++;
    voortgang?.(klaar, totaal);
  }
  return { toegevoegd, bijgewerkt, mislukt };
}
```
**Important divergence, flagged for the planner:** `pasImportToe` here does one write *per row*
(one `addUser`/`updateUser` await per item), which is correct for a member import of a few dozen
rows. RESEARCH.md's Pattern 4 and D-21 require the *opposite* discipline for bulk lesson writes:
one `commit()` per unsplittable unit (a whole approved plan, or one bounded chunk), not one write
per lesson — see `addBookingSeries` below. `pasImportLessenToe` should therefore follow
`pasImportToe`'s *outer shape* (progress callback, per-phase counters, `ImportActiesLessen`
interface parallel to `ImportActies`) but its *write granularity* should follow
`addBookingSeries`/`commit()`, not `pasImportToe`'s one-row-at-a-time loop. This tension should be
called out explicitly in the plan that implements `pasImportLessenToe`.

**`ImportActies`/`ImportUitslag` — the interfaces to parallel** (lines 505-516):
```typescript
export interface ImportActies {
  addUser: (u: Omit<User, 'id'>) => Promise<User | null>;
  updateUser: (id: string, patch: Partial<Omit<User, 'id' | 'role'>>) => Promise<void>;
}
export interface ImportUitslag {
  toegevoegd: number;
  bijgewerkt: number;
  mislukt: number;
}
```

---

### `lib/import-trainingen.test.ts` (new)

**Analog:** `lib/import-leden.test.ts` in full — same "no mocking" discipline.

**No-mock, plain-object testing style** (lines 176-180 and throughout):
```typescript
const lid = (id: string, email: string, extra: Partial<User> = {}): User => ({
  id, name: 'Bestaand', email, role: 'player', ...extra,
});
const kop = ['naam', 'email', 'rol', 'telefoon', 'uurtarief'];
```
Every test builds plain fixture objects/rows and calls `planImport(rows, existingUsers)` directly
— no `jest.mock`, no `jest.fn` for the plan tests (only `pasImportToe`'s tests, further down,
supply fake `acties` objects as plain functions, still not `jest.fn`). `lib/import-trainingen.test.ts`
must do the same: plain row arrays, plain `LesGroep`/`User`/`Court` fixtures, direct calls to
`planImportLessen`, and only the executor tests get plain-function `acties` stand-ins.

**Idempotency test pattern to imitate and extend for IMP-06** (lines 208-214, adapted):
```typescript
it('laat een bestaand lid dat niets nieuws meebrengt helemaal met rust', () => {
  const bestaande = [lid('u1', 'jonas@club.be', { name: 'Jonas', phone: '0470' })];
  const plan = planImport([kop, ['Jonas', 'jonas@club.be', 'speler', '0470', '']], bestaande);
  expect(plan.bijgewerkt).toEqual([]);
  expect(plan.nieuw).toEqual([]);
  expect(plan.fouten).toEqual([]);
});
```
IMP-06's test must do the literal two-pass version RESEARCH.md's Wave-0-gap calls for: run
`planImportLessen` once against empty existing state, "apply" it (or simulate the resulting
state), then run `planImportLessen` again against the *same rows* and assert the second plan is
entirely empty/no-op (zero new groups, zero new players, zero new lessons) — this is the literal
test `koen.xlsx` twice must pass for IMP-10.

**Column-recognition tests to imitate** (lines 74-174, `describe('leesKopregel', ...)`): same
battery of cases — order-independence, case-insensitivity, alternate spellings, missing required
column returns `null` but keeps `nietHerkend`, duplicate header keeps first and reports second —
applied to `leesKopregelLessen` and the D-04 column set.

---

### `app/admin/trainingen-import.tsx` (new)

**Analog:** `app/admin/leden-import.tsx` in full.

**Module-level survive-remount state — copy this exact device verbatim** (lines 19-54):
```typescript
// Overleeft, anders dan React-state, een her-mount van dit scherm: een trainer die tijdens
// een grote import wegnavigeert en terugkomt krijgt zo geen tweede lus over hetzelfde
// bestand, ook al is de vorige `LedenImport`-instantie allang verdwenen. ...
let importDraait = false;
let laatsteVoortgang: { klaar: number; totaal: number } | null = null;
let laatsteUitslag: ImportUitslag | null = null;

type ImportGebeurtenis =
  | { type: 'voortgang'; klaar: number; totaal: number }
  | { type: 'klaar'; uitslag: ImportUitslag };

const importLuisteraars = new Set<(gebeurtenis: ImportGebeurtenis) => void>();
```
Given IMP-10's ~1400-row scale (bigger than a typical member list), this survive-remount pattern
matters *more* here, not less — copy it verbatim with `ImportUitslagLessen`-typed events.

**File-choice branching (web picker vs. paste box) — same structure, but binary not text** (lines
196-229 for the UI branch; the underlying call is `kiesTekstbestand` from `lib/bestand.ts`). The
trainingen screen calls the new `kiesBinairBestand`/`readAsArrayBuffer` sibling instead of
`kiesTekstbestand`; RESEARCH.md's Architecture diagram already names this function. Note:
`.planning/IMPORT-SJABLOON.md`'s format has no plausible "paste from Excel" fallback (it needs a
real `.xlsx`, not tab-separated text) — the discretion item "hoe het sjabloonbestand gegenereerd
en aangeboden wordt" should record that the phone/no-file-picker fallback path from
`leden-import.tsx` (lines 208-228) likely does not carry over as-is; flag this to the planner
rather than silently copying it.

**Plan-before-write button gating — the exact discipline to copy** (lines 359-386): the "Importeren"
button must stay disabled/plan-only until explicitly confirmed, mirroring
`disabled={plan.nieuw.length === 0 && plan.bijgewerkt.length === 0}` — adapted to
"disabled when the plan has nothing new to create at all."

**Rejected-file vs. row-level-errors branching** (lines 230-256 vs. 256-388): same two-path split
— `bestandAfgekeurd(plan)` shows one full-file rejection card with `nietHerkend`/`dubbel` still
visible; otherwise the full plan-summary screen. Reuse this exact two-branch structure for
`trainingen-import.tsx`.

**"Opnieuw proberen recomputes against fresh state" pattern** (lines 359-368):
```typescript
{uitkomst.mislukt > 0 ? (
  // Alleen bij een mislukking: `tekst` staat nog (zie voerUit hierboven), en
  // dit rekent het plan gewoon opnieuw tegen de intussen bijgewerkte `users`
  // — zo toont het precies de leden die nog niet gelukt zijn...
  <Button label={t('Opnieuw proberen')} onPress={() => toonPlan(tekst)} />
) : null}
```
This is directly D-21's "veilig opnieuw te draaien" made visible in the UI — re-running the same
file recomputes the plan against the now-partially-applied state and only shows what's still
outstanding. `trainingen-import.tsx` must offer the same retry affordance, and the screen copy
should say so explicitly per D-21 ("Zeg het ook zo tegen de gebruiker op het scherm").

---

### `providers/SimpleDataProvider.tsx` (extend) — the commit surface the import writes through

**Analog (read in full this session):** `commit()` itself, plus `addBookingSeries`, `addUser`,
`updateUser`.

**`commit()` — the one function every write in this app goes through** (lines 343-361):
```typescript
// Persist then update state; surface any failure instead of swallowing it.
const commit = useCallback(async (next: StoreData) => {
  const previous = storeRef.current;
  storeRef.current = next;
  schrijfBezig.current = true;
  try {
    await backend.save(previous, next);
    setStore(next);
  } catch (e: unknown) {
    storeRef.current = previous;
    setError(e instanceof Error ? e.message : 'Opslaan mislukt');
    throw e;
  } finally {
    schrijfBezig.current = false;
  }
}, []);
```
This is what D-21 ("veilig opnieuw te draaien... niet één databanktransactie") is actually built
on: `commit` swaps `storeRef.current` optimistically, awaits `backend.save`, and reverts the ref
if it throws. There is no cross-table Postgres transaction underneath (`backend.save` →
`saveToSupabase` → sequential per-table `.upsert()`), so a failure partway through
`backend.save` leaves Postgres partially written even though the local `storeRef`/state reverts
correctly. This is exactly Pitfall 5 in RESEARCH.md — read it again when writing
`pasImportLessenToe`.

**`addBookingSeries` — the "one commit for a whole batch, not per-row" pattern to copy exactly** (lines 653-715, especially 708-714):
```typescript
let cards = store.beurtenkaarten;
let bookings = store.bookings;
const created: Booking[] = [];
let refused = 0;

for (const slot of plan.usable) {
  const fresh: Booking = { ...base, id: newId('b'), series_id: seriesId, ... };
  ...
  bookings = [...bookings, final];
  created.push(final);
}

setError(refused === 0 ? null : refusedSeriesNotice(refused, created.length, base.payment_method));
await commit({ ...store, beurtenkaarten: cards, bookings });
return { created, skipped: plan.skipped };
```
Note the shape: the loop builds up new local arrays (`cards`, `bookings`) purely in memory,
*then* a single `await commit(...)` writes the whole batch in one call. `pasImportLessenToe` (or
whatever new provider action executes the lessons import plan) must follow this exact shape for
new lesson groups, new players, and new bookings — accumulate everything the approved plan
produces into new local arrays, then issue **one** `commit()` (or one per clearly-bounded chunk,
per RESEARCH.md's Pitfall-5 discussion), never one `commit()` per row/group/lesson. This is the
concrete thing "safe to re-run" (D-21) has to work with — re-running the same import a second
time must, via `groepSleutel`/`Groep-ID`/the new lesson key, recompute an empty-or-smaller plan
against whatever the first run's `commit()` actually landed (fully or partially).

**`addUser`/`updateUser` — the exact write shape `ImportActies` wraps, for D-06's player creation** (lines 975-993):
```typescript
const addUser = useCallback(async (u: Omit<User, 'id'>): Promise<User | null> => {
  const store = storeRef.current;
  if (!store) return null;
  const created: User = { ...u, id: newId('u') };
  await commit({ ...store, users: [...store.users, created] });
  return created;
}, [commit]);
```
D-06 requires unknown players to be created "zelfde regels als `lib/import-leden.ts`" — this
literal `addUser` function (one commit per call) is what `lib/import-leden.ts::pasImportToe`
wraps today. For the lessons importer, RESEARCH.md's Pattern 4 argues new players should be
folded into the *same* single batch commit as the new groups/lessons rather than calling
`addUser` once per new player (each of which is its own `commit()`) — this is a real tension
between "reuse `addUser`'s rules" (D-06) and "one commit per unsplittable unit" (D-21/Pattern 4).
Recommendation for the planner: reuse `addUser`'s *validation/shape* (what a new `User` object
looks like) but fold the actual write into the same big `commit()` as the rest of the import,
not via N separate `addUser()` calls — flag this explicitly in the plan, do not silently pick one.

---

### `lib/lesgroepen.ts` — reused as-is, not modified

**`groepSleutel` — the exact function the import must call, never reimplement** (lines 273-282):
```typescript
/**
 * De sleutel waaraan een groep te herkennen is: naam, lesdag en beginuur. Eén naam kan in een
 * seizoen op drie momenten voorkomen met heel andere spelers, dus de naam alleen zegt niets.
 *
 * Dit is een herkenningssleutel om een groep uit een geïmporteerde planning terug te vinden,
 * en geen uniciteitsregel — zie `lesGroepFout`.
 */
export function groepSleutel(g: Pick<LesGroep, 'name' | 'weekday' | 'start_hour'>): string {
  return `${g.name.trim().toLowerCase()}|${g.weekday}|${g.start_hour}`;
}
```
Note the doc comment already anticipates the import use case by name ("een groep uit een
geïmporteerde planning terug te vinden") — this function was written with D-23 in mind. Call it
with a `{ name, weekday, start_hour }` tuple built from each row's `Groep` cell plus the derived
weekday/hour; never write a second key function.

**`komendeLessen` — for computing "what already exists for this group going forward" (D-12)** (lines 104-110):
```typescript
export function komendeLessen<B extends GroepBoeking>(
  bookings: B[], groupId: string, now: Date,
): B[] {
  return groupBookingsFrom(bookings, groupId, now).filter((b) => b.status !== 'cancelled');
}
```

**`planRosterChange` — the pattern for "what changes if this group's roster changes"** (lines 121-132):
```typescript
export function planRosterChange(
  group: LesGroep, newRoster: string[], bookings: GroepBoeking[], now: Date,
): RosterChangePlan {
  const raken = komendeLessen(bookings, group.id, now);
  return {
    group: { ...group, roster: [...newRoster] },
    bookingPatches: raken.map((b) => ({ id: b.id, participant_ids: [...newRoster] })),
  };
}
```
When the import updates an existing group's roster (D-06/D-07: new players discovered in a
re-import), reuse this function rather than writing new roster-diff logic — it already returns
the "plan, don't write" shape the importer needs.

**`planGroepWijziging` — pattern for D-13's "don't silently move a manually-changed lesson"** (lines
197-271, especially 240-259): this function already embodies exactly D-13's spirit — a lesson
that can't be moved (past, vakantie, or `botstMet` collision) is reported in `geblokkeerd` with a
reason, not silently skipped or silently forced. The import's own "handmatig verzet, niet
stilzwijgend teruggezet" collision category (IMP-08) should produce a parallel
`geblokkeerd`/`GeblokkeerdeLes`-shaped list, reusing the same three-reason vocabulary
(`'bezet' | 'vakantie' | 'verleden'`) where it applies, adding a distinct reason for "this slot
already has a different, manually-placed booking" if `botstMet` alone doesn't capture it.

---

### `lib/recurrence.ts` — reused as-is, not modified

**`botstMet` — the one collision predicate, do not write a second one** (lines 141-158):
```typescript
/**
 * Botst dit tijdvak met een bestaande boeking — van dezelfde trainer, of op dezelfde baan?
 * ...
 * Woordelijk dezelfde regel als `overlaps` in providers/SimpleDataProvider: dezelfde
 * trainer, tijdvakken die elkaar raken zonder de grenzen mee te tellen (een les van 10–11
 * botst niet met 11–12), en een geannuleerde les houdt niets bezet. Wijkt deze versie ooit
 * af, dan meldt het scherm een reeks of een verzetting die de provider vervolgens weigert —
 * daarom is dit de enige plek in lib/ die deze vraag beantwoordt...
 */
export function botstMet(
  slot: SeriesSlot, existing: BezetBoeking[], vraag: BezetVraag,
): BezetBoeking | null {
  const aStart = new Date(slot.start_time).getTime();
  const aEnd = new Date(slot.end_time).getTime();
  return existing.find((b) => {
    if (b.status === 'cancelled') return false;
    if (vraag.negeer?.has(b.id)) return false;
    const zelfdeTrainer = b.coach_id === vraag.coachId;
    const zelfdeBaan = !!vraag.courtId && !!b.court_id && b.court_id === vraag.courtId;
    if (!zelfdeTrainer && !zelfdeBaan) return false;
    const bStart = new Date(b.start_time).getTime();
    const bEnd = new Date(b.end_time).getTime();
    return aStart < bEnd && bStart < aEnd;
  }) ?? null;
}
```
Call this directly for IMP-05's "botst met bezette trainer of baan" check, passing
`{ coachId, courtId }` derived from the row's `Coach`/`Baan` lookup. Do not write
`botstMetUitImport` or any variant — the comment explicitly documents the cost of a diverging
second copy.

**Local-time day-stepping — the header comment on why "not +168 hours", to quote/paraphrase for D-15** (lines 1-11):
```typescript
// Alles gebeurt in lokale tijd, net als `bookingsOnDay` in lib/hub en de periodes in
// lib/period. Dat is hier geen detail: een reeks die over de uurwissel loopt moet om
// 10:00 blijven staan, en dat lukt alleen als je met dag-, uur- en minuutvelden rekent
// en niet met "168 uur erbij".
```
And the actual stepping function (lines 93-103):
```typescript
/**
 * Dezelfde dagtijd, een aantal dagen verder. Door de dag op te tellen in het veld `date`
 * en uur en minuut ongemoeid te laten blijft een les van 10:00 ook na de uurwissel om
 * 10:00 staan — bij optellen in milliseconden zou hij naar 09:00 of 11:00 schuiven.
 */
function shiftDays(d: Date, days: number): Date {
  return new Date(
    d.getFullYear(), d.getMonth(), d.getDate() + days,
    d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds(),
  );
}
```
Every date the lessons importer builds from a spreadsheet cell (`serieNaarDatum` + `fractieNaarTijd`
→ a lesson's local start time) must be constructed the same way: local Y/M/D/H/min components
passed to `new Date(...)`, never `Date.UTC(...)` followed by `.toISOString()` for interpretation.
D-15's required DST-crossing fixture test should assert against this exact function's behavior
style (a season spanning the last Sunday of March/October shows the same local hour on both
sides).

---

### `lib/vakanties.ts` — reused as-is, not modified

**`vakantieOpMoment` — the one function to call for "does this lesson fall in a club holiday"** (lines 66-70):
```typescript
/** Idem, voor het begin van een les (een ISO-tijdstip). De dag telt lokaal, zoals overal. */
export function vakantieOpMoment(vakanties: Vakantie[], iso: string): Vakantie | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return vakantieOp(vakanties, d);
}
```
Call this once per candidate lesson slot, exactly as `planSeries` and `planGroepWijziging` do
(both check the vakantie *before* the collision check — "is de club dicht, dan doet het er niet
meer toe of de trainer dan ook nog bezet was", `lib/recurrence.ts` line 208-209 / `lib/lesgroepen.ts`
line 244-245). The importer must preserve this ordering: vakantie check first, `botstMet` second.

---

### `lib/students.ts` (extend, per D-22/Pitfall 6/7) — current state to extend beside, not replace

**Current `normalizeName`/`nameExists` — do not change their exact-order semantics; other call sites depend on them** (lines 1-23, full file):
```typescript
// Spelers herkennen op naam. Staat hier, en niet in de keuzelijst zelf, omdat "bestaat deze
// naam al?" een regel is die je wil kunnen nalezen en testen: hij bepaalt of een trainer een
// tweede speler met dezelfde naam kan aanmaken, en dat is precies wat we willen voorkomen.

export function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

export function nameExists(students: readonly User[], name: string): boolean {
  const q = normalizeName(name);
  if (!q) return false;
  return students.some((s) => normalizeName(s.name) === q);
}
```
D-22 requires a **new**, separately-tested, order-insensitive comparison living beside these
(e.g. `normalizeNameOrderInsensitive`/`nameExistsAnyOrder`), matching this file's own stated
philosophy in its header comment: "'bestaat deze naam al?' een regel is die je wil kunnen
nalezen en testen." Both the coach lookup and the player lookup in `lib/import-trainingen.ts`
must call the *same* new function (Pitfall 7) — do not let coach-matching and player-matching
diverge into two slightly different comparisons. Test it against the two real names from
`koen.xlsx`: `"Leemans Koen"` and `"de Clippele Antoine"` (the latter proves a naive
"split on first space" heuristic is wrong — "de Clippele" is a two-word surname).

---

### `lib/bestand.ts` (extend, for binary file reading) — current state to extend beside

**Current `kiesTekstbestand` — the exact `<input type=file>` + `FileReader` pattern to mirror for binary** (full file, lines 1-40):
```typescript
// Een tekstbestand van de gebruiker inlezen. De tegenhanger van lib/share.ts, dat een
// bestand wegschrijft, en met dezelfde keuze erin: op web bestaat een bestandskiezer, op
// een telefoon niet zonder `expo-document-picker` erbij. ...

export const kanBestandKiezen: boolean =
  Platform.OS === 'web' && typeof document !== 'undefined' && typeof FileReader !== 'undefined';

export function kiesTekstbestand(): Promise<string | null> {
  if (!kanBestandKiezen) return Promise.resolve(null);
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,text/csv,text/plain';
    input.onchange = () => {
      const bestand = input.files?.[0];
      if (!bestand) { resolve(null); return; }
      const lezer = new FileReader();
      lezer.onload = () => resolve(typeof lezer.result === 'string' ? lezer.result : null);
      lezer.onerror = () => resolve(null);
      lezer.readAsText(bestand, 'utf-8');
    };
    input.click();
  });
}
```
The new `kiesBinairBestand` sibling should follow this exact structure: same `kanBestandKiezen`
gate reused (not duplicated), same `<input type=file>` + `onchange`/`FileReader` shape, but
`accept = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'` and
`lezer.readAsArrayBuffer(bestand)` / `lezer.onload = () => resolve(lezer.result instanceof
ArrayBuffer ? new Uint8Array(lezer.result) : null)`. Keep the same "`null` means cancelled or
failed, not an error to show" comment and behavior.

## Shared Patterns

### The plan/execute split (D-09, D-10)
**Source:** `lib/import-leden.ts::planImport`/`pasImportToe` in full.
**Apply to:** `lib/import-trainingen.ts::planImportLessen`/`pasImportLessenToe`. `planImportLessen`
must contain zero `await`s and zero calls into `providers/`/`components/`/`app/` — it takes rows
plus current state (existing groups, players, coaches, courts, settings) and returns a plan
object, full stop.

### One commit per unsplittable batch, never per row (D-21, Pattern 4)
**Source:** `providers/SimpleDataProvider.tsx::addBookingSeries` (lines 653-715, especially the
comment implied by its structure — accumulate in memory, one `commit()` at the end).
**Apply to:** whatever new provider action executes the approved lessons-import plan. Contrast
explicitly with `lib/import-leden.ts::pasImportToe`'s one-write-per-row loop, which is the wrong
granularity to copy for this phase's bulk writes — copy `pasImportToe`'s *counters/progress-callback
interface shape*, not its per-row commit frequency.

### The one collision predicate (`botstMet`) and the one group key (`groepSleutel`)
**Source:** `lib/recurrence.ts::botstMet` (lines 141-158), `lib/lesgroepen.ts::groepSleutel`
(lines 273-282).
**Apply to:** IMP-03 (group derivation) and IMP-05 (collision reporting) in
`lib/import-trainingen.ts`. Never write a second, "importer-specific" version of either — both
source files carry explicit comments warning against exactly this divergence.

### Vakantie-before-collision ordering
**Source:** `lib/recurrence.ts::planSeries` (line 208-209 comment) and
`lib/lesgroepen.ts::planGroepWijziging` (line 244-245 comment): "de vakantie eerst... doet het er
niet meer toe of de trainer dan ook nog bezet was."
**Apply to:** the per-row scheduling logic in `planImportLessen` — check `vakantieOpMoment` before
`botstMet`, same order, for the same reason (IMP-05's counts should reflect this priority: a slot
in a vakantie is never also counted as "botst").

### Local-time date construction, only `.toISOString()` at the very end
**Source:** `lib/recurrence.ts::shiftDays` (lines 98-103) and its file header (lines 8-11);
`lib/xlsx.ts::datumNaarSerie`'s epoch-quirk comment (lines 250-257) inverted for
`serieNaarDatum`/`fractieNaarTijd`.
**Apply to:** every date/time value the reader decodes and every date the importer constructs
(D-15, D-20). A dedicated DST-crossing fixture test is required, following the same "assert the
same local hour on both sides of the boundary" style already implicit in `lib/recurrence.ts`'s
own reasoning (no existing DST test to point to directly — this is genuinely new coverage per
RESEARCH.md's Wave-0 gap list).

### `{vars}`-placeholder error/warning messages, never pre-interpolated strings
**Source:** `lib/import-leden.ts::ImportFout` (lines 176-190) and every `plan.fouten.push({...})`
call site in `planImport` (e.g. lines 372-377, 383-389, 401-407).
**Apply to:** every `ImportFout`-equivalent produced by `planImportLessen` — reasons are Dutch
sentences with `{naam}`-style placeholders, filled via `vars`, translated with `t(reden, vars)` on
the screen side, never string-concatenated in `lib/`.

### Reject-whole-file vs. reject-one-row, two distinct screen states
**Source:** `lib/import-leden.ts::bestandAfgekeurd` (lines 273-281) and
`app/admin/leden-import.tsx` lines 230-256 (the branch that renders it).
**Apply to:** `trainingen-import.tsx` — an empty file or a header missing a required D-04 column
is a different UI state ("dit bestand kan niet gebruikt worden") from "37 of 1398 rows have
errors, the rest imports fine."

### Module-level state surviving screen remount during a long-running import
**Source:** `app/admin/leden-import.tsx` lines 19-54 (`importDraait`, `laatsteVoortgang`,
`laatsteUitslag`, `importLuisteraars`).
**Apply to:** `trainingen-import.tsx`, with even more relevance given the ~1400-row scale of a
real `koen.xlsx` import compared to a typical member list.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `lib/xlsx-lezen.ts`'s DEFLATE decoder itself (stored/fixed-Huffman/dynamic-Huffman inflate) | utility | transform | Nothing in this codebase decompresses anything today; `lib/xlsx.ts`'s writer explicitly avoids needing this. RESEARCH.md's Code Examples/Architecture sections and RFC 1951 itself are the only guidance — there is no in-repo analog for the Huffman-tree-building and bit-reading logic. Budget this as genuinely new code, sized per RESEARCH.md's estimate (~300-500 lines), built and tested in isolation before any import logic depends on it (D-19). |
| The lesson-key idempotency function (`Datum` + beginuur + lesgroep, D-11) | utility | transform | `groepSleutel` is the closest sibling in *style* (same file, same signature convention) but there is no existing "which booking is this, across re-imports" key anywhere in `lib/` — `series_id` and `group_id` answer different questions. Write this as a new, small, symmetrical function next to `groepSleutel`'s usage site, following its exact style (lowercase/trim on any string parts, `|`-joined), not as a method on an unrelated file. |

## Metadata

**Analog search scope:** `lib/*.ts` (all files named in CONTEXT.md/RESEARCH.md canonical refs),
`app/admin/*.tsx`, `providers/SimpleDataProvider.tsx`, `.planning/phases/04-excel-export/`,
`.planning/IMPORT-SJABLOON.md`.
**Files read in full this session:** `lib/import-leden.ts`, `lib/import-leden.test.ts`,
`lib/xlsx.ts`, `lib/xlsx.test.ts`, `lib/lesgroepen.ts`, `lib/recurrence.ts`, `lib/vakanties.ts`,
`lib/students.ts`, `lib/bestand.ts`, `app/admin/leden-import.tsx`, plus targeted reads of
`providers/SimpleDataProvider.tsx` (`commit`, `addBookingSeries`, `addUser`, `updateUser`) and
`lib/types.ts` (`Booking`, `Settings.lesson_duration_minutes`).
**Pattern extraction date:** 2026-09-06
