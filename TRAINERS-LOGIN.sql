-- Logins voor de trainers, met wachtwoord 123.
--
-- Draai dit in de Supabase SQL-editor, NA de import van de clublijst: dit bestand maakt geen
-- trainers aan, het geeft de trainers die er al staan een login. De import maakt de rijen in
-- `users` (rol `coach`, met een demo-adres); dit bestand maakt hun account in `auth.users`.
--
-- Twee keer draaien kan geen kwaad: een trainer die al een login heeft, wordt overgeslagen.
--
-- ---------------------------------------------------------------------------
-- LEES DIT EERST
-- ---------------------------------------------------------------------------
--
-- Dit zet het wachtwoord `123` op elk trainersaccount. Deze databank bevat de echte namen van
-- 550 spelers van de club, hun lesgroepen en hun agenda. Twaalf accounts met een wachtwoord van
-- drie cijfers zijn geen beveiliging; ze zijn een deur die openstaat.
--
-- Dat is prima om mee door te klikken en te testen, en het is uitdrukkelijk wat er gevraagd is.
-- Het is niet prima om te laten staan zodra de club er echt mee werkt. Wat er dan moet gebeuren:
-- elke trainer zet zijn eigen wachtwoord via "wachtwoord vergeten", of je draait het onderaan
-- staande blok dat de wachtwoorden ongeldig maakt.
--
-- Het adres is een demo-adres op `example.com`. Dat domein is bij RFC 2606 gereserveerd en kan
-- nooit post ontvangen: er gaat dus met zekerheid geen bevestigingsmail naar een echt persoon.
-- Vandaar ook dat het account hier meteen als bevestigd wordt aangemaakt — een bevestigingsmail
-- zou nergens aankomen en de trainer zou nooit binnen raken.

-- 1 · pgcrypto, voor het versleutelen van het wachtwoord.
create extension if not exists pgcrypto with schema extensions;

-- 2 · Een login voor elke trainer die er nog geen heeft.
--
--     `auth_id is null` is de test: de trigger `link_auth_user` vult dat veld zodra er een
--     account op hetzelfde adres bestaat. Staat het leeg, dan is er geen login.
--
--     `email_confirmed_at` wordt meteen gezet, zie hierboven. `raw_app_meta_data` en
--     `raw_user_meta_data` moeten gevuld zijn, anders struikelt de GoTrue-server erover bij het
--     inloggen; dit zijn de waarden die Supabase zelf ook schrijft.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
select
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  u.email,
  extensions.crypt('123', extensions.gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb
from users u
where u.role = 'coach'
  and u.auth_id is null
  and u.email is not null
  and u.email <> ''
  and not exists (select 1 from auth.users a where a.email = u.email);

-- 3 · De ledenrijen aan hun verse login knopen.
--
--     De trigger doet dit voor een login die ná de ledenrij ontstaat, maar niet met terugwerkende
--     kracht voor de rijen die er al stonden. Vandaar deze update; hij is onschadelijk als de
--     trigger zijn werk al deed.
update users u
set auth_id = a.id
from auth.users a
where u.email = a.email
  and u.auth_id is null
  and u.role = 'coach';

-- 4 · Een identiteit per account.
--
--     Zonder rij in `auth.identities` weigert Supabase het inloggen met "Invalid login
--     credentials", ook al klopt het wachtwoord. Dat is de valkuil waar leslie-login.sql ook op
--     stuitte.
insert into auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select
  a.id::text,
  a.id,
  jsonb_build_object('sub', a.id::text, 'email', a.email, 'email_verified', true),
  'email',
  now(),
  now(),
  now()
from auth.users a
join users u on u.email = a.email and u.role = 'coach'
where not exists (
  select 1 from auth.identities i where i.user_id = a.id and i.provider = 'email'
);

-- ---------------------------------------------------------------------------
-- 5 · Controle
-- ---------------------------------------------------------------------------
--
-- Hier hoort per trainer één regel uit te komen, met een adres, `heeft_login` = true en
-- `heeft_identiteit` = true. Verwacht: twaalf trainers na de import van de clublijst.

select
  u.name,
  u.email,
  (u.auth_id is not null) as heeft_login,
  exists (
    select 1 from auth.identities i where i.user_id = u.auth_id and i.provider = 'email'
  ) as heeft_identiteit
from users u
where u.role = 'coach'
order by u.name;

-- ---------------------------------------------------------------------------
-- 6 · Het opruimblok — draai dit zodra de club er echt mee gaat werken
-- ---------------------------------------------------------------------------
--
-- Dit maakt elk trainerswachtwoord ongeldig zonder de accounts weg te gooien: niemand kan meer
-- inloggen met `123`, en elke trainer kan zichzelf via "wachtwoord vergeten" een eigen
-- wachtwoord zetten. Staat met opzet uitgecommentarieerd; haal de streepjes weg als het zover
-- is.
--
-- update auth.users a
-- set encrypted_password = extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')),
--     updated_at = now()
-- from users u
-- where u.auth_id = a.id and u.role = 'coach';
