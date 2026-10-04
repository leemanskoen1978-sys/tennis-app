-- De twee lesgroepen die in de indeling van oktober 2026 niet meer voorkomen.
--
-- WAT ER GEBEURDE. De club stuurde begin oktober een nieuwe planning: dezelfde lesdagen, maar
-- spelers op een ander moment. Die wordt ingelezen met Beheer → Importeren
-- (`Lesgroepen-oktober-2026.xlsx`, staat in Downloads en niet in de repository). Twee groepen
-- van september staan er niet meer in:
--
--   - donderdag 16:00, Terrein 8 (Tienertennis geel - Groep 30)
--   - zondag 15:00, Terrein 11 (Privéles - Groep 18, had in september al geen spelers)
--
-- WAAROM DIT MET SQL MOET EN NIET MET EEN HERIMPORT. De import verwijdert of schrapt nooit een
-- les (D-13): een groep die uit het bestand valt blijft staan, met haar lessen. En archiveren in
-- Beheer → Lesgroepen haalt de groep alleen uit de lijst; haar komende lessen blijven op de
-- afvinklijst staan. Dit bestand doet allebei: de komende lessen afzeggen en de groep archiveren.
--
-- Afzeggen en niet verwijderen: de les blijft bestaan met status `cancelled`, zoals elke andere
-- afgezegde les, en is met de hand terug te zetten. Wat al geweest is, blijft onaangeroerd.
--
-- DRAAI DIT PAS NA DE IMPORT, en lees stap 1 voor je stap 2 draait.

-- ---------------------------------------------------------------------------
-- STAP 1 · Kijken
-- ---------------------------------------------------------------------------
--
-- Verwacht: twee groepen (of één, als de zondaggroep zonder spelers nooit aangemaakt is). Bij
-- donderdag een kleine dertig komende lessen (tot 6 juni 2027, min de vakanties); bij zondag nul.
-- Staat er hier een andere groep of een veel groter getal, stop dan.

select g.id, g.name, g.weekday, g.start_hour, c.name as terrein, g.archived,
       jsonb_array_length(g.roster) as spelers,
       count(b.id) filter (where b.start_time >= now() and b.status <> 'cancelled') as komende_lessen
from lesson_groups g
join courts c on c.id = g.court_id
left join bookings b on b.group_id = g.id
where (g.weekday = 4 and g.start_hour = 16 and g.start_minute = 0 and c.name = 'Terrein 8')
   or (g.weekday = 0 and g.start_hour = 15 and g.start_minute = 0 and c.name = 'Terrein 11')
group by g.id, c.name;

-- ---------------------------------------------------------------------------
-- STAP 2 · De komende lessen afzeggen en de groepen archiveren
-- ---------------------------------------------------------------------------

begin;

with weg as (
  select g.id
  from lesson_groups g
  join courts c on c.id = g.court_id
  where (g.weekday = 4 and g.start_hour = 16 and g.start_minute = 0 and c.name = 'Terrein 8')
     or (g.weekday = 0 and g.start_hour = 15 and g.start_minute = 0 and c.name = 'Terrein 11')
)
update bookings
set status = 'cancelled'
where group_id in (select id from weg)
  and start_time >= now()
  and status <> 'cancelled';

update lesson_groups g
set archived = true
from courts c
where c.id = g.court_id
  and ((g.weekday = 4 and g.start_hour = 16 and g.start_minute = 0 and c.name = 'Terrein 8')
    or (g.weekday = 0 and g.start_hour = 15 and g.start_minute = 0 and c.name = 'Terrein 11'));

commit;

-- Controle: draai stap 1 opnieuw. Verwacht: `archived` waar en `komende_lessen` nul.
-- Daarna de app hard herladen: ze leest de databank bij het opstarten.
