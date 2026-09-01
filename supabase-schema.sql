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

-- ---------------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------------

create table if not exists users (
  id text primary key,
  auth_id uuid unique references auth.users(id) on delete set null,
  email text unique not null,
  name text not null,
  -- Twee rollen. "Ouder" was er ooit een derde, en dat werkte averechts: een ouder die zelf
  -- tennist moest kiezen tussen zijn eigen lessen zien óf die van zijn kind. Ouderschap is
  -- geen rol maar een band tussen twee mensen, en die staat in `ouder_kind`.
  role text not null check (role in ('player','coach')),
  phone text,
  bio text,
  preferred_court_id text,
  working_hours jsonb,
  working_days jsonb,
  notification_settings jsonb,
  -- Het uurloon staat NIET hier maar in `coach_rates`. Zie daar waarom: een kolom in deze
  -- tabel is voor iedereen leesbaar die de ledenlijst mag zien, en dat is iedereen.
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

-- Spraakmemo's: ruw materiaal dat een trainer op de baan inspreekt en later uitwerkt.
-- De audio staat als data-URL in de rij, net als bij student_progress.voice_memo_uri. Dat
-- mag hier omdat een memo tijdelijk is: uitwerken verwijdert hem. Wordt dat ooit anders,
-- dan hoort de audio in Supabase Storage en niet meer hier.
create table if not exists memos (
  id text primary key,
  student_id text not null references users(id) on delete cascade,
  coach_id text not null references users(id) on delete cascade,
  -- De les mag verdwijnen zonder de memo mee te nemen: wat er over een speler gezegd is,
  -- hoort niet weg te vallen omdat een boeking geschrapt wordt.
  booking_id text references bookings(id) on delete set null,
  audio_uri text not null,
  duration_ms int not null,
  created_at timestamptz not null default now()
);

create index if not exists memos_coach_idx on memos (coach_id);

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

-- Wat een trainer per uur verdient. Bewust een eigen tabel en geen kolom in `users`:
-- RLS kijkt naar rijen, niet naar kolommen, en `users_select` staat open voor iedereen die
-- ingelogd is — een trainer moet immers de naam van zijn spelers kunnen zien. Zolang het
-- uurloon dáárin stond, kon elke ingelogde gebruiker het loon van elke trainer opvragen,
-- ook al toonde geen enkel scherm het hem. Als eigen tabel valt de vraag "wiens loon is
-- dit" wél samen met een rij, en houdt de policy hieronder hem tegen.
--
-- Schrijven doet alleen de beheerder. Het uurloon is wat de club uitbetaalt; wie het zelf
-- kon zetten, kon zijn eigen loon verhogen.
create table if not exists coach_rates (
  coach_id text primary key references users(id) on delete cascade,
  hourly_rate numeric not null,
  updated_at timestamptz not null default now()
);

-- Welke ouder bij welk kind hoort.
--
-- Een ouder ziet niets tot een trainer ja zegt: de aanvraag begint op 'pending', net als een
-- lesaanvraag. Zonder die stap zou iedereen die zich als ouder aanmeldt het dossier van elk
-- kind van de club kunnen openen door de naam te kiezen.
--
-- 'rejected' blijft staan in plaats van te verdwijnen, zodat de ouder te horen krijgt wat er
-- met zijn vraag gebeurd is — dezelfde reden als `rejected_at` bij een geweigerde les.
create table if not exists ouder_kind (
  id text primary key,
  parent_id text not null references users(id) on delete cascade,
  child_id text not null references users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by text references users(id) on delete set null,
  -- Eén aanvraag per paar: vraagt een ouder het twee keer, dan is het dezelfde vraag.
  unique (parent_id, child_id)
);

create index if not exists ouder_kind_parent_idx on ouder_kind (parent_id, status);
create index if not exists ouder_kind_child_idx on ouder_kind (child_id, status);

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

-- Kolommen die later bijkwamen. `create table if not exists` slaat een bestaande tabel
-- over, dus een nieuw veld bereikt een project dat het script al eens draaide alleen langs
-- deze weg. Ze staan hier apart zodat ze niet nog eens over het hoofd gezien worden.
alter table lessons add column if not exists tags jsonb;
alter table bookings add column if not exists created_by text references users(id) on delete set null;
alter table courts add column if not exists group_rates jsonb;
-- Wie de club beheert. Bewust een vinkje en geen vierde rol: een beheerder is meestal ook
-- gewoon trainer, met zijn eigen agenda en zijn eigen spelers. Zie lib/rechten.ts.
alter table users add column if not exists is_admin boolean not null default false;
-- Wanneer een lesaanvraag geweigerd is. Alleen gezet bij het weigeren, en dat is het punt:
-- een geweigerde aanvraag en een les die later gewoon is afgezegd staan allebei op
-- 'cancelled'. Zonder dit onderscheid kan de speler niet te horen krijgen wat er met zijn
-- vraag gebeurd is.
alter table bookings add column if not exists rejected_at timestamptz;
-- Wie er die dag effectief stond: {"speler-id": "aanwezig"|"afwezig"}. Een speler die er
-- niet in staat is niet afgevinkt, en dat is iets anders dan afwezig — vandaar een lijstje
-- en geen kolom per speler. Wijzigen mag alleen de trainer van de les of de beheerder; dat
-- bewaakt `bewaak_betaalvelden` hieronder al, want alles buiten de twee betaalvelden valt
-- daar vanzelf onder "mag niet".
alter table bookings add column if not exists attendance jsonb;

-- De rol 'parent' bestaat niet meer: wie kinderen volgt, doet dat via `ouder_kind` en houdt
-- gewoon zijn eigen rol. Eerst iedereen omzetten, dan pas de regel aanscherpen — andersom
-- weigert de databank de bestaande rijen.
do $$
begin
  if exists (select 1 from users where role = 'parent') then
    update users set role = 'player' where role = 'parent';
  end if;
end
$$;

alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check
  check (role in ('player','coach'));

-- Het uurloon verhuisde van `users` naar `coach_rates` (zie daar waarom). Eerst overzetten,
-- dan pas weghalen — en allebei alleen als de oude kolom er nog is, zodat dit script ook op
-- een project dat het al draaide gewoon opnieuw mag.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'hourly_rate'
  ) then
    insert into coach_rates (coach_id, hourly_rate)
    select id, hourly_rate from users where hourly_rate is not null
    on conflict (coach_id) do nothing;

    alter table users drop column hourly_rate;
  end if;
