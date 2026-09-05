# Phase 5: Excel-import van trainingen - Research

**Researched:** 2026-09-06
**Domain:** Hand-written xlsx (zip + DEFLATE + SpreadsheetML) reading; idempotent bulk import of lesson groups, players and bookings into a live Supabase-backed scheduling app
**Confidence:** HIGH for codebase-reuse findings (grounded directly in `lib/*.ts` read in full); MEDIUM for the DEFLATE-implementation-size estimate (grounded in the RFC and in `koen.xlsx`'s own zip headers, not in a working prototype); MEDIUM for partial-failure semantics (grounded in reading `saveToSupabase`/`sync.ts`, not in a live Supabase test)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Het formaat — vastgelegd, niet ter discussie**
- **D-01:** Eén regel per **les × leerling**. Een groepsles van zes staat als zes regels met
  dezelfde datum en hetzelfde uur. Zo plant de club vandaag al, en zo levert de export het aan.
- **D-02:** De lesgroep wordt **afgeleid**, niet ingevuld. Sleutel: `Groep` + weekdag +
  beginuur, binnen het ingelezen seizoen. Niet de groepsnaam alleen — in `koen.xlsx` staat
  "Groep 8" op drie momenten met drie volledig verschillende rosters en nul overlap.
- **D-03:** Staat er een `Groep-ID` in het bestand (de export vult die in), dan wint die van de
  afgeleide sleutel. Zo blijft een groep herkenbaar ook als naam of uur verandert.
- **D-04:** Verplichte kolommen: `Datum`, `Uur`, `Groep`, `Coach`, `Leerling`. Optioneel:
  `Groep-ID`, `Type les` (wordt het niveau), `E-mail leerling`, `Baan`. Genegeerd bij inlezen
  maar geschreven bij export: `Weekdag`, `Weeknr`, `Locatie`, `Indoor/Outdoor`. Onbekende
  kolommen worden genegeerd, niet afgekeurd. De koprij bepaalt wat waar staat.
- **D-05:** Lesduur is een clubinstelling met 60 minuten als beginwaarde. Geen kolom. Een
  wijziging geldt voor nieuw ingeplande lessen en nooit met terugwerkende kracht.

**Wat de import wel en niet aanmaakt**
- **D-06:** Aanmaken: lesgroepen, onbekende spelers (zelfde regels als `lib/import-leden.ts`),
  en de lessen zelf.
- **D-07:** Opzoeken maar nooit aanmaken: trainers en banen. Een trainer aanmaken betekent een
  uurtarief en toegang tot de club; dat is geen bijproduct van een import. Ontbreekt de
  trainer, dan meldt de droogloop het en gaat die groep niet door.
- **D-08:** Namen worden gematcht via `normalizeName` uit `lib/students.ts`, en het matchen
  moet ertegen kunnen dat de achternaam vooraan staat ("Leemans Koen", "de Clippele Antoine").

**De droogloop**
- **D-09:** Vóór er iets wegschrijft, een samenvatting — in groepen en aantallen, niet in
  1400 regels: lesgroepen nieuw/bijgewerkt/ongewijzigd, hoeveel spelers nieuw, hoeveel lessen
  ingepland worden, hoeveel er in een clubvakantie vallen en overgeslagen worden, hoeveel er
  botsen met een bezette trainer of baan, en wat niet gelezen kon worden met regelnummer en
  reden.
- **D-10:** Het plan wordt in `lib/` uitgerekend zonder databank en zonder scherm, precies zoals
  `lib/import-leden.ts` dat doet. Dat is waarom de belofte "je ziet het vóór het gebeurt"
  testbaar is.

**Herimport**
- **D-11:** De sleutel van één les is `Datum` + beginuur + de lesgroep. Hetzelfde bestand een
  tweede keer inlezen verandert niets.
- **D-12:** Een gewijzigd bestand werkt bij, vanaf vandaag vooruit. Wat geweest is blijft staan.
- **D-13:** Een les die met de hand verzet of afgezegd is, wordt **niet** stilzwijgend
  teruggezet. De droogloop meldt zulke botsingen apart en de beheerder beslist.
- **D-14:** Een import die halverwege mislukt, laat geen halve groep of halve reeks achter.

**Tijd**
- **D-15:** Alles in lokale tijd, met dag-, uur- en minuutvelden — nooit UTC parsen en dan
  `.toISOString()`. Een reeks die de zomer-wintertijdwissel overspant moet op elk lesmoment
  hetzelfde lokale uur tonen. `lib/recurrence.ts` doet dit al goed; volg het. Hier hoort een
  fixture-test bij die de wissel overspant.

**Toegang en databank**
- **D-16:** Alleen de beheerder. Elke nieuwe of gewijzigde tabel krijgt admin-only
  RLS-policies en wordt met de hand op de upsert-val nagelopen.
- **D-17:** Schemawijzigingen als `alter table ... if not exists`-blok onderaan
  `supabase-schema.sql`. **De gebruiker draait ze zelf.** Niets in deze fase mag SQL draaien of
  de productiedatabank aanraken — en dat weegt hier het zwaarst van alle fases, want dit is de
  enige fase die in bulk schrijft.

### Claude's Discretion
- Het lezen van een xlsx (`lib/xlsx.ts` schrijft alleen; lezen moet erbij, zonder pakket).
- De schermindeling van de droogloop.
- Hoe het sjabloonbestand gegenereerd en aangeboden wordt.

### Deferred Ideas (OUT OF SCOPE)
- Importeren uit iets anders dan Excel — niet gevraagd.
- Automatisch importeren op schema — niet gevraagd.
- Controlelijst vóór het seizoen (dubbele banen, lessen in vakantie als apart scherm) — v2 (CONTR-01).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| IMP-01 | Leeg sjabloonbestand downloaden dat de verwachte kolommen toont | `voorbeeldLedenCsv`-equivalent pattern in `lib/import-leden.ts`; column contract fixed by `.planning/IMPORT-SJABLOON.md` — needs a new `voorbeeldTrainingenXlsx`-style generator built on `lib/xlsx.ts::buildXlsx` |
| IMP-02 | Volledige droogloop vóór er iets wegschrijft | Plan/execute pattern (`planImport`/`pasImportToe`) mirrored as `planImportLessen`/`pasImportLessenToe`; D-09 dry-run shape documented in Architecture Patterns |
| IMP-03 | Lesgroepen afleiden op sleutel Groep+weekdag+beginuur | `groepSleutel` in `lib/lesgroepen.ts` already implements this exact key — reuse, do not reimplement (see Don't Hand-Roll) |
| IMP-04 | Onbekende speler aanmaken (zelfde regels als ledenimport); trainer/baan nooit aanmaken | `lib/import-leden.ts`'s `addUser`/dedup path reused directly; D-07 lookup-only enforced via new pure lookup functions, never a create path for coaches/courts |
| IMP-05 | Lessen inplannen met vakanties gefilterd, bezette trainer/baan gemeld | `vakantieOpMoment` (`lib/vakanties.ts`) and `botstMet` (`lib/recurrence.ts`) reused directly — see Architecture Patterns and Don't Hand-Roll |
| IMP-06 | Zelfde bestand tweede keer inlezen verandert niets | Idempotent matching via `groepSleutel`/`Groep-ID` + new lesson key (date+hour+group); Wave 0 test gap flagged in Validation Architecture |
| IMP-07 | Gewijzigd bestand werkt bij vanaf vandaag | Mirrors the "changes work from today forward" pattern already established for `planRosterChange`/`groupBookingsFrom` in `lib/lesgroepen.ts` |
| IMP-08 | Handmatig verzette/afgezegde les niet stil teruggezet | `botstMet`'s existing collision-reporting shape extended to flag manual-edit conflicts as a distinct dry-run category (D-13) |
| IMP-09 | Halverwege mislukte import laat geen halve groep/reeks achter | See Pitfall 5 (Common Pitfalls) — interpreted as "recoverable by re-import," not a real DB transaction (Supabase has none available); flagged as Open Question 1 for explicit user confirmation |
| IMP-10 | `koen.xlsx` leest ongewijzigd in, 7 lesgroepen, enige melding is trainer/baan koppelen | `koen.xlsx` inspected directly this session (zip structure, date/time encoding, row shapes) — see Code Examples "Fixture values confirmed"; this is also the pitfall that most directly demands the DEFLATE reader |
| IMP-11 | Lesduur als clubinstelling, 60 min beginwaarde, nooit met terugwerkende kracht | `Settings.lesson_duration_minutes` already implemented in Phase 1 with exactly this semantics — importer only needs to read it, not build it |
</phase_requirements>

## Summary

Phase 5 has one honestly large unknown and everything else is disciplined reuse. The large
unknown is reading `koen.xlsx`: `unzip -v` on the real fixture shows all ten of its zip
entries stored as `Defl:S` (DEFLATE), not "stored" the way `lib/xlsx.ts` writes its own
files. `lib/xlsx.ts`'s writer deliberately skips compression to avoid needing an inflate
implementation — that shortcut cannot be reused for reading, because the reader must handle
files Excel itself produced, not just files this app wrote. A correct reader therefore needs
a real RFC 1951 DEFLATE decoder (stored, fixed-Huffman and dynamic-Huffman blocks), which is
new code of a similar order of magnitude to `lib/xlsx.ts` itself (roughly 300-500 lines for a
correct, testable implementation) plus the zip central-directory reader, `sharedStrings.xml`
parser, sheet-row parser and Excel date/time decoding — all four of which are small and
low-risk by comparison.

Everything downstream of "I have the rows as strings" is a close structural copy of
`lib/import-leden.ts`'s dry-run/plan/execute pattern, `lib/lesgroepen.ts::groepSleutel` (which
already implements exactly the group key IMPORT-SJABLOON.md specifies), and
`lib/recurrence.ts`'s local-time day-stepping. The lesson-duration clubinstelling
(`Settings.lesson_duration_minutes`, IMP-11) already exists as of Phase 1 with 60 as its
default and forward-only semantics documented — this requirement is already modeled, the
import only needs to read it. Partial-failure safety (IMP-09) is achievable not through a
real database transaction (Supabase has none available to a sequential JS client) but through
the existing `commit()`-as-one-diff pattern plus write ordering, combined with the fact that a
failed-then-retried import is safe by construction because everything is matched, never
appended, on re-run.

**Primary recommendation:** Build the xlsx reader as its own small library
(`lib/xlsx-lezen.ts` or extend `lib/xlsx.ts`) with its own exhaustive test file *before*
starting the import planner, using `koen.xlsx` as the primary fixture from day one — and
seriously consider splitting this phase into two plans/waves so the reader lands and is
proven (byte-exact round trip against `koen.xlsx`) before any import business logic is
written on top of it.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Zip central-directory parsing | `lib/` (pure) | — | No I/O; same tier as `lib/xlsx.ts`'s writer |
| DEFLATE decompression | `lib/` (pure) | — | Pure byte-in/byte-out function, testable against known vectors |
| sharedStrings.xml / sheet XML parsing | `lib/` (pure) | — | Pure string parsing, no DOM parser available/needed |
| Excel serial date/time decoding | `lib/` (pure) | — | Mirrors `datumNaarSerie` in `lib/xlsx.ts`, inverted |
| Import dry-run (`planImportLessen`-equivalent) | `lib/` (pure) | — | Must be pure and total, exactly like `planImport` — no DB, no screen |
| File picking (choose a spreadsheet) | Browser/Client | — | `lib/bestand.ts` is web-only today (`kanBestandKiezen`); reading binary needs `readAsArrayBuffer`, a new function alongside `kiesTekstbestand` |
| Applying the plan (writes) | Frontend Server / Provider (`SimpleDataProvider.tsx`) | API/Backend (Supabase RLS) | Same layering as every other write path: `lib/` computes, provider commits, RLS is the real guard |
| Coach/court lookup (never create) | `lib/` (pure) | Database | Lookup logic is pure; the underlying rows already exist in Supabase, looked up via passed-in lists exactly like `import-leden.ts` does for players |
| Idempotent matching keys (group, lesson) | `lib/` (pure) | — | `groepSleutel` already lives in `lib/lesgroepen.ts`; a lesson key is new, symmetrical code |
| RLS admin-only enforcement | Database (Supabase) | — | The app is never the guard (`lib/rechten.ts`'s own stated philosophy); every new/changed table needs its own admin-only policy verified by hand (D-16, D-17) |

## Standard Stack

### Core

No new dependency is proposed or needed. Everything below is hand-written, matching the
existing `lib/xlsx.ts` precedent and the explicit user constraint ("zonder pakket").

| Concern | Approach | Why Standard (for this codebase) |
|---------|---------|--------------|
| Zip reading | Hand-written central-directory walker | `lib/xlsx.test.ts` already contains a minimal version (`leesZip`) used only in tests; the real reader generalizes it to handle both stored *and* deflated entries and local-header offsets robustly |
| Decompression | Hand-written RFC 1951 inflate | `koen.xlsx`'s entries are all `Defl:S`; a stored-only reader (mirroring the writer) cannot open real Excel files |
| XML parsing | Regex/string-scan, not a DOM parser | `lib/xlsx.ts` writer uses string templates, not a DOM API; a lightweight scanner for `<c r="..." ...><v>...</v></c>` and `<si><t>...</t></si>` is sufficient for the narrow SpreadsheetML subset Excel actually emits and keeps the reader dependency-free |
| Reading the chosen file as bytes | `FileReader.readAsArrayBuffer` (web only, matching `kiesTekstbestand`'s `readAsText`) | `lib/bestand.ts` already gates on `Platform.OS === 'web'`; binary reading is a new sibling function, not a new platform capability |

### Supporting

| Concern | Approach | When to Use |
|---------|---------|-------------|
| `DecompressionStream('deflate-raw')` | Browser-native API, NOT recommended as the primary path | Only worth considering as a documented alternative — see "Don't Hand-Roll" below for why this codebase's own stated philosophy argues against relying on it as the sole implementation |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-written inflate | `DecompressionStream('deflate-raw')` (native, web-only) | Zero new code, but: (1) contradicts `lib/xlsx.ts`'s own stated reasoning for avoiding "available everywhere nowadays" platform assumptions (`utf8()`'s comment explicitly rejects this argument for `TextEncoder`); (2) not available on older Safari (<16.4) or in a future React Native reader without a stream polyfill; (3) makes the reader untestable byte-for-byte in Jest without extra plumbing (Jest's `jsdom`/node environment support for `DecompressionStream` depends on the Node version `jest-expo` resolves to — unverified in this session, HIGH-risk to rely on) |
| Hand-written inflate | A tiny well-known pure-JS inflate (`tiny-inflate`, `pako`'s inflate core) vendored as source, not npm | Still "a package" in spirit even if copy-pasted; user constraint says "zonder pakket," and a vendored file nobody on this team wrote is harder to trust for a bulk-write feature than a hand-tested implementation matching the rest of `lib/xlsx.ts`'s style |

**Installation:** None. No `npm install` for this phase.

**Version verification:** N/A — no packages proposed.

## Package Legitimacy Audit

Not applicable — this phase installs no external packages. `.planning/phases/05-excel-import-van-trainingen/05-CONTEXT.md` (D-06 constraint block and Claude's Discretion) explicitly requires the xlsx reader be hand-written, matching `lib/xlsx.ts`. If a future planner is ever tempted to add an xlsx-reading package, this table would need to be filled in — flagged here so the planner does not silently skip the gate:

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| (none proposed) | — | — | — | — | — | N/A |

**Packages removed due to slopcheck [SLOP] verdict:** none (none proposed)
**Packages flagged as suspicious [SUS]:** none (none proposed)

## Architecture Patterns

### System Architecture Diagram

```
[koen.xlsx bytes, chosen via <input type=file>]
        |
        v
  lib/bestand.ts (NEW: kiesBinairBestand — readAsArrayBuffer, web-only)
        |
        v
  lib/xlsx-lezen.ts (NEW)
   +-- leesZip(bytes)              -> ZipIngang[] (central directory walk, handles stored + deflate)
   +-- inflate(bytes)              -> Uint8Array (RFC 1951, only called for entries with method=8)
   +-- leesSharedStrings(xml)      -> string[] (index -> literal text)
   +-- leesBlad(xml, sharedStrings)-> ruwe rijen: string[][] per row, by column letter
   +-- serieNaarDatum(n)           -> {jaar, maand, dag}  (inverse of datumNaarSerie)
   +-- fractieNaarTijd(f)          -> {uur, minuut}
        |
        v
  lib/import-trainingen.ts (NEW — mirrors lib/import-leden.ts)
   +-- leesKopregelLessen(koprij)          -> Kolommen | nietHerkend/dubbel  (reuse the exact
   |                                          leesKopregel shape/pattern from import-leden.ts)
   +-- planImportLessen(rijen, bestaande*) -> ImportPlanLessen (PURE, no DB, no screen)
   |     uses: groepSleutel() from lib/lesgroepen.ts (already exists, do not reimplement)
   |     uses: normalizeName()/nameExists() from lib/students.ts (extended for "Achternaam Voornaam")
   |     uses: vakantieOpMoment() from lib/vakanties.ts
   |     uses: botstMet() from lib/recurrence.ts (do not reimplement the collision predicate)
   |     uses: Settings.lesson_duration_minutes (already exists, Phase 1)
        |
        v
  app/admin/trainingen-import.tsx (NEW screen, mirrors app/admin/leden-import.tsx)
   +-- shows ImportPlanLessen summary (D-09: groups/counts, never 1400 rows)
        |
        v
  pasImportLessenToe(plan, acties)  -> ONE commit() call to SimpleDataProvider
   +-- providers/SimpleDataProvider.tsx: commit(next: StoreData) -> backend.save(previous, next)
   +-- providers/supabaseStore.ts: saveToSupabase -> per-table upsert() (sequential, NOT
        cross-table transactional) -> Postgres RLS (admin-only, D-16/D-17)
```

### Recommended Project Structure

```
lib/
├── xlsx.ts                  # unchanged — writer only
├── xlsx-lezen.ts             # NEW — zip + inflate + sharedStrings + sheet + date/time decode
├── xlsx-lezen.test.ts         # NEW — unit tests + koen.xlsx fixture round-trip
├── import-trainingen.ts      # NEW — dry-run/plan, mirrors import-leden.ts
├── import-trainingen.test.ts # NEW — idempotency, DST fixture, koen.xlsx IMP-10 fixture test
├── lesgroepen.ts             # existing — groepSleutel() reused as-is
├── recurrence.ts             # existing — botstMet(), local-time stepping reused as-is
├── vakanties.ts              # existing — vakantieOpMoment() reused as-is
├── students.ts               # existing — normalizeName()/nameExists(), extend name-order handling
└── bestand.ts                # extend — add kiesBinairBestand (readAsArrayBuffer)
app/admin/
└── trainingen-import.tsx     # NEW screen, mirrors leden-import.tsx
```

### Pattern 1: Plan/Execute split (already established, must be repeated exactly)

**What:** A pure `planX` function takes rows + current state, returns a plan object with
`nieuw`/`bijgewerkt`/`fouten`/`waarschuwingen`-shaped fields; nothing is written. A separate
`pasXToe` function takes an approved plan and performs the writes.

**When to use:** Always, for this phase — it is the entire reason IMP-02's promise ("see
before it happens") is testable at all.

**Example:**
```typescript
// Source: lib/import-leden.ts (read in full this session)
export function planImport(
  rijen: ReadonlyArray<readonly string[]>,
  bestaande: readonly User[],
  magTarief = true,
): ImportPlan { /* no I/O anywhere in this function */ }

export async function pasImportToe(
  plan: ImportPlan,
  acties: ImportActies,
  voortgang?: (klaar: number, totaal: number) => void,
): Promise<ImportUitslag> { /* the only place awaits happen */ }
```

### Pattern 2: The group key already exists — do not reinvent it

**What:** `lib/lesgroepen.ts::groepSleutel` already implements exactly the D-02 key
(`name|weekday|start_hour`, lowercased/trimmed name).

**When to use:** The importer's group-matching step should call this function directly
against a synthesized `LesGroep`-shape (or a lighter tuple) built from each row's `Groep` +
derived weekday + derived start hour, rather than writing a second, subtly different key
function.

**Example:**
```typescript
// Source: lib/lesgroepen.ts (read in full this session)
export function groepSleutel(g: Pick<LesGroep, 'name' | 'weekday' | 'start_hour'>): string {
  return `${g.name.trim().toLowerCase()}|${g.weekday}|${g.start_hour}`;
}
```

### Pattern 3: Local-time date construction, never UTC-then-toISOString

**What:** Every date/time value derived from a spreadsheet cell must be built with
`new Date(jaar, maand - 1, dag, uur, minuut)`, exactly like `shiftDays`/`parseUntil` in
`lib/recurrence.ts`. Never `Date.UTC(...)` followed by `.toISOString()` for the *interpretation*
step (only `.toISOString()` at the very end, once, to produce the stored ISO string, is fine —
that's what `planSeries` itself does at `slotStart.toISOString()`).

**Example:**
```typescript
// Source: lib/recurrence.ts (read in full this session) — the pattern to mirror exactly
function shiftDays(d: Date, days: number): Date {
  return new Date(
    d.getFullYear(), d.getMonth(), d.getDate() + days,
    d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds(),
  );
}
```

### Pattern 4: One commit() per unsplittable unit of work

**What:** `addBookingSeries` in `SimpleDataProvider.tsx` already puts "all the lessons of one
series" into a single `commit()` call, with a comment explicitly warning that a loop with one
commit per lesson would leave the store looking different from what actually landed. The
import must follow the same discipline: one `commit()` for the whole approved plan (or, if
chunked for size, one `commit()` per clearly-bounded chunk — see Pitfall/Scale section below),
never one commit per row.

**Example:**
```typescript
// Source: providers/SimpleDataProvider.tsx (read in full this session)
// comment near addBookingSeries: "Alle lessen gaan in één `commit` de opslag in. Een lus met
// een commit per les zou ze één voor één opslaan en de tussenstand telkens laten zien..."
```

### Anti-Patterns to Avoid

- **A second "is this the same lesson" or "is this the same group" predicate:** `botstMet` in
  `lib/recurrence.ts` already carries a comment warning that a diverging second copy of the
  overlap predicate is exactly the bug class to avoid (`overlaps()` in `SimpleDataProvider.tsx`
  must stay behaviorally identical). The same discipline applies to `groepSleutel` — do not
  write `lesGroepSleutelUitImport` as a parallel, slightly different function.
- **Reading `LesGroep.roster` to decide "who is in this lesson":** `lib/lesgroepen.ts`'s own
  header comment states this boundary explicitly — `roster` is "who's in the group now,"
  `Booking.participant_ids` is "who actually stood on court that day." The importer writes
  both (roster at group-creation/update time, `participant_ids` per generated booking) but
  never conflates them.
- **A per-row database call inside the dry-run:** the entire value of D-09/D-10 depends on
  `planImportLessen` being pure and total — no `await`, no Supabase call, anywhere inside it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| "Is this lesson slot the same as an existing one" | A new lesson-matching function from scratch | New but *symmetrical* function, keyed on `(group key or Groep-ID) + date + start_hour`, following `groepSleutel`'s exact style/signature convention | Consistency with the one existing recognition-key function; a diverging convention here is precisely Pitfall 5 in PITFALLS.md |
| Group recognition | Matching only on `Groep` name | `groepSleutel` (existing) plus `Groep-ID` override (D-03) | `koen.xlsx` itself proves name-only matching is wrong: "Groep 8" appears three times with zero roster overlap |
| Weekly recurrence / collision detection | A new day-stepping and collision-checking loop for the import | `lib/recurrence.ts::botstMet` (collision) and the same local-time stepping style as `shiftDays` | Two divergent overlap predicates is an explicitly flagged bug class in `PITFALLS.md` Pitfall 3, already once fixed in this codebase for `bookings_insert`/RLS |
| Player creation/dedup | A second "create if unknown" path | `normalizeName`/`nameExists` from `lib/students.ts`, and the exact `addUser`/dedup shape from `lib/import-leden.ts` | `PITFALLS.md`'s Security Mistakes table explicitly flags a second player-creation path as reopening the "Confirm email" bulk-account-claiming risk already documented for `leden-import.tsx` |
| Excel date/time decoding | Ad-hoc `serial / 86400` math scattered across the importer | One `serieNaarDatum`/`fractieNaarTijd` pair in `lib/xlsx-lezen.ts`, the mirror of `datumNaarSerie` | `datumNaarSerie` already documents the 1899-12-30 epoch quirk (Excel's fictitious 1900 leap day) — the inverse function must encode the same knowledge once, not be rederived per call site |
| DEFLATE decompression | Any per-feature "quick and dirty" partial inflate that only handles the one compression mode seen in `koen.xlsx` today | A full RFC 1951 decoder (stored + fixed + dynamic Huffman) | A future re-export of `koen.xlsx` from a different Excel version, or a file from LibreOffice/Numbers, is not guaranteed to use the same Huffman mode; "works today" is not the same as "works for the next file a coach brings in" |

**Key insight:** Every piece of *business logic* in this phase (matching, dedup, collision,
date math, plan/execute split) already has a canonical, tested implementation somewhere in
`lib/`. The only genuinely new problem is the *file format*, not the *business rules* — this
should shape how the phase is planned: one wave for the format, one for the rules.

## Common Pitfalls

### Pitfall 1: Stored-only zip reading fails on every real xlsx file

**What goes wrong:** A reader built by generalizing `lib/xlsx.test.ts`'s `leesZip` helper
(which only ever reads files this app's own stored-mode writer produced) silently mis-decodes
or crashes on `koen.xlsx`, because every entry in that file is `Defl:S` (verified via
`unzip -v koen.xlsx` in this session), not stored.

**Why it happens:** The existing zip-reading code in the test suite was written to validate
the writer's own output and never needed to handle compression method 1 (deflate); it's easy
to assume "the zip format" is solved because a reader already exists in the repo.

**How to avoid:** Check the compression-method field (2 bytes at offset 10 in both the local
file header and the central-directory record) for every entry; branch to `inflate()` when it
is `8` (deflate) and pass bytes through unchanged when it is `0` (stored). Test against both
`buildXlsx`'s own stored output (regression) and `koen.xlsx`'s deflated entries (the real
target).

**Warning signs:** A reader that only ever sees test fixtures generated by `buildXlsx` will
pass all its own tests and still fail the moment it opens a real Excel file.

### Pitfall 2: A `sharedStrings.xml` reference of `0` looks like "no reference"

**What goes wrong:** Cells with `t="s"` store an *index* into `sharedStrings.xml` as their
`<v>` content (confirmed directly in `koen.xlsx`'s `sheet1.xml`: `<c r="A1" s="1" t="s"><v>0</v></c>`
means "shared string #0", which is `"Datum"`). A naive parser that treats a falsy/zero `<v>`
as "empty cell" silently turns every reference to the *first* shared string (in this file:
the literal header word "Datum," and in general whatever string happens to be interned first)
into a blank cell.

**How to avoid:** Distinguish "cell absent" from "cell value is the string `0`" at the parsing
level — never coerce with `!value` or `value || fallback`; check `t="s"` explicitly and index
into the shared-strings array by parsed integer, allowing `0`.

**Warning signs:** The first-ever unique string in a workbook (often a column header)
silently disappears or gets swapped with an unrelated value.

### Pitfall 3: Time-of-day cells decode to the wrong minute from floating-point fractions

**What goes wrong:** `koen.xlsx`'s `Uur` column stores fractions like
`0.58333333333333337` (=14:00) and `0.625` (=15:00). Multiplying by 24 and truncating with
plain `Math.floor` on a value like `0.58333333333333337 * 24 = 13.999999999999998` yields hour
`13` instead of `14` due to float imprecision.

**How to avoid:** Round to the nearest minute before extracting hour/minute — e.g. compute
`totalMinutes = Math.round(fraction * 24 * 60)`, then `uur = Math.floor(totalMinutes / 60)`,
`minuut = totalMinutes % 60`. Verified directly against the two real fraction values found in
`koen.xlsx`.

**Warning signs:** A lesson imported at `13:59` or `14:01` instead of the intended `14:00` —
easy to miss on a visual spot-check, exactly the DST-adjacent "looks close enough" failure
mode `PITFALLS.md` Pitfall 4 warns about for dates.

### Pitfall 4: DST-crossing import dates (already documented, re-confirmed against `lib/recurrence.ts`)

**What goes wrong:** See `.planning/research/PITFALLS.md` Pitfall 4 in full — constructing a
lesson's start time via `Date.UTC(...)` + `.toISOString()` (or naive `new Date(isoStringWithZ)`
parsing of a date built that way) shifts every lesson on one side of a DST boundary by one
hour, silently.

**How to avoid:** Build every lesson's `Date` with
`new Date(jaar, maand - 1, dag, uur, minuut)` (local components), exactly mirroring
`shiftDays`/`parseUntil` in `lib/recurrence.ts`, and only call `.toISOString()` once, at the
very end, to produce the value actually stored on `Booking.start_time`/`end_time`.

**Warning signs:** A fixture test importing a season spanning the last Sunday of March or
October shows a lesson at 19:00 or 21:00 instead of the intended 20:00 for roughly half the
occurrences.

### Pitfall 5: Cross-table partial failure looks like "no transaction," but is recoverable by re-import — do not assume otherwise without checking write order

**What goes wrong:** `saveToSupabase` (`providers/supabaseStore.ts`, read in full) loops over
tables and issues one `.upsert(rows)` Postgres statement per table, sequentially, inside a
single JS function — there is no cross-table database transaction available to a sequential
Supabase JS client. If the `users` upsert succeeds and the subsequent `lesson_groups` upsert
throws, new player rows are already persisted with no group referencing them yet; if
`lesson_groups` succeeds and `bookings` then fails, a real group with zero lessons is left
standing.

**Why it happens:** `commit()`'s `try/catch` reverts the *local* `storeRef` and re-throws, but
cannot undo already-executed Postgres statements — genuinely, per-table atomicity is real
(each `.upsert()` is one SQL statement), cross-table atomicity is not.

**How to avoid:** Two things make this acceptable rather than dangerous, and both must be
true simultaneously: (1) order the diff so the *least* consequential writes happen last — an
orphaned new player row with no group yet is harmless and matches on next re-run by email; an
empty group with no lessons yet is visible and self-explanatory in the app's own lesgroepen
screen and the *next* re-import will fill in its lessons without creating a duplicate group
(because `groepSleutel`/`Groep-ID` matching is exact and re-run-safe); (2) put the whole
approved plan into **one** `commit()` call (Pattern 4 above), not one per group — a half-applied
single commit still leaves the store in a state a second import run can complete correctly,
whereas many small commits interleaved with other admin actions could not be reasoned about
the same way. Document this explicitly as the chosen interpretation of IMP-09 ("no half group
or half series left behind") — it is "no half group left un-fixable by re-running the same
import," not "a real database transaction," because the latter does not exist in this stack.

**Warning signs:** A plan or test that assumes a rollback of already-written Postgres rows on
mid-import failure — this is not something `saveToSupabase` can do.

### Pitfall 6: Name matching breaks on "Achternaam Voornaam" without an explicit rule

**What goes wrong:** `koen.xlsx` writes names as `"Leemans Koen"`, `"de Clippele Antoine"`.
`normalizeName` (`lib/students.ts`, read in full) only lowercases and trims — it does not
reorder tokens. Matching this literal string against a `User.name` stored as `"Koen Leemans"`
(the natural order a coach or member-import would use) fails as an exact match today.

**How to avoid:** This needs a **new, small, explicitly-tested function** — not a change to
`normalizeName` itself, which other call sites (member import, participant pickers) rely on
for exact-order comparison. A safe token-set comparison (split on whitespace, lowercase, sort
tokens, join) would match `"Leemans Koen"` and `"Koen Leemants"` — beware this also equates
any two people who happen to share the same two words in reverse order (rare but not
impossible for a common Belgian surname/given-name pair); the dry-run's existing "a name like
this already exists" warning path in `import-leden.ts` (`nameExists`-style) should fire for
these near-matches rather than silently merging or silently creating a duplicate. `"de
Clippele Antoine"` additionally shows a multi-word surname ("de Clippele") — a token-set
compare handles this correctly by design (order-independence), whereas any "split on first
space" heuristic would incorrectly treat "de" as the given name.

**Warning signs:** `koen.xlsx`'s IMP-10 acceptance test importing a member already known to
the club under `"Koen Leemans"` and getting a *second*, near-duplicate player named `"Leemans
Koen"` instead of matching the existing one.

### Pitfall 7: Coach lookup must also handle "Leemans Koen" ordering

**What goes wrong:** D-07 requires trainers to be looked up, never created. If coach lookup
reuses plain `normalizeName` (exact-order match) while player lookup gets the token-set fix
from Pitfall 6, `koen.xlsx`'s own coach (`Coach` column = `"Leemans Koen"`) will fail to match
an existing coach account stored as `"Koen Leemans"`, and IMP-10's acceptance criterion ("the
only message is that coach and courts still need linking") becomes "every group's coach is
unmatched" instead.

**How to avoid:** Coach lookup and player lookup must use the *same* name-matching function
(the Pitfall 6 fix), not two independently-written comparisons.

## Code Examples

### Reading the group key from a row (mirrors `groepSleutel`)

```typescript
// Source: derived directly from lib/lesgroepen.ts::groepSleutel, read in full this session
import { groepSleutel } from './lesgroepen';

function sleutelUitRij(groep: string, weekday: number, startHour: number): string {
  return groepSleutel({ name: groep, weekday, start_hour: startHour });
}
```

### Excel date serial -> local date (inverse of `datumNaarSerie` in `lib/xlsx.ts`)

```typescript
// Source: lib/xlsx.ts::datumNaarSerie (read in full this session) inverted; epoch verified
// against koen.xlsx's own A2 cell value 46274 = 9 September 2026, matching
// .planning/IMPORT-SJABLOON.md's stated season start.
const EXCEL_EPOCH_UTC_MS = Date.UTC(1899, 11, 30);

export function serieNaarDatum(serie: number): { jaar: number; maand: number; dag: number } {
  const ms = EXCEL_EPOCH_UTC_MS + Math.round(serie) * 86_400_000;
  const d = new Date(ms);
  return { jaar: d.getUTCFullYear(), maand: d.getUTCMonth() + 1, dag: d.getUTCDate() };
}

export function fractieNaarTijd(fractie: number): { uur: number; minuut: number } {
  const totaalMinuten = Math.round(fractie * 24 * 60); // rounding avoids the float-imprecision
  return { uur: Math.floor(totaalMinuten / 60) % 24, minuut: totaalMinuten % 60 };
}
```

### Fixture values confirmed directly from `koen.xlsx` in this session

```
A2 (Datum):  <c r="A2" s="1"><v>46274</v></c>            -> serial 46274 = 9 sep 2026
D2 (Uur):    <c r="D2" s="2"><v>0.58333333333333337</v>  -> 14:00
D4 (Uur):    <c r="D4" s="2"><v>0.625</v>                -> 15:00
Header row:  all t="s" (shared-string) references, no inline strings anywhere in the file
Row shape:   every one of the 1398 data rows has exactly 10 <c> cells, columns A..J,
             no empty/self-closing cells found (grep for self-closing <c .../> returned 0)
zip entries: [Content_Types].xml, _rels/.rels, xl/workbook.xml, xl/_rels/workbook.xml.rels,
             xl/worksheets/sheet1.xml, xl/theme/theme1.xml, xl/styles.xml,
             xl/sharedStrings.xml, docProps/core.xml, docProps/app.xml — ALL "Defl:S"
sharedStrings.xml: count="9796" uniqueCount="70" — small enough to hold entirely in memory
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `lib/xlsx.ts` writes stored-only zips | Reader must handle deflated zips | N/A — was always true for reading real files, just never needed until now | The writer's "skip compression, it's simpler" shortcut cannot be extended to reading |

**Deprecated/outdated:** None — this is new code, not a migration.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A hand-written RFC 1951 inflate implementation for this use case runs roughly 300-500 lines for a correct, testable implementation | Summary, Standard Stack | If actually much larger/smaller, the phase-split recommendation (below) may be over- or under-cautious; does not block planning, only sizing |
| A2 | `DecompressionStream('deflate-raw')` support in the Jest/`jest-expo` test environment is unverified in this session (only checked in the ambient Node used by this agent's Bash tool, not the project's actual `jest-expo` preset) | Standard Stack, Alternatives Considered | If it *is* available and reliable in `jest-expo`, the alternative becomes more attractive than presented; the planner should spike this for ~15 minutes before committing either way if choosing between the two options |
| A3 | A token-set (order-independent) name comparison is an acceptable fix for "Achternaam Voornaam" without introducing false-positive merges at club scale (~1400 rows, dozens of families) | Pitfall 6 | If two real, different club members share the same two name-tokens in reverse order, they would incorrectly match; low probability at this club size but not zero, and the CONTEXT.md's own D-08 acknowledges the risk without specifying the exact algorithm |
| A4 | Partial cross-table write failure (Pitfall 5) is an acceptable interpretation of IMP-09 given Supabase has no cross-table transaction available to a sequential JS client | Common Pitfalls, Validation Architecture | If the user/planner intended a stricter guarantee (e.g. a Postgres function/RPC wrapping the whole import in one real transaction), this changes the phase's shape substantially — this should be surfaced explicitly to the user before planning locks it in, since D-14/D-17 forbid the app from running arbitrary SQL and a new RPC function is exactly "SQL that needs to be run by the club" |

**If this table is empty:** N/A — see above.

## Open Questions

1. **Should the whole import go through one Postgres RPC/transaction instead of sequential upserts?**
   - What we know: `saveToSupabase` today does sequential per-table `.upsert()` calls with no
     cross-table transaction; D-17 forbids this phase from running SQL against the production
     database itself (schema changes are `alter table ... if not exists` blocks the user runs).
   - What's unclear: whether "the beheerder runs the schema block themselves" extends to also
     approving a *new stored procedure* for atomic import, versus accepting the
     re-run-is-safe interpretation of IMP-09 documented in Pitfall 5.
   - Recommendation: default to the re-run-safe interpretation (no new RPC, no new SQL beyond
     the usual `alter table` block for new/changed tables) unless the user explicitly wants a
     stronger guarantee — flag this choice for `/gsd:discuss-phase` or an explicit planner note
     rather than silently deciding it.

2. **Exact algorithm for the "Achternaam Voornaam" name-order fix (Pitfall 6/A3).**
   - What we know: a token-set comparison handles both single-surname ("Leemans Koen") and
     multi-word-surname ("de Clippele Antoine") cases correctly, and the dry-run's existing
     "possible duplicate" warning path is the safety net for edge cases.
   - What's unclear: whether the fix belongs as a new exported function in `lib/students.ts`
     (extending the one place name-matching already lives) or as import-local logic. Given
     `lib/students.ts`'s own header comment ("staat hier, en niet in de keuzelijst zelf, omdat
     'bestaat deze naam al' een regel is die je wil kunnen nalezen en testen"), the same
     argument applies here: it should probably live in `lib/students.ts` so member-list
     screens benefit from the same fix, not just the importer.
   - Recommendation: add e.g. `normalizeNameOrderInsensitive`/`nameExistsAnyOrder` to
     `lib/students.ts`, tested against exactly the two real names from `koen.xlsx`.

3. **Whether `DecompressionStream` is realistically usable in this stack's test environment.**
   - What we know: it exists as a global function in the ambient Node process used by this
     research session's Bash tool; it is a browser-native API, and the import feature is
     web-only today per `lib/bestand.ts`.
   - What's unclear: `jest-expo`'s test environment (React Native / Hermes-flavored) support
     is unverified; relying on it would make `xlsx-lezen.test.ts` environment-dependent in a
     way none of the existing `lib/` tests are.
   - Recommendation: spike a 10-line Jest test calling `new DecompressionStream('deflate-raw')`
     before deciding; if it fails or is flaky under `jest-expo`, that alone settles the
     hand-written-inflate decision without further debate.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js (dev/test) | `npm test`, `npx tsc --noEmit` | ✓ | (ambient, unpinned in this session) | — |
| `koen.xlsx` fixture | IMP-10 acceptance test | ✓ | present at repo root, 68574 bytes, verified openable via `unzip` | — |
| A second, isolated Supabase project for RLS upsert verification (D-16/D-17) | Manual upsert verification step | ✗ (not checked in this session — no `.env`/Supabase credentials probed) | — | None with equivalent safety — `.planning/research/PITFALLS.md` Pitfall 7 and `CONCERNS.md` both recommend standing one up specifically because this phase is the highest-risk bulk-write phase; if not available, the fallback is extreme discipline (mock-store only, never running the real import against production more than the one final verified time) |
| `DecompressionStream` in `jest-expo`'s test environment | Only relevant if this path is chosen over hand-written inflate | Unverified (see Open Question 3) | — | Hand-written inflate (recommended primary path regardless) |

**Missing dependencies with no fallback:**
- A second Supabase project for safe RLS/import testing — this is a process gap, not a code
  gap, and should be raised with the user before this phase's checkpoint tasks, exactly as
  `PITFALLS.md` Pitfall 7 already recommends for the whole milestone.

**Missing dependencies with fallback:**
- `DecompressionStream` — fallback is simply not using it (see Standard Stack recommendation).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 29.7 via `jest-expo` preset (`package.json`) |
| Config file | `package.json` `"jest"` key (`preset: "jest-expo"`) — no separate `jest.config.js` |
| Quick run command | `npx jest lib/xlsx-lezen lib/import-trainingen` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IMP-01 | Empty template download shows expected columns | unit | `pytest`-equivalent: `npx jest lib/import-trainingen -t "voorbeeld"` | ❌ Wave 0 — new `voorbeeldTrainingenXlsx`-style function + test |
| IMP-02 | Dry-run summarizes before any write | unit | `npx jest lib/import-trainingen -t "planImportLessen"` | ❌ Wave 0 |
| IMP-03 | Group derived on `Groep`+weekday+start_hour, two same-name groups stay separate | unit | `npx jest lib/import-trainingen -t "groepSleutel\|twee groepen"` | ❌ Wave 0 |
| IMP-04 | Unknown player created via same rules as member import; coach/court never created | unit | `npx jest lib/import-trainingen -t "onbekende speler\|trainer bestaat niet"` | ❌ Wave 0 |
| IMP-05 | Lessons scheduled with vakanties filtered, collisions reported not overwritten | unit | `npx jest lib/import-trainingen -t "vakantie\|botst"` | ❌ Wave 0 (reuses `vakantieOpMoment`/`botstMet`) |
| IMP-06 | Re-import identical file = no-op | unit (regression) | `npx jest lib/import-trainingen -t "tweede keer"` | ❌ Wave 0 — must literally import the same fixture rows twice in one test |
| IMP-07 | Changed file updates forward from today only | unit | `npx jest lib/import-trainingen -t "gewijzigd bestand"` | ❌ Wave 0 |
| IMP-08 | Manually moved/cancelled lesson not silently reverted, reported as collision | unit | `npx jest lib/import-trainingen -t "handmatig verzet"` | ❌ Wave 0 |
| IMP-09 | Partial mid-import failure leaves no unrecoverable half state | integration (mock provider) + manual | `npx jest lib/import-trainingen -t "mislukt"` for the plan-purity guarantee; manual Supabase check for the write-ordering claim (Pitfall 5) — cannot be fully automated against real Postgres upsert failure modes | ❌ Wave 0 (automatable part); manual step required for the rest |
| IMP-10 | `koen.xlsx` imports unchanged, 7 groups, only coach/court linking message | integration (fixture) | `npx jest lib/import-trainingen -t "koen.xlsx"` | ❌ Wave 0 — needs a helper to load the binary fixture in Jest (Node `fs.readFileSync` on `koen.xlsx`, converted to `Uint8Array`) |
| IMP-11 | Lesson duration is a clubinstelling, forward-only | unit | `npx jest lib/import-trainingen -t "lesduur"` | ✅ partially — `Settings.lesson_duration_minutes` and its forward-only semantics already exist and are covered from Phase 1; only the importer's *read* of this setting is new |

### Sampling Rate

- **Per task commit:** `npx jest lib/xlsx-lezen lib/import-trainingen && npx tsc --noEmit`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green, plus the manual RLS upsert verification (D-16/D-17) and the
  manual `koen.xlsx` real-Excel-file open check, before `/gsd:verify-work`.

### Wave 0 Gaps

- [ ] `lib/xlsx-lezen.ts` + `lib/xlsx-lezen.test.ts` — zip central-directory reader (stored +
  deflate), inflate, sharedStrings parser, sheet-row parser, `serieNaarDatum`/`fractieNaarTijd`.
  Needs its own byte-level test vectors (known DEFLATE test strings, e.g. "123456789" style
  fixed vectors) *and* a full round-trip test against `koen.xlsx` read via `fs.readFileSync`.
- [ ] `lib/import-trainingen.ts` + `lib/import-trainingen.test.ts` — the dry-run/plan/execute
  logic, mirroring `import-leden.ts`'s test structure exactly (fouten/waarschuwingen/nieuw/
  bijgewerkt cases, idempotency test, DST-boundary fixture test).
  Needs a hand-built DST fixture: a weekly group whose season crosses the last Sunday of March
  or October (Belgian DST dates), asserting identical local start hour on every generated
  lesson.
- [ ] `lib/students.ts` extension for order-insensitive name matching (Pitfall 6/Open Question 2)
  — needs its own test cases using the exact two real names from `koen.xlsx`
  ("Leemans Koen", "de Clippele Antoine").
- [ ] `lib/bestand.ts` extension: a binary file-picking function (`readAsArrayBuffer`) —
  needs a test mirroring however `kiesTekstbestand`'s existing (if any) tests are structured;
  note `lib/bestand.ts` itself has no visible `*.test.ts` in this session's file listing, which
  the planner should check and, if absent, decide whether this new function needs one (it is a
  thin Web API wrapper, similar to `kiesTekstbestand`).
- [ ] Fixture loader helper for `koen.xlsx` in Jest (reading a binary file from the repo root
  in a Jest test needs `fs`/`path`, which is fine under `jest-expo`'s Node-based test runner
  for `lib/` tests, but should be written once and shared, not per-test).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Unchanged — existing Supabase auth |
| V3 Session Management | no | Unchanged |
| V4 Access Control | yes | Admin-only RLS policies on every new/changed table (D-16), verified against the exact upsert-vs-insert-policy trap already documented twice in `CONCERNS.md` |
| V5 Input Validation | yes | Every cell value is untrusted user-authored spreadsheet content; `planImportLessen` must treat every field the same way `planImport` treats CSV cells — reject/flag rather than coerce, never trust column position, only the header row |
| V6 Cryptography | no | Not applicable — no new secrets/crypto |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| RLS `WITH CHECK` re-evaluated on upsert-as-update (the exact bug documented twice in `CONCERNS.md`) | Denial of Service (silent write drop, not data exposure) | Write every new policy as admin-only (`is_admin()`-style check), never an ownership/`created_by` check, mirroring the already-fixed `bookings_insert` pattern; manually verify insert-as-A/update-as-B for every new table |
| Bulk-created player accounts claimable before the real member signs up | Spoofing | Route all new-player creation through the exact same `addUser` path member import uses (already flagged in `PITFALLS.md` Security Mistakes), so the existing "Confirm email" operational reminder applies uniformly |
| A crafted/corrupted xlsx (malformed zip, huge shared-strings table, deeply nested XML) causing the hand-written parser to hang or crash | Denial of Service | Bound the inflate loop (a malformed DEFLATE stream should throw, not loop forever — check for the end-of-block symbol and a maximum output size sanity bound), and treat any parse exception as an `ImportFout` on the whole file (mirroring `bestandAfgekeurd` in `import-leden.ts`), never an unhandled exception that crashes the admin screen |
| Testing this bulk-write feature against the live production Supabase project | (process risk, not STRIDE) | Mock-store mode (remove `.env`) for all `lib/` development and dry-run testing; the one necessary real-import verification against production should use the actual `koen.xlsx` file with data the club wants kept, not throwaway test data, per `PITFALLS.md` Pitfall 7 and the user's own memory note ("Dev-server praat met echte Supabase") |

## Sources

### Primary (HIGH confidence — read in full this session)
- `lib/import-leden.ts`, `lib/import-leden.test.ts` (via wc/summary + full read of import-leden.ts) — the plan/execute pattern to mirror
- `lib/xlsx.ts`, `lib/xlsx.test.ts` — the writer, its stored-only zip approach, `datumNaarSerie`
- `lib/recurrence.ts` — local-time day stepping, `botstMet`, `planSeries`
- `lib/lesgroepen.ts` — `groepSleutel`, the group-vs-booking roster boundary
- `lib/students.ts`, `lib/contact.ts` — `normalizeName`, `nameExists`, email/phone normalization
- `lib/bestand.ts` — existing web-only text file picking, the gap for binary reading
- `lib/vakanties.ts` — `vakantieOpMoment`
- `lib/types.ts` — `LesGroep`, `Booking`, `Settings.lesson_duration_minutes`, `Court`, `User`
- `providers/SimpleDataProvider.tsx`, `providers/supabaseStore.ts`, `lib/sync.ts` — the
  `commit()`/`saveToSupabase`/`diffStores` write path, confirming no cross-table transaction
- `koen.xlsx` (repo root) — inspected directly via `unzip -v`, `unzip -o`, and raw XML reads:
  confirmed all entries `Defl:S`, confirmed sheet structure (1399 rows incl. header, 10 cells
  each, no gaps), confirmed date serial (46274), time fractions (0.58333333333333337, 0.625),
  shared-strings table (70 unique strings), styles (`s="1"` = date `numFmtId=14`, `s="2"` =
  time `numFmtId=166`)
- `.planning/IMPORT-SJABLOON.md`, `.planning/phases/05-excel-import-van-trainingen/05-CONTEXT.md`,
  `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/phases/04-excel-export/04-02-PLAN.md`,
  `.planning/phases/04-excel-export/04-CONTEXT.md`, `.planning/phases/01-lesgroepen/01-01-SUMMARY.md`,
  `.planning/phases/01-lesgroepen/01-03-SUMMARY.md`, `.planning/research/PITFALLS.md`,
  `.planning/codebase/CONVENTIONS.md`, `.planning/codebase/CONCERNS.md`, `.planning/config.json`

### Secondary (MEDIUM confidence)
- RFC 1951 (DEFLATE) knowledge of block types (stored/fixed-Huffman/dynamic-Huffman) and
  typical pure-JS implementation size — general training knowledge, not verified against a
  specific reference implementation's line count in this session
- `DecompressionStream` browser support timeline (Chrome 80+, Firefox 113+, Safari 16.4+) —
  general training knowledge, not re-verified via web search this session

### Tertiary (LOW confidence)
- None flagged beyond what's captured above

## Metadata

**Confidence breakdown:**
- Standard stack (no new deps, hand-written reader): HIGH — directly dictated by user
  constraint and confirmed necessary by inspecting `koen.xlsx`'s actual compression
- Architecture (plan/execute, reuse of `groepSleutel`/`botstMet`/`recurrence`): HIGH — all
  read in full this session, patterns are explicit and already proven at scale in this codebase
- Pitfalls (DEFLATE, sharedStrings, float time, DST, partial-write, name order): HIGH for the
  ones directly verified against `koen.xlsx`'s bytes or existing code; MEDIUM for the
  partial-write recovery argument (Pitfall 5), which is a reasoned interpretation, not something
  tested against a live Supabase failure in this session

**Research date:** 2026-09-06
**Valid until:** 30 days (stable domain — no external API/library version drift risk since
nothing new is installed; the one thing that could go stale is `koen.xlsx` itself if the club
edits it, so re-verify the fixture's byte layout if that file changes before this phase executes)
