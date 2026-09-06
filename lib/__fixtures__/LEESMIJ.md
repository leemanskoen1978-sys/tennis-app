# lessen-voorbeeld.xlsx

Een nagemaakt Excel-bestand voor de tests van `lib/xlsx-lezen.ts`, `lib/inflate.ts` en
`lib/import-trainingen.ts`.

## Waarom dit bestand bestaat

De club levert haar lessenrooster aan als een echt Excel-bestand, `koen.xlsx`. Dat bestand
staat **bewust in `.gitignore`** en komt hier nooit in: deze repository is publiek en er staan
de namen van 42 kinderen in.

Maar zonder énig Excel-bestand valt op CI de dekking weg van precies de moeilijkste code die we
zelf geschreven hebben: de DEFLATE-uitpakker en de zip-lezer. Een lezer die alleen slaagt op
werkmappen die deze app zelf schreef, bevestigt zijn eigen aannames en niets meer.

Vandaar twee lagen:

- **dit bestand** bewijst de machinerie, altijd en overal, ook op CI;
- **`koen.xlsx`** bewijst het hele seizoen (1398 regels, 10 groepen, 42 leerlingen) en draait
  alleen waar het bestand staat. Ontbreekt het, dan worden die tests luid overgeslagen met een
  waarschuwing — zie `heeftKoen` in `lib/xlsx-lezen.test.ts` en `lib/import-trainingen.test.ts`.

## Hierin staat geen echt mens

De trainer (`Vermeulen Sanne`) en de vijf leerlingen (`Achtermans Fien`, `Boddaert Ruben`,
`Cools Nore`, `Dewitte Stan`, `Eeckhout Lore`) zijn verzonnen. De locatie `TENNISHAL` is
verzonnen. Ook de metagegevens zijn geschoond: `docProps/core.xml` noemt `Testclub` als maker,
en het absolute pad van de maker (`x15ac:absPath`, met een gebruikersnaam erin) is uit
`xl/workbook.xml` verwijderd.

`lib/xlsx-lezen.test.ts` heeft een test die hierop staat te letten: komt er ooit een echte naam
in dit bestand terecht, dan valt de suite om in plaats van dat het stil gepubliceerd wordt.

**Plak er dus nooit een rij uit `koen.xlsx` in.** Wil je het bestand uitbreiden, verzin dan
nieuwe mensen.

## De eigenaardigheden zijn met opzet

Dit bestand is uit `koen.xlsx` afgeleid en houdt diens valstrikken vast. Ruim ze niet op — dan
blijft alles groen terwijl er niets meer bewezen wordt:

1. **Ingepakt met methode 8 (deflate), niet opgeslagen.** `buildXlsx` in `lib/xlsx.ts` slaat
   onverpakt op; wordt dit bestand ooit zo heringepakt, dan draait `lib/inflate.ts` hier nooit
   meer. Alle tien de ingangen beginnen bovendien met een blok met dynamische Huffman-tabellen,
   want dat is wat Excel schrijft.
2. **De lokale kop en de centrale map spreken elkaar tegen over het extra veld.** De centrale
   map noemt bij elke ingang extra-lengte 0, terwijl `[Content_Types].xml` en `_rels/.rels` in
   hun lokale kop 520 dragen en drie andere ingangen 264. Wie de centrale waarde gebruikt om de
   gegevens te zoeken begint 520 bytes te vroeg en pakt rommel uit — en dat merk je nergens
   aan, behalve aan een blad dat leeg blijft. Deze afwijking is er met de hand in gezet (de zip
   is niet met een standaardpakker geschreven maar byte voor byte opgebouwd), juist omdat elke
   gewone pakker hem zou wegpoetsen. Zie ook de uitleg bij `leesZip` in `lib/xlsx-lezen.ts`.
3. **Een tabel met gedeelde teksten, met `<v>0</v>` in cel A1.** Index 0 is de eerste tekst
   (`Datum`) en niet een lege cel. Een lezer die `0` als "leeg" leest, verliest de koprij.
4. **Datums als serie en uren als breuk.** `46274` is woensdag 9 september 2026. De breuk
   `0.58333333333333337` hoort 14:00 te worden en niet 13:00 of 13:59: dat is de afrondingsval.
5. **Dezelfde kolommen als het echte bestand**: `Datum`, `Weekdag`, `Weeknr`, `Uur`,
   `Type les`, `Groep`, `Coach`, `Leerling`, `Locatie`, `Indoor/Outdoor`. Zo bewijst dit
   bestand ook de kopregellezer, inclusief het negeren van de vier kolommen die de import niets
   zeggen. In `Indoor/Outdoor` staat het woord `Indoor` en geen terreinnummer, precies als in
   het echte bestand — daarom levert dit bestand nul geplande lessen op.

## Wat erin staat

Negen rijen: één koprij en acht gegevensrijen, over twee groepen.

| Groep | Dag      | Uur   | Leerlingen |
| ----- | -------- | ----- | ---------- |
| Groep 1 | woensdag | 14:00 | 3, op twee datums |
| Groep 2 | vrijdag  | 17:00 | 2, op één datum   |