end
$$;

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

-- Beheert deze gebruiker de club? Zelfde opzet als is_coach: `security definer`, want de
-- policies op users mogen deze vraag niet zelf weer door RLS sturen.
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from users where auth_id = auth.uid() and is_admin);
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

-- Is dit een goedgekeurd kind van wie er nu kijkt? Zelfde opzet als hierboven: `security
-- definer`, want de policies op ouder_kind mogen deze vraag niet zelf weer door RLS sturen.
create or replace function is_mijn_kind(kind_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from ouder_kind
    where parent_id = app_user_id()
      and child_id = kind_id
      and status = 'approved'
  );
$$;

-- ---------------------------------------------------------------------------
-- Het beheerdersvinkje bewaken
-- ---------------------------------------------------------------------------

-- Alleen een beheerder maakt een beheerder. Dit kán niet met een policy: RLS kijkt naar
-- hele rijen, niet naar één kolom, en `users_update` staat een trainer toe om gebruikers
-- bij te werken. Zonder deze trigger zou elke trainer zichzelf tot beheerder kunnen maken
-- door één veld mee te sturen — de app biedt dat nergens aan, maar de app is de bewaker
-- niet.
--
-- `auth.uid() is null` betekent: dit komt niet uit de app maar uit de SQL-editor of een
-- service-role sleutel. Dat moet mogen, anders kon de allereerste beheerder nooit gezet
-- worden en zat de club buiten haar eigen deur.
create or replace function bewaak_is_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.is_admin and auth.uid() is not null and not is_admin() then
      raise exception 'Alleen een beheerder kan een beheerder aanmaken';
    end if;
    return new;
  end if;

  if new.is_admin is distinct from old.is_admin
     and auth.uid() is not null
     and not is_admin() then
    raise exception 'Alleen een beheerder kan het beheerdersvinkje wijzigen';
  end if;
  return new;
