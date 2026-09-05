# Phase 4: Excel-export - Research

**Researched:** 2026-09-06
**Domain:** Multi-sheet xlsx generation from an existing hand-written zip/XML writer; reuse of existing payroll/report/attendance calculations; file delivery on web vs. mobile.
**Confidence:** HIGH (all claims verified by reading the actual source files in this repo — no external library research needed, since D-04 forbids adding one)

## Summary

The single biggest technical unknown — "can `lib/xlsx.ts` write more than one sheet?" — is answered directly by reading the file: **no, not today.** `buildXlsx()` hardcodes exactly one worksheet (`sheet1.xml`), one `<sheet>` entry in `xl/workbook.xml`, and two fixed relationship IDs. Everything else in the OOXML package (styles, content types, zip container) is already sheet-count-agnostic or trivially made so. This is a real but *bounded* change: add a `bladen: XlsxBlad[]` (or similar) entry point, loop to emit `sheet1.xml..sheetN.xml`, and generate N `<sheet>`/`<Override>`/`<Relationship>` entries instead of one. No new zip/CRC/UTF-8 code is needed — that layer already works with an arbitrary list of named parts.

Three of the four required sheets are near-trivial extensions of code that already exists and is already tested: `lib/csv.ts` already builds exactly the "Lessen" sheet's shape (it is the CSV/xlsx export used today on Historiek) and `lib/reports.ts` already computes `payoutsByCoach` for "Uren per trainer" and `lib/aanwezigheid.ts` already stores per-lesson attendance for "Aanwezigheid." The fourth ("Groepen") is a straightforward aggregation over `LesGroep` + `lib/lesgroepen.ts` helpers. The genuinely new work is (a) multi-sheet support in `lib/xlsx.ts`, (b) a `Groep-ID` column and the exact `.planning/IMPORT-SJABLOON.md` column set on "Lessen" (columns that don't exist in `lib/csv.ts` today: `Weekdag`, `Weeknr`, `Locatie`, `Indoor/Outdoor`, `Type les`, `E-mail leerling`, `Baan`, `Groep-ID`), and (c) a pivot-shaped attendance sheet, which has no existing analog anywhere in the codebase.

**A blocking dependency risk:** EXP-03 requires the "Uren per trainer" sheet to key on **who actually taught** the lesson (`taught_by_id`), but as of this research date `lib/lesgever.ts` (the "one place" VERV-02 mandates) **does not exist yet** — only `lib/lesgever.test.ts` is present (untracked, presumably RED). `payoutsByCoach` in `lib/reports.ts` currently keys everything on `b.coach_id`, never `taught_by_id`. This is expected: Phase 4 depends on Phase 3, which depends on Phase 2, and Phase 2's wiring (plans 02-01, 02-03, 02-04) is still pending in the roadmap. **The plan for this phase must assume Phase 2/2.1/3 have landed `lib/lesgever.ts` and an `effectiveCoachId`-style helper by the time Phase 4 executes**, and the "Uren per trainer" sheet must call through that helper (or `payoutsByCoach` once it is updated to use it) rather than re-deriving attribution itself. Do not write export code today against `coach_id` and call it correct.

**Primary recommendation:** Extend `lib/xlsx.ts` to accept multiple `XlsxBlad`s in one workbook (small, mechanical change to `buildXlsx`); write one new `lib/export-trainingen.ts` (or similar) module that assembles the four `XlsxBlad`s by calling into `lib/reports.ts`, `lib/payments.ts`, `lib/aanwezigheid.ts`, and `lib/lesgroepen.ts` — never recomputing money or hours itself; reuse `lib/period.ts`, `lib/share.ts` (not `lib/bestand.ts` — see Pitfall below), and the `Historiek`/`Rapport` screen patterns for the UI.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Period selection (EXP-01) | `lib/period.ts` (pure) | Screen (`app/admin/*.tsx`) for the picker UI | `PeriodPicker` component + `lib/period.ts` already own "which lessons are in scope"; export must reuse, not refilter |
| Workbook/sheet assembly (all EXP-*) | New `lib/` module (pure) | — | Per `CONVENTIONS.md`: "Zit er logica in een scherm die je niet kunt testen, dan hoort ze in `lib/`" — this is exactly `lib/csv.ts`'s existing pattern, extended |
| xlsx byte-level writing | `lib/xlsx.ts` (pure) | — | Existing zip/XML writer; extend for N sheets, never replace (D-04) |
| Payroll/hours calculation (EXP-03) | `lib/reports.ts` + `lib/payments.ts` (pure) | — | Existing single source of truth (`payoutsByCoach`, `totalCoachPayout`, `coachPayout`); export must call these, never reimplement |
| Attendance data (EXP-04) | `lib/aanwezigheid.ts` (pure) | `bookings.attendance` (Supabase/mock store) | Data already exists per-booking; export only needs a new *shaping* function (pivot), not new attendance logic |
| Group aggregation (EXP-05) | `lib/lesgroepen.ts` (pure) | `LesGroep`/`Booking.group_id` | `lessenVanGroep`, `komendeLessen` already answer "which lessons belong to this group" |
| File delivery (web download / mobile share) | `lib/share.ts` (pure-ish, platform branch) | Screen (button, disabled states) | `shareXlsx`/`xlsxWordtOndersteund` already exist and are used by Historiek; **not** `lib/bestand.ts` (see Pitfall 3) |
| Admin gate (D-06) | Screen (`if (!isAdmin(currentUser))`) | — | No new table ⇒ no RLS; the screen itself is the only boundary, per TOEG-01 pattern in `app/admin/lesgroepen/index.tsx` |

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** One file, four sheets, all user-chosen: **Lessen** (one row per lesson: date, start/end hour, court, assigned coach, who actually taught it, group or player, player count, status), **Uren per trainer** (hours and pay per trainer over the period, based on who actually taught — Phase 2), **Aanwezigheid** (per lesson group: players in rows, lesson dates in columns, filled from `bookings.attendance`; must also print empty for a substitute with no app), **Groepen** (one row per lesson group: name, level, day/hour, trainer, player count, number of scheduled lessons, plus `Groep-ID`).
- **D-02:** The "Lessen" sheet is in **exactly** the column format the import reads, including `Groep-ID`. An export must be re-importable unchanged. See `.planning/IMPORT-SJABLOON.md` — do not deviate.
- **D-03:** Amounts are numbers and dates are dates — never text. This is precisely why `lib/xlsx.ts` exists.

### Claude's Discretion

- How the period is chosen and where the export screen lives.
- How the file reaches the user on web and on phone (`lib/bestand.ts` referenced in CONTEXT.md — **but see Pitfall 3: the actual delivery module is `lib/share.ts`**, not `lib/bestand.ts`, which only reads files).
- Column widths and sheet names, within what `.planning/IMPORT-SJABLOON.md` fixes.

### Deferred Ideas (OUT OF SCOPE)

