-- Tennis App — Supabase-schema.
--
-- Voer dit uit in de SQL-editor van je Supabase-project (Database → SQL editor → New query,
-- alles plakken, Run). Zet daarna de project-URL en de anon key in .env; zie .env.example.
-- Het script is idempotent: je mag het opnieuw draaien na een wijziging.
--
-- Drie keuzes die de rest van dit bestand verklaren:
--
-- 1. Sleutels zijn `text`, niet `uuid`. De app maakt zijn eigen id's ("b-m1k2j3-x9y") en doet
--    dat al sinds de eerste versie; ze zijn uniek en leesbaar in een foutmelding. Zou de
--    databank ze uitdelen, dan moest elke schrijfactie eerst wachten op een antwoord voordat
--    het scherm iets kon tonen.
--
-- 2. Een gebruiker en zijn login zijn twee dingen. `users.auth_id` wijst naar `auth.users`,
--    maar mag leeg zijn: een trainer voegt een speler toe die nog nooit ingelogd heeft, en
--    die speler bestaat dan al met lessen en al. Logt hij later voor het eerst in, dan wordt
--    zijn account aan die bestaande rij gekoppeld op e-mailadres (zie `link_auth_user`).
--    Was de login zelf de sleutel geweest, dan had zo'n speler geen dossier kunnen hebben.
--
-- 3. Lijstjes die alleen als geheel betekenis hebben (de beurten van een kaart, de oefeningen
--    van een training, de deelnemers van een groepsles) staan als jsonb en niet in een eigen
--    tabel. Ze worden nooit los opgevraagd of los gewijzigd — altijd samen met hun les of
--    kaart — dus een aparte tabel zou alleen maar een join per scherm opleveren.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------------

create table if not exists users (
  id text primary key,
  auth_id uuid unique references auth.users(id) on delete set null,
  email text unique not null,
  name text not null,
  role text not null check (role in ('player','coach','parent')),
  phone text,
  bio text,
  preferred_court_id text,
  working_hours jsonb,
  working_days jsonb,
  notification_settings jsonb,
  hourly_rate numeric,
  default_payment_method text check (default_payment_method in
    ('open','cash','invoice','qr','beurtenkaart','sponsor')),
  sponsor_budget numeric,
  created_at timestamptz not null default now()
);

create table if not exists courts (
  id text primary key,
  name text not null,
  number int not null,
  indoor boolean not null default false,
  hourly_rate numeric not null default 0,
  -- De groepstaffel: [{max_players, rate}]. `rate` is het TOTAAL van de les, niet per speler.
  group_rates jsonb,
  created_at timestamptz not null default now()
);

