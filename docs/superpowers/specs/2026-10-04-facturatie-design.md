# Facturatie — ontwerp

*4 oktober 2026.*

Koen factureert zijn trainersuren aan twee clubs en doet dat vandaag in
`facturen.xlsx`. Dit ontwerp brengt dat werk naar de app: de lijst met lessen plakken,
aanvullen met wat er niet in staat, en er per club een factuur uit laten rollen.

Het is **persoonlijk werk, geen clubwerk**. Niemand anders in de club ziet dit scherm of
deze gegevens.

## Wat het vervangt

`facturen.xlsx` heeft vijf bladen: `Sheet3` (de geplakte lessen plus een blokje handmatige
privélessen en een urenoverzicht per club), `Klanten` (clubgegevens en uurtarief),
`Gantoise factuur`, `Racso factuur` en `Facturenregister`. De app neemt alle vijf over.

Drie dingen uit dat bestand gaan **niet** mee:

- **De km-vergoeding** (€ 0,3573/km, blok "GEMAAKTE KOSTEN"). Staat al op 0 km. Beslist op
  4 oktober 2026; komt erbij als Koen hem nodig heeft.
- **De tweede leverancier.** De Gantoise-factuur ging uit op naam van AI4U
  (BTW BE1039121804, IBAN BE09143136358257). Vanaf nu factureert **Sport4fun** aan beide
  clubs. AI4U komt niet in de app.
- **De controlekolom met zeven formules** (K9:L18). Die controles blijven, maar als gewone
  meldingen in het scherm, niet als cellen.

## Besluiten die vastliggen

Genomen in gesprek op 4 oktober 2026, in volgorde van het gesprek:

1. De gegevens staan **in de databank**, niet in het scherm of in de browser.
2. De uitvoer is een **xlsx-bestand**. Geen printbare pagina, geen PDF.
3. Met de hand kan je: **privélessen bijtikken**, **geplakte regels schrappen of hun uren
   corrigeren**, en **een vrije factuurlijn met eigen bedrag** toevoegen.
4. Het **factuurnummer typ je zelf**. De app stelt niets voor, maar waarschuwt als het
   nummer al in het register staat.
5. De **klantgegevens zijn beheerbaar** in een scherm, niet vast in de code.
6. **Alles wat geplakt is, telt mee.** Geen filter op trainer of status.
7. Het hangt onder **Beheer → Facturatie**.
8. Facturatie **schrijft nooit in de rest van de app** en koppelt geen enkele geplakte regel
   aan een bestaande les, speler of boeking. Lezen mag wel: zie *Twee bronnen* hieronder.
9. De leverancier is **Sport4fun** voor beide clubs.
11. **Racso wil een overzicht van de extra lessen.** Dat komt als tweede tabblad mee in
    hetzelfde bestand (bijgekomen op 4 oktober 2026).
10. Er zijn **twee bronnen van uren** en je kiest er per club één: de geplakte lijst, of de
    lessen die al in de app staan (bijgekomen op 4 oktober 2026, na het eerste ontwerp).

## Twee bronnen

Voor Gantoise staan de lessen ook gewoon in de app: het zijn de boekingen waar Koen de
lesgever van is. Voor Racso niet. Beide wegen moeten kunnen, en het scherm moet tonen welke
je neemt.

Per club kies je daarom **één** bron. Op de factuurkaart staan de twee getallen naast
elkaar:

```
  Uit de app              35,00 u      ( )
  Uit de geplakte lijst   35,00 u      (•)
  Privélessen              0,00 u
```

Eén tik wisselt. Lopen de twee uiteen, dan zie je dat meteen — dat is precies de controle
die vandaag niemand doet. Optellen kan niet: de twee beschrijven dezelfde lessen, en de som
zou dubbel zijn.

**Privélessen tellen altijd mee**, bij welke bron je ook kiest. Ze staan per definitie in
geen van beide lijsten.

De keuze wordt per klant bewaard (`bron_voorkeur` op `facturatie_klanten`), zodat Gantoise
op de app blijft staan en Racso op de geplakte lijst. Standaard is de geplakte lijst.

