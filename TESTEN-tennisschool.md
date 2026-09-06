# De tennisschool-module testen

Bijgewerkt op 6 september 2026. Alle code staat op `main` en is gepusht.
1463 tests groen, `npx tsc --noEmit` schoon, webbuild slaagt.

---

## 0. Eerst dit, anders werkt er niets

**Draai de migratie.** De module voegt twee tabellen, twee kolommen, een index en een
gewijzigde trigger toe. Zolang die er niet zijn, blijven de nieuwe schermen leeg — de app
blijft wél gewoon werken, dat is met opzet zo gebouwd.

1. Open je Supabase-project → SQL Editor.
2. Plak de volledige inhoud van **`MIGRATIE-tennisschool.sql`** (staat in de projectmap).
3. Draai het.

Alles is `if not exists` / `create or replace`, dus twee keer draaien kan geen kwaad.

Wat erin zit:

| | |
| --- | --- |
| `lesson_groups` | de lesgroepen, met roster, seizoen en archiefvlag |
| `bookings.group_id` | de verwijzing van een les naar zijn groep |
| `bookings.taught_by_id` | wie de les werkelijk gaf |
| `sick_leaves` | de ziekmeldingen, met `retracted_at` voor intrekken |
| `bewaak_betaalvelden` | uitgebreid: alleen een beheerder mag `taught_by_id` zetten |

**Let op bij het testen.** De dev-server praat met de échte productiedatabank van de club.
Wil je vrij kunnen klikken zonder de club te raken: hernoem je `.env` tijdelijk naar
`.env.uit` en start met `npx expo start --web --clear` — dan draait de app op
voorbeeldgegevens.

---

## 1. Lesgroepen — Beheer → Club → Lesgroepen

- [ ] Maak een groep aan: naam, niveau, dag, uur, trainer, baan, seizoen van–tot.
- [ ] Voeg spelers toe aan het rooster; haal er een weg.
- [ ] Verzet de groep naar een ander uur. **Vóór het opslaan** hoort er te staan hoeveel
      lessen meeverzetten, en welke blijven staan omdat de trainer of de baan dan bezet is.
- [ ] Sla op. De komende lessen staan op het nieuwe uur; het blok "Eerder en afgezegd" is
      onveranderd — zelfde datums, zelfde uren.
- [ ] Geef de groep een andere trainer. De komende lessen gaan mee, maar een les waar al een
      vervanger op stond, houdt die vervanger.
- [ ] Wijzig alleen de naam. Er hoort te staan dat er niets meeverzet, en geen enkele les
      mag bewegen.
- [ ] Archiveer een groep. De gegeven lessen en hun geschiedenis blijven staan.
- [ ] Log in als gewone trainer en tik `/admin/lesgroepen` in de adresbalk. Verwacht:
      "Lesgroepen zijn alleen voor de beheerder."

## 2. Wie gaf de les écht — op een les in de agenda

- [ ] Open een les. Er hoort een blok te staan waarmee je invult wie hem werkelijk gaf.
- [ ] Vul een vervanger in. Op de leskaart blijft de vaste trainer staan, met "(vervangen)"
      erachter — beide namen, nooit de een in plaats van de ander.
- [ ] Kijk in Beheer → Rapport: het loon van die les hoort nu bij de vervanger, tegen diens
      eigen uurtarief. De vaste trainer krijgt er niets voor.
- [ ] De omzet mag níét veranderd zijn. Omzet loopt op het tarief van de baan, loon op dat
      van de trainer.
- [ ] Log in als de trainer van die les (niet als beheerder). Hij hoort de keuze niet te
      krijgen — anders kan hij zijn eigen loonstaat sturen.

## 3. Ziekmelding en werklijst — Beheer → Club → Ziekmelding

- [ ] Meld een trainer ziek van–tot, eventueel met reden.
- [ ] Je komt in de werklijst. Alle geraakte lessen staan er, met datum, uur, baan, groep of
      speler en het aantal spelers.
- [ ] Kies bij één les "vervanger koppelen". De lijst toont wie kán, én daaronder wie niet
      kan mét de reden — buiten zijn uren, eigen les, afwijkende periode, clubvakantie, of
      zelf ziek. Wie niet kan is nog steeds aanklikbaar; jij beslist.
- [ ] Kies bij een andere les "laten staan". Die les blijft gemarkeerd staan in de agenda
      als "zoekt vervanger", en blijft in de werklijst.
- [ ] Zeg een derde les af.
- [ ] Koppel een vervanger aan één les uit een reeks of groep. De rest van de reeks mag niet
      meebewegen.
- [ ] Trek de ziekmelding in. De markering "zoekt vervanger" verdwijnt overal; lessen waar
      al een vervanger op staat, houden hem.

