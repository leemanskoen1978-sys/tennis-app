-- Lesmateriaal doorsturen voor een periode, per trainer en per groep.
--
-- Draai dit in de Supabase SQL-editor. Twee keer draaien kan geen kwaad.
--
-- WAAROM DIT NODIG IS. De tennisschool werkt met een lessenboekje: in een bepaalde periode doet
-- een groep of een trainer een bepaalde training. Lesmateriaal (`lessons`) hangt vandaag aan
-- precies één speler (`student_id`) of aan niemand, dus die afspraak leefde buiten de app — in
-- een mail of op papier — en een trainer die op zijn lesdag keek, zag niet wat hij hoorde te
-- geven.
--
-- Dezelfde inhoud staat onderaan supabase-schema.sql. Lopen die twee uiteen, dan werkt de app
-- bij de club anders dan bij een verse installatie.

create table if not exists les_planning (
  id text primary key,
  lesson_id text not null references lessons(id) on delete cascade,
  coach_id text references users(id) on delete cascade,
  group_id text references lesson_groups(id) on delete cascade,
  van date not null,
  tot date not null,
  created_at timestamptz not null default now(),
  -- Dezelfde regel als `lesplanningFout` in lib/lesplanning: beide leeg zou stilzwijgend "de
  -- hele club" betekenen. De app zorgt dat er geen knop is die hier geweigerd wordt; dit is de
  -- bewaking (zie het kopcommentaar van lib/rechten.ts).
  constraint les_planning_doelwit check (coach_id is not null or group_id is not null)
);

-- `on delete cascade` op alle drie de verwijzingen, en met opzet niet `set null` zoals bij
-- `bookings.taught_by_id`. Dat verschil zit hierin: een boeking blijft bestaan en valt bij een
-- lege waarde terug op een geldige toestand ("de vaste trainer gaf hem zelf"). Een planningrij
-- heeft die terugval niet — zonder materiaal, of zonder de trainer of groep waar ze over ging,
-- betekent ze niets meer en hoort ze weg.

create index if not exists les_planning_coach_idx on les_planning (coach_id);
create index if not exists les_planning_group_idx on les_planning (group_id);
create index if not exists les_planning_lesson_idx on les_planning (lesson_id);

alter table les_planning enable row level security;

-- Lezen: elke trainer, want hij moet de planning van zijn eigen lessen zien. Dat is dezelfde
-- grens die `lessons_select` al hanteert voor de bibliotheek.
--
-- DE SPELER STAAT HIER MET OPZET NIET BIJ (beslist op 9 september 2026). Dit is werkinstructie
-- voor de trainer. Zou een speler het moeten zien, dan kost dat twee openingen in de bestaande
-- bewaking in plaats van nul: `lessons_select` laat hem alleen materiaal lezen dat aan hemzelf
-- hangt, en `lesson_groups_select` is alleen voor de beheerder.
drop policy if exists les_planning_select on les_planning;
create policy les_planning_select on les_planning for select
  to authenticated using (is_coach() or is_admin());

-- Schrijven: alleen de beheerder, zoals bij `lesson_groups` en `sick_leaves`. Wat de club die
-- periode geeft, beslist de tennisschool en niet een trainer voor zichzelf.
drop policy if exists les_planning_write on les_planning;
create policy les_planning_write on les_planning for all
  to authenticated using (is_admin()) with check (is_admin());