**Wat "uit de app" precies telt.** De boekingen waarvan Koen de lesgever is — `lesgeverId`
uit `lib/lesgever.ts`, dus inclusief lessen die hij van een collega overnam en zonder lessen
die hij liet overnemen. Dat is dezelfde definitie die zijn profiel al gebruikt
(`coachPayoutThisMonth` in `lib/reports.ts`). Afgezegde lessen (`status: 'cancelled'`)
tellen niet mee. De uren zijn `end_time - start_time`, op twee decimalen.

Schrappen en uren corrigeren werkt alleen op de geplakte lijst. Klopt er iets niet aan een
les in de app, dan hoort dat in de app rechtgezet te worden en niet in de facturatie.

## Toegang

Het scherm en de rij ernaartoe zijn zichtbaar voor één e-mailadres:
`leemanskoen@telenet.be`. Dat adres staat als constante in `lib/facturatie.ts`, met een
functie `magFactureren(email: string | null): boolean` eromheen die hoofdletters en spaties
negeert. De databank hangt er niet vanaf: daar beschermt RLS op `auth.uid()`, zodat een
tweede gebruiker die het pad raadt niets te zien krijgt.

## De vier bladen

Eén scherm, `app/admin/facturatie.tsx`, met vier bladen in de stijl van de rest van Beheer.

### Blad 1 — Lessen

Bovenaan een plakvlak met een knop **Verwerken**. Daaronder de lijst van alle gekende
lessen, nieuwste eerst, met een filter op club en op maand.

De lijst toont alleen de geplakte lessen en de privélessen. Lessen uit de app staan hier
niet: die horen in de app zelf thuis en zijn hier alleen een getal op de factuurkaart.

Per regel: datum, dag + uur, club, groep, uren, en of hij meetelt. Een regel schrappen zet
`actief` op onwaar — hij verdwijnt niet, want anders komt hij bij de volgende plakbeurt
gewoon terug. Geschrapte regels staan doorstreept en zijn met één tik terug te zetten. De
uren zijn te overschrijven; staat er een eigen getal, dan toont de app het gerekende getal
ernaast zodat zichtbaar blijft dat er iets is aangepast.

### Extra lessen

De privélessen heten naar de club toe **extra lessen**. Er zijn er op dit moment precies
twee, allebei bij Racso en allebei van het type `sponsor`:

| naam | uur | club | type |
|---|---|---|---|
| Stan | 09:00 – 10:00 | Racso | sponsor |
| Veerle | 10:00 – 11:00 | Racso | sponsor |

Daarom staan er op het Lessen-blad twee knoppen die alles al ingevuld hebben — **Stan
9-10u** en **Veerle 10-11u** — waarbij je alleen nog de datum kiest. Het volle formulier
(naam, type, club, datum, uren) blijft eronder staan: die twee zijn de huidige stand van
zaken, geen wet. Komt er een derde bij, dan tik je hem gewoon in.

De twee knoppen staan niet in de code vastgespijkerd maar in één lijst bovenaan
`components/facturatie/LessenBlad.tsx`, zodat er een regel bij kan zonder dat iemand door
het scherm moet.

Een knop **Privéles toevoegen** opent het volle formulier: naam, type, datum, club, uren.
Dat is het blokje M–Q uit `Sheet3`.

### Blad 2 — Factuur maken

Maand en jaar kiezen (standaard de vorige maand). Daaronder per club een kaart:

```
VZW Racso                                    T.C. RACSO
  Uit de app             0,00 u   ( )
  Uit de geplakte lijst  6,00 u   (•)
  Privélessen            2,00 u
  ───────────────────────
  Totaal            8,00 u  ×  € 31,00  =  € 248,00
  BTW 0 %                                  € 0,00
  Te betalen                               € 248,00

  Factuurnummer  [NG-0007        ]
  Factuurdatum   [01/10/2026     ]   Vervaldatum 16/10/2026
  Omschrijving   [Tennislessen September 2026]

  + vrije lijn

  [ Factuur downloaden ]
```

