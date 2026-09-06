---
phase: 05-excel-import-van-trainingen
plan: 01
subsystem: de DEFLATE-uitpakker (RFC 1951) waar de xlsx-lezer op staat
tags: [import, xlsx, deflate, inflate, huffman, geen-pakket]
requires: []
provides:
  - "lib/inflate.ts: inflate(bytes, verwachteLengte?) — RFC 1951, alle drie de bloksoorten, met de hand"
affects: []
tech-stack:
  added: []
  patterns:
    - "vaste tabellen uit de specificatie op moduleniveau, één keer opgebouwd — hetzelfde patroon als CRC_TABEL in lib/xlsx.ts"
    - "een kleine benoemde hulpstructuur met methodes (bitlezer, uitvoer) in plaats van losse index-rekenarij — de spiegelvorm van schrijver() in lib/xlsx.ts"
    - "canonieke Huffman als tellingen + symbolenlijst (puff-vorm), niet als boom van knopen"
    - "terugverwijzingen byte voor byte kopiëren, nooit met set/subarray"
    - "bekende bytevectoren van buiten de codebase als test, niet zelf berekende verwachtingen"
key-files:
  created: [lib/inflate.ts, lib/inflate.test.ts]
  modified: []
decisions:
  - "D-18 uitgevoerd: geen pakket erbij; DecompressionStream staat bij naam in het kopcommentaar met de reden waarom het geen alternatief is (bestaat niet overal waar deze app draait)"
  - "verwachteLengte is niet alleen een beginmaat maar meteen de harde bovengrens: een ingang die meer uitpakt dan zijn eigen zip-kop belooft is niet te vertrouwen (T-05-02)"
  - "MAX_UITVOER = 64 MB als grens zonder verwachte lengte, geijkt op de 526.954 uitgepakte bytes van sheet1.xml in koen.xlsx (T-05-01)"
  - "De bitlezer geeft voorbij het einde van de invoer een fout in plaats van nullen — dat is precies het verschil tussen een fout en een eindeloze lus"
  - "De vaste afstandsboom krijgt 30 codes en niet 32: codes 30 en 31 bestaan niet en worden zo een fout in plaats van een onzinnige afstand"
  - "Een dynamisch blok zonder code voor symbool 256 wordt geweigerd: zo'n blok heeft geen einde"
metrics:
  duration: ~35 min
  completed: 2026-09-06
  tasks: 2
  tests_before: 1223
  tests_after: 1236
---

# Phase 5 Plan 01: De DEFLATE-uitpakker — Summary

`inflate()` pakt een rauwe DEFLATE-stroom byte-exact uit — opgeslagen, vaste Huffman en
dynamische Huffman — bewezen tegen vier bekende bytevectoren die buiten deze codebase om zijn
vastgesteld, met een fout in plaats van een lus op een stukgeslagen bestand.

## Wat er gebouwd is

**`lib/inflate.ts` (407 regels)**

| Blok | Wat het doet |
|---|---|
| Kopcommentaar | Wat dit is (RFC 1951, de uitpakhelft van zip), waarom er geen pakket bij komt (web én telefoon, `DecompressionStream` bestaat niet overal waar dat is — dezelfde afweging als `utf8()`), en waarom de schrijver in `lib/xlsx.ts` dit nooit nodig had (die slaat onverpakt op, Excel niet) |
| `bitlezer(bytes)` | `eenBit()`, `bits(n)` (laagste bit eerst), `uitlijnen()`, `byte()`. Het commentaar wijst de klassieke fout aan: vaste-breedte-getallen laag-eerst, Huffman-codes juist hoog-naar-laag |
| `LENGTE_BASIS` / `LENGTE_EXTRA` / `AFSTAND_BASIS` / `AFSTAND_EXTRA` | De tabellen uit de specificatie, op moduleniveau, met het commentaar dat ze niet uit te rekenen zijn (de reeks knikt bij code 284/285) |
| `bouwHuffman(lengtes)` | De canonieke methode: tellen per lengte, startpositie per lengte, symbolen op volgorde |
| `leesSymbool(lezer, boom)` | Bit voor bit van hoog naar laag; per lengte kijken of de code binnen het bereik valt. Geen tabel van 32768 ingangen voor een bestand van een paar honderd kilobyte |
| `VASTE_LITERALEN` / `VASTE_AFSTANDEN` | De vaste bomen (8-8-9-7 en 30× 5 bits), één keer opgebouwd |
| `CODELENGTE_VOLGORDE` | `16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15` letterlijk, met de reden erbij (de vaakst-nulle lengtes achteraan, zodat een blok de staart mag weglaten) |
| `dynamischeBomen(lezer)` | HLIT/HDIST/HCLEN, de codelengteboom, en het uitvouwen van 16 (vorige, 3-6×), 17 (3-10 nul) en 18 (11-138 nul) |
| `uitvoer(beginmaat, grens)` | Verdubbelende buffer; `kopieer()` gaat byte voor byte omdat een kopie over zichzelf heen mag lopen |
| `MAX_UITVOER` | 64 MB, geijkt op de 526.954 bytes van `sheet1.xml` in `koen.xlsx` |
| `inflate(bytes, verwachteLengte?)` | De lus over blokken: BFINAL + BTYPE, dan bloksoort 0, 1 of 2; bloksoort 3 is een fout |

