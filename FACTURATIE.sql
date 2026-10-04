-- Facturatie — de vier tabellen achter Beheer → Facturatie.
--
-- Draai dit in de SQL-editor van Supabase (Database → SQL editor → New query, alles plakken,
-- Run). Het script is idempotent: je mag het opnieuw draaien na een wijziging. Herlaad daarna
-- de app hard — ze leest de databank bij het opstarten.
--
-- Dit is de boekhouding van één persoon en geen voorziening van de club. Elke rij draagt
-- daarom een eigenaar, en elke policy hieronder kijkt naar `auth.uid()` en naar niets anders:
-- geen rol, geen uitzondering voor de beheerder. Wie de club beheert, heeft hier niets te
-- zoeken.
--
-- Sleutels zijn `text` en komen van de app, zoals overal in dit schema. Zie de kop van
-- supabase-schema.sql voor het waarom.
--
-- LET OP bij het met de hand invoegen van een rij vanuit de SQL-editor: `auth.uid()` is
-- daar leeg, en `eigenaar` is `not null`. Zo'n insert wordt dus geweigerd tenzij je zelf
-- je uuid meegeeft. De app heeft daar geen last van — die schrijft altijd ingelogd.

-- ---------------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------------

-- Mijn eigen gegevens, zoals ze bovenaan de factuur komen. Eén rij per eigenaar.
create table if not exists facturatie_leverancier (
  id text primary key,
  eigenaar uuid not null default auth.uid(),
  naam text not null default '',
  adres text not null default '',
  btw text not null default '',
  iban text not null default '',
  bic text not null default '',
  unique (eigenaar)
);

-- De clubs waaraan gefactureerd wordt.
create table if not exists facturatie_klanten (
  id text primary key,
  eigenaar uuid not null default auth.uid(),
  klantnaam text not null default '',
  adres text not null default '',
  postcode_gemeente text not null default '',
  btw_nummer text not null default '',
  uurtarief numeric(10,2) not null default 0,
  korte_naam text not null default '',
  -- Onder welke naam deze club in de geplakte lijst staat: "T.C. RACSO", niet "RACSO".
  -- In facturen.xlsx stond hier "RACSO" en vergeleek de SUMIFS exact; die werkmap telde
  -- Racso daardoor op nul uur. Daarom is dit een eigen, zichtbaar veld.
  naam_in_lijst text not null default '',
  btw_percentage numeric(5,2) not null default 0,
  -- 'geplakt' of 'app': waar de uren van deze klant vandaan komen. Zie "Twee bronnen" in
  -- docs/superpowers/specs/2026-10-04-facturatie-design.md.
  bron_voorkeur text not null default 'geplakt'
    check (bron_voorkeur in ('geplakt', 'app')),
  volgorde int not null default 0
);

-- De lessen: geplakt uit het clubsysteem, of met de hand bijgetikt als privéles.
create table if not exists facturatie_lessen (
  id text primary key,
  eigenaar uuid not null default auth.uid(),
  bron text not null default 'geplakt' check (bron in ('geplakt', 'prive')),
  club_tekst text not null default '',
  aanbod text not null default '',
  doelgroep text not null default '',
  groep text not null default '',
  dag_uur text not null default '',
  trainer text not null default '',
  status text not null default '',
  datum date not null,
  uren numeric(6,2) not null default 0,
  -- Met de hand gezet; gaat voor op `uren`. Leeg betekent "niets aangepast", en dat is iets
  -- anders dan nul uur.
  uren_handmatig numeric(6,2),
  -- Geschrapt is false. De rij blijft bestaan: wist je hem, dan komt hij bij de volgende
  -- plakbeurt gewoon terug en telt hij weer mee.
  actief boolean not null default true,
  naam_prive text not null default '',
  type_prive text not null default '',
  -- club + groep + dag/uur, opgeschoond. Houdt een tweede plakbeurt tegen.
  sleutel text not null,
  aangemaakt timestamptz not null default now()
);

-- Een unieke index en niet alleen een controle in de app: twee plakbeurten die tegelijk
-- binnenkomen zouden anders allebei "dit ken ik nog niet" zien en allebei schrijven.
create unique index if not exists facturatie_lessen_sleutel
  on facturatie_lessen (eigenaar, sleutel);

create index if not exists facturatie_lessen_datum
  on facturatie_lessen (eigenaar, datum);