De omschrijving is standaard `Tennislessen <Maandnaam> <jaar>`, en aanpasbaar. De
vervaldatum is de factuurdatum + 15 dagen en wordt getoond, niet getypt.

Een vrije lijn heeft een omschrijving, een aantal, een eenheid en een tarief. Ze telt mee in
het nettobedrag.

**Meldingen**, in de plaats van de zeven controleformules:

| melding | wanneer |
|---|---|
| "Dit nummer staat al in het register" | het factuurnummer bestaat al — waarschuwing, je mag door |
| "Er zijn geen uren voor deze maand" | het totaal is nul — de knop is uit |
| "De app zegt 35,00 u, de geplakte lijst 34,00 u" | de twee bronnen verschillen — waarschuwing, je mag door |
| "De factuurdatum valt buiten de dienstmaand" | losse waarschuwing, je mag door |
| "Deze club is deze maand al gefactureerd" | er staat al een factuur voor die klant en die maand in het register — waarschuwing |
| "3 lessen bij een club die ik niet ken: T.C. RACSO" | zie *Club herkennen* |

Alleen een leeg factuurnummer en een totaal van nul houden de knop tegen. De rest zijn
waarschuwingen: Koen weet beter dan de app wanneer een factuur toch mag.

### Blad 3 — Register

De gemaakte facturen, nieuwste eerst: nummer, klant, datum, vervaldatum, omschrijving,
uren, tarief, netto, BTW, totaal. Per rij bij te werken: **betaald** (ja/nee), **betaald op**
en een **opmerking**. Een factuur is te verwijderen uit het register — met bevestiging, want
dan komt het nummer weer vrij.

De xlsx is niet opnieuw te downloaden: wat in het register staat zijn de cijfers, niet het
bestand. Wie hem opnieuw nodig heeft, maakt hem opnieuw met hetzelfde nummer.

### Blad 4 — Instellingen

Bovenaan **mijn gegevens**, één blok: naam, adres, BTW-nummer, IBAN, BIC. Gevuld met
Sport4fun, Broekstraat 51 9290 Overmere, BE0647703840, BE90143103210832, GEBA BE BB.

Daaronder de clubs. Per club: klantnaam, adres, postcode + gemeente, BTW-nummer, uurtarief,
korte naam, en **de naam zoals die in de plaktekst staat**. Een club toevoegen of
verwijderen kan.

De twee clubs worden bij het eerste gebruik aangemaakt. Racso komt uit `facturen.xlsx`;
de gegevens van Gantoise stonden daar niet in en zijn op 4 oktober 2026 door Koen gegeven:

| | klantnaam | adres | postcode + gemeente | BTW | tarief | korte naam | naam in de lijst | bron |
|---|---|---|---|---|---|---|---|---|
| 1 | VZW Gantoise | Noorderlaan 25 | 9000 Gent | BE0409025343 | € 33 | Gantoise | GANTOISE | app |
| 2 | VZW Racso | Graaf Wickmanstraat 16 | 9070 Destelbergen | BE0418482744 | € 31 | Racso | T.C. RACSO | geplakt |

Het BTW-nummer van Racso staat in het Excel-blad als `BTW nummer: 0418482744`, dus zonder
landcode en met een opschrift ervoor. In de app staat alleen het nummer zelf, met `BE`
ervoor, zoals bij Gantoise — het opschrift zet het factuurblad er zelf bij.

Het scherm waarschuwt als het adres of het BTW-nummer van een klant leeg is: een factuur
zonder die twee is niet in orde.

## Club herkennen

In `Klanten` staat voor Racso `RACSO`, maar in de plaktekst staat `T.C. RACSO`. De SUMIFS in
`Sheet3` vergelijkt exact en telde Racso daardoor op nul uren. Dat is de reden dat de naam in
de plaktekst een eigen, beheerbaar veld is.