end;
$$;

drop trigger if exists users_is_admin_bewaakt on users;
create trigger users_is_admin_bewaakt
  before insert or update on users
  for each row execute function bewaak_is_admin();

-- ---------------------------------------------------------------------------
-- De betaalwijze mag de betaler zelf zetten — en verder niets
-- ---------------------------------------------------------------------------

-- `bookings_update` laat hieronder ook de betaler toe (en de ouder van een minderjarige
-- betaler), want wie de rekening krijgt hoort te kiezen of hij cash betaalt of op factuur.
-- Maar RLS kent alleen hele rijen: wie een rij mag wijzigen, mag élke kolom wijzigen. Zonder
-- deze trigger kon een speler met dezelfde toestemming zijn les een uur verzetten, aan een
-- andere trainer hangen of zichzelf goedkeuren.
--
-- Vandaar de vergelijking op de hele rij: alles behalve de twee betaalvelden moet gelijk
-- blijven. Zo hoeft deze functie niet te weten welke kolommen er in de toekomst bij komen —
-- een nieuwe kolom valt vanzelf onder "mag niet".
create or replace function bewaak_betaalvelden()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Buiten een sessie om (een script, de SQL-editor) geldt deze grens niet.
  if auth.uid() is null then return new; end if;
  -- De trainer van deze les en de beheerder mogen alles; voor hen is er niets te bewaken.
  if is_admin() or old.coach_id = app_user_id() then return new; end if;

  if (to_jsonb(new) - 'payment_method' - 'beurtenkaart_id')
     is distinct from (to_jsonb(old) - 'payment_method' - 'beurtenkaart_id') then
    raise exception 'Alleen de betaalwijze van je eigen les mag je zelf wijzigen.';
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_betaalvelden_bewaakt on bookings;
create trigger bookings_betaalvelden_bewaakt
  before update on bookings
  for each row execute function bewaak_betaalvelden();

-- ---------------------------------------------------------------------------
-- De beurt van een verwijderde les komt terug
-- ---------------------------------------------------------------------------

-- Stond een les op een beurtenkaart en wordt ze verwijderd, dan hoort die beurt terug te
-- komen. De app doet dat zelf zodra ze het mag — maar een speler en een ouder mogen een
-- kaart niet bewerken (`kaarten_write` hieronder), en dat is met opzet: wie zijn eigen
-- beurten kan terugzetten, geeft zichzelf gratis lessen.
--
-- Vandaar deze trigger. Hij hangt aan de verwijdering zelf, dus hij geldt voor iedereen die
-- een les weghaalt, langs welke weg dan ook. `security definer` omdat het anders diezelfde
-- grens is die hem tegenhoudt.
--
-- Heeft de app de beurt al teruggegeven (de trainer), dan haalt dit niets meer weg en
-- verandert er niets: de les stond er dan al niet meer in.
create or replace function geef_beurt_terug()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.beurtenkaart_id is null then return old; end if;

  update beurtenkaarten
     set uses = coalesce(
       (select jsonb_agg(beurt)
          from jsonb_array_elements(coalesce(uses, '[]'::jsonb)) as e(beurt)
         where beurt->>'booking_id' is distinct from old.id),
       '[]'::jsonb
     )
   where id = old.beurtenkaart_id;

  return old;
end;
$$;

drop trigger if exists bookings_beurt_terug on bookings;
create trigger bookings_beurt_terug
  after delete on bookings
  for each row execute function geef_beurt_terug();

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
-- alleen wat van hemzelf is, en een ouder ziet wat van zijn goedgekeurde kind is. Die grens
-- staat hier en niet alleen in de schermen — anders is hij weg zodra iemand de app
-- voorbijloopt en rechtstreeks met de databank praat.
--
-- Twee dingen die RLS niet kan, en waar dus een trigger voor staat:
--  - één kolom afschermen. Daarom heeft het uurloon een eigen tabel (`coach_rates`) in
--    plaats van een kolom in `users`: zo valt "wiens loon is dit" samen met een rij.
--  - één kolom vrijgeven. De betaler mag zijn betaalwijze zetten maar niet zijn lesuur;
--    `bewaak_betaalvelden` bewaakt dat verschil.
-- ---------------------------------------------------------------------------

