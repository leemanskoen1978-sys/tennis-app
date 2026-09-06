-- Het seizoen en de lesduur per lesgroep.
--
-- Draai dit in de Supabase SQL-editor, ná MIGRATIE-tennisschool.sql en KALENDER-2026-2027.sql.
-- Twee keer draaien kan geen kwaad: alles hieronder is herhaalbaar.
--
-- WAAROM DIT NODIG IS. De clublijst met 192 groepen is een weekschema: één regel per groep,
-- met een weekdag en een uur, en zonder één datum. De lessen volgen uit de clubkalender. Maar
-- KALENDER-2026-2027.sql heeft daar alleen de RODE dagen van ingelezen — de dagen zonder les
-- binnen het seizoen. Het WIT in "GANTOISE TENNIS - KALENDER JAARCYCLUS 2026-2027" (1 t/m 6
-- september, en alles na 30 juni) is geen vakantie maar buiten het seizoen, en dat verschil
-- stond nergens in de databank.
--
-- Zonder deze twee datums moet de importer het seizoen raden. Raadt hij 1 september, dan
-- krijgen de groepen op woensdag, donderdag, vrijdag en zaterdag er een les bij in de week
-- vóór het seizoen: 31 lessen in plaats van 30, voor 550 spelers.

-- ---------------------------------------------------------------------------
-- 1. De randen van het seizoen, overgenomen uit de kalender van de club
-- ---------------------------------------------------------------------------
--
-- September '26 begint met 1 t/m 6 ongekleurd; week 37 start groen op maandag 7 september.
-- Het groen eindigt op zondag 6 juni '27; 7 t/m 30 juni is wit, net als de eerste week van
-- september. Dat zijn de twee dagen hieronder.
--
-- LET OP: hier stond eerst 2027-06-30, en dat was fout — een verkeerde lezing van diezelfde
-- foto. Het kostte vier weken te veel in de agenda, 660 lessen. Wie dit bestand al met de oude
-- datum gedraaid heeft, zet het recht met SEIZOEN-EINDIGT-6-JUNI.sql. De rekensom die het
-- uitwijst: met 6 juni komen dinsdag tot en met zaterdag allemaal op precies dertig lesweken
-- uit, het getal van het tarievenblad; met 30 juni geen enkele dag.
--
-- Alleen deze twee sleutels worden gezet, niet het hele object: de vakanties, de lesduur, het
-- thema en de taal blijven staan zoals ze zijn. Dezelfde aanpak als in KALENDER-2026-2027.sql.

insert into club_settings (id, value)
values ('club', '{}'::jsonb)
on conflict (id) do nothing;

update club_settings
set value = value
      || jsonb_build_object('season_start', '2026-09-07')
      || jsonb_build_object('season_end',   '2027-06-06'),
    updated_at = now()
where id = 'club';

-- ---------------------------------------------------------------------------
-- 2. De lesduur per lesgroep
-- ---------------------------------------------------------------------------
--
-- De club heeft één lesduur als instelling, en voor 188 van de 192 groepen klopt die: 60
-- minuten. Twee groepen duren 30 minuten en twee duren 90. Dat staat in de kolom `Uur` van de
-- clublijst als een reeks ("16:00 - 17:00") en gaat vandaag verloren.
--
-- LEEG BETEKENT: gebruik de clubinstelling. Zo hoeft geen enkele bestaande groep aangeraakt te
-- worden en verandert er niets aan wat er nu in de agenda staat. Alleen de groepen waar het
-- bestand een afwijkende duur voor geeft, krijgen hier een getal.
--
-- De bovengrens van 300 minuten is er tegen een tikfout, niet tegen een lange les: vijf uur
-- les bestaat niet en een cel waar per ongeluk een jaartal in belandt, hoort te stuiten.

alter table lesson_groups
  add column if not exists duration_minutes int
  check (duration_minutes is null or duration_minutes between 5 and 300);

-- ---------------------------------------------------------------------------
-- 3. Controle
-- ---------------------------------------------------------------------------
--
-- Hier hoort uit te komen: 2026-09-07, 2027-06-30, en 13 vakantieperiodes. Die dertien zijn
-- al nagelopen tegen de kalenderfoto en kloppen alle vijftien rode blokken — herfst,
-- Wapenstilstand, kerst (21 dec t/m 3 jan), 15 t/m 23 januari, krokus, Pasen (28 maart t/m
-- 10 april), 1 mei, Hemelvaart, Pinkstermaandag, 25 en 30 mei, 1 t/m 3 juni en 6 juni. Er
-- hoeft dus niets aan de vakanties zelf te gebeuren.

select
  value->>'season_start'                  as seizoen_van,
  value->>'season_end'                    as seizoen_tot,
  jsonb_array_length(value->'vakanties')  as aantal_vakanties
from club_settings
where id = 'club';

-- En dat de kolom er staat; hier hoort één regel uit te komen met is_nullable = YES.
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'lesson_groups' and column_name = 'duration_minutes';