Vergelijken gebeurt op de opgeschoonde naam: spaties aan de randen weg, dubbele spaties naar
één, hoofdletterongevoelig. Verder niets — geen "begint met", geen gedeeltelijke match, want
dan zou `RACSO` ook `T.C. RACSO II` vangen.

Lessen bij een club die niet in de lijst staat, worden gewoon bewaard. Ze tellen nergens mee
en het scherm meldt hoeveel het er zijn, met welke naam, en met een knop om die club toe te
voegen.

## De plaktekst lezen

`lib/facturatie-plak.ts`, zonder afhankelijkheden, volledig te testen.

De tekst wordt per regel gelezen. Een regel is een les als ze **minstens vijf velden** heeft
na splitsen op tab, én het vijfde veld een leesbaar dag-en-uurveld is. Al de rest — de
koprij, losse kopwoorden onder elkaar, lege regels, een voettekst — wordt overgeslagen en
geteld.

De vijf velden die gelezen worden, op positie: club (1), aanbod (2), doelgroep (3), groep
(4), dag + uur (5). De velden erna worden bewaard zoals ze binnenkomen (trainer,
aanwezigheid, gewijzigd, status) maar nergens voor gebruikt. De kolom `Bedrag` wordt
**genegeerd**: in de plaktekst staat voor Gantoise 0 € en het echte tarief staat in de
klantgegevens.

Het dag-en-uurveld heeft de vorm `wo 09/09/2026 14:00 - 15:00`. Gelezen met één reguliere
uitdrukking die de dagafkorting overslaat, dag/maand/jaar neemt en de twee tijdstippen. De
uren zijn het verschil in uren, op twee decimalen afgerond. Gaat de eindtijd over
middernacht of is ze gelijk aan de begintijd, dan is de regel onleesbaar — niet nul uren,
want nul uren is stilletjes verkeerd.

**Dubbels.** Een les is dezelfde les als club, groep en dag + uur gelijk zijn, na opschonen.
Bij het verwerken geldt: een nieuwe sleutel wordt een nieuwe regel, een bekende sleutel
wordt overgeslagen en raakt niets aan — ook niet als de regel geschrapt was of de uren
aangepast zijn. Anders zou een plakbeurt het handwerk van vorige maand ongedaan maken.

De uitkomst van het verwerken is één zin plus een opklapbare lijst:
*"24 nieuw, 48 waren al gekend, 2 overgeslagen."* De overgeslagen regels staan er letterlijk
bij, met de reden. Niets verdwijnt zonder dat het op het scherm komt.

## Rekenen

`lib/facturatie.ts`, zuiver rekenwerk zonder databank.

```ts
urenPerClub(lessen, klanten, maand, jaar): Array<{
  klant: Klant;
  urenGeplakt: number;
  urenPrive: number;
}>
urenUitApp(bookings, lesgeverId, maand, jaar): number
onbekendeClubs(lessen, klanten, maand, jaar): Array<{ naam: string; aantal: number }>
factuurUit(klant, uren, vrijeLijnen, nummer, datum, omschrijving, maand, jaar): Factuur
```

Meetellen doet een geplakte les als ze `actief` is, haar datum in de gevraagde maand valt,
en haar club op een klant uitkomt. Het totaal op de factuur is de gekozen bron
(`urenGeplakt` of `urenUitApp`) plus `urenPrive`.

`urenUitApp` kent geen clubs: de app weet niet bij welke club een boeking hoort. Het getal
is dus hetzelfde voor elke club, en het heeft alleen betekenis bij de club waarvoor Koen
`bron_voorkeur = 'app'` zet. Zou er ooit een tweede club op de app staan, dan telt die
dezelfde uren een tweede keer — het scherm waarschuwt daarvoor zodra meer dan één klant op
`'app'` staat.

Bedragen worden per lijn afgerond op twee decimalen en dan opgeteld, niet omgekeerd. BTW
staat op 0 % en is een veld op de klant, geen vaste nul: zou de regeling ooit wijzigen, dan
is dat één getal en niet een zoektocht.

Alle geldopmaak gaat door `formatEuro` uit `lib/money.ts`.

## Het xlsx-bestand

