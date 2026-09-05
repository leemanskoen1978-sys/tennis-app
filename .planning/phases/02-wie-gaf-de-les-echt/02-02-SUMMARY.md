---
phase: 02-wie-gaf-de-les-echt
plan: 02
subsystem: database
tags: [postgres, supabase, rls, sql-migration, trigger, security]

requires:
  - phase: 01-lesgroepen
    provides: het append-only staartblok-patroon (lesson_groups/group_id) als vormvoorbeeld
provides:
  - "bookings.taught_by_id kolom + index als tekst onderaan supabase-schema.sql, nog niet gedraaid"
  - "bewaak_betaalvelden vervangen met een beheerdersgrens op taught_by_id vóór de coach-uitzondering"
affects: [02-wie-gaf-de-les-echt plan 01 (lib/lesgever.ts leest deze kolom), plan 03/04 (verdere wiring en migratie zelf draaien)]

tech-stack:
  added: []
  patterns:
    - "vroege guard vóór een bestaande early-return-bypass, in plaats van toevoegen aan de bestaande uitsluitingslijst — de enige manier om een kolom strenger te maken dan de rij zelf"

key-files:
  created: []
  modified:
    - supabase-schema.sql

key-decisions:
  - "De nieuwe taught_by_id-controle staat vóór `if is_admin() or old.coach_id = app_user_id()`, niet erna en niet in de to_jsonb-uitsluitingslijst — anders kan de trainer van de les zijn eigen loon zetten"
  - "on delete set null, niet cascade: een verwijderde invaltrainer laat de les bestaan en valt terug op coach_id"
  - "Geen tweede trigger en geen RLS-policy: de bestaande trigger bookings_betaalvelden_bewaakt blijft de enige kolomgrens (D-09)"

patterns-established:
  - "Voor elk toekomstig loongevoelig veld: een expliciete vroege guard in bewaak_betaalvelden, vóór de coach-bypass, nooit in de rij-brede uitsluitingslijst"

requirements-completed: [VERV-01]

duration: 12min
completed: 2026-09-06
---

# Phase 02 Plan 02: Wie gaf de les écht — schema en beheerdersgrens Summary

**bookings.taught_by_id (kolom + index) en een vervangen bewaak_betaalvelden waarin de beheerdersgrens op dat veld vóór de bestaande "trainer mag alles"-regel staat — alles als tekst, niets uitgevoerd.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-09-06T—
- **Completed:** 2026-09-06T—
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- `alter table bookings add column if not exists taught_by_id text references users(id) on delete set null;` + `create index if not exists bookings_taught_by_idx on bookings (taught_by_id);`, onder een Nederlands commentaar dat uitlegt wat leeg betekent (D-02), waarom `coach_id` nooit verandert, en waarom `on delete set null` in plaats van `cascade`, met verwijzing naar `lib/lesgever.ts`.
- `bewaak_betaalvelden` volledig herhaald met precies één toevoeging: een controle die opwerpt als `new.taught_by_id is distinct from old.taught_by_id and not is_admin()`, geplaatst **direct na** `if auth.uid() is null then return new; end if;` en **vóór** `if is_admin() or old.coach_id = app_user_id() then return new; end if;`.
- Alle vier bestaande controles (rij-vergelijking, betaalwijzeregel, drie aanwezigheidsregels) letterlijk overgenomen — vijf `raise exception`-blokken in het nieuwe blok (vier bestaand + één nieuw).
- Commentaar boven het nieuwe blok verwijst expliciet terug naar het `lesson_groups`-commentaar en legt uit waarom die redenering (`group_id` had geen triggerwijziging nodig) hier NIET opgaat: `taught_by_id` is loongevoelig, `group_id` niet.

## Exacte SQL en regelnummers (bewijs van de volgorde)

Toegevoegd in twee commits onderaan `supabase-schema.sql`. Het bestand telt nu 1010 regels.

**Kolom + index** (regels 953-954, na het commentaar op regels 942-948):
```sql
alter table bookings add column if not exists taught_by_id text references users(id) on delete set null;
create index if not exists bookings_taught_by_idx on bookings (taught_by_id);
```

**Vervangen functie** (`create or replace function bewaak_betaalvelden()` op regel 962, tweede voorkomen in het bestand — het eerste, oorspronkelijke staat op regel 411):

```sql
create or replace function bewaak_betaalvelden()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mijn text[];
  vandaag timestamptz;
begin
  if auth.uid() is null then return new; end if;

  if new.taught_by_id is distinct from old.taught_by_id and not is_admin() then
    raise exception 'Alleen een beheerder kan invullen wie de les werkelijk gaf.';
  end if;

  if is_admin() or old.coach_id = app_user_id() then return new; end if;

  if (to_jsonb(new) - 'payment_method' - 'beurtenkaart_id' - 'attendance')
     is distinct from (to_jsonb(old) - 'payment_method' - 'beurtenkaart_id' - 'attendance') then
    raise exception 'Alleen de betaalwijze en je eigen aanwezigheid mag je zelf wijzigen.';
  end if;

  if (new.payment_method is distinct from old.payment_method
      or new.beurtenkaart_id is distinct from old.beurtenkaart_id)
     and not (old.player_id = app_user_id() or is_mijn_kind(old.player_id)) then
    raise exception 'De betaalwijze zet de speler die de rekening krijgt.';
  end if;

  if new.attendance is distinct from old.attendance then
    vandaag := date_trunc('day', now() at time zone 'Europe/Brussels') at time zone 'Europe/Brussels';
    if old.start_time < vandaag then
      raise exception 'Wie er bij een les uit het verleden stond, noteert de trainer.';
    end if;
    mijn := array(
      select coalesce(app_user_id(), '')
      union
      select child_id from ouder_kind
        where parent_id = app_user_id() and status = 'approved'
    );
    if (coalesce(new.attendance, '{}'::jsonb) - mijn)
       is distinct from (coalesce(old.attendance, '{}'::jsonb) - mijn) then
      raise exception 'Je past alleen je eigen aanwezigheid aan.';
    end if;
  end if;

  return new;
end;
$$;
```