- A revenue sheet — already exists in Beheer → Rapport (D-05). Revenue runs on the **court's** rate; coach pay runs on the **coach's** rate. These two amounts must never be merged into one sheet or one column.
- Exporting to anything other than Excel — not requested.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EXP-01 | Admin picks a period and gets one Excel file | `lib/period.ts` (`Period`, `PeriodPicker` UI pattern from `historiek.tsx`), `lib/share.ts` (`shareXlsx`), multi-sheet `buildXlsx` |
| EXP-02 | "Lessen" sheet: one row per lesson, full column set | `lib/csv.ts` (`csvRows`/`CSV_COLUMNS` pattern to extend), `.planning/IMPORT-SJABLOON.md` column table, `lib/types.ts` `Booking` fields |
| EXP-03 | "Uren per trainer" sheet, keyed on who actually taught | `lib/reports.ts::payoutsByCoach`, `lib/payments.ts::coachPayout`/`totalCoachPayout` — **pending Phase 2/3 `lib/lesgever.ts` wiring**, see Open Questions |
| EXP-04 | "Aanwezigheid" sheet, players × lesson dates pivot, empty-printable | `lib/aanwezigheid.ts` (`aanwezigheidVan`, `Aanwezigheden`), `lib/lesgroepen.ts` (`lessenVanGroep`) |
| EXP-05 | "Groepen" sheet, one row per group + `Groep-ID` | `lib/types.ts::LesGroep`, `lib/lesgroepen.ts` (`actieveGroepen`, `lessenVanGroep`) |
| EXP-06 | Amounts as numbers, dates as dates | `lib/xlsx.ts::XlsxCel` (`geld`/`datum` kinds already implemented and tested) |
| EXP-07 | "Lessen" round-trips into the Phase 5 importer | `.planning/IMPORT-SJABLOON.md` full column table (below); `Groep-ID` semantics |

## Standard Stack

### Core

No new libraries — D-04 forbids it, and none are needed. Everything below is existing project code.