Eén bestand met **twee tabbladen**: `Factuur` en `Extra lessen`. Bestandsnaam:
`factuur-<nummer>.xlsx`, met alles wat geen letter, cijfer, streepje of liggend streepje is
vervangen door een streepje.

Het tweede tabblad is er altijd, ook als het leeg is: dan staat er "Geen extra lessen in
deze maand." Racso vraagt dat overzicht elke maand, en een tabblad dat er soms wel en soms
niet is, is een tabblad waarvan iemand denkt dat het vergeten werd.

### Tabblad 2 — Extra lessen

```
 rij 1   EXTRA LESSEN
 rij 2   VZW Racso · September 2026 · factuur NG-0007
 rij 4   Datum        Naam      Type      Uren
 rij 5   07/09/2026   Stan      sponsor   1,00
 rij 6   07/09/2026   Veerle    sponsor   1,00
 rij 7   14/09/2026   Stan      sponsor   1,00
 ...
         Totaal                           6,00
```

Op datum geordend, oudste eerst. De uren onderaan tellen op tot het getal dat op blad 1 in
het urenblok mee verrekend is.

### Tabblad 1 — de factuur

De indeling, in de rijen van het origineel:

```
 rij 5   Mijn gegevens
 rij 6   Naam    Sport4fun                     Factuur
 rij 7   Adres   Broekstraat 51 9290 Overmere  Datum        01/10/2026
 rij 8   BTW     BE0647703840                  Factuurnr    NG-0007
 rij 9   IBAN    BE90143103210832              Vervaldatum  16/10/2026
 rij 10  BIC     GEBA BE BB
 rij 16  Factuur voor:
 rij 17  VZW Racso
 rij 18  Graaf Wickmanstraat 16
 rij 19  9070 Destelbergen
 rij 20  BTW nummer: 0418482744
 rij 21                                        valuta:      euro
 rij 22  BESCHRIJVING:        Aantal  Eenheid  Tarief  Bedrag
 rij 23  Tennislessen September 2026
 rij 24  (de uren)            8,00    uren     31,00   248,00
 rij 25+ (een rij per vrije lijn)
         netto:                                        248,00
         BTW %                                         0
         BTW-Bedrag                                    0,00
 rij 38  Artikel 44.2.3 vrijstelling btw exploitatie lichamelijke ontwikkeling
 rij 39  kleine onderneming
 rij 42  AANVULLENDE OPMERKINGEN
 rij 43  1. Gelieve het verschuldigde bedrag binnen de 15 dagen te storten op rekening:
                                               Te Betalen:  248,00
 rij 45  2. Gelieve het factuur# te vermelden als mededeling
```

Bedragen zijn getallen met geldopmaak en datums zijn datums, niet de tekst ervan — zoals
`lib/xlsx.ts` dat al doet voor de rapporten. Het blad bevat geen formules: wat erin staat is
uitgerekend. Een factuur die zichzelf herrekent als iemand een cel aanraakt, is geen factuur
meer.

### Wat `lib/xlsx.ts` erbij krijgt

De schrijver kent nu één vorm: een koprij met rijen eronder (`XlsxBlad`). Een factuur is geen
tabel. Er komt een tweede vorm bij:

```ts
export interface XlsxVrijBlad {
  naam: string;
  cellen: ReadonlyArray<{ rij: number; kolom: number; cel: XlsxCel }>;
  breedtes?: readonly number[];
  samengevoegd?: ReadonlyArray<{ van: string; tot: string }>;
}
```

`bladXml` krijgt een broer `vrijBladXml`, en daarnaast komen `buildVrijXlsx` (één vrij blad)
en `buildVrijWorkbook` (meer dan één). Dat laatste is wat de factuur nodig heeft: twee
tabbladen die allebei vrij zijn. `buildWorkbook` kan vandaag wel twee tabbladen aan, maar
alleen als tabel met een koprij — en een factuur is geen tabel.

De bestaande functies en hun tests blijven zoals ze zijn: `lib/csv.ts` en het
historiekscherm hangen eraan.

