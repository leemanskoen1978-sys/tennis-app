-- De aanwezigheid van een oude les is voor de beheerder.
--
-- Draai dit in de SQL-editor van Supabase. Het verandert één functie en raakt geen gegevens.
--
-- ---------------------------------------------------------------------------
-- WAAROM
-- ---------------------------------------------------------------------------
--
-- `bewaak_betaalvelden` liet de trainer van een les alles schrijven, met één regel bovenaan:
--
--     if is_admin() or old.coach_id = app_user_id() then return new; end if;
--
-- Daarmee kon een trainer de aanwezigheid van een heel seizoen herschrijven. Wat geweest is,
-- is wat er op de baan is vastgesteld; vergat hij af te vinken, dan meldt hij het aan de
-- beheerder en die zet het recht.
--
-- De grens is de DAG en niet het uur. Afvinken gebeurt ná de les: zou de grens "zodra de les
-- voorbij is" zijn, dan blokkeert ze een trainer die zijn groep om vijf over het uur afvinkt,
-- en dat is het gewone geval en geen correctie. Hij houdt dus tot middernacht de tijd.
--
-- Alleen de AANWEZIGHEID wordt begrensd, niet de rest. Een trainer moet de betaalwijze van
-- een oude les nog kunnen rechtzetten; dat is administratie en geen waarneming. Wie de les
-- werkelijk gaf (`taught_by_id`) kon hij al niet zetten — dat is al beheerderswerk.
--
-- `coalesce(taught_by_id, coach_id)` en niet `coach_id`: een vervanger die de les overnam,
-- stond op de baan en vinkt dus af. Dat is dezelfde regel als `lesgeverId` in lib/lesgever.
--
-- ---------------------------------------------------------------------------
-- LET OP — deze functie staat TWEE KEER in supabase-schema.sql
-- ---------------------------------------------------------------------------
--
-- Rond regel 411 en rond regel 962. Omdat `create or replace` van boven naar beneden loopt,
-- wint de tweede en is de eerste dode tekst. Ze zijn ook uit elkaar gegroeid: alleen de
-- tweede kent de regel dat `taught_by_id` beheerderswerk is, terwijl de eerste het betere
-- commentaar draagt. Dit bestand vervangt de werkende versie; in supabase-schema.sql zijn
-- allebei bijgewerkt zodat het niet meer uitmaakt welke wint.

create or replace function bewaak_betaalvelden()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mijn text[];
  vandaag timestamptz;
begin
  -- Buiten een sessie om (een script, de SQL-editor) geldt deze grens niet.
  if auth.uid() is null then return new; end if;

  -- De beheerder mag alles. Hij is degene bij wie een trainer een vergissing meldt.
  if is_admin() then return new; end if;

  -- Wie de les werkelijk gaf, voedt de loonstaat; dat blijft beheerderswerk.
  if new.taught_by_id is distinct from old.taught_by_id then
    raise exception 'Alleen een beheerder kan invullen wie de les werkelijk gaf.';
  end if;

  -- "Vandaag" is een dag op de kalender hier, niet in UTC: een les van vanochtend om negen
  -- uur hoort tot vanavond van de speler te blijven, en met de UTC-dag zou dat verschuiven.
  vandaag := date_trunc('day', now() at time zone 'Europe/Brussels') at time zone 'Europe/Brussels';

  -- De lesgever van deze les: alles mag, behalve de aanwezigheid van een oude les.
  -- `coalesce` omdat een vervanger op de baan stond en dus afvinkt.
  if coalesce(old.taught_by_id, old.coach_id) = app_user_id() then
    if new.attendance is distinct from old.attendance and old.start_time < vandaag then
      raise exception 'Wie er bij een les uit het verleden stond, zet de beheerder recht.';
    end if;
    return new;
  end if;

  -- Vanaf hier: een speler of een ouder.
  if (to_jsonb(new) - 'payment_method' - 'beurtenkaart_id' - 'attendance')
     is distinct from (to_jsonb(old) - 'payment_method' - 'beurtenkaart_id' - 'attendance') then
    raise exception 'Alleen de betaalwijze en je eigen aanwezigheid mag je zelf wijzigen.';
  end if;

  -- De betaalvelden zijn van wie de rekening krijgt. Wie meespeelt maar niet betaalt, komt
  -- sinds de aanwezigheid ook langs `bookings_update`, en die mag hier niet ineens de
  -- betaalwijze van een ander zetten.
  if (new.payment_method is distinct from old.payment_method
      or new.beurtenkaart_id is distinct from old.beurtenkaart_id)
     and not (old.player_id = app_user_id() or is_mijn_kind(old.player_id)) then
    raise exception 'De betaalwijze zet de speler die de rekening krijgt.';
  end if;

  if new.attendance is distinct from old.attendance then
    if old.start_time < vandaag then
      raise exception 'Wie er bij een les uit het verleden stond, noteert de trainer.';
    end if;
    -- Voor wie je spreekt: jezelf en je goedgekeurde kinderen. Al de rest van de lijst moet
    -- na de wijziging nog letterlijk hetzelfde zijn.
    mijn := array(
      select coalesce(app_user_id(), '')
      union
      select child_id from ouder_kind
        where parent_id = app_user_id() and status = 'approved'
    );
    if (coalesce(new.attendance, '{}'::jsonb) - mijn)
       is distinct from (coalesce(old.attendance, '{}'::jsonb) - mijn) then
      raise exception 'Je past alleen je eigen aanwezigheid aan.';
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Controle
-- ---------------------------------------------------------------------------
--
-- 1 · De trigger hangt er nog aan. Hier hoort één regel uit te komen.

select tgname, tgenabled
from pg_trigger
where tgname = 'bookings_betaalvelden_bewaakt' and not tgisinternal;

-- 2 · De functie bevat de nieuwe regel. Hier hoort `true` uit te komen.

select prosrc like '%zet de beheerder recht%' as nieuwe_regel_staat_erin
from pg_proc
where proname = 'bewaak_betaalvelden';

-- 3 · De echte test doe je in de app, ingelogd als trainer (niet als beheerder, want die
--     mag alles):
--
--     - vink een les van vandaag af, ook eentje die al is afgelopen  -> moet lukken
--     - probeer de aanwezigheid van een les van gisteren te wijzigen -> moet weigeren met
--       "Wie er bij een les uit het verleden stond, zet de beheerder recht."
--     - wijzig de betaalwijze van een les van vorige maand           -> moet nog steeds lukken
