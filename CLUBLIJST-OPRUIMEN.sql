-- De oude import opruimen, vóór de clublijst ingelezen wordt.
--
-- WAAROM DIT NODIG IS. In de agenda staan 325 lessen uit de eerste import (`koen.xlsx`), alle
-- 325 op naam van één trainer en alle 325 zónder lesgroep. Dat laatste is geen slordigheid: dat
-- bestand is ingelezen vóórdat de tabel `lesson_groups` bestond — die kwam er pas met
-- `MIGRATIE-tennisschool.sql` op 6 september 2026 — dus de kolom `bookings.group_id` bestond nog
-- niet en er viel niets te koppelen.
--
-- Diezelfde lessen staan óók in de clublijst van de club, want die bevat alle groepen van de
-- tennisschool en deze trainer is er een van. Sinds 6 september 2026 blokkeert een overlap niet
-- meer, dus de import zou ze een tweede keer inplannen. De droogloop laat het zien: tegen een
-- lege club geeft de clublijst 301 overlappingen, tegen deze club 626 — precies 325 meer.
--
-- LET OP, EERDERE VERSIE VAN DIT BESTAND WAS FOUT. Die zocht de oude lessen via lesgroepen
-- zonder baan. Er zijn helemaal geen lesgroepen: de lessen hangen aan niets. Het script vond
-- daardoor niets en verwijderde ook niets — er is niets verloren gegaan, maar het loste ook
-- niets op.
--
-- DRAAI DIT IN DRIE STAPPEN, EN LEES STAP 1 VOOR JE STAP 2 DRAAIT. Stap 2 verwijdert lessen en
-- kan niet ongedaan gemaakt worden.

-- ---------------------------------------------------------------------------
-- STAP 1 · KIJKEN. Verwijdert niets.
-- ---------------------------------------------------------------------------
--
-- Hier hoort één regel uit te komen: 325 lessen, trainer Koen Leemans, van 2026-09-09 tot ergens
-- in juni 2027.
--
-- Wat dit afbakent, en waarom dat veilig is:
--
--   `group_id is null`   — een les die wél aan een groep hangt, is er een van de nieuwe import
--                          en blijft dus met rust. Vandaag hangt er geen enkele aan een groep,
--                          maar deze voorwaarde blijft staan zodat dit script ook veilig is als
--                          je het per ongeluk een tweede keer draait ná de import.
--   `start_time >= ...`  — wat geweest is blijft staan. Alles vóór 7 september 2026 wordt niet
--                          aangeraakt, ook al hangt het aan niets.
--
-- Staat er hieronder een regel met een ándere trainer, of met een aantal dat niet 325 is, stop
-- dan en kijk eerst wat het is. Dan zit er meer in dan alleen de oude import — een baan die
-- iemand zelf gereserveerd heeft bijvoorbeeld, en die hoort niet weg.

select
  u.name              as trainer,
  b.status,
  count(*)            as lessen,
  min(b.start_time)   as eerste,
  max(b.start_time)   as laatste
from bookings b
left join users u on u.id = b.coach_id
where b.group_id is null
  and b.start_time >= '2026-09-07'
group by u.name, b.status
order by count(*) desc;

-- ---------------------------------------------------------------------------
-- STAP 2 · DE LESSEN WEG. Dit is de onomkeerbare stap.
-- ---------------------------------------------------------------------------
--
-- Alle 325 liggen in de toekomst — het seizoen begint op 7 september 2026 — dus er verdwijnt
-- geen gegeven les, geen aanwezigheid en geen geschiedenis. Ze komen terug via de clublijst, en
-- dan mét hun lesgroep en hun deelnemers erbij; dat is precies de winst.

delete from bookings
where group_id is null
  and start_time >= '2026-09-07';

-- ---------------------------------------------------------------------------
-- STAP 3 · CONTROLE
-- ---------------------------------------------------------------------------
--
-- Hier hoort `0` uit te komen.

select count(*) as lessen_over
from bookings
where start_time >= '2026-09-07';

-- Daarna: de pagina van de app hard herladen (Cmd+Shift+R) — hij houdt de lessen in het geheugen
-- en rekent anders nog met wat er stond. Dan de clublijst opnieuw kiezen in Beheer → Lessen
-- beheren → Trainingen importeren.
--
-- De droogloop hoort dan te zeggen: 193 nieuwe lesgroepen, 510 nieuwe spelers, 6461 lessen, en
-- **301** overlappingen in plaats van 626. Die 301 zijn de zes halve banen en die horen er te
-- zijn.