Samengevoegde cellen zijn nodig voor de lange regels (de omschrijving, de twee
BTW-voetnoten, de betalingsinstructie); zonder dat lopen ze achter de kolom met bedragen.

## De databank

Een nieuw bestand `FACTURATIE.sql`, idempotent zoals de andere, dat Koen zelf draait op de
databank van de club. Tot dat gedraaid is, toont het scherm één nette melding en verder
niets — de app mag niet omvallen op een tabel die er nog niet is, zoals `selectAllOptioneel`
in `providers/supabaseStore.ts` al doet.

Vier tabellen. Sleutels zijn `text` en door de app gemaakt, zoals de rest van het schema.
Elke tabel heeft `eigenaar uuid not null default auth.uid()` met een index erop.

```
facturatie_leverancier   id, eigenaar, naam, adres, btw, iban, bic
facturatie_klanten       id, eigenaar, klantnaam, adres, postcode_gemeente, btw_nummer,
                         uurtarief numeric, korte_naam, naam_in_lijst, btw_percentage,
                         volgorde int
facturatie_lessen        id, eigenaar, bron ('geplakt'|'prive'), club_tekst, aanbod,
                         doelgroep, groep, dag_uur, trainer, status, datum date,
                         uren numeric, uren_handmatig numeric null, actief bool default true,
                         naam_prive, type_prive, sleutel text, aangemaakt timestamptz
facturatie_facturen      id, eigenaar, factuurnr, klant_naam, klant_adres,
                         klant_postcode_gemeente, klant_btw, factuurdatum date,
                         vervaldatum date, omschrijving, dienstmaand int, dienstjaar int,
                         aantal_uren numeric, uurtarief numeric, netto numeric,
                         btw_percentage numeric, btw_bedrag numeric, totaal numeric,
                         vrije_lijnen jsonb, extra_lessen jsonb,
                         betaald bool default false, betaald_op date,
                         opmerking text, aangemaakt timestamptz
```

`sleutel` op `facturatie_lessen` is de dubbelsleutel (club + groep + dag/uur, opgeschoond),
met een unieke index op `(eigenaar, sleutel)`. Daardoor kan ook een dubbele plakbeurt die
tegelijk binnenkomt geen dubbels maken. Privélessen krijgen een sleutel uit hun eigen velden
plus hun id, zodat twee identieke privélessen op dezelfde dag elkaar niet uitsluiten.

`vrije_lijnen` en `extra_lessen` zijn jsonb en geen eigen tabel: ze hebben alleen betekenis
samen met hun factuur en worden nooit los opgevraagd — dezelfde keuze als voor de beurten
van een kaart, zie de kop van `supabase-schema.sql`.

`extra_lessen` is een kopie van de privélessen van die maand, niet een verwijzing ernaar.
Dezelfde reden als bij de klantgegevens: wat op een verstuurde factuur stond, mag niet
veranderen omdat er achteraf een les geschrapt wordt.

De klantgegevens worden **mee op de factuur bewaard**, niet alleen als verwijzing. Verhuist
een club volgend jaar, dan mag een factuur van vorig jaar niet van adres veranderen.

RLS op alle vier: lezen, toevoegen, wijzigen en verwijderen alleen waar
`eigenaar = auth.uid()`. Geen rol, geen uitzondering voor de beheerder. Het is Koens
boekhouding.

## Waar het in de app hangt

De uren uit de app komen uit `bookings`, die de provider al bij het opstarten heeft; daar
hoeft niets extra voor opgehaald te worden.

De provider leest bij het opstarten alles op wat je mag zien, en dat moet zo blijven: deze
lessenlijst groeit elk jaar en heeft niets met de rest van de app te maken. Facturatie gaat
daarom **niet** door `SimpleDataProvider`. Het volgt het pad dat `bezetteUren` al bewandelt:
een eigen leesweg op `Backend` in `providers/backend.ts`, met een Supabase-kant in
`providers/supabaseStore.ts` en een lokale kant in `providers/mockStore.ts` zodat de app
zonder `.env` blijft werken.

