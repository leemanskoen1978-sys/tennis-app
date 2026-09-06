-- Terrein 1 tot en met 11 aanmaken.
--
-- Draai dit in de Supabase SQL-editor. Twee keer draaien kan geen kwaad: er wordt alleen een
-- baan toegevoegd waarvan het nummer nog niet bestaat, dus banen die je al hebt blijven
-- ongemoeid en krijgen geen dubbel.
--
-- Uurtarief: € 60 op alle elf, zoals afgesproken. Dat is wat een speler per uur betaalt bij
-- een privéles; pas het daarna aan per baan in Beheer -> Banen. Daar zet je ook de
-- groepstaffel ("tot 2 spelers x euro, tot 4 spelers y euro") -- zonder staffel geldt het
-- uurtarief voor elke groepsgrootte.
--
-- Binnen vanaf terrein 7: 1 tot en met 6 buiten, 7 tot en met 11 binnen.

insert into courts (id, name, number, indoor, hourly_rate)
select v.id, v.naam, v.nummer, v.binnen, v.tarief
from (values
  ('court-1',  'Terrein 1',  1,  false, 60),
  ('court-2',  'Terrein 2',  2,  false, 60),
  ('court-3',  'Terrein 3',  3,  false, 60),
  ('court-4',  'Terrein 4',  4,  false, 60),
  ('court-5',  'Terrein 5',  5,  false, 60),
  ('court-6',  'Terrein 6',  6,  false, 60),
  ('court-7',  'Terrein 7',  7,  true,  60),
  ('court-8',  'Terrein 8',  8,  true,  60),
  ('court-9',  'Terrein 9',  9,  true,  60),
  ('court-10', 'Terrein 10', 10, true,  60),
  ('court-11', 'Terrein 11', 11, true,  60)
) as v(id, naam, nummer, binnen, tarief)
where not exists (select 1 from courts c where c.number = v.nummer)
  and not exists (select 1 from courts c where c.id = v.id);

-- Controle achteraf: hier horen elf regels uit te komen, 1 tot en met 11.
-- select number, name, indoor, hourly_rate from courts order by number;