alter table users enable row level security;
alter table courts enable row level security;
alter table bookings enable row level security;
alter table lessons enable row level security;
alter table student_progress enable row level security;
alter table memos enable row level security;
alter table player_goals enable row level security;
alter table beurtenkaarten enable row level security;
alter table coach_rates enable row level security;
alter table ouder_kind enable row level security;
alter table club_settings enable row level security;
alter table installed_catalogues enable row level security;

-- users: iedereen die ingelogd is mag de namen zien (een speler ziet zijn trainer, een
-- trainer zijn spelers). Wijzigen doet de trainer, of jijzelf aan je eigen rij.
drop policy if exists users_select on users;
create policy users_select on users for select
  to authenticated using (true);

-- Ook hier telt de upsert mee (zie de opmerking bij bookings_insert): werkt een speler zijn
-- eigen telefoonnummer bij, dan gaat die wijziging langs déze regel. Zonder `auth_id =
-- auth.uid()` werd dat geweigerd, terwijl users_update het uitdrukkelijk toestaat. Je mag
-- dus schrijven aan de rij die van jou is — en aan meer niet.
drop policy if exists users_insert on users;
create policy users_insert on users for insert
  to authenticated with check (is_coach() or is_admin() or auth_id = auth.uid());

drop policy if exists users_update on users;
create policy users_update on users for update
  to authenticated using (is_coach() or is_admin() or auth_id = auth.uid())
  with check (is_coach() or is_admin() or auth_id = auth.uid());

drop policy if exists users_delete on users;
create policy users_delete on users for delete
  to authenticated using (is_coach() or is_admin());

-- coach_rates: je eigen loon, of alles als je de club beheert. Dit is de hele reden dat het
-- uurloon een eigen tabel heeft — zie daar. Een collega valt buiten beide takken en krijgt
-- geen rij terug; niet een rij met een leeg bedrag, maar niets.
drop policy if exists rates_select on coach_rates;
create policy rates_select on coach_rates for select
  to authenticated using (coach_id = app_user_id() or is_admin());

-- Schrijven alleen de beheerder: dit is wat de club uitbetaalt.
drop policy if exists rates_write on coach_rates;
create policy rates_write on coach_rates for all
  to authenticated using (is_admin()) with check (is_admin());

-- ouder_kind: de ouder ziet zijn eigen aanvragen, de trainer ziet ze allemaal (hij moet
-- erover beslissen).
drop policy if exists ouder_kind_select on ouder_kind;
create policy ouder_kind_select on ouder_kind for select
  to authenticated using (parent_id = app_user_id() or is_coach() or is_admin());

-- Een ouder vraagt alleen voor zichzelf, en alleen als vraag: 'pending' staat er met zoveel
-- woorden, zodat hij zichzelf niet kan goedkeuren door de app voorbij te lopen. Dezelfde
-- opzet als bookings_insert.
drop policy if exists ouder_kind_insert on ouder_kind;
create policy ouder_kind_insert on ouder_kind for insert
  to authenticated with check (
    is_coach()
    or is_admin()
    or (parent_id = app_user_id() and status = 'pending')
  );

-- Beslissen doet de trainer. LET OP de upsert (zie bookings_insert): de app schrijft hele
-- rijen, dus een ouder die zijn aanvraag opnieuw wegschrijft komt ook langs deze regel — en
-- die laat hem alleen 'pending' houden. Goedkeuren kan hij dus niet.
drop policy if exists ouder_kind_update on ouder_kind;
create policy ouder_kind_update on ouder_kind for update
  to authenticated
  using (is_coach() or is_admin() or parent_id = app_user_id())
  with check (
    is_coach()
    or is_admin()
    or (parent_id = app_user_id() and status = 'pending')
  );

