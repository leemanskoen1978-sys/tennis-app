-- Migratie voor de tennisschool-module.
-- Plak dit blok in de Supabase SQL-editor en draai het een keer.
-- Alles is 'if not exists' / 'create or replace': twee keer draaien kan geen kwaad.
-- Gegenereerd op 2026-09-06 uit supabase-schema.sql.


-- ---------------------------------------------------------------------------
-- Lesgroepen
-- ---------------------------------------------------------------------------

-- Een lesgroep is een blijvend gegeven — naam, niveau, vaste dag en uur, trainer, baan,
-- seizoen en de lijst spelers die erin zitten — los van de losse les die er elke week uit
-- ontstaat. Zie D-01/D-02 in .planning/phases/01-lesgroepen/01-CONTEXT.md. `roster` staat
-- als jsonb en niet als koppeltabel, om dezelfde reden als ontwerpkeuze 3 bovenaan dit
-- bestand: die lijst wordt nooit los van zijn groep opgevraagd of gewijzigd, altijd samen
-- met de groep erbij — een eigen tabel zou dus alleen een join per scherm opleveren.
--
-- Alleen de beheerder ziet en beheert deze tabel — dezelfde grens als `coach_rates`
-- hierboven, en om dezelfde reden geen "created_by"-kolom of -conditie: géén van beide
-- policies hieronder verwijst naar wie een rij ooit gemaakt heeft. Dat is met opzet. Lees
-- eerst het commentaar boven `bookings_insert` voordat je hier een eigenaarscontrole aan
-- toevoegt: de app schrijft met een upsert, Postgres toetst de `with check` ook bij een
-- latere wijziging, en alles wat hier over de máker van de rij geëist wordt, geldt dus ook
-- voor iedere volgende beheerder die de rij aanpast. Precies die val brak `bookings_insert`
-- ooit stilzwijgend, en dit project is er al twee keer stilzwijgend door geraakt — vandaar
-- de vorm van `rates_write`, niet van `rates_select`.
--
-- `bewaak_betaalvelden` hoeft niet aangepast te worden voor de nieuwe kolom `group_id` op
-- `bookings`. Die trigger vergelijkt de hele rij minus `payment_method`, `beurtenkaart_id`
-- en `attendance`, dus `group_id` valt vanzelf onder "mag een speler niet wijzigen" — en de
-- beheerder en de trainer van de les mogen sowieso al alles, want die twee staan bovenaan de
-- functie al langs. Wie de groep van een les verzet, is per definitie een van die twee.
create table if not exists lesson_groups (
  id text primary key,
  name text not null,
  level text not null,
  weekday int not null check (weekday between 0 and 6),
  start_hour int not null check (start_hour between 0 and 23),
  start_minute int not null default 0 check (start_minute between 0 and 59),
  coach_id text references users(id) on delete set null,
  court_id text references courts(id) on delete set null,
  season_start date not null,
  season_end date not null,
  roster jsonb not null default '[]'::jsonb,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

alter table bookings add column if not exists group_id text references lesson_groups(id) on delete set null;
create index if not exists bookings_group_idx on bookings (group_id);

alter table lesson_groups enable row level security;

drop policy if exists lesson_groups_select on lesson_groups;
create policy lesson_groups_select on lesson_groups for select
  to authenticated using (is_admin());
drop policy if exists lesson_groups_write on lesson_groups;
create policy lesson_groups_write on lesson_groups for all
  to authenticated using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- Wie gaf de les écht
-- ---------------------------------------------------------------------------

-- Leeg betekent "de vaste trainer (coach_id) gaf de les zelf" (D-02). coach_id verandert
-- hierdoor NOOIT: dat blijft van wie de les is — zijn agenda, zijn rooster, zijn dubbele-
-- boekingscontrole. taught_by_id is alleen het antwoord op "wie stond er echt op de baan",
-- en dat antwoord is de enige plek waar loon, uren en het trainersrapport naar kijken (zie
-- lib/lesgever.ts). `on delete set null`, niet `cascade`: verwijdert de club een trainer die
-- ooit inviel, dan verdwijnt de les niet — hij valt terug op "de vaste trainer gaf hem zelf",
-- precies zoals een lege waarde altijd al betekende.
alter table bookings add column if not exists taught_by_id text references users(id) on delete set null;
create index if not exists bookings_taught_by_idx on bookings (taught_by_id);

-- Loongevoelig: alleen de beheerder mag invullen wie een les werkelijk gaf. Dit hoort bij
-- bewaak_betaalvelden (dezelfde bewaking als payment_method), niet bij een nieuwe trigger
-- ernaast (D-09). Belangrijk: dit MOET vóór de bestaande regel "de trainer van deze les mag
-- alles" komen — die regel is precies waarom group_id destijds GEEN aanpassing nodig had
-- (zie het commentaar boven `lesson_groups` hierboven) en waarom taught_by_id die WEL nodig
-- heeft: de trainer van de les mag hier expliciet niet alles.
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

-- ---------------------------------------------------------------------------
-- Ziekmeldingen
-- ---------------------------------------------------------------------------

-- Een ziekmelding is een periode op een trainer, los van zijn boekingstijden
-- (users.booking_periods) en los van de clubvakanties. Zie D-03 in
-- .planning/phases/03-ziekmelding-en-vervangerswerklijst/03-CONTEXT.md: een
-- boekingsperiode is vooruit gepland ("hij geeft die weken geen les"), een ziekmelding is
-- een gebeurtenis met lessen die al gepland stonden en nu opgelost moeten worden. Ze staan
-- daarom in een eigen tabel, niet als extra velden op `booking_periods`.
--
-- `retracted_at` in plaats van verwijderen: intrekken (D-02/VERV-10) is iets dat gebeurd
-- is en blijft zichtbaar. Een ziekmelding met `retracted_at` gezet telt nergens meer mee
-- als "open" — niet in de werklijst, niet in het vervangersvoorstel — maar de rij zelf
-- blijft bestaan.
--
-- Alleen de beheerder ziet en beheert deze tabel — dezelfde grens als `coach_rates` en
-- `lesson_groups`, en om dezelfde reden geen "created_by"-kolom of -conditie: géén van
-- beide policies hieronder verwijst naar wie een rij ooit gemaakt heeft. Dat is met opzet.
-- Lees eerst het commentaar boven `bookings_insert` voordat je hier een eigenaarscontrole
-- aan toevoegt: de app schrijft met een upsert, Postgres toetst de `with check` ook bij een
-- latere wijziging, en alles wat hier over de máker van de rij geëist wordt, geldt dus ook
-- voor iedere volgende beheerder die de rij aanpast. Precies die val brak `bookings_insert`
-- ooit stilzwijgend, en dit project is er al twee keer stilzwijgend door geraakt.
--
-- coach_id gebruikt hier `on delete cascade`, niet `on delete set null` zoals
-- `lesson_groups.coach_id` hierboven: een ziekmelding heeft geen betekenis meer zodra zijn
-- trainer weg is, terwijl een les moet blijven bestaan en terugvalt op "de vaste trainer
-- gaf hem zelf" (zie het `taught_by_id`-commentaar hierboven). Dat verschil is bewust.
--
-- Dit blok draait de gebruiker zelf (D-14) — geen enkele taak in deze fase voert het uit of
-- legt een verbinding met Supabase. Zolang het niet gedraaid is, moet de app blijven
-- werken: `providers/supabaseStore.ts` leest deze tabel daarom met `selectAllOptioneel`,
-- niet met `selectAll`.
create table if not exists sick_leaves (
  id text primary key,
  coach_id text not null references users(id) on delete cascade,
  van date not null,
  tot date not null,
  reden text,
  created_at timestamptz not null default now(),
  retracted_at timestamptz
);

create index if not exists sick_leaves_coach_idx on sick_leaves (coach_id);

alter table sick_leaves enable row level security;

drop policy if exists sick_leaves_select on sick_leaves;
create policy sick_leaves_select on sick_leaves for select
  to authenticated using (is_admin());
drop policy if exists sick_leaves_write on sick_leaves;
create policy sick_leaves_write on sick_leaves for all
  to authenticated using (is_admin()) with check (is_admin());


-- ---------------------------------------------------------------------------
-- Banen: schrijven is voortaan van de beheerder
-- ---------------------------------------------------------------------------

-- `courts_write` stond op `is_coach()`: elke trainer kon het uurtarief van een baan
-- aanpassen. Dat tarief is wat een speler per uur betaalt — het is geld, en geld is van de
-- beheerder. `courts_select` blijft ongemoeid: iedereen moet banen kunnen lezen, anders
-- ziet een speler niet meer op welke baan hij staat en breekt het boeken van een les.
drop policy if exists courts_write on courts;
create policy courts_write on courts for all
  to authenticated using (is_admin()) with check (is_admin());
