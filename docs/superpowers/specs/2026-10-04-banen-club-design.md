# Een terrein hoort bij een club

*4 oktober 2026.*

## Waarom

Beheer → Facturatie toont bij elke klant "Uit de app" met hetzelfde getal: alle lessen van de
maand waar Koen de lesgever van was. Een les weet niet bij welke club ze hoort, dus VZW Racso
kreeg de 35 uur van Gantoise te zien. Het ontwerp van de facturatie
(`2026-10-04-facturatie-design.md`) verwachtte daar "0,00 u".

Racso-lessen kunnen later wel in de app komen, op eigen Racso-terreinen. De club van een les
volgt dus uit haar terrein.

## Wat er verandert

1. **Gegevens.** `courts` krijgt een kolom `club text` (mag leeg). `Court` in `lib/types.ts`
   krijgt `club?: string`. `BANEN-CLUB.sql` voegt de kolom toe en zet Terrein 1 tot en met 11
   op `GANTOISE` — dezelfde schrijfwijze als de kolom "Locatie" in de planning van de club en
   als "naam in de lijst" van Gantoise. `supabase-schema.sql` krijgt dezelfde kolom.
2. **Beheer → Banen.** Per terrein een tekstveld "Club", bewaard bij het verlaten van het veld.
3. **Facturatie.** `urenUitAppPerKlant` telt de uren per klant. Een les telt bij een klant als
   de club van haar terrein, door `schoon()`, gelijk is aan zijn "naam in de lijst" of zijn
   "korte naam". Exact, geen gedeeltelijke match — om dezelfde reden als bij `T.C. RACSO`.
   Wat bij geen enkele klant uitkomt, staat per terrein in `zonderKlant` en verschijnt als
   waarschuwing bovenaan het factuurblad, zoals de onbekende clubs uit de geplakte lijst.
   Wat een uur van Koen is, verandert niet: `lesgeverId`, geen afgezegde lessen, de maand van
   de begintijd.
4. De waarschuwing "meerdere clubs op de bron de app tellen dezelfde uren" verdwijnt: dat is
   niet meer waar.

## Buiten dit ontwerp

Racso-terreinen afschermen voor spelers van Gantoise: de app kent één lijst terreinen, en een
terrein dat je toevoegt is voor iedereen boekbaar.

## Testen

In `lib/facturatie.test.ts`: twee klanten op hun eigen terreinen; een terrein zonder club en
een club zonder klant komen in `zonderKlant`; hoofdletters en dubbele spaties maken niets uit;
de korte naam telt ook; een les van een andere trainer en een afgezegde les tellen niet.