-- Intrekken mag de ouder zelf: een vraag die je niet meer wilt stellen, hoort te kunnen
-- verdwijnen.
drop policy if exists ouder_kind_delete on ouder_kind;
create policy ouder_kind_delete on ouder_kind for delete
  to authenticated using (is_coach() or is_admin() or parent_id = app_user_id());

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
  to authenticated using (is_coach() or is_admin()) with check (is_coach() or is_admin());

drop policy if exists catalogues_select on installed_catalogues;
create policy catalogues_select on installed_catalogues for select to authenticated using (true);
drop policy if exists catalogues_write on installed_catalogues;
create policy catalogues_write on installed_catalogues for all
  to authenticated using (is_coach() or is_admin()) with check (is_coach() or is_admin());

-- bookings: een trainer ziet en beheert zijn eigen agenda; een speler ziet de lessen waarin
-- hij meespeelt.
-- De betaler staat apart van de medespelers, dus beide kanten tellen mee — dezelfde regel
-- als `playsIn` in lib/groups. Bewust uitgeschreven en niet in een hulpfunctie op het
-- rij-type: dat laatste leest korter, maar hangt af van een vorm van verwijzen die je pas
-- ziet mislukken op het moment dat je de policy aanmaakt.
drop policy if exists bookings_select on bookings;
create policy bookings_select on bookings for select
  to authenticated using (
    is_admin()
    or coach_id = app_user_id()
    or player_id = app_user_id()
    or coalesce(participant_ids, '[]'::jsonb) ? app_user_id()
    -- De ouder ziet de lessen van zijn goedgekeurde kind, langs allebei de kanten: het kind
    -- kan de betaler zijn of gewoon meespelen in een groepsles.
    or is_mijn_kind(player_id)
    or exists (
      select 1 from jsonb_array_elements_text(coalesce(participant_ids, '[]'::jsonb)) as p(id)
      where is_mijn_kind(p.id)
    )
  );

-- Een speler mag alleen een les voor zichzelf aanvragen, en alleen als aanvraag: 'pending'
-- staat hier met zoveel woorden, zodat hij zichzelf niet kan goedkeuren door de app voorbij
-- te lopen. Zie lib/inbox voor dezelfde regel in de app.
drop policy if exists bookings_insert on bookings;
-- LET OP bij het wijzigen: de app schrijft met een upsert (`insert ... on conflict do
-- update`, zie saveToSupabase). Postgres controleert daarbij ook déze policy, óók als de
-- rij allang bestaat en er alleen iets aan verandert. Alles wat hier over de *maker* van de
-- rij wordt geëist, geldt dus ook bij elke latere wijziging door iemand anders.
--
-- Daarom staat er bij de trainer geen `created_by = app_user_id()` meer. Dat stond er wel,
-- en het brak het goedkeuren: een speler vraagt een les aan (created_by = de speler), de
-- trainer keurt goed, de rij wordt ge-upsert — en dan klopte de trainerregel niet meer
-- omdat de maker iemand anders was. De knop deed niets en zei niets. Het beschermde ook
-- niets: een trainer mag elke les in zijn eigen agenda sowieso al wijzigen.
create policy bookings_insert on bookings for insert
  to authenticated with check (
    -- De beheerder maakt het rooster van de club en mag dus in elke agenda inplannen.
    is_admin()
    or (is_coach() and coach_id = app_user_id())
    or (player_id = app_user_id() and status = 'pending' and created_by = app_user_id())
    -- Een ouder vraagt aan namens zijn kind: dezelfde regel, alleen staat de speler op de
    -- naam van het kind en de maker op die van de ouder.
    or (is_mijn_kind(player_id) and status = 'pending' and created_by = app_user_id())
  );

-- Wijzigen (goedkeuren, weigeren, betaalwijze, annuleren) is het werk van de trainer van
-- die les.
drop policy if exists bookings_update on bookings;
-- Ook de betaler staat hier, en de ouder van een minderjarige betaler: wie de rekening
-- krijgt, kiest of hij cash betaalt of op factuur. Wat hij verder níét mag — het uur
-- verzetten, van trainer wisselen, zichzelf goedkeuren — houdt de trigger
-- `bewaak_betaalvelden` tegen, want een policy kent alleen hele rijen en geen kolommen.
create policy bookings_update on bookings for update
  to authenticated using (
    coach_id = app_user_id()
    or is_admin()
    or player_id = app_user_id()
    or is_mijn_kind(player_id)
  )
  with check (
    coach_id = app_user_id()
    or is_admin()
    or player_id = app_user_id()
    or is_mijn_kind(player_id)
  );