## 4. Export — Beheer → Club → Trainingen exporteren

- [ ] Kies een periode, klik de Excel-knop. Verwacht `lessen-JJJJ-MM.xlsx`.
- [ ] Vier tabbladen: `Lessen`, `Uren per trainer`, `Aanwezigheid`, `Groepen`.
- [ ] Blad Lessen: klik een cel in `Datum` — een echte datum, geen tekst. Sorteren op die
      kolom moet chronologisch gaan.
- [ ] Blad Uren per trainer: selecteer `Loon (EUR)`; Excel toont een som onderin. Vergelijk
      met Beheer → Rapport over dezelfde periode — het trainersloon hoort gelijk te zijn, en
      er hoort nergens een omzetbedrag te staan.
- [ ] Blad Aanwezigheid: per groep een datumrij met de spelers eronder, `X` / `afw` / leeg.
      Print-voorbeeld: bruikbaar als lege invullijst voor een vervanger zonder app.
- [ ] Blad Groepen: elke rij heeft een gevuld `Groep-ID`.
- [ ] Log in als gewone trainer, tik `/admin/export`. Verwacht de weigerzin.

## 5. Import — Beheer → Club → Trainingen importeren

- [ ] "Voorbeeldbestand downloaden" → open het in Excel. Negen kolommen, twee
      voorbeeldregels, de tweede zonder baan en zonder e-mailadres.
- [ ] Kies `koen.xlsx`. De droogloop hoort binnen enkele seconden te komen:
      **tien lesgroepen, 42 nieuwe spelers, nul ingeplande lessen.**
- [ ] Onder de aantallen staat een rode kaart: tien groepen worden nu níét aangemaakt, omdat
      er geen trainer aan hangt. Dat hoort er te staan.
- [ ] Geef `Leemans Koen` een traineraccount in Beheer → Leden (rol trainer). Kies
      `koen.xlsx` opnieuw. Nu horen de tien groepen er wél te komen, met hun rosters.
- [ ] **De lessen komen nog steeds niet** — en dat klopt: in `koen.xlsx` staat overal
      `Indoor` in plaats van een terreinnummer, en een les kan niet bestaan zonder baan. De
      droogloop zegt dat per groep.

      Wil je de lessen ook, dan is dit de weg:
      1. Vervang in het bestand `Indoor` door `10` op de woensdagregels en `8` op de
         vrijdagregels. De kolom mag `Indoor/Outdoor` blijven heten — de app leest hem als
         baan zodra er een nummer in staat.
      2. Zorg dat er in Beheer → Banen banen met nummer 8 en 10 bestaan.
      3. Lees het bestand opnieuw in. Nu horen de tien groepen hun lessen te krijgen.
- [ ] Lees `koen.xlsx` daarna nóg een keer in. Verwacht: nul nieuwe groepen, nul nieuwe
      spelers, nul nieuwe lessen. Dat is de belofte "veilig opnieuw te draaien", met eigen ogen.
- [ ] Exporteer een periode (punt 4) en lees dat bestand meteen weer in. Verwacht: alles
      herkend, niets verdubbeld.

---

## Wat je moet weten vóór je begint

**De export werkt alleen op de website, niet in de telefoon-app.** Op een telefoon staat er
een zin in plaats van een knop. `lib/share.ts` kan daar geen xlsx afleveren.

**Een import kan niet zichzelf terugdraaien.** Er is geen transactie over meerdere tabellen,
en die kan er niet komen zonder SQL te draaien — wat deze module bewust niet doet. Wat wél
waar is: gaat er iets mis halverwege, dan blijft staan wat er stond, komt er niets dubbel
bij, en maakt hetzelfde bestand nog eens inlezen het af. Dat staat ook zo op het scherm.

**Een groep hernoemen in een geëxporteerd bestand** wordt herkend aan het `Groep-ID` en werkt
de groepsrij bij — maar de lessen verhuizen niet mee. Een import verzet geen seizoen als
bijwerking van het lezen van een bestand; de gevolgen staan in de droogloop en jij beslist.

**Nog niet gebouwd, bewust:** spelers en ouders automatisch verwittigen bij een wijziging,
een clubbreed weekraster, inhaallessen, wachtlijsten, en een trainer die zichzelf ziek meldt.
Die staan als v2 in `.planning/REQUIREMENTS.md`.

**Twee kleine dingen die er al waren en die ik niet heb aangeraakt:** een losse boeking
controleert alleen of de trainer vrij is, niet of de baan al bezet is; en `newGoalId` in
`lib/goals.ts` kan in theorie botsen omdat het op `Date.now()` plus vier tekens toeval leunt.
Allebei genoteerd, geen van beide veroorzaakt door dit werk.
