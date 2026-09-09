-- Een les vrijgeven, en een trainer die er zelf een overneemt.
--
-- Draai dit in de Supabase SQL-editor. Twee keer draaien kan geen kwaad.
--
-- WAAROM DIT NODIG IS. Tot nu vulde alleen de beheerder in wie een les werkelijk gaf: de trigger
-- `bewaak_betaalvelden` weigerde elke wijziging van `taught_by_id` die niet van hem kwam, en de
-- policy `bookings_update` liet een trainer de rij van een collega sowieso niet aanraken. Dat
-- klopte zolang toewijzen alleen vanaf de werklijst van een ziekmelding gebeurde. Nu neemt een
-- trainer zelf een openstaande les over, en daar hoort precies één opening bij — geen algemeen
-- schrijfrecht op de lessen van collega's.
--
-- Dezelfde inhoud staat in supabase-schema.sql, in de sectie "Wie gaf de les écht". Lopen die
-- twee uiteen, dan werkt de app bij de club anders dan bij een verse installatie.

-- Het merkteken "deze les zoekt een trainer", buiten ziekte om — gezet door de trainer van de
-- les of door de beheerder, op het lesdetailblad. Onwaar is de normale toestand, dus er hoeft
-- niets ingevuld te worden voor wat er al staat.
--
-- Het zegt niets over wie de les geeft: coach_id blijft van wie de les is en taught_by_id blijft
-- het enige antwoord op wie er werkelijk stond (zie lib/lesgever.ts). Of een les daarmee ook echt
-- openstaat, beslist `les_staat_open` hieronder — daar telt ook mee of er al een lesgever op
-- staat en of de les afgezegd is.
alter table bookings
  add column if not exists zoekt_trainer boolean not null default false;

-- Staat deze les open om over te nemen?
--
-- De tegenhanger van `staatOpen` in lib/openstaand.ts. Dezelfde dubbeling als tussen
-- lib/rechten.ts en de policies: de app zorgt dat er geen knop staat die hier geweigerd wordt,
-- dit is de bewaking. Lopen ze uiteen, dan is het gevolg een geweigerde knop met een melding —
-- en nooit een stille wijziging.
--
-- `least`/`greatest` op de ziekteperiode, net als `dektDag` in lib/ziekmelding.ts: er staat
-- minstens één omgekeerde rij in de databank van vóór de controle van 6 september 2026, en die
-- hoort hier hetzelfde te dekken als in de app.
--
-- De dag komt uit de Brusselse tijdzone en niet uit de UTC-datum van start_time: een avondles
-- schuift in UTC een dag op, en zou dan op de verkeerde dag ziek of juist gewoon lijken.
create or replace function les_staat_open(b bookings)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select b.status <> 'cancelled'
     and b.taught_by_id is null
     and (
       b.zoekt_trainer
       or exists (
         select 1 from sick_leaves z
          where z.coach_id = b.coach_id
            and z.retracted_at is null
            and (b.start_time at time zone 'Europe/Brussels')::date
                between least(z.van, z.tot) and greatest(z.van, z.tot)
       )
     );
$$;

-- De policy opnieuw, met één tak erbij: een trainer mag aan een rij komen die openstaat, en aan
-- een rij waar hij zelf als lesgever op staat. Hij staat hier en niet bij de andere policies
-- hierboven omdat hij `taught_by_id` en `zoekt_trainer` noemt — die kolommen bestaan pas vanaf
-- dit punt in het bestand.
--
-- Een policy kent alleen hele rijen en geen kolommen. Wélke kolom er mag veranderen, zegt
-- `bewaak_betaalvelden` hieronder.
drop policy if exists bookings_update on bookings;
create policy bookings_update on bookings for update
  to authenticated using (
    coach_id = app_user_id()
    or is_admin()
    or player_id = app_user_id()
    or is_mijn_kind(player_id)
    or exists (
      select 1 from jsonb_array_elements_text(coalesce(participant_ids, '[]'::jsonb)) as p(id)
      where p.id = app_user_id() or is_mijn_kind(p.id)
    )
    or (is_coach() and (les_staat_open(bookings) or taught_by_id = app_user_id()))
  )
  with check (
    coach_id = app_user_id()
    or is_admin()
    or player_id = app_user_id()
    or is_mijn_kind(player_id)
    or exists (
      select 1 from jsonb_array_elements_text(coalesce(participant_ids, '[]'::jsonb)) as p(id)
      where p.id = app_user_id() or is_mijn_kind(p.id)
    )
    or (is_coach() and (taught_by_id = app_user_id() or taught_by_id is null))
  );

create or replace function bewaak_betaalvelden()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mijn text[];
  vandaag timestamptz;
  alleen_lesgever boolean;
begin
  if auth.uid() is null then return new; end if;

  if new.taught_by_id is distinct from old.taught_by_id and not is_admin() then
    -- "Er verandert verder niets aan de rij" is het hart van deze uitzondering. Zonder die eis
    -- geeft de claimtak een trainer schrijfrecht op de hele boeking van een collega — het uur,
    -- de baan, de spelers, de betaalwijze.
    alleen_lesgever := (to_jsonb(new) - 'taught_by_id') = (to_jsonb(old) - 'taught_by_id');
    if not (
      alleen_lesgever
      and old.start_time > now()
      and (
        -- Overnemen: van leeg naar zichzelf, op een les die openstaat.
        (old.taught_by_id is null and new.taught_by_id = app_user_id()
           and is_coach() and les_staat_open(old))
        -- Teruggeven: van zichzelf naar leeg. Ook een les die de beheerder toewees mag terug —
        -- ze komt daarmee weer op de werklijst te staan en verdwijnt dus niet.
        or (old.taught_by_id = app_user_id() and new.taught_by_id is null)
      )
    ) then
      raise exception 'Alleen een beheerder kan invullen wie de les werkelijk gaf.';
    end if;
    return new;
  end if;

  if is_admin() or old.coach_id = app_user_id() then return new; end if;

  if (to_jsonb(new) - 'payment_method' - 'beurtenkaart_id' - 'attendance')
     is distinct from (to_jsonb(old) - 'payment_method' - 'beurtenkaart_id' - 'attendance') then
    raise exception 'Alleen de betaalwijze en je eigen aanwezigheid mag je zelf wijzigen.';
  end if;

  if (new.payment_method is distinct from old.payment_method
      or new.beurtenkaart_id is distinct from old.beurtenkaart_id)
     and not (old.player_id = app_user_id() or is_mijn_kind(old.player_id)) then
    raise exception 'De betaalwijze zet de speler die de rekening krijgt.';
  end if;

  if new.attendance is distinct from old.attendance then
    vandaag := date_trunc('day', now() at time zone 'Europe/Brussels') at time zone 'Europe/Brussels';
    if old.start_time < vandaag then
      raise exception 'Wie er bij een les uit het verleden stond, noteert de trainer.';
    end if;
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