Wat erbij komt op `Backend`:

```ts
facturatieLaden: () => Promise<FacturatieData | null>;
facturatieBewaren: (wat: FacturatieWijziging) => Promise<void>;
```

`null` betekent "de tabellen staan er nog niet" en is iets anders dan een lege boekhouding —
dezelfde afspraak als bij `bezetteUren`.

Het scherm laadt bij het openen en houdt zijn eigen toestand bij.

## Tests

Alles in `lib/` krijgt tests, zoals de 1935 die er al staan.

`lib/facturatie-plak.test.ts`
- de plaktekst uit het gesprek van 4 oktober 2026 levert 69 lessen op: 60 bij Gantoise en
  9 bij T.C. RACSO
- de koprij als losse woorden onder elkaar wordt overgeslagen, niet als les gelezen
- `wo 09/09/2026 14:00 - 15:00` wordt 9 september 2026 en 1,00 uur
- een les van 14:00 tot 15:30 wordt 1,50 uur
- een eindtijd vóór de begintijd is onleesbaar en wordt gemeld
- tweemaal dezelfde tekst plakken levert de tweede keer nul nieuwe regels
- een regel met drie velden wordt overgeslagen met reden
- lege regels en regels met alleen spaties tellen niet als overgeslagen

`lib/facturatie.test.ts`
- `T.C. RACSO` matcht op de klant met `naam_in_lijst = 'T.C. RACSO'`
- `  t.c. racso ` matcht hem ook
- `RACSO` matcht hem **niet** en komt bij de onbekende clubs
- september 2026 uit de voorbeeldlijst geeft Gantoise 35 uur (hetzelfde getal als `F24` van
  het Gantoise-blad) en Racso 0 uur; oktober geeft Gantoise 25 uur en Racso 9 uur
- een geschrapte les telt niet mee
- `uren_handmatig` gaat voor op de gerekende uren
- privélessen tellen bij het clubtotaal, bij beide bronnen
- `urenUitApp` telt alleen boekingen waarvan de gevraagde trainer de lesgever is
- een boeking die hij liet overnemen telt niet mee, een die hij overnam wel
- een afgezegde boeking telt niet mee
- een boeking van 18:00 tot 19:30 levert 1,50 uur
- een vrije lijn telt mee in het netto
- `extraLessenUit` geeft de privélessen van die klant en die maand, op datum geordend
- een geschrapte privéles komt niet in het overzicht
- het overzicht telt op tot hetzelfde getal als `urenPrive`
- BTW 0 % geeft een nettobedrag gelijk aan het totaal
- `magFactureren` is waar voor het adres in elke schrijfwijze, en onwaar voor elk ander
  adres en voor `null`

`lib/xlsx.test.ts` (uitbreiding)
- een vrij blad met cellen op hun plaats leest weer uit elkaar op de verwachte coördinaten
- een samengevoegd bereik komt in de XML terecht
- een werkmap met twee vrije bladen draagt beide tabbladen, met hun eigen naam
- de bestaande tabeltests blijven draaien

`lib/facturatie-xlsx.test.ts`
- het tweede tabblad staat er ook als er geen extra lessen zijn, met de zin erin
- de extra lessen staan op datum, met een totaalrij die optelt tot `aantal_uren` min de
  gewone uren

## Wat er daarna nog niet is

Bewust buiten deze eerste versie, in volgorde van waarschijnlijkheid dat het gevraagd wordt:

- de km-vergoeding
- een factuur opnieuw downloaden uit het register
- een PDF
- meer dan één trainer
- een extra les die zichzelf elke week herhaalt — de twee knoppen vragen per keer een datum

## Wat Koen moet doen

1. `FACTURATIE.sql` draaien op de databank, en daarna de app **hard herladen** — hij leest
   de databank bij het opstarten.
2. Nakijken of de uren die de app voor Gantoise toont, kloppen met wat hij verwacht. Staat
   er een verschil met de geplakte lijst, dan zegt de factuurkaart dat erbij.
