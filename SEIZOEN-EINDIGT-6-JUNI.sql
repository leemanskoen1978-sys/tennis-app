-- Het seizoen eindigt op 6 juni 2027 en niet op 30 juni.
--
-- WAT ER MIS WAS. `SEIZOEN-EN-LESDUUR.sql` zette `season_end` op 2027-06-30. Dat was een
-- verkeerde lezing van de kalenderfoto: 7 t/m 30 juni is wit, net als 1 t/m 6 september, en wit
-- is buiten het seizoen. De import plande daardoor vier weken te veel in.
--
-- HOE HET AAN HET LICHT KWAM. De eigenaar telde dertig woensdagen en de app toonde er
-- vierendertig. De rekensom wees één kant op: met een seizoen tot 6 juni komen dinsdag tot en
-- met zaterdag allemaal op precies dertig lesweken uit — het getal van het tarievenblad, op vijf
-- dagen tegelijk. Met 30 juni komt geen enkele dag daarop uit.
--
-- WAAROM DIT MET SQL MOET EN NIET MET EEN HERIMPORT. De import verwijdert nooit een les (D-13).
-- Een les die niet meer in het bestand voorkomt wordt gemeld en niet weggegooid — dat is een
-- bewuste afspraak en een goede: een importbestand hoort geen agenda te kunnen leegvegen. Het
-- opruimen is dus een aparte, zichtbare handeling, en dit bestand is die handeling.
--
-- DRIE STAPPEN. Lees stap 2 voor je hem draait; die verwijdert lessen en dat is onomkeerbaar.

-- ---------------------------------------------------------------------------
-- STAP 1 · Het seizoen rechtzetten
-- ---------------------------------------------------------------------------

update club_settings
set value = value || jsonb_build_object('season_end', '2027-06-06'),
    updated_at = now()
where id = 'club';

-- Controle: hier hoort 2026-09-07 en 2027-06-06 uit te komen.
select value->>'season_start' as van, value->>'season_end' as tot
from club_settings where id = 'club';

-- ---------------------------------------------------------------------------
-- STAP 2 · KIJKEN, dan pas verwijderen
-- ---------------------------------------------------------------------------
--
-- Eerst tellen. Verwacht: 660 lessen, verdeeld over 7 tot en met 30 juni 2027.
--
-- Die 660 zijn uitgerekend uit de groepen per weekdag (24 op maandag, 20 op dinsdag, 43 op
-- woensdag, 23 op donderdag, 23 op vrijdag, 41 op zaterdag, 19 op zondag) maal het aantal keer
-- dat die dag in dat venster valt, minus de twee groepen zonder spelers die sowieso geen lessen
-- hebben. Komt er een ander getal uit, stop dan en zeg het — dan klopt een van beide sommen niet.

select count(*) as te_verwijderen,
       min(start_time) as eerste,
       max(start_time) as laatste
from bookings
where start_time >= '2027-06-07'
  and group_id is not null;

-- En dan pas dit. `group_id is not null` staat er zodat een losse baanreservering die iemand
-- zelf voor eind juni maakte blijft staan: die komt niet uit de import en gaat ons niet aan.

delete from bookings
where start_time >= '2027-06-07'
  and group_id is not null;

-- ---------------------------------------------------------------------------
-- STAP 3 · Controle
-- ---------------------------------------------------------------------------
--
-- Verwacht: 5736 lessen, en de laatste op vrijdag 4 juni 2027 — zaterdag 5 juni is de laatste
-- lesdag van het seizoen, en 6 juni is een "Geen les"-dag.

select count(*) as lessen_over, max(start_time) as laatste_les
from bookings
where start_time >= '2026-09-07';

-- Daarna de app hard herladen (Cmd+Shift+R): hij houdt de lessen in het geheugen en telt anders
-- door met de oude. Op de kaart van een speler hoort "34 aankomend" dan 30 te zijn geworden.