**Regelnummer-bewijs van de volgorde** (binnen dit tweede voorkomen van de functie):
- Regel **974**: `if new.taught_by_id is distinct from old.taught_by_id and not is_admin() then`
- Regel **978**: `if is_admin() or old.coach_id = app_user_id() then return new; end if;`

974 < 978 — de beheerdersgrens staat vóór de coach-uitzondering, exact zoals D-08 vereist. Ter vergelijking staat dezelfde coach-uitzondering in de oorspronkelijke, ongewijzigde functie op regel 424 (geen `taught_by_id`-controle ervoor, want die kolom bestond daar nog niet — dat is precies waarom de vervangende functie onderaan nodig was).

**Tellingen van bestaande bewakingen** (moeten ongewijzigd blijven):
- `raise exception` in het tweede (nieuwe) blok: **5** (4 bestaand + 1 nieuw) — geverifieerd met `awk` op het tweede voorkomen van de functienaam.
- `raise exception` in het eerste (oude, ongewijzigde) blok: **4** — ongewijzigd, want dat blok wordt vervangen, niet bewerkt.
- Uitsluitingslijst `to_jsonb(new) - 'payment_method' - 'beurtenkaart_id' - 'attendance'`: **2×** in het bestand (oud + nieuw blok), **geen enkele keer** met `taught_by_id` erbij.
- `create trigger bookings_betaalvelden_bewaakt`: **1×** — geen tweede trigger toegevoegd.

## Task Commits

1. **Taak 1: De kolom als alter table-blok onderaan het bestand** - `48ddb3b` (feat)
2. **Taak 2: De trigger, met de beheerdersgrens vóór de trainersuitzondering** - `f6fe109` (feat)

**Plan metadata:** (dit document + STATE.md wordt apart gecommit)

## Files Created/Modified

- `supabase-schema.sql` - nieuw staartblok: `bookings.taught_by_id`-kolom + index, en een vervangende `bewaak_betaalvelden` met de beheerdersgrens vóór de coach-bypass.

## Decisions Made

- De nieuwe controle staat als eigen `if`-blok direct na de sessie-check en vóór de coach-bypass — niet toegevoegd aan de bestaande `to_jsonb`-uitsluitingslijst, want die lijst vuurt alleen voor niet-coach/niet-beheerder-actoren en zou het probleem net omgekeerd hebben opgelost.
- Geen tweede trigger, geen RLS-wijziging: `bookings_update` liet de beheerder en de trainer van de rij al toe; de trigger is en blijft de enige kolomgrens in dit schema.
- `on delete set null` gekopieerd van het bestaande `court_id`-patroon (regel 71), niet `cascade`: een verwijderde invaltrainer laat de les bestaan.
- De twee taken zijn los gecommit (kolom eerst, dan de vervangende functie) zodat elke taak zijn eigen, individueel controleerbare commit heeft, ook al vormen ze samen één staartblok.

## Deviations from Plan

None - plan uitgevoerd exact zoals geschreven. Het toegevoegde blok is woordelijk het "Full recommended append block" uit `02-PATTERNS.md`.

## Issues Encountered

Geen. Alle acceptatiecriteria uit het plan zijn met grep/awk geverifieerd vóór het committen (zie regelnummer-bewijs hierboven).

## User Setup Required

None - dit blok is tekst. De gebruiker draait de migratie zelf in de SQL-editor van Supabase in een later plan (D-10). Er is niet verbonden met Supabase en er is geen SQL uitgevoerd tijdens dit plan.

## Next Phase Readiness

- `lib/lesgever.ts` (plan 01) kan nu tegen deze kolomnaam en semantiek plannen: leeg betekent "de vaste trainer gaf hem zelf".
- Plan 03/04 kunnen dit blok direct kopiëren naar de SQL-editor en de trigger-volgorde handmatig herverifiëren vóór het draaien.

---
*Phase: 02-wie-gaf-de-les-echt*
*Completed: 2026-09-06*

## Self-Check: PASSED
- FOUND: supabase-schema.sql (bevat `taught_by_id` op regel 953 en 974)
- FOUND: 48ddb3b (task 1 commit)
- FOUND: f6fe109 (task 2 commit)
- `grep -c "create or replace function bewaak_betaalvelden" supabase-schema.sql` → 2
- Regel 974 (`new.taught_by_id`) < regel 978 (`old.coach_id = app_user_id()`) → volgorde correct