**`lib/inflate.test.ts` (137 regels)** — `bytesVan()` en `tekstVan()` met de hand (geen
`TextDecoder`, zelfde reden als `utf8`), 13 tests, geen `jest.mock`, geen `jest.fn`.

## De vier vectoren

| # | Bloksoort | Bewijst |
|---|---|---|
| 1 | opgeslagen | `010c00f3ff…` → `Hallo tennis` |
| 2 | vaste Huffman | `4b4c848124380000` → `aaaaaaaaaabbbbbbbbbb` — een kopie van tien bytes uit een venster van één |
| 3 | vaste Huffman | `4b4c4a4e444200` → `abcabcabcabcabc` — overlappende kopie met afstand 3 |
| 4 | dynamische Huffman | 122 bytes → de 160 tekens uit het plan — de bloksoort waarin élke ingang van `koen.xlsx` staat |

Daarnaast: twee blokken in één stroom, een verminkte NLEN, een lege invoer, een afgekapte
stroom, de bovengrens en bloksoort 3 — zes `toThrow`-gevallen.

## Extra zekerheid buiten de test om

Omdat dit de laag is waar de rest van fase 5 op staat, is `inflate()` naast de vier vectoren
ook nog eenmalig differentieel getoetst tegen `python3 zlib`: 62 stromen (compressieniveau 0
tot en met 9, `Z_FIXED`, willekeurige binaire bytes, tekst, een alfabet van vier symbolen, en
een geval van 120 kB dat volledig uit overlappende terugverwijzingen bestaat). Alle 62 kwamen
byte-exact overeen. Die toets is bewust **niet** in de codebase gezet — hij vraagt python en
zou de test aan een externe toolchain binden; de vier vaste vectoren in `lib/inflate.test.ts`
zijn wat er blijvend bewaakt wordt.

## Afwijkingen van het plan

Geen — het plan is uitgevoerd zoals geschreven. Twee dingen die het plan opendeed en die hier
zijn ingevuld:

- **`verwachteLengte` is meteen de bovengrens.** Taak 2 vraagt "een stroom die meer wil
  uitpakken dan de opgegeven bovengrens geeft een fout"; de opgegeven maat uit de zip-kop is
  exact, dus hem als harde grens gebruiken kost niets en vangt de zip-bom uit T-05-02 al vóór
  `MAX_UITVOER`.
- **De vaste afstandsboom heeft 30 codes** (zoals het plan schrijft) en niet de 32 die het
  formaat toestaat. Voor geldige gegevens is dat identiek; codes 30 en 31 worden zo een fout
  in plaats van een afstand die niet bestaat.

## Beveiliging (threat register)

| Threat ID | Afgedekt door |
|---|---|
| T-05-01 (DoS, misvormde stroom) | `MAX_UITVOER`, plus `eenBit()`/`byte()` die voorbij het einde van de invoer een fout gooien in plaats van nullen te lezen. Getest met een afgekapte vector 4 |
| T-05-02 (zip-bom) | Dezelfde grens, en `verwachteLengte` als harde bovengrens. Getest |
| T-05-SC (npm-installs) | Er is niets geïnstalleerd. `git diff --stat package.json package-lock.json` is leeg |

## Verificatie

```
npx tsc --noEmit                → nul fouten
npx jest lib/inflate            → 13 passed, 13 total
npm test                        → 50 suites, 1236 passed (was 1223)
npx expo export --platform web  → web bundle 3,81 MB, geslaagd
git diff --stat package.json package-lock.json → leeg
```

Acceptatiecriteria uit het plan, letterlijk nagelopen: alle vier de hex-vectoren staan in de
test (`010c00f3ff…`, `4b4c848124380000`, `4b4c4a4e444200`, `0dcac911c3200c00c0562880514f5ce6`),
`hsreltpuscta pirhgwpr` staat er, `DecompressionStream` komt 1× voor en uitsluitend in
commentaar (`grep -v '^\s*//' | grep -c 'DecompressionStream\|require(\|import('` = 0), er is
geen import uit een hogere laag (= 0), het kopcommentaar telt 10 `//`-regels in de eerste 10,
`CODELENGTE_VOLGORDE` staat er letterlijk, `MAX_UITVOER` komt 3× voor, `526` staat in het
commentaar, en er zijn 6 `toThrow`-gevallen.

## Wat dit opendoet

Plan 05-02 en verder kunnen nu een echte zip-ingang lezen. De rest van de fase kent alleen
`inflate(bytes, verwachteLengte?)`.

## Self-Check: PASSED

- `lib/inflate.ts` — FOUND
- `lib/inflate.test.ts` — FOUND
- `5387764` test(inflate): bekende bytevectoren … — FOUND
- `b341cb6` feat(inflate): onverpakte en vast-gehuffmande blokken … — FOUND
- `e191d0d` test(inflate): de dynamische-Huffman-vector … — FOUND
- `80bc95b` feat(inflate): dynamische Huffman erbij … — FOUND