drop policy if exists bookings_delete on bookings;
-- De speler zelf en de ouder van een goedgekeurd kind mogen een les schrappen zolang ze nog
-- moet beginnen: wie de rekening krijgt, mag ook zeggen dat het niet doorgaat.
--
-- Wat geweest is, blijft van de trainer. Een gegeven les is een regel in de historiek en in
-- de omzet, en die laat je niet weghalen door de andere kant van de rekening; daar gaat de
-- trainer over. Dezelfde grens staat in `magLesVerwijderen` (lib/rechten) — daar zodat het
-- scherm geen knop aanbiedt die hier geweigerd wordt, hier omdat dit de bewaking is.
--
-- Alleen de betaler, niet wie meespeelt: in een groepsles zou het schrappen van de boeking
-- ook de les van de anderen wegvegen.
create policy bookings_delete on bookings for delete
  to authenticated using (
    coach_id = app_user_id()
    or is_admin()
    or ((player_id = app_user_id() or is_mijn_kind(player_id)) and start_time > now())
  );

-- lesmateriaal: de trainer beheert alles, de speler ziet wat aan hém is toegewezen. Dezelfde
-- grens als `visibleLessonsFor` in lib/lessons: het clubmateriaal zonder speler is
-- gereedschap van de trainer.
drop policy if exists lessons_select on lessons;
create policy lessons_select on lessons for select
  to authenticated using (
    is_coach() or student_id = app_user_id() or is_mijn_kind(student_id)
  );
drop policy if exists lessons_write on lessons;
create policy lessons_write on lessons for all
  to authenticated using (is_coach() or is_admin()) with check (is_coach() or is_admin());

-- voortgang, doelen en beurtenkaarten: de speler leest zijn eigen, de trainer schrijft.
drop policy if exists progress_select on student_progress;
create policy progress_select on student_progress for select
  to authenticated using (
    is_coach() or student_id = app_user_id() or is_mijn_kind(student_id)
  );
drop policy if exists progress_write on student_progress;
create policy progress_write on student_progress for all
  to authenticated using (is_coach() or is_admin()) with check (is_coach() or is_admin());

-- Een memo is ruw materiaal, geen mededeling: een speler ziet zijn memo's níét. Ook een
-- beheerder niet — dit is de ene plek waar `is_admin()` bewust ontbreekt. Wat een trainer
-- half ingesproken over een kind zegt, is van hem tot hij het uitwerkt; wát hij ervan
-- maakt, staat daarna gewoon in het dossier waar de beheerder wél bij kan. Wat hij te
-- zien krijgt, is de notitie die de trainer eruit maakt. En een trainer ziet alleen zijn
-- eigen memo's — de opname van een collega is niet aan hem.
drop policy if exists memos_select on memos;
create policy memos_select on memos for select
  to authenticated using (coach_id = app_user_id());
drop policy if exists memos_write on memos;
create policy memos_write on memos for all
  to authenticated using (coach_id = app_user_id()) with check (coach_id = app_user_id());

drop policy if exists goals_select on player_goals;
create policy goals_select on player_goals for select
  to authenticated using (
    is_coach() or student_id = app_user_id() or is_mijn_kind(student_id)
  );
drop policy if exists goals_write on player_goals;
create policy goals_write on player_goals for all
  to authenticated using (is_coach() or is_admin()) with check (is_coach() or is_admin());

drop policy if exists kaarten_select on beurtenkaarten;
create policy kaarten_select on beurtenkaarten for select
  to authenticated using (
    is_coach() or player_id = app_user_id() or is_mijn_kind(player_id)
  );
drop policy if exists kaarten_write on beurtenkaarten;
create policy kaarten_write on beurtenkaarten for all
  to authenticated using (is_coach() or is_admin()) with check (is_coach() or is_admin());

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
