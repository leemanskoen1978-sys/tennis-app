-- Onthouden welke ziekmelding een les afzegde.
--
-- Draai dit in de Supabase SQL-editor. Twee keer draaien kan geen kwaad.
--
-- WAAROM DIT NODIG IS. `bookings.status` zegt dát een les afgezegd is, niet waaróm. Een les die
-- de beheerder vanaf de werklijst afzegde omdat er geen vervanger te vinden was, en een les die
-- de speler zelf afzegde omdat hij ziek is, zien er identiek uit.
--
-- Sinds 6 september 2026 draait het verwijderen van een ziekmelding terug wat eruit volgde. Voor
-- de vervanger kan dat op de periode: `taught_by_id` wordt uitsluitend vanaf de werklijst gezet.
-- Voor de afzegging niet — op de periode afgaan zou een les hervatten die de speler had
-- afgezegd, en dat is erger dan een les die blijft ontbreken.
--
-- Vandaar dit veld. De werklijst zet er het id van de ziekmelding in; het verwijderen zet
-- precies díé lessen terug en raakt een speler-afzegging met zekerheid nooit aan. Bij het
-- terugzetten wordt het veld gewist, zodat er nooit een verwijzing blijft staan naar een melding
-- die niet meer bestaat.
--
-- Leeg is de normale toestand: elke andere afzegging, en elke les die niet afgezegd is. Er hoeft
-- dus niets ingevuld te worden voor wat er al staat.

alter table bookings
  add column if not exists cancelled_by_sick_leave text;

-- Geen verwijzing naar `sick_leaves(id)` met opzet: de melding wordt verwijderd en dit veld
-- overleeft dat moment. Een `references ... on delete set null` zou het veld wissen op precies
-- het moment dat de app het nodig heeft om te weten welke lessen terug moeten.

-- Controle: hier hoort één regel uit te komen, is_nullable = YES.
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'bookings' and column_name = 'cancelled_by_sick_leave';
