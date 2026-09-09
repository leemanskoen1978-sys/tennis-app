-- Welke uren er bij een trainer bezet zijn — zonder te verklappen wie er dan les heeft.
--
-- WAT ER MIS IS. Op Reserveren (`app/agenda/new.tsx`) rekent het scherm uit welke uren nog
-- vrij zijn met de lessen die het heeft. Maar `bookings_select` geeft een speler alleen zijn
-- eigen lessen en die van zijn kind, en verder niets. Voor een ouder staat de woensdag van
-- zijn trainer dus helemaal leeg terwijl die vol zit. Hij vraagt een uur aan dat allang bezet
-- is, en de trainer ziet de botsing pas als de aanvraag binnenkomt.
--
-- Gevonden op 9 september 2026 door de eigenaar, kijkend als ouder. Zie OPENSTAAND.md punt 1e.
--
-- WAAROM DE POLICY NIET VERRUIMD WORDT. "Geef een speler ook de lessen van andere spelers bij
-- zijn trainer" lost het op en breekt iets ergers: dan leest hij wie er bij zijn trainer les
-- heeft, op welk uur, met naam. Bij 555 leden en veel kinderen is dat precies wat die regel
-- afschermt. RLS schermt rijen af en geen kolommen, dus "wel de tijd, niet de naam" kan daar
-- niet uitgedrukt worden.
--
-- WAT HIER DAN WEL STAAT. Eén functie die op de vraag antwoordt en niets meer: geef mij de
-- begin- en eindtijden van deze ene trainer, in dit ene venster. Geen namen, geen spelers,
-- geen bedragen, geen id's — twee tijdstippen per les. Wie de dag van een trainer opvraagt,
-- krijgt te zien dat er van 14:00 tot 15:00 iets staat, en niet wát of wie.
--
-- Een functie en geen view, om twee redenen. Een view zou de hele tabel in één keer
-- beschikbaar maken en het is dan aan de aanroeper om zich te beperken; deze functie kán niet
-- meer teruggeven dan één trainer en één venster. En dit schema doet zijn rechtenwerk al met
-- `security definer`-functies (`app_user_id`, `is_admin`, `is_coach`), dus dit sluit aan bij
-- wat er staat in plaats van er een tweede patroon naast te zetten.
--
-- WAT DIT NIET DOET. Het blokkeert niets. Sinds 6 september 2026 geldt dat een overlap nooit
-- blokkeert en altijd waarschuwt — op Terrein 7 draait dezelfde trainer blauw en rood naast
-- elkaar op een halve baan (zie `addBooking` in providers/SimpleDataProvider.tsx). Deze
-- functie laat het scherm alleen zien wat er staat; wat je daarmee doet, blijft een keuze.
--
-- DRAAIEN. Eén keer, in de SQL-editor van Supabase. Hij is herhaalbaar: `create or replace`
-- en `revoke`/`grant` mogen zo vaak als je wil.

-- ---------------------------------------------------------------------------
-- De functie
-- ---------------------------------------------------------------------------

-- `security definer`, want dat is het hele punt: de vraag moet langs `bookings` zonder zelf
-- door `bookings_select` te gaan. Zonder dat zou hij precies dezelfde lege dag teruggeven als
-- het scherm nu al heeft.
--
-- `stable`: binnen één query verandert het antwoord niet.
--
-- `set search_path = public` staat er om dezelfde reden als bij de bestaande functies: een
-- `security definer`-functie zonder vast zoekpad is te misleiden met een eigen schema.
-- Het venster is begrensd, en die grens zit ín de functie. Er staat met opzet geen tweede,
-- onbegrensde versie naast: die zou de grens meteen weer waardeloos maken, want wie de ene mag
-- aanroepen mag de andere ook. Zonder grens is dit een manier om het hele lesrooster van een
-- trainer in één keer op te halen — nog steeds zonder namen, maar wel het volledige patroon
-- van zijn jaar. Reserveren kijkt veertien dagen vooruit, dus eenendertig is ruim.
create or replace function bezette_uren(
  trainer text,
  van timestamptz,
  tot timestamptz
)
returns table (start_time timestamptz, end_time timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  max_dagen constant int := 31;
begin
  if van is null or tot is null or trainer is null then
    raise exception 'Geef een trainer, een begin en een einde.';
  end if;
  if tot <= van then
    raise exception 'Het venster eindigt niet na zijn begin.';
  end if;
  if tot - van > (max_dagen || ' days')::interval then
    raise exception 'Vraag hoogstens % dagen tegelijk op.', max_dagen;
  end if;

  return query
    select b.start_time, b.end_time
    from bookings b
    where b.coach_id = trainer
      -- Een afgezegde les houdt geen uur meer bezet. Zelfde regel als `bezetteSlots` in
      -- lib/slots.ts, zodat het scherm en de databank hetzelfde zeggen.
      and b.status <> 'cancelled'
      -- Overlap met het gevraagde venster, niet "begint erin": een les van 23:30 tot 00:30
      -- hoort bij allebei de dagen die hij raakt.
      and b.start_time < tot
      and b.end_time > van
    order by b.start_time;
end;
$$;

-- ---------------------------------------------------------------------------
-- Wie hem mag aanroepen
-- ---------------------------------------------------------------------------

-- Niet `anon`: wie niet ingelogd is, heeft hier niets te zoeken. Een uitgelogde bezoeker die
-- het lesrooster van de club kan uitlezen, is een lek dat je niet ziet gebeuren.
revoke all on function bezette_uren(text, timestamptz, timestamptz) from public, anon;

-- Elk ingelogd lid. Dat is de bedoeling: een speler moet kunnen zien wanneer zijn trainer
-- bezet is, anders vraagt hij uren aan die niet kunnen.
grant execute on function bezette_uren(text, timestamptz, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- Nakijken
-- ---------------------------------------------------------------------------
--
-- Vervang het id door dat van een trainer met lessen (`select id, name from users where role =
-- 'coach'`). Er horen tijdstippen uit te komen en verder niets.
--
--   select * from bezette_uren(
--     'u_ann',
--     '2026-09-09T00:00:00+02'::timestamptz,
--     '2026-09-10T00:00:00+02'::timestamptz
--   );
--
-- En de grens, die een fout hoort te geven ("Vraag hoogstens 31 dagen tegelijk op."):
--
--   select * from bezette_uren(
--     'u_ann',
--     '2026-01-01T00:00:00+01'::timestamptz,
--     '2027-01-01T00:00:00+01'::timestamptz
--   );