create table if not exists bookings (
  id text primary key,
  -- De speler die betaalt. Ook bij een groepsles: één les, één rekening.
  player_id text not null references users(id) on delete cascade,
  -- De medespelers, zonder de betaler. Zie lib/groups: alleen dáár wordt de groepsgrootte
  -- uitgerekend, hier staat enkel wie erbij stond.
  participant_ids jsonb,
  coach_id text not null references users(id) on delete cascade,
  court_id text references courts(id) on delete set null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status text not null check (status in ('pending','confirmed','cancelled','completed','synchronized')),
  payment_method text not null default 'open' check (payment_method in
    ('open','cash','invoice','qr','beurtenkaart','sponsor')),
  beurtenkaart_id text,
  payment_split text check (payment_split in ('together','separate')),
  series_id text,
  notes text,
  -- Wie de les aanmaakte. Bepaalt of hij meteen vaststaat of eerst goedgekeurd moet worden.
  created_by text references users(id) on delete set null,
  actual_start_time timestamptz,
  actual_end_time timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists bookings_coach_start_idx on bookings (coach_id, start_time);
create index if not exists bookings_player_start_idx on bookings (player_id, start_time);
create index if not exists bookings_series_idx on bookings (series_id);

create table if not exists lessons (
  id text primary key,
  title text not null,
  url text,
  description text,
  uploaded_by text references users(id) on delete set null,
  student_id text references users(id) on delete cascade,
  coach_id text references users(id) on delete set null,
  status text check (status in ('gepland','gegeven')),
  -- PDF's: [{id,name,mime,size,source,uri,drive_file_id}] — zie docs/lesson-attachments.md.
  attachments jsonb,
  -- Een veldsituatie wordt als scène bewaard (strokes + objecten), niet als plaatje: zo
  -- blijft hij scherp op elk scherm en kan hij later opnieuw geopend worden.
  drawing jsonb,
  explanation jsonb,
  -- Eigen tags van de trainer. De rest leidt lib/tags af uit de tekst.
  tags jsonb,
  training_number int,
  duration_minutes int,
  focus_points jsonb,
  materials jsonb,
  exercises jsonb,
  created_at timestamptz not null default now()
);

create index if not exists lessons_student_idx on lessons (student_id);

create table if not exists student_progress (
  id text primary key,
  student_id text not null references users(id) on delete cascade,
  coach_id text not null references users(id) on delete cascade,
  training_type text not null check (training_type in ('techniek','tactiek','fysiek','mentaal','match')),
  notes text,
  rating int,
  skills jsonb,
  homework text,
  voice_memo_uri text,
  lesson_id text references lessons(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists student_progress_student_idx on student_progress (student_id);

create table if not exists player_goals (
  id text primary key,
  student_id text not null references users(id) on delete cascade,
  horizon text not null check (horizon in ('lessons10','lessons20','season')),
  shot_type text,
  change_type text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists player_goals_student_idx on player_goals (student_id);

create table if not exists beurtenkaarten (
  id text primary key,
  player_id text not null references users(id) on delete cascade,
  total_sessions int not null default 10,
  remarks text,
  -- De gebruikte beurten als lijst en niet als teller: zo blijft de geschiedenis zichtbaar
  -- en kan een beurt bij annulering terug. [{booking_id, date}]
  uses jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists beurtenkaarten_player_idx on beurtenkaarten (player_id);

-- De instellingen van de club: één rij, en dat wordt afgedwongen met een vaste sleutel.
-- Een tabel met per ongeluk twee rijen instellingen is een bron van "bij mij staat er iets
-- anders" die niemand ooit terugvindt.
create table if not exists club_settings (
  id text primary key default 'club' check (id = 'club'),
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Welke meegeleverde lessenreeksen al zijn toegevoegd. Zonder dit zou een training die de
-- trainer bewust weggooide bij elke start terugkomen.
create table if not exists installed_catalogues (
  id text primary key,
  installed_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Wie ben ik — één keer uitgerekend, door elke policy hieronder gebruikt
-- ---------------------------------------------------------------------------

-- `stable` en `security definer`: de functie moet de users-tabel kunnen lezen zonder zelf
-- weer door RLS te gaan (dat zou zichzelf aanroepen), en het antwoord verandert niet binnen
-- één query.
create or replace function app_user_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select id from users where auth_id = auth.uid();
$$;

create or replace function is_coach()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from users where auth_id = auth.uid() and role = 'coach');
$$;

-- Speelt de ingelogde gebruiker mee in deze les? De betaler staat apart van de medespelers,
-- dus beide kanten tellen — dezelfde regel als `playsIn` in lib/groups.
create or replace function plays_in(b bookings)
returns boolean
language sql
stable
as $$
  select b.player_id = app_user_id()
      or coalesce(b.participant_ids, '[]'::jsonb) ? app_user_id();
$$;

-- ---------------------------------------------------------------------------
-- Nieuwe login aan een bestaande gebruiker koppelen
-- ---------------------------------------------------------------------------

-- Meldt iemand zich aan met een e-mailadres dat de trainer al had ingevoerd, dan krijgt die
-- bestaande rij zijn login — met zijn lessen, zijn beurtenkaart en zijn dossier eraan vast.
-- Bestaat het adres nog niet, dan komt er een nieuwe speler bij. Een trainer wordt nooit
-- vanzelf aangemaakt: die rol geef je bewust, in Beheer.
create or replace function link_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update users
     set auth_id = new.id
   where lower(email) = lower(new.email)
     and auth_id is null;

  if not found then
    insert into users (id, auth_id, email, name, role)
    values (
      'u-' || replace(new.id::text, '-', ''),
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
      'player'
    )
    on conflict (email) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function link_auth_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- De regel van de app in één zin: een trainer beheert de club, een speler ziet en doet
-- alleen wat van hemzelf is. Die grens staat hier en niet alleen in de schermen — anders is
-- hij weg zodra iemand de app voorbijloopt en rechtstreeks met de databank praat.
-- ---------------------------------------------------------------------------

alter table users enable row level security;
alter table courts enable row level security;
alter table bookings enable row level security;
alter table lessons enable row level security;
alter table student_progress enable row level security;
alter table player_goals enable row level security;
alter table beurtenkaarten enable row level security;
alter table club_settings enable row level security;
alter table installed_catalogues enable row level security;

-- users: iedereen die ingelogd is mag de namen zien (een speler ziet zijn trainer, een
-- trainer zijn spelers). Wijzigen doet de trainer, of jijzelf aan je eigen rij.
drop policy if exists users_select on users;
create policy users_select on users for select
  to authenticated using (true);

drop policy if exists users_insert on users;
create policy users_insert on users for insert
  to authenticated with check (is_coach());

drop policy if exists users_update on users;
create policy users_update on users for update
  to authenticated using (is_coach() or auth_id = auth.uid())
  with check (is_coach() or auth_id = auth.uid());

drop policy if exists users_delete on users;
create policy users_delete on users for delete
  to authenticated using (is_coach());

-- courts en instellingen: iedereen leest (een speler ziet op welke baan hij staat), de
-- trainer beheert.
drop policy if exists courts_select on courts;
create policy courts_select on courts for select to authenticated using (true);
drop policy if exists courts_write on courts;
create policy courts_write on courts for all
  to authenticated using (is_coach()) with check (is_coach());

drop policy if exists club_settings_select on club_settings;
create policy club_settings_select on club_settings for select to authenticated using (true);
drop policy if exists club_settings_write on club_settings;
create policy club_settings_write on club_settings for all
  to authenticated using (is_coach()) with check (is_coach());

drop policy if exists catalogues_select on installed_catalogues;
create policy catalogues_select on installed_catalogues for select to authenticated using (true);
drop policy if exists catalogues_write on installed_catalogues;
create policy catalogues_write on installed_catalogues for all
  to authenticated using (is_coach()) with check (is_coach());

-- bookings: een trainer ziet en beheert zijn eigen agenda; een speler ziet de lessen waarin
-- hij meespeelt.
drop policy if exists bookings_select on bookings;
create policy bookings_select on bookings for select
  to authenticated using (coach_id = app_user_id() or plays_in(bookings));

-- Een speler mag alleen een les voor zichzelf aanvragen, en alleen als aanvraag: 'pending'
-- staat hier met zoveel woorden, zodat hij zichzelf niet kan goedkeuren door de app voorbij
-- te lopen. Zie lib/inbox voor dezelfde regel in de app.
drop policy if exists bookings_insert on bookings;
create policy bookings_insert on bookings for insert
  to authenticated with check (
    (is_coach() and coach_id = app_user_id() and created_by = app_user_id())
    or (player_id = app_user_id() and status = 'pending' and created_by = app_user_id())
  );

-- Wijzigen (goedkeuren, weigeren, betaalwijze, annuleren) is het werk van de trainer van
-- die les.
drop policy if exists bookings_update on bookings;
create policy bookings_update on bookings for update
  to authenticated using (coach_id = app_user_id()) with check (coach_id = app_user_id());

drop policy if exists bookings_delete on bookings;
create policy bookings_delete on bookings for delete
  to authenticated using (coach_id = app_user_id());

-- lesmateriaal: de trainer beheert alles, de speler ziet wat aan hém is toegewezen. Dezelfde
-- grens als `visibleLessonsFor` in lib/lessons: het clubmateriaal zonder speler is
-- gereedschap van de trainer.
drop policy if exists lessons_select on lessons;
create policy lessons_select on lessons for select
  to authenticated using (is_coach() or student_id = app_user_id());
drop policy if exists lessons_write on lessons;
create policy lessons_write on lessons for all
  to authenticated using (is_coach()) with check (is_coach());

-- voortgang, doelen en beurtenkaarten: de speler leest zijn eigen, de trainer schrijft.
drop policy if exists progress_select on student_progress;
create policy progress_select on student_progress for select
  to authenticated using (is_coach() or student_id = app_user_id());
drop policy if exists progress_write on student_progress;
create policy progress_write on student_progress for all
  to authenticated using (is_coach()) with check (is_coach());

drop policy if exists goals_select on player_goals;
create policy goals_select on player_goals for select
  to authenticated using (is_coach() or student_id = app_user_id());
drop policy if exists goals_write on player_goals;
create policy goals_write on player_goals for all
  to authenticated using (is_coach()) with check (is_coach());

drop policy if exists kaarten_select on beurtenkaarten;
create policy kaarten_select on beurtenkaarten for select
  to authenticated using (is_coach() or player_id = app_user_id());
drop policy if exists kaarten_write on beurtenkaarten;
create policy kaarten_write on beurtenkaarten for all
  to authenticated using (is_coach()) with check (is_coach());

-- ---------------------------------------------------------------------------
-- Rechten voor de app
--
-- RLS zegt WELKE rijen iemand mag; deze grants zeggen dat de rol überhaupt met de tabel
-- mag praten. Supabase zet dat normaal zelf goed, maar bij een project waar "privileges
-- automatisch toekennen" uit staat, gebeurt dat niet — en dan krijgt de app op elk scherm
-- "permission denied for table" terwijl er niets mis is met de regels hieronder. Ze hier
-- expliciet zetten kost niets en haalt die val weg.
--
-- Alleen `authenticated`: wie niet ingelogd is, heeft in deze app niets te zoeken.
-- ---------------------------------------------------------------------------

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

-- ---------------------------------------------------------------------------
-- Startgegevens
--
-- Alleen wat een lege club nodig heeft om te kunnen boeken. Gebruikers komen uit het
-- aanmelden, en het lessenboekje voegt de app zelf toe bij de eerste start van een trainer.
-- ---------------------------------------------------------------------------

insert into courts (id, name, number, indoor, hourly_rate)
values ('c-1', 'Baan 1', 1, false, 30),
       ('c-2', 'Baan 2', 2, true, 35)
on conflict (id) do nothing;

insert into club_settings (id, value)
values ('club', '{"booking_end_time":"21:00","theme":"light","language":"nl"}'::jsonb)
on conflict (id) do nothing;
