-- Oefeningen per kleur doorsturen, net als lesmateriaal.
--
-- Draai dit in de Supabase SQL-editor, ná LESPLANNING.sql. Twee keer draaien kan geen kwaad.
--
-- WAAROM DIT NODIG IS. De beheerder stuurt lesmateriaal door voor een periode, aan een trainer
-- en/of een groep (`les_planning`). "Oefeningen blauw, week 2" is geen rij in `lessons` — die
-- inhoud staat in de app zelf (lib/oefeningen) — dus een doorsturing kon er tot nu toe niet naar
-- wijzen. Nu wijst ze óf naar een les, óf naar een kleur en een week.
--
-- Bestaande rijen blijven kloppen: die hebben een `lesson_id` en geen kleur of week.
--
-- Dezelfde inhoud staat onderaan supabase-schema.sql. Lopen die twee uiteen, dan werkt de app
-- bij de club anders dan bij een verse installatie.

alter table les_planning alter column lesson_id drop not null;

alter table les_planning
  add column if not exists oefening_kleur text
    check (oefening_kleur in ('blauw', 'rood', 'oranje', 'groen'));
alter table les_planning
  add column if not exists oefening_week int
    check (oefening_week in (1, 2));

-- Precies één van de twee: een les, of een kleur mét een week. Beide leeg zou een doorsturing
-- zijn die nergens naar wijst; een kleur zonder week zou niet zeggen wát er doorgestuurd wordt.
-- De app zorgt dat er geen knop is die hier geweigerd wordt; dit is de bewaking (zie het
-- kopcommentaar van lib/rechten.ts).
alter table les_planning drop constraint if exists les_planning_wat;
alter table les_planning add constraint les_planning_wat check (
  (lesson_id is not null and oefening_kleur is null and oefening_week is null)
  or (lesson_id is null and oefening_kleur is not null and oefening_week is not null)
);

-- Wie mag lezen en schrijven verandert niet: de policies op `les_planning` gelden per rij.
