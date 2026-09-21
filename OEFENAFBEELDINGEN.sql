-- De afbeeldingen bij de oefeningen per kleur (Lesmateriaal → Oefeningen per kleur).
--
-- Draai dit in de Supabase SQL-editor. Twee keer draaien kan geen kwaad.
--
-- WAAROM DIT NODIG IS. De beheerder voegt op dat scherm tekeningen toe bij de opwarming, de
-- leskern, het tussenspel en de wedstrijdvorm. Dat zijn echte bestanden, dus ze horen in Storage
-- en niet in een tabel; zie lib/oefenafbeeldingen voor hoe ze heten (één map per kleur en week).
--
-- De bucket is PRIVÉ: de app vraagt per bezoek een tijdelijke link. Dat is met opzet, in
-- dezelfde geest als `les_planning` — dit is werkinstructie voor de trainer, geen openbare
-- pagina, en een speler heeft er niets mee te maken.
--
-- Dezelfde inhoud staat onderaan supabase-schema.sql. Lopen die twee uiteen, dan werkt de app
-- bij de club anders dan bij een verse installatie.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('oefeningen', 'oefeningen', false, 5242880, array['image/jpeg'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Lezen: elke trainer en de beheerder.
drop policy if exists oefeningen_select on storage.objects;
create policy oefeningen_select on storage.objects for select
  to authenticated using (bucket_id = 'oefeningen' and (is_coach() or is_admin()));

-- Toevoegen en weghalen: alleen de beheerder, zoals bij `les_planning`. Er is geen policy voor
-- `update`: een afbeelding vervang je door een nieuwe toe te voegen en de oude weg te halen.
drop policy if exists oefeningen_insert on storage.objects;
create policy oefeningen_insert on storage.objects for insert
  to authenticated with check (bucket_id = 'oefeningen' and is_admin());

drop policy if exists oefeningen_delete on storage.objects;
create policy oefeningen_delete on storage.objects for delete
  to authenticated using (bucket_id = 'oefeningen' and is_admin());