-- De gemaakte facturen. Dit is het archief uit het tabblad Facturenregister.
create table if not exists facturatie_facturen (
  id text primary key,
  eigenaar uuid not null default auth.uid(),
  factuurnr text not null default '',
  -- De klantgegevens staan hier uitgeschreven en niet als verwijzing: verhuist een club
  -- volgend jaar, dan mag een factuur van vorig jaar niet van adres veranderen.
  klant_naam text not null default '',
  klant_adres text not null default '',
  klant_postcode_gemeente text not null default '',
  klant_btw text not null default '',
  factuurdatum date not null,
  vervaldatum date not null,
  omschrijving text not null default '',
  dienstmaand int not null check (dienstmaand between 1 and 12),
  dienstjaar int not null,
  aantal_uren numeric(8,2) not null default 0,
  uurtarief numeric(10,2) not null default 0,
  netto numeric(12,2) not null default 0,
  btw_percentage numeric(5,2) not null default 0,
  btw_bedrag numeric(12,2) not null default 0,
  totaal numeric(12,2) not null default 0,
  -- De vrije lijnen hebben alleen betekenis samen met hun factuur en worden nooit los
  -- opgevraagd. Dezelfde keuze als voor de beurten van een kaart; zie supabase-schema.sql.
  vrije_lijnen jsonb not null default '[]'::jsonb,
  -- Het overzicht dat Racso elke maand vraagt, zoals het bij het maken van de factuur was.
  -- Een kopie en geen verwijzing naar facturatie_lessen: wordt er volgende maand een les
  -- geschrapt, dan mag een verstuurde factuur niet meeveranderen.
  extra_lessen jsonb not null default '[]'::jsonb,
  betaald boolean not null default false,
  betaald_op date,
  opmerking text not null default '',
  aangemaakt timestamptz not null default now()
);

create index if not exists facturatie_facturen_datum
  on facturatie_facturen (eigenaar, factuurdatum desc);

-- Geen unieke index op het factuurnummer: een nummer dat al bestaat is een waarschuwing en
-- geen verbod. Koen weet beter dan de databank wanneer hij een factuur toch zo wil nummeren
-- — bijvoorbeeld als hij er een opnieuw maakt nadat hij hem uit het register haalde.

-- ---------------------------------------------------------------------------
-- Rechten
-- ---------------------------------------------------------------------------

alter table facturatie_leverancier enable row level security;
alter table facturatie_klanten enable row level security;
alter table facturatie_lessen enable row level security;
alter table facturatie_facturen enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'facturatie_leverancier', 'facturatie_klanten', 'facturatie_lessen', 'facturatie_facturen'
  ] loop
    execute format('drop policy if exists %1$s_select on %1$s', t);
    execute format('drop policy if exists %1$s_insert on %1$s', t);
    execute format('drop policy if exists %1$s_update on %1$s', t);
    execute format('drop policy if exists %1$s_delete on %1$s', t);

    -- `%s` en niet `%I` voor de tabelnaam: wat hier binnenkomt is de vaste lijst hierboven
    -- en nooit iets van buiten. Zou dat ooit veranderen, dan moet dit `%I` worden.
    --
    -- `to authenticated` zoals overal in supabase-schema.sql. Strikt genomen overbodig —
    -- voor de anon-rol is `auth.uid()` leeg en matcht `eigenaar = null` nooit — maar een
    -- policy die alleen klopt omdat een vergelijking toevallig onwaar is, is er een die
    -- niemand durft te wijzigen.
    execute format(
      'create policy %1$s_select on %1$s for select '
      || 'to authenticated using (eigenaar = auth.uid())', t);
    -- Ook `with check` op insert: anders kan iemand een rij op naam van een ander wegschrijven
    -- door de kolom zelf mee te sturen, en de default `auth.uid()` komt daar niet aan te pas.
    execute format(
      'create policy %1$s_insert on %1$s for insert '
      || 'to authenticated with check (eigenaar = auth.uid())', t);
    -- `with check` op update houdt tegen dat je je eigen rij op naam van iemand anders zet.
    execute format(
      'create policy %1$s_update on %1$s for update '
      || 'to authenticated using (eigenaar = auth.uid()) '
      || 'with check (eigenaar = auth.uid())', t);
    execute format(
      'create policy %1$s_delete on %1$s for delete '
      || 'to authenticated using (eigenaar = auth.uid())', t);
  end loop;
end
$$;