| Module | Role | Why reuse instead of new code |
|--------|------|--------------------------------|
| `lib/xlsx.ts` | Byte-level xlsx writer (zip + OOXML XML) | Hand-written specifically to avoid a ~1MB library cost; must be extended for multi-sheet, never replaced |
| `lib/csv.ts` | Existing single-sheet "Lessen"-shaped export (`csvRows`, `CSV_COLUMNS`, `toXlsx`) | Contains the exact pattern (column table with `value`/`getal`/`geld`/`datum`) this phase's "Lessen" sheet must extend |
| `lib/reports.ts` | `payoutsByCoach`, `totalsByPlayer`, `countedBookings` | Single source of truth for "who taught how much, for how much pay" |
| `lib/payments.ts` | `coachPayout`, `totalCoachPayout`, `bookingPrice`, `countsAsRevenue` | The actual money math; export must call, never reimplement |
| `lib/aanwezigheid.ts` | `Aanwezigheden`, `aanwezigheidVan` | The three-state (present/absent/unset) attendance field |
| `lib/period.ts` | `Period`, `bookingsInPeriod`, `periodFilename`, `periodLabel` | Scope selection, identical to Historiek/Rapport |
| `lib/lesgroepen.ts` | `LesGroep`, `lessenVanGroep`, `groupBookingsFrom`, `actieveGroepen` | Group aggregation for "Groepen" and "Aanwezigheid" sheets |
| `lib/share.ts` | `shareXlsx`, `xlsxWordtOndersteund` | File delivery — already platform-branched (web download vs. mobile `Share.share`, which explicitly cannot carry xlsx bytes) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Extending `lib/xlsx.ts` for multi-sheet | A real xlsx library (`xlsx`/`exceljs`) | Explicitly forbidden by D-04 (megabyte web-bundle cost for one blad's worth of use); not evaluated further |
| New export module calling `lib/reports.ts` | Recomputing hours/pay inline in export code | Violates the phase's own canonical constraint ("het exportblad mag geen tweede berekening worden") and PITFALLS.md's explicit warning about `taught_by_id ?? coach_id` drift |

**Installation:** none — no new dependencies.

**Version verification:** N/A — no packages to verify.

## Package Legitimacy Audit

Not applicable. This phase installs zero external packages (D-04 explicitly forbids a new xlsx package, and no other new dependency is implied by any EXP-* requirement). No `pip`/`npm`/`cargo` install commands are needed, and slopcheck was not run because there is nothing to check.

## Architecture Patterns

### System Architecture Diagram

```
Admin picks period on new export screen (app/admin/export.tsx or similar)
        │
        ▼
lib/period.ts: bookingsInPeriod(bookings, period)   ── same filter Historiek/Rapport use
        │
        ▼
new lib/export-trainingen.ts (pure, no I/O)
        │
        ├─► "Lessen" sheet rows  ──uses──► lib/payments.ts (bookingPrice, coachPayout)
        │                                  lib/lesgroepen.ts (group name/level lookup via group_id)
        │                                  lib/status.ts (bookingStatusLabel)
        │
        ├─► "Uren per trainer" rows ──uses──► lib/reports.ts::payoutsByCoach
        │                                     (which must itself resolve taught_by_id ?? coach_id
        │                                      once Phase 2/3 land — see Open Questions)
        │
        ├─► "Aanwezigheid" rows (pivot) ──uses──► lib/lesgroepen.ts::lessenVanGroep
        │                                          lib/aanwezigheid.ts::aanwezigheidVan
        │
        └─► "Groepen" rows ──uses──► lib/lesgroepen.ts (LesGroep list, lessenVanGroep for counts)
        │
        ▼
lib/xlsx.ts::buildXlsx({ bladen: [Lessen, UrenPerTrainer, Aanwezigheid, Groepen] })
        │  (extended to accept N sheets — see Pitfall 1)
        ▼
Uint8Array (the .xlsx file bytes)
        │
        ▼
lib/share.ts::shareXlsx(filename, bytes)
        │
        ├─ web: Blob download via <a download>
        └─ mobile: throws "Een Excel-bestand delen kan alleen op het web." — button hidden via xlsxWordtOndersteund
```

### Recommended Project Structure

```
lib/
├── xlsx.ts                  # MODIFY: accept multiple XlsxBlad in one workbook
├── xlsx.test.ts             # MODIFY: add multi-sheet round-trip tests
├── export-trainingen.ts     # NEW: pure assembly of the four sheets (name is a suggestion —
│                             #      follow the "one noun per module" convention)
├── export-trainingen.test.ts # NEW: reads the built xlsx back apart, same pattern as xlsx.test.ts
├── csv.ts                   # UNCHANGED (or lightly extended if the "Lessen" column set is
│                             #   pulled up into a shared column table — see EXP-07 mapping below)
├── reports.ts                # UNCHANGED (read-only dependency)
├── payments.ts               # UNCHANGED (read-only dependency)
├── aanwezigheid.ts            # UNCHANGED (read-only dependency)
├── lesgroepen.ts              # UNCHANGED (read-only dependency)
└── period.ts                  # UNCHANGED (read-only dependency)

app/admin/
└── export.tsx                # NEW: period picker + four-sheet download button, admin-gated
                                #   (or extend an existing admin screen — Claude's discretion, D-06)
```

### Pattern 1: One column table drives header + typed cell (from `lib/csv.ts`)

**What:** A `readonly Column[]` array where each column has a `label`, a `value()` (string, for display/CSV), and optional `getal()`/`geld`/`datum()` for the typed xlsx cell. The header row and every data row map over the same array, so header and cells can never drift out of column-order sync.

**When to use:** For every one of the four sheets in this phase — it is the established, tested pattern (`CSV_COLUMNS` in `lib/csv.ts`) and should be repeated exactly for "Uren per trainer," "Aanwezigheid," and "Groepen," not reinvented.

**Example:**
```typescript
// Source: lib/csv.ts (existing, verbatim pattern to replicate)
export interface CsvColumn {
  label: string;
  value: (row: CsvRow) => string;
  getal?: (row: CsvRow) => number;
  geld?: boolean;
  datum?: (row: CsvRow) => Date;
  breedte: number;
}
```

### Pattern 2: Cell-shaping happens once, generically, in `toXlsx`-style code

**What:** `lib/csv.ts::toXlsx` maps a row through the column table and decides `soort: 'datum' | 'geld' | 'getal' | 'tekst'` generically — no sheet-specific branching. The same generic mapper should be reused (or copy-pasted verbatim, since it's ~12 lines) for every new sheet rather than writing four bespoke cell-builders.

**Example:**
```typescript
// Source: lib/csv.ts (existing)
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
}))
```

### Pattern 3: Precompute lookup Maps once, outside the per-row loop

**What:** Every existing calculation module (`lib/reports.ts::courtsById`, `lib/payments.ts::openBalanceFor`, `lib/csv.ts::csvRows`) builds a `Map<id, entity>` once before iterating bookings, never `.find()`s inside the loop.

**When to use:** Mandatory for this phase given realistic scale (~1400 rows for one coach's season, "a multiple of that" for the whole club — see Performance section).

**Example:**
```typescript
// Source: lib/csv.ts::csvRows (existing)
const nameById = new Map(users.map((u) => [u.id, u.name]));
const rateById = new Map(users.map((u) => [u.id, u.hourly_rate]));
const courtById = new Map(courts.map((c) => [c.id, c]));
```

### Anti-Patterns to Avoid

- **Recomputing money in the export module:** `lib/reports.ts` and `lib/payments.ts` already own every euro figure the export needs. A second implementation (even one that "looks the same") is exactly the drift PITFALLS.md and OPENSTAAND.md warn against for `revenue`/`booked`/`payout`.
- **Reading `LesGroep.roster` to answer "who was at this specific lesson":** per `lib/lesgroepen.ts`'s own header comment and PITFALLS.md Pitfall 1, "who's in the lesson" is always `Booking.participant_ids` (via `lib/groups.ts`), never the group's current roster — the roster only answers "who is in the group *now*."
- **Keying "Uren per trainer" on `coach_id` instead of the effective teacher:** explicitly called out in PITFALLS.md's own "Looks Done But Isn't" checklist for this exact phase.
- **Treating `lib/bestand.ts` as the delivery mechanism:** it is the *import-reading* module (`kiesTekstbestand`), not delivery. Delivery is `lib/share.ts` (`shareXlsx`/`shareCsv`/`xlsxWordtOndersteund`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Coach pay/hours over a period | A second pay calculation in the export module | `lib/reports.ts::payoutsByCoach`, `lib/payments.ts::coachPayout`/`totalCoachPayout` | Single source of truth; two implementations *will* drift the moment a payroll rule changes |
| Zip/xlsx byte format | A new writer or a library | `lib/xlsx.ts::buildXlsx` (extended for N sheets) | D-04; the existing writer is already tested against a real zip reader |
| Date→Excel-serial conversion | Custom math | `lib/xlsx.ts::datumNaarSerie` (already handles the 1900 leap-year quirk and local-time semantics) | Already correct and tested; a second implementation risks the exact 1900/DST edge cases this one already handles |
| Group membership at a point in time | Reading `LesGroep.roster` per lesson | `Booking.participant_ids` via `lib/groups.ts` | The whole point of PITFALLS.md Pitfall 1 — the roster is "now," not "then" |
| File delivery cross-platform | A new download/share utility | `lib/share.ts::shareXlsx` | Already handles web-Blob-download vs. mobile-throws-with-Dutch-message; already used by Historiek |

**Key insight:** Every calculation this phase needs already exists and is already tested elsewhere in the codebase. The actual net-new work is (1) multi-sheet plumbing in `lib/xlsx.ts`, (2) the exact `IMPORT-SJABLOON.md` column set on "Lessen" (several columns `lib/csv.ts` doesn't currently have), and (3) the pivot shape of "Aanwezigheid," which genuinely has no precedent in this codebase.

## Research Question Answers

### 1. Multiple sheets in `lib/xlsx.ts` — exact scope of the change

**Today: one sheet only.** Evidence, `lib/xlsx.ts:369-401` (`buildXlsx`):
- `[Content_Types].xml` hardcodes exactly one `<Override PartName="/xl/worksheets/sheet1.xml" .../>`.
- `xl/workbook.xml` hardcodes exactly one `<sheet name="..." sheetId="1" r:id="rId1"/>`.
- `xl/_rels/workbook.xml.rels` hardcodes `rId1 → worksheets/sheet1.xml` and `rId2 → styles.xml`.
- The zip only ever gets one `xl/worksheets/sheet1.xml` entry.

**What has to change** — all inside `buildXlsx`, nothing in `zip()`/`crc32()`/`utf8()`/`bladXml()`/`stijlenXml()` (those already operate on arbitrary named parts or a single `XlsxBlad` independent of sheet count):

```typescript
// Sketch of the required shape change (not exact code — illustrates scope):
export function buildXlsx(bladen: XlsxBlad[]): Uint8Array {
  const namen = bladen.map((b) => bladnaam(b.naam)); // bladnaam() already dedupes nothing —
    // NEW: must also de-duplicate names within one workbook (Excel rejects two identical
    // tab names); bladnaam() today only cleans illegal characters and truncates to 31.

  const contentTypes = ... // one <Override> per sheetN.xml (loop 1..bladen.length)
  const workbook = ...     // one <sheet name=".." sheetId="N" r:id="rIdN"/> per sheet
  const workbookRels = ... // rId1..rIdN → worksheets/sheetN.xml, then rId(N+1) → styles.xml

  return zip([
    { naam: '[Content_Types].xml', ... },
    { naam: '_rels/.rels', ... },
    { naam: 'xl/workbook.xml', ... },
    { naam: 'xl/_rels/workbook.xml.rels', ... },
    { naam: 'xl/styles.xml', ... },
    ...bladen.map((b, i) => ({ naam: `xl/worksheets/sheet${i + 1}.xml`, inhoud: utf8(bladXml({ ...b, naam: namen[i] })) })),
  ]);
}
```

**Real size of the change:** small and mechanical — three string-template loops instead of three fixed strings, plus one new concern (sheet-name collision within a workbook, since `bladnaam()` today only sanitizes a single name in isolation and two of this phase's four sheet names could theoretically collide after the 31-char truncation, though in practice "Lessen"/"Uren per trainer"/"Aanwezigheid"/"Groepen" are all well under 31 characters and distinct). No new zip/CRC/styling work. **This is not the risky part of the phase** — the pivot shape of "Aanwezigheid" and the exact IMPORT-SJABLOON column fidelity are bigger risks than the multi-sheet mechanics.

**Backward compatibility note:** `lib/csv.ts::toXlsx` and `historiek.tsx` currently call `buildXlsx({ naam, koppen, rijen, breedtes })` (a single `XlsxBlad`), and `lib/csv.test.ts`/`lib/xlsx.test.ts` assert on that single-sheet shape. Changing `buildXlsx`'s signature to take an array breaks that call site and those tests. The plan must decide: overload `buildXlsx` to accept either one `XlsxBlad` or `XlsxBlad[]`, or add a new exported function (e.g. `buildXlsxMultiBlad`/`buildWorkbook`) and leave `buildXlsx` untouched for the single-sheet caller. Given `CONVENTIONS.md`'s "if nothing outside the file imports it, don't export it" and the existing test suite's exact assertions on `buildXlsx`'s current shape, **adding a new function alongside `buildXlsx` is lower-risk** than changing `buildXlsx`'s signature, since it avoids touching `lib/csv.ts`, `lib/csv.test.ts`, and `historiek.tsx` in a phase that isn't about them. Flag this as a decision for the planner, not something this research locks down.

### 2. "Lessen" sheet column mapping (EXP-07 round-trip)

Full mapping from `.planning/IMPORT-SJABLOON.md`'s column table to the data model:

| Column | Required by import | Source in data model |
|--------|---------------------|------------------------|
| `Datum` | yes | `Booking.start_time` → local calendar day, as `XlsxCel{soort:'datum'}` |
| `Weekdag` | no (import ignores, export writes for readability) | Derived from `Booking.start_time` via `Date#getDay()` — no existing helper; trivial to compute inline or add a one-line helper |
| `Weeknr` | no (ignored on import) | ISO week number of `start_time` — **no existing helper in the codebase**; must be written fresh (small, pure, testable function) |
| `Uur` | yes | `Booking.start_time` → local hour:minute. Import only reads a *start* hour (no end column); EXP-02 additionally wants an **end** hour, which IMPORT-SJABLOON.md does not have a column for — see Open Questions |
| `Type les` | no (becomes `LesGroep.level` on import) | `LesGroep.level` via `Booking.group_id` lookup; for a lesson **without** a group (private lesson), there is no natural source — see question 3 below |
| `Groep` | yes | `LesGroep.name` via `Booking.group_id`; for a private lesson (no `group_id`), IMPORT-SJABLOON.md doesn't define this cell's content for a non-group row — likely the player's name or blank, needs a decision (see Open Questions) |
| `Coach` | yes | `User.name` via `Booking.coach_id` (the **assigned** trainer — `coach_id` never changes per `taught_by_id`'s own doc comment in `lib/types.ts`) |
| `Leerling` | yes | `User.name` via `Booking.player_id` (the payer) — but a **group** lesson has multiple players (`participantIdsOf`); IMPORT-SJABLOON.md's own model is "one row per lesson × student," meaning a group lesson of 6 must become **6 rows** with the same date/hour, one per `lessonPlayerIds(b)` entry — this is a real transformation, not a 1:1 `Booking`→row mapping, and must be built explicitly (`lib/groups.ts::lessonPlayerIds` gives the exact list) |
| `Groep-ID` | optional, wins over the name/day/hour key | `LesGroep.id` via `Booking.group_id` — empty when `group_id` is absent (private lesson) |
| `E-mail leerling` | optional (needed to invite a new player later) | `User.email` (assume this field exists on `User` — verify exact field name in `lib/types.ts` `User` interface before implementation) |
| `Baan` | optional | `Court.name` (or `Court.number`) via `Booking.court_id`; absent when `court_id` is absent |
| `Locatie` | ignored on import, written for readability | No existing field maps directly — IMPORT-SJABLOON.md doesn't define what this should contain for this club; **flag for user clarification, don't invent a value** |
| `Indoor/Outdoor` | ignored on import, written for readability | `Court.indoor` via `Booking.court_id` — straightforward boolean → Dutch label |

**Columns EXP-02 additionally requires that IMPORT-SJABLOON.md does not list:** end hour (`einduur`), player **count** (`aantal spelers` — computable via `groupSize`), and **status** (`bookingStatusLabel`). These are extra columns beyond the import's required/optional set — the import ignores unknown columns per IMPORT-SJABLOON.md ("Onbekende kolommen worden genegeerd, niet afgekeurd"), so adding them is safe for round-tripping, but they must be placed so the *required* columns' names/positions still match (column order doesn't matter per the spec — "Kolomvolgorde doet er niet toe; de koprij bepaalt wat waar staat").

**Flagged as not producible from what exists today without a decision:**
- `Weeknr` (ISO week number) — needs a new small pure function, not a blocker, just net-new code.
- `Type les` / `Groep` cell content for a **private lesson** (no `group_id`) — IMPORT-SJABLOON.md's own model has no "ungrouped" row concept; needs a decision (see Open Questions).
- `Locatie` — no data source; needs a decision or must be left blank.

### 3. `Groep-ID` in the export

- **On the "Lessen" sheet:** one `Groep-ID` cell per row, equal to `Booking.group_id`. For a lesson with **no** group (a one-off private lesson, `group_id` undefined), the cell is empty (`''` as a `tekst` cell, or omit the value) — IMPORT-SJABLOON.md is explicit that "Leeg of afwezig = matchen op de sleutel," and a private lesson has no group key to match on anyway, so leaving it blank is correct and matches the import's own contract.
- **On the "Groepen" sheet:** one `Groep-ID` cell per row = `LesGroep.id` — always present, since every row on this sheet *is* a group.
- **Private lesson, "Groep" column on Lessen:** per point 2 above, this is genuinely undefined in the current spec (no roster/group concept applies) — flagged as an Open Question rather than assumed.

### 4. "Uren per trainer" (EXP-03)

`lib/reports.ts::payoutsByCoach(bookings, users)` is the existing function that produces exactly this shape: `{ coachId, name, lessons, amount, missingRate }[]`, sorted by amount descending. It already:
- Filters via `countedBookings` (cancelled lessons excluded) — matches "wat er nog moet gebeuren" semantics used everywhere else.
- Computes `amount` via `coachPayout(b, coach?.hourly_rate)` — the trainer's own hourly rate, prorated by duration, **regardless of payment status** ("het uur is gegeven").
- Flags `missingRate` for visible warning rather than silent zero — must be surfaced on the sheet (e.g. a text note or a separate flag column), not silently dropped, per `CONVENTIONS.md`'s "Error Handling" rule that a missing/invalid business value must be visibly flagged.

**What must change before EXP-03 is correct:** `payoutsByCoach` currently groups and looks up by `b.coach_id`. VERV-02 requires this to run against **who actually taught** (`taught_by_id ?? coach_id`). This resolution does not exist yet in the live repo (`lib/lesgever.ts` is absent; only its test file is present, untracked). **This phase's plan must not build a parallel "effective coach" resolution inside the export module** — it must call whatever `payoutsByCoach`/`totalCoachPayout` look like *after* Phase 2/2.1/3 land (per VERV-02's own requirement: "via één plek in de code"). If, at Phase 4 planning/execution time, `lib/reports.ts` has not yet been updated to key on the effective teacher, that is a signal the phase dependency order (`Phase 3 → Phase 4`) has not actually been satisfied and should block, not be worked around locally.

**Revenue must not appear:** confirmed against D-05, `OPENSTAAND.md`'s money table, and `lib/reports.ts`'s own header comment ("Omzet en trainersloon zijn twee verschillende bedragen... mogen nooit in elkaar geschoven worden"). The "Uren per trainer" sheet's columns should be: trainer name, lesson count, hours (derivable from `bookingMinutes`/60, summed — not currently pre-summed anywhere, needs a small new aggregation, still calling `bookingMinutes` from `lib/payments.ts`), and pay amount from `payoutsByCoach`. No price/revenue/euro-per-lesson-to-the-player column belongs here.

### 5. Attendance sheet (EXP-04) — shape

No existing pivot/matrix export exists anywhere in this codebase; this is the one sheet with no direct precedent.

**Cell values, three states per `lib/aanwezigheid.ts`:**
- `aanwezigheidVan(booking, playerId)` returns `'aanwezig'`, `'afwezig'`, or `null` (not yet ticked).
- Sensible xlsx mapping: a `tekst` cell with e.g. `'X'`/`'Aanwezig'` for present, `'-'`/`'Afwezig'` for absent, and an empty cell for unset — **must be decided by the planner as a concrete convention**, not left ambiguous, since a substitute reading a printed sheet needs to fill in blanks manually (D-01's own stated purpose: "vervanger die geen app heeft").

**Shape construction, per lesson group:**
1. For each `LesGroep`, get its lessons in the period via `lessenVanGroep(bookings, group.id)` filtered to the chosen period (reuse `lib/period.ts::bookingsInPeriod` or an equivalent date filter — `lessenVanGroep` itself has no period parameter).
2. Columns = one per distinct lesson date in that filtered set, sorted chronologically (the `Datum` — likely as text label "dd/mm" since a repeating-header multi-group sheet can't use one native Excel date type across differently-grouped column sets without a fully columnar layout; a simpler, defensible approach is one column per lesson **occurrence**, labeled with its date).
3. Rows = the **union of players who appeared in any of those lessons' `participant_ids`/`player_id`** for that group in the period — not `LesGroep.roster`, which is "now," not "then" (Pitfall 1 in PITFALLS.md applies directly here: reading the roster for a past period would show today's roster, not who was actually enrolled in October).
4. Since this is one sheet covering **all** groups (D-01 says "per lesgroep de spelers in de rijen" as one blad, not one blad per group), the sheet needs a **group-name/level column plus a blank separator row** between groups, or a `Groep`-labeled sub-header per block — this layout decision belongs to the planner; `lib/xlsx.ts` supports arbitrary rows/columns so either layout is mechanically possible.

**Printed-empty variant:** The same sheet, generated with all attendance cells forced blank regardless of `bookings.attendance`, is what "leeg afdrukbaar" (EXP-04's requirement) means — this can be achieved two ways: (a) the same sheet function with an `omitAttendance: boolean` flag that always writes empty cells, or (b) documenting that printing the sheet with the "Excel toont dit blanco tenzij ingevuld" property is already true once a substitute simply doesn't fill in the cells before printing (i.e. no code change needed, just a printable, dated grid). **Recommendation for the planner:** treat this as the *same* sheet always generated with real attendance data (never omit real data the admin has), since D-01's wording is about the sheet being usable blank *by a substitute before the lesson*, not about suppressing existing data — this needs explicit confirmation from the user during planning, as it changes whether one function or two variants are needed. Flagged as an Open Question.

### 6. Cell types (EXP-06) — `XlsxCel` handling, verified

From `lib/xlsx.ts:269-283` (`celXml`) and `lib/xlsx.test.ts:207-230`:
- `{ soort: 'datum', waarde: Date }` → `<c s="3"><v>{serial}</v></c>`, styled with `numFmtId="165"` (`dd/mm/yyyy`), via `datumNaarSerie()` which correctly counts from the Excel epoch (30 Dec 1899) including the fake-1900-leap-year offset, and does so on **local calendar day**, not UTC (`datumNaarSerie` uses `getFullYear/getMonth/getDate`) — confirmed by test: identical serial for 08:00 and 23:30 on the same local day.
- `{ soort: 'geld', waarde: number }` → `<c s="2"><v>{n}</v></c>`, styled with `numFmtId="164"` (`#,##0.00`) — a genuine numeric cell, sortable and summable natively.
- Both are proven round-trippable by `xlsx.test.ts` (`buildXlsx` test suite reads its own zip apart via a from-scratch minimal zip reader, verifying `<cellXfs count="4">`, `formatCode="#,##0.00"`, `formatCode="dd/mm/yyyy"` all present, and the cell values themselves).
- **Confirmed: dates and money will sort/sum in Excel with zero user explanation needed** — this is exactly what `lib/xlsx.ts`'s header comment states as its entire reason for existing, and the test suite verifies the underlying claim (numeric `<v>` values, not `t="inlineStr"` text cells).

### 7. Performance

At realistic scale (~1400 rows for one coach's season per `.planning/IMPORT-SJABLOON.md`; "a multiple of that" club-wide, so plausibly 5,000–10,000+ "Lessen" rows for a full club export), the O(n²) traps to avoid — all already correctly avoided by the *existing* code this phase reuses, and must be preserved in new code:

- **Court/user lookup per row:** `lib/csv.ts::csvRows` and `lib/reports.ts::courtsById`/`totalsByPlayer` already build `Map<id, entity>` once before the loop (`nameById`, `rateById`, `courtById`). New sheet-building code (attendance pivot, groups sheet) must follow the identical pattern — build `Map<groupId, LesGroep>`, `Map<courtId, Court>`, etc. once, never `.find()` inside a per-row/per-cell loop.
- **Group lookup per "Lessen" row:** each row needs its group's name/level via `Booking.group_id` — build `Map<string, LesGroep>` from the full `lesGroepen` list once, not `lesGroepen.find(g => g.id === b.group_id)` per row.
- **Attendance pivot's O(groups × lessons × players) shape:** this is inherent to the pivot (not avoidable, and not actually large — at most tens of groups × tens of lessons × single-digit players per group), but building it should still iterate `lessenVanGroep` results once per group (already O(bookings) per group via a single filter/sort) rather than re-filtering the full booking list per player.
- **The multi-row-per-player-in-a-group-lesson expansion for "Lessen" (question 2 above):** expanding one `Booking` into up to N rows (via `lessonPlayerIds`) is O(total participant-lesson pairs), which is the actual row count IMPORT-SJABLOON.md describes (1398 rows for 325 lessons) — this is correct and expected, not a perf bug, but must be built as a single `.flatMap()`-style pass over bookings, not a nested re-scan.

### 8. Delivery — `lib/bestand.ts` vs `lib/share.ts`

**Correction to the phase brief:** `lib/bestand.ts` (as read in full) is exclusively for **reading** a user-supplied file (`kiesTekstbestand`, used by the future import screen) — it has no write/delivery capability at all. The module that actually gets a finished file to the user is **`lib/share.ts`**:
- `shareXlsx(filename, bytes: Uint8Array)` — on web, triggers a `Blob`/`<a download>` download (`kanDownloaden()` checks `Platform.OS === 'web'` + `document`/`Blob` availability); on any other platform, it `throw`s `new Error('Een Excel-bestand delen kan alleen op het web.')`.
- `xlsxWordtOndersteund: boolean` — precomputed at module load (`= kanDownloaden()`), used by screens to **hide** the Excel button entirely on mobile rather than showing it and having it throw — exactly the existing `historiek.tsx` pattern (`{xlsxWordtOndersteund ? <Button .../> : null}`).
- `shareCsv(filename, text)` exists as a fallback that *does* work on mobile (via `Share.share`, text-only) — not applicable to a 4-sheet xlsx (there is no multi-sheet CSV equivalent), so on mobile this phase's export screen should behave like Historiek: no Excel button, and (Claude's discretion, per CONTEXT.md) either no export at all on mobile, or an explanatory note that Excel export is web-only. This must be a planning decision, not assumed silently.

### 9. Screen

No dedicated export screen exists yet. `app/admin/reports.tsx` (read in full) is the closest shape reference: `PeriodPicker` for period selection, `CoachFilter` for scoping (not applicable here — this export always covers all trainers per D-01, not a per-trainer scope), admin/`clubcijfers` gating via `magClubcijfersZien(currentUser)`/`isAdmin`, `Screen` wrapper, `Card` for grouped content, `StatCard`/`StatCardRow` for summary numbers.

`app/agenda/historiek.tsx` is the closer functional reference since it already **is** an export screen: `PeriodPicker` + `xlsxWordtOndersteund`-gated `Button` calling `shareXlsx(filename, toXlsx(rows))`, with an `exportError` local state (distinct from the provider's global `error`) and a try/catch wrapper (`exporteer`) around the async share call.

**Admin boundary (D-06):** follow `app/admin/lesgroepen/index.tsx`'s exact pattern — `if (!isAdmin(currentUser)) return <Screen>...</Screen>` early, **on the screen itself**, not only via a hidden tile in `app/admin/index.tsx`. D-06 explicitly requires this ("wél moet het scherm zelf achter `isAdmin` staan, niet alleen de tegel") since there is no new table/RLS policy to fall back on for this phase.

**Where the screen lives:** Claude's discretion per CONTEXT.md. A new `app/admin/export.tsx` (or `app/admin/export-trainingen.tsx`) with a tile added to `app/admin/index.tsx`'s admin-only tile list (same conditional block used for `lesgroepen`/`leden`) is the natural fit, following the existing one-tile-per-admin-screen convention.

### 10. Scope check — anything really Phase 5/v2 in disguise?

- **EXP-07's round-trip correctness is entirely Phase 4's job**, but its *value* (actually re-importing) is Phase 5 — this phase only needs to produce a file whose columns and `Groep-ID` semantics **match** what Phase 5 will read; it does not implement any reading/parsing logic itself. No scope leak here as written.
- **The `Weeknr`/`Weekdag`/`Locatie`/`Indoor-Outdoor` "written for readability, ignored on import" columns** (per IMPORT-SJABLOON.md itself) are legitimately Phase 4 scope (EXP-02's column list explicitly includes them via the shared template), not v2 — but they should be treated as lower priority within the phase than the columns the *import* actually requires, since a mistake here doesn't threaten EXP-07's round-trip guarantee.
- **No scope creep detected toward v2 items** (RASTER-01, CONTR-01, BERICHT-01, ZIEK-01, INHAAL-01) — none of EXP-01..07 touches messaging, cross-club views, or waitlists.
- **One thing to watch, not scope creep but a sequencing risk:** EXP-03's correctness is *conditional* on Phase 2/2.1/3 work this repo has not yet completed (see Open Questions). The planner should treat "Phase 2/3's payroll wiring is done and `payoutsByCoach` already resolves the effective teacher" as an explicit precondition/dependency check at the start of Phase 4 execution, not something Phase 4 quietly re-implements to route around a gap.

## Project Constraints (from CLAUDE.md / CONVENTIONS.md)

- **Dutch identifiers and comments** for all domain-specific code (functions, types, variables); comments explain *why*, not *what*, per the established house style. English stays for generic/technical vocabulary (`XlsxBlad`, `XlsxCel` already follow this: Dutch domain words, English generic types where needed).
- **Every `lib/*.ts` file needs a matching `lib/*.test.ts`** beside it, with no `jest.mock`/`jest.fn` — pure functions, fixtures as plain objects/arrays, exactly like `lib/lesgroepen.test.ts` and `lib/xlsx.test.ts`.
- **`lib/` never imports from `providers/`, `components/`, or `app/`** — the entire sheet-assembly module must be pure computation over already-loaded arrays (`bookings`, `users`, `courts`, `lesGroepen`), matching `lib/csv.ts`'s existing signature style.
- **File-header comment blocks** (2-6 lines) explaining the module's purpose/boundary, not an API list — required for any new `lib/` file.
- **One rule module per concern** — do not add sheet-assembly logic into `lib/reports.ts`, `lib/payments.ts`, or `lib/csv.ts`; create a new file.
- **No new exports that nothing outside the file uses** — keep internal helpers (e.g. a private `weeknummer()` helper) unexported if only used by their own tests, matching the accepted `sameRow`/`splitEvenly`/`crc32` pattern.
- **Delivery checklist before considering any task done:** `npx tsc --noEmit`, `npm test`, `npx expo export --platform web` — all three, every commit, per `CONVENTIONS.md` and `OPENSTAAND.md`.
- **Dev server talks to real Supabase** — this phase's `lib/` work is pure/no-I/O and safe to test purely with fixtures; no reason to touch the dev server for anything in this phase, since D-06 adds no new table.
- **User-visible strings via `t('Nederlandse zin')`** — any new screen text (button labels, sheet names shown to the user, error messages) must go through `lib/i18n.ts`, matching `historiek.tsx`'s `t()` calls throughout.

## Common Pitfalls

### Pitfall 1: Multi-sheet change silently breaks the existing single-sheet caller

**What goes wrong:** `lib/csv.ts::toXlsx` and `historiek.tsx` call `buildXlsx({ naam, koppen, rijen, breedtes })` today. If `buildXlsx`'s signature is changed in place to take `XlsxBlad[]`, every existing call site and every existing `xlsx.test.ts`/`csv.test.ts` assertion on the current single-sheet shape breaks.

**Why it happens:** The most obvious implementation of "support multiple sheets" is to change the one function that already exists, rather than adding a second one.

**How to avoid:** Add a new function (e.g. `buildWorkbook(bladen: XlsxBlad[])`) that reuses the same internal XML-building helpers, and leave `buildXlsx` and its existing callers/tests untouched. Confirm this decision explicitly during planning (see Open Question).

**Warning signs:** `npx tsc --noEmit` failing in `lib/csv.ts` or `historiek.tsx` after touching `lib/xlsx.ts`; `lib/xlsx.test.ts`'s `buildXlsx` describe block failing.

### Pitfall 2: "Uren per trainer" built against `coach_id` because `lib/lesgever.ts` doesn't exist yet at planning time

**What goes wrong:** Since `lib/lesgever.ts` and the `taught_by_id ?? coach_id` resolution genuinely do not exist in the repo as of this research, a planner or implementer under time pressure could reasonably build "Uren per trainer" against `payoutsByCoach`'s *current* `coach_id`-only behavior and call it done, since it will pass `tsc`/Jest today.

**Why it happens:** Phase 4 is being planned/researched while Phase 2's wiring (and Phase 2.1, Phase 3) are still incomplete in this exact repository, so "what `payoutsByCoach` does" is a moving target between research time and execution time.

**How to avoid:** Treat "Phase 2/2.1/3 have landed and `lib/reports.ts` resolves the effective teacher" as a **precondition check** at the start of Phase 4 execution (grep for `lib/lesgever.ts`'s existence and for `taught_by_id` usage inside `payoutsByCoach`/`totalCoachPayout` before writing the export sheet). If the precondition isn't met, that is a phase-ordering problem to raise, not something to route around locally inside the export module.

**Warning signs:** A new `lib/export-*.ts` file that reads `b.coach_id` directly for pay/hours instead of calling `payoutsByCoach`; `grep -n "taught_by_id" lib/reports.ts` returning nothing at the time this phase is executed.

### Pitfall 3: Confusing `lib/bestand.ts` (reads files) with the actual delivery module

**What goes wrong:** CONTEXT.md and the phase brief both name `lib/bestand.ts` as "hoe een bestand bij de gebruiker terechtkomt" (how a file reaches the user), but that module only *reads* a user-chosen file for import — it has no download/share capability. Building against the wrong module wastes a planning cycle or produces a screen that can't actually deliver the export.

**Why it happens:** Both `lib/bestand.ts` and `lib/share.ts` deal with "files," and the naming similarity plus the CONTEXT.md reference points the wrong way.

**How to avoid:** Use `lib/share.ts::shareXlsx`/`xlsxWordtOndersteund` for delivery, exactly as `historiek.tsx` already does. `lib/bestand.ts` is Phase 5's concern (reading an uploaded training file), not this phase's.

**Warning signs:** Any import of `lib/bestand.ts` inside export-related code.

### Pitfall 4: Attendance pivot reads `LesGroep.roster` instead of historical `participant_ids`

**What goes wrong:** Building "who are the rows" for a past period's attendance sheet by reading `LesGroep.roster` (today's roster) instead of the union of `participant_ids`/`player_id` actually recorded per lesson in that period produces a sheet where a player who joined the group *after* the exported period appears retroactively, and a player who left before the export doesn't appear even though they attended real lessons in the period.

**Why it happens:** `LesGroep.roster` is the obvious, single, already-loaded field to reach for; building the historically-correct row set requires iterating actual bookings in the period instead.

**How to avoid:** Row set = `new Set(lessenVanGroep(bookings, group.id).filter(inPeriod).flatMap(lessonPlayerIds))`, never `group.roster`. This is a direct application of PITFALLS.md's Pitfall 1 and `lib/lesgroepen.ts`'s own header-comment warning.

**Warning signs:** A test where changing a group's current roster changes a *past* period's exported attendance sheet.

### Pitfall 5: `Groep`/`Type les` cell left blank or garbage for a private (ungrouped) lesson on the "Lessen" sheet

**What goes wrong:** IMPORT-SJABLOON.md's entire model assumes every row belongs to a group (the group key `Groep + weekdag + beginuur` is how the importer recognizes rows); a private lesson has no `group_id` and thus no natural `Groep`/`Type les` value, but EXP-02 explicitly requires "groep of speler" in that column — meaning the export's own requirement (show group OR player) already anticipates this case, but IMPORT-SJABLOON.md's spec doesn't define what re-importing such a row should do with an empty `Groep` cell.

**Why it happens:** The two documents (EXP-02's "groep of speler" and IMPORT-SJABLOON.md's group-centric model) were written for slightly different purposes and haven't been reconciled in this phase's context.

**How to avoid:** Surface this as an explicit question during planning/discuss-phase rather than guessing a convention (e.g. putting the player's name in the `Groep` column would make a private lesson round-trip as if it were a group named after a person — likely wrong, but only the user/planner can decide the intended behavior). See Open Questions.

**Warning signs:** A "Lessen" sheet where private-lesson rows have an empty `Groep-ID` and an empty `Groep`/`Type les` cell with no documented meaning for what a re-import should do with that combination.

## Code Examples

### Existing single-sheet xlsx build (the pattern to extend)

```typescript
// Source: lib/csv.ts:168-185 (existing, verbatim)
export function toXlsx(rows: CsvRow[]): Uint8Array {
  return buildXlsx({
    naam: t('Lessen'),
    koppen: csvHeader(),
    breedtes: CSV_COLUMNS.map((c) => c.breedte),
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
  });
}
```

### Existing multi-sheet-shaped cell type contract (unchanged, reused as-is)

```typescript
// Source: lib/xlsx.ts:16-20 (existing)
export type XlsxCel =
  | { soort: 'tekst'; waarde: string }
  | { soort: 'getal'; waarde: number }
  | { soort: 'geld'; waarde: number }
  | { soort: 'datum'; waarde: Date };
```

### Existing screen pattern for period + Excel export (to replicate for the new screen)

```typescript
// Source: app/agenda/historiek.tsx:139-149 (existing)
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

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| One-sheet-only `lib/xlsx.ts` | Multi-sheet workbook | This phase | Enables the four-sheet workbook D-01 requires; must not regress the existing single-sheet caller (`lib/csv.ts`/`historiek.tsx`) |
| `payoutsByCoach` keyed on `coach_id` | Keyed on effective teacher (`taught_by_id ?? coach_id`) | Phase 2/2.1/3 (pending as of this research) | EXP-03 is only correct once this lands — see Pitfall 2 |

**Deprecated/outdated:** None — no library or API in this domain is being deprecated; this is entirely internal, hand-rolled code being extended.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `User` has an `email` field usable for the `E-mail leerling` column | Q2 (column mapping) | If the field name differs, the column mapping code won't compile — low risk, caught immediately by `tsc` |
| A2 | Attendance cell convention (e.g. `'X'`/`'-'`/blank) is acceptable as a first proposal | Q5 (attendance shape) | User may want different symbols/labels; low risk, purely cosmetic, easy to change post-review |
| A3 | The empty-printable "Aanwezigheid" variant means "print the real sheet before filling it in," not "force all cells blank in the file" | Q5 (attendance shape) | If wrong, the planner builds an unnecessary second code path (an `omitAttendance` flag) that duplicates rendering logic |
| A4 | Adding a new `buildWorkbook`-style function is lower-risk than changing `buildXlsx`'s signature in place | Pitfall 1 / Q1 | If the user/planner prefers changing `buildXlsx` directly and updating its 2 call sites, that's also viable — just more files touched in one commit |

**None of these are compliance/security/retention-policy claims** — all are implementation-detail proposals flagged for planner confirmation, not assumed business rules.

## Open Questions

1. **Does `buildXlsx` change signature, or does a new function sit alongside it?**
   - What we know: `buildXlsx` today takes one `XlsxBlad`; two existing call sites (`lib/csv.ts`, indirectly `historiek.tsx`) and their tests depend on that shape.
   - What's unclear: whether the plan should touch those existing call sites (converting them to the new N-sheet API) or leave them alone with a parallel function.
   - Recommendation: default to a new function (`buildWorkbook` or similar) unless the planner has a reason to consolidate; lowest blast radius.

2. **Is Phase 2/2.1/3's `taught_by_id` resolution actually landed by the time Phase 4 executes?**
   - What we know: as of this research, it is not (`lib/lesgever.ts` absent, only its test file present untracked; `lib/reports.ts::payoutsByCoach` keys on `coach_id` only).
   - What's unclear: whether Phase 4 will actually execute after Phase 3 completes (per roadmap order) or whether phases are being planned out of strict sequence.
   - Recommendation: the plan should include an explicit precondition/verification task ("confirm `lib/reports.ts` resolves the effective teacher before building EXP-03") rather than silently building against `coach_id`.

3. **What goes in "Groep"/"Type les" on the "Lessen" sheet for a private (ungrouped) lesson?**
   - What we know: EXP-02 says the column shows "groep of speler"; IMPORT-SJABLOON.md's model has no defined behavior for an ungrouped row in that column.
   - What's unclear: the intended re-import behavior for such a row.
   - Recommendation: raise explicitly with the user during plan review before finalizing the "Lessen" column-mapping code.

4. **What does "leeg afdrukbaar" (EXP-04) actually require — a suppress-data mode, or just a usable blank-friendly layout?**
   - What we know: D-01's own text frames it as "why this sheet exists" (a substitute without the app can use it), suggesting the normal sheet (with real data, or genuinely empty for a future/unstarted period) already satisfies this.
   - What's unclear: whether a literal "force all cells blank regardless of stored attendance" toggle is wanted.
   - Recommendation: confirm with the user before building an extra code path.

5. **What is `Locatie`'s intended content?**
   - What we know: IMPORT-SJABLOON.md lists it as "genegeerd bij het inlezen; wél geschreven bij de export omdat ze het bestand leesbaar maken," but doesn't say what value belongs there for this club (it's presumably free text like "Tennisclub X, Baan 3" in `koen.xlsx`, but no field in this codebase's data model currently stores anything matching that).
   - What's unclear: whether to leave it blank, derive something from `Court`, or ask the user for a club-level setting.
   - Recommendation: leave blank unless the user specifies a source; do not invent a value.

## Environment Availability

Not applicable — this phase has no external tool/service/runtime dependencies beyond the existing Expo/Node toolchain already used by every other phase (`npx tsc --noEmit`, `npm test`, `npx expo export --platform web`), which are already confirmed working throughout this repository's history (every prior phase's SUMMARY.md reports these three commands passing).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest (via `jest-expo` preset), already configured; 1024+ tests currently passing, entirely in `lib/` |
| Config file | `package.json` (`jest` block) / `jest-expo` preset — no dedicated `jest.config.js` found separately from what's already used by every existing `lib/*.test.ts` |
| Quick run command | `npx jest lib/xlsx` / `npx jest lib/export-trainingen` (name TBD) |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EXP-01 | One file, four sheets produced for a period | unit | `npx jest lib/export-trainingen -t "vier bladen"` | ❌ Wave 0 (new test file) |
| EXP-02 | "Lessen" sheet exact column set incl. `Groep-ID`, group lesson expands to N rows | unit | `npx jest lib/export-trainingen -t "Lessen"` | ❌ Wave 0 |
| EXP-03 | "Uren per trainer" matches `payoutsByCoach` for the same bookings, no revenue column | unit | `npx jest lib/export-trainingen -t "Uren per trainer"` | ❌ Wave 0 |
| EXP-04 | "Aanwezigheid" pivot uses historical `participant_ids`, not current roster | unit | `npx jest lib/export-trainingen -t "Aanwezigheid"` | ❌ Wave 0 |
| EXP-05 | "Groepen" one row per group with correct counts + `Groep-ID` | unit | `npx jest lib/export-trainingen -t "Groepen"` | ❌ Wave 0 |
| EXP-06 | Amounts/dates are real numeric/date cells in every sheet, not text | unit (extends existing `xlsx.test.ts` pattern) | `npx jest lib/xlsx` | ✅ pattern exists, ❌ new multi-sheet assertions |
| EXP-07 | A "Lessen" sheet, read back apart, contains exactly IMPORT-SJABLOON.md's required columns with correct header labels and values | unit (round-trip, same technique as `xlsx.test.ts`'s own zip reader) | `npx jest lib/export-trainingen -t "round-trip"` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx jest lib/xlsx lib/export-trainingen` (or whatever the new module is named) + `npx tsc --noEmit`
- **Per wave merge:** `npm test` (full suite — must stay green, currently 1024+ tests)
- **Phase gate:** Full suite green, plus `npx expo export --platform web`, before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `lib/xlsx.test.ts` — extend with multi-sheet assertions (workbook.xml lists N sheets, N worksheet parts exist in the zip, content-types lists all N)
- [ ] New `lib/export-trainingen.ts` + `lib/export-trainingen.test.ts` — the four-sheet assembly and its round-trip test, following `xlsx.test.ts`'s own zip-reading test pattern exactly (read the built file back apart with a from-scratch minimal reader, not trust the writer's own internal state)
- [ ] No framework install needed — Jest/jest-expo already fully configured and used by 1024+ existing tests

**Manual-only steps (cannot be caught by `tsc`/Jest):**
- Opening the actual generated `.xlsz`/`.xlsx` file in real Excel/LibreOffice/Numbers to visually confirm: four tabs appear with the right names, in the right order; dates display as dates (not serial numbers); amounts sum correctly when the user selects a column; the attendance sheet's blank cells are genuinely blank (not `0` or `"undefined"`); the frozen header row and autofilter work per-sheet, not only on the first sheet.
- Verifying the admin-only screen boundary by attempting to navigate to the export URL as a non-admin user (mirrors the existing manual check pattern for `app/admin/lesgroepen/index.tsx`).
- Confirming the mobile behavior (no crash, sensible fallback message or hidden button) on an actual phone/simulator, since `xlsxWordtOndersteund` branches on `Platform.OS` which Jest's `jest-expo` preset may not exercise identically to a real device.

## Security Domain

`security_enforcement` presumed enabled (absent from context; treat as default-on per protocol), but this phase adds **no new table, no new RLS policy, and no new network endpoint** (D-06 explicitly states this). The only access-control surface is the screen-level `isAdmin(currentUser)` gate.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No new auth surface; relies entirely on existing session/login |
| V3 Session Management | no | Unchanged |
| V4 Access Control | yes | Screen-level `isAdmin(currentUser)` check, mirroring `app/admin/lesgroepen/index.tsx`'s exact pattern — this is the *only* enforcement point since there's no new table/RLS to fall back on |
| V5 Input Validation | minimal | Period picker inputs already validated by existing `lib/period.ts::parseDayInput`/`customPeriod` (reused, not new) |
| V6 Cryptography | no | No new secrets/tokens; xlsx bytes are not encrypted (unnecessary — this is an internal admin export of the club's own data, not a cross-tenant boundary) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A non-admin navigates directly to the export screen's URL, bypassing a hidden tile | Elevation of Privilege | Screen-level `isAdmin` early-return, exactly as `app/admin/lesgroepen/index.tsx` already does — **not** relying on the tile being hidden in `app/admin/index.tsx` |
| Attendance sheet exposes another player's attendance to a non-admin somehow reaching the data | Information Disclosure | Since the screen is admin-gated entirely and the data is loaded via the same `useSimpleData()` context every other admin screen uses (already RLS-protected at the Supabase layer for non-admins), no new exposure surface is introduced as long as the screen gate is correctly in place |

## Sources

### Primary (HIGH confidence — read directly, this repository)
- `lib/xlsx.ts`, `lib/xlsx.test.ts` — full read, verbatim code and test assertions cited above
- `lib/csv.ts` — full read, existing single-sheet export pattern
- `lib/reports.ts`, `lib/payments.ts` — full read, payroll/revenue calculation source of truth
- `lib/aanwezigheid.ts` — full read, three-state attendance model
- `lib/period.ts` — full read, period selection/filename/label logic
- `lib/lesgroepen.ts`, `lib/groups.ts` — full read, group/roster/participant model
- `lib/share.ts`, `lib/bestand.ts` — full read, delivery vs. import-reading distinction
- `lib/types.ts` (`Booking`, `LesGroep`, `Court`, `User` fragments), `lib/status.ts` — full/partial read, data model fields
- `app/admin/reports.tsx`, `app/agenda/historiek.tsx`, `app/admin/lesgroepen/index.tsx`, `app/admin/index.tsx` — full/partial read, screen shape and admin-gate patterns
- `.planning/IMPORT-SJABLOON.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/phases/04-excel-export/04-CONTEXT.md` — full read, binding requirements/decisions
- `.planning/phases/01-lesgroepen/01-01-SUMMARY.md`, `01-03-SUMMARY.md`, `.planning/phases/02-wie-gaf-de-les-echt/02-02-SUMMARY.md` — full read, confirming actual landed state of `LesGroep`/`taught_by_id`
- `.planning/codebase/CONVENTIONS.md`, `.planning/research/PITFALLS.md`, `OPENSTAAND.md` — full read, house rules and pre-identified risks for this exact milestone
- `git log`, `git status`, `ls lib/` — verified `lib/lesgever.ts` does not yet exist; `lib/lesgever.test.ts` is untracked

### Secondary (MEDIUM confidence)
None — no external web sources were needed or consulted; this phase is entirely internal to the existing, fully-readable codebase and its own planning documents.

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, every claim verified by reading the actual source
- Architecture: HIGH — multi-sheet xlsx change scoped exactly against the real `buildXlsx` source; all reuse targets read in full
- Pitfalls: HIGH for codebase-specific findings (taught_by_id gap, roster-vs-participant_ids, bestand.ts-vs-share.ts confusion — all directly observed in source); the attendance-sheet layout and private-lesson column questions are correctly flagged as open rather than guessed

**Research date:** 2026-09-06
**Valid until:** Effectively pinned to this repository's own state — re-verify the `lib/lesgever.ts`/`taught_by_id` precondition (Open Question 2) at the start of Phase 4 execution regardless of elapsed time, since it depends on Phase 2/2.1/3 completion, not calendar time.
