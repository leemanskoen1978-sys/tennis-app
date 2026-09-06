-- De clubkalender 2026-2027: de dagen zonder les.
--
-- Draai dit in de Supabase SQL-editor. Het voegt de periodes toe aan de clubinstellingen;
-- de rest van je instellingen (lesduur, thema, taal) blijft ongemoeid, want er wordt alleen
-- de sleutel `vakanties` gezet en niet het hele object overschreven.
--
-- Twee keer draaien kan geen kwaad: de lijst wordt vervangen, niet aangevuld, dus je krijgt
-- geen dubbele periodes.
--
-- Overgenomen uit "GANTOISE TENNIS - KALENDER JAARCYCLUS 2026-2027", de rode dagen.
-- Vijf periodes hebben nog geen naam gekregen omdat ze op geen bekende feestdag vallen;
-- die staan als "Geen les" en kan je in Beheer -> Kalender hernoemen.

insert into club_settings (id, value)
values ('club', '{}'::jsonb)
on conflict (id) do nothing;

update club_settings
set value = jsonb_set(value, '{vakanties}', '[
  {"id":"vak-2026-11-02","naam":"Herfstvakantie",      "van":"2026-11-02","tot":"2026-11-08"},
  {"id":"vak-2026-11-11","naam":"Wapenstilstand",      "van":"2026-11-11","tot":"2026-11-11"},
  {"id":"vak-2026-12-21","naam":"Kerstvakantie",       "van":"2026-12-21","tot":"2027-01-03"},
  {"id":"vak-2027-01-15","naam":"Geen les",            "van":"2027-01-15","tot":"2027-01-23"},
  {"id":"vak-2027-02-06","naam":"Krokusvakantie",      "van":"2027-02-06","tot":"2027-02-12"},
  {"id":"vak-2027-03-28","naam":"Paasvakantie",        "van":"2027-03-28","tot":"2027-04-10"},
  {"id":"vak-2027-05-01","naam":"Feest van de arbeid", "van":"2027-05-01","tot":"2027-05-02"},
  {"id":"vak-2027-05-06","naam":"Hemelvaart",          "van":"2027-05-06","tot":"2027-05-07"},
  {"id":"vak-2027-05-17","naam":"Pinkstermaandag",     "van":"2027-05-17","tot":"2027-05-17"},
  {"id":"vak-2027-05-25","naam":"Geen les",            "van":"2027-05-25","tot":"2027-05-25"},
  {"id":"vak-2027-05-30","naam":"Geen les",            "van":"2027-05-30","tot":"2027-05-30"},
  {"id":"vak-2027-06-01","naam":"Geen les",            "van":"2027-06-01","tot":"2027-06-03"},
  {"id":"vak-2027-06-06","naam":"Geen les",            "van":"2027-06-06","tot":"2027-06-06"}
]'::jsonb),
    updated_at = now()
where id = 'club';

-- Controle: hier horen dertien periodes uit te komen.
-- select jsonb_array_length(value->'vakanties') from club_settings where id = 'club';
