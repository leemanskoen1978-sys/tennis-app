-- Een terrein hoort bij een club.
--
-- WAAROM. Beheer → Facturatie toonde bij elke klant hetzelfde getal "Uit de app": een les wist
-- niet bij welke club ze hoort, en VZW Racso kreeg zo de uren van Gantoise te zien. Sinds
-- 4 oktober 2026 volgt de club uit het terrein: de facturatie telt een les bij de klant
-- waarvan de naam gelijk is aan de club van haar terrein. Zie
-- docs/superpowers/specs/2026-10-04-banen-club-design.md.
--
-- Terrein 1 tot en met 11 zijn die van Gantoise. `GANTOISE` is de schrijfwijze van de kolom
-- "Locatie" in de planning van de club, en de "naam in de lijst" van Gantoise in de
-- facturatie. Een Racso-terrein dat later bijkomt, krijgt zijn club in Beheer → Banen.
--
-- Twee keer draaien kan geen kwaad: de kolom komt er alleen bij als ze er nog niet is, en een
-- terrein dat al een club heeft, blijft ongemoeid.

alter table courts add column if not exists club text;

update courts
set club = 'GANTOISE'
where club is null
  and name in ('Terrein 1', 'Terrein 2', 'Terrein 3', 'Terrein 4', 'Terrein 5', 'Terrein 6',
               'Terrein 7', 'Terrein 8', 'Terrein 9', 'Terrein 10', 'Terrein 11');

-- Controle: elf terreinen met GANTOISE. Staat er een terrein zonder club tussen, dan meldt de
-- facturatie zijn uren tot je de club invult in Beheer → Banen.
select number, name, club from courts order by number;

-- Daarna de app hard herladen: ze leest de databank bij het opstarten.
