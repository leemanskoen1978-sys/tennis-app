-- De oude import opruimen, vóór de clublijst ingelezen wordt.
--
-- WAAROM DIT NODIG IS. In de agenda staan 325 lessen uit de eerste import (`koen.xlsx`): tien
-- lesgroepen van één trainer. Diezelfde groepen staan óók in de clublijst van de club, want die
-- lijst bevat álle groepen van de tennisschool. De droogloop laat het zien: tegen een lege club
-- geeft de clublijst 301 overlappingen, tegen jouw club 626 — precies 325 meer.
--
-- Sinds 6 september 2026 blokkeert een overlap niet meer, dus de import zou die 325 lessen
-- gewoon een tweede keer inplannen. Dat is geen halve baan maar een dubbele boeking: dezelfde
-- les, twee keer in de agenda, met twee verschillende groepen eraan.
--
-- DRAAI DIT IN VIER STAPPEN, EN LEES STAP 1 VOOR JE STAP 2 DRAAIT. Stap 2 verwijdert lessen.
-- Dat kan niet ongedaan gemaakt worden.

-- ---------------------------------------------------------------------------
-- STAP 1 · KIJKEN. Verwijdert niets.
-- ---------------------------------------------------------------------------
--
-- Hier hoort uit te komen: tien groepen, alle tien zonder baan, samen 325 lessen.
--
-- De baan is het kenmerk waaraan de oude import te herkennen is: `koen.xlsx` heeft geen kolom
-- `Baan`, dus die tien groepen kregen er geen. De 193 groepen van de clublijst hebben alle 193
-- wél een terrein. Komt er hieronder een groep uit die je met de hand hebt aangemaakt en die
-- toevallig ook geen baan heeft, dan hoort die er NIET bij — noteer haar id en sluit haar
-- hieronder uit.

select
  g.id,
  g.name,
  g.weekday,
  g.start_hour,
  g.court_id,
  u.name as trainer,
  count(b.id) as lessen
from lesson_groups g
left join users u on u.id = g.coach_id
left join bookings b on b.group_id = g.id
where g.court_id is null
  and g.archived = false
group by g.id, g.name, g.weekday, g.start_hour, g.court_id, u.name
order by g.weekday, g.start_hour;

-- En de controle op het totaal. Hier hoort 325 uit te komen: hetzelfde getal als het aantal
-- lessen dat nu in de agenda staat. Komt er minder uit, dan hangen er lessen aan een groep die
-- hierboven niet in de lijst staat, en dan moeten we eerst kijken welke.
select count(*) as lessen_van_die_groepen
from bookings b
join lesson_groups g on g.id = b.group_id
where g.court_id is null and g.archived = false;

-- ---------------------------------------------------------------------------
-- STAP 2 · DE LESSEN WEG. Dit is de onomkeerbare stap.
-- ---------------------------------------------------------------------------
--
-- Alleen de lessen van díé groepen. Een losse boeking die iemand zelf gemaakt heeft, hangt aan
-- geen enkele groep (`group_id is null`) en wordt hier dus niet geraakt.
--
-- Alle 325 liggen in de toekomst — het seizoen begint op 7 september 2026 — dus er verdwijnt
-- geen enkele gegeven les en geen enkele aanwezigheid.

delete from bookings b
using lesson_groups g
where b.group_id = g.id
  and g.court_id is null
  and g.archived = false;

-- ---------------------------------------------------------------------------
-- STAP 3 · DE GROEPEN ARCHIVEREN, NIET VERWIJDEREN.
-- ---------------------------------------------------------------------------
--
-- Archiveren en niet weggooien, met opzet. Een gearchiveerde groep telt niet mee bij het
-- herkennen (`actieveGroepen` in lib/lesgroepen laat ze eruit), dus de import ziet ze niet en
-- maakt gewoon haar 193 nieuwe groepen aan. Maar de rij blijft staan: gaat er straks iets mis,
-- dan is er nog te zien wat er was. Een verwijderde rij is weg.

update lesson_groups
set archived = true
where court_id is null and archived = false;

-- ---------------------------------------------------------------------------
-- STAP 4 · CONTROLE
-- ---------------------------------------------------------------------------
--
-- Hier hoort uit te komen: 0 lessen, 0 actieve groepen zonder baan, 10 gearchiveerde.

select
  (select count(*) from bookings where start_time >= '2026-09-07') as lessen_over,
  (select count(*) from lesson_groups where court_id is null and archived = false) as actief_zonder_baan,
  (select count(*) from lesson_groups where archived = true) as gearchiveerd;

-- Daarna de clublijst inlezen in Beheer → Lessen beheren → Trainingen importeren. De droogloop
-- hoort dan te zeggen: 193 nieuwe lesgroepen, 510 nieuwe spelers, 6461 lessen, en **301**
-- overlappingen in plaats van 626. Die 301 zijn de zes halve banen en die horen er te zijn.
