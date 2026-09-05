---
phase: 03-ziekmelding-en-vervangerswerklijst
plan: 01
subsystem: botsingsregel
tags: [refactor, dubbele-boeking, recurrence, provider]
requires: []
provides: ["lib/recurrence.ts::botstMet als enige botsingsregel"]
affects: ["providers/SimpleDataProvider.tsx::addBooking"]
key-files:
  created: []
  modified:
    - lib/recurrence.ts
    - lib/recurrence.test.ts
    - providers/SimpleDataProvider.tsx
decisions:
  - "Geen lib/overlap.ts: fase 2.1 zette de regel al in lib/recurrence.ts::botstMet, een nieuw bestand zou een derde variant zijn"
  - "addBooking geeft géén courtId mee, zodat het waarneembare gedrag exact gelijk blijft"
metrics:
  tasks: 2
  tests: 1154
  completed: 2026-09-06
---

# Fase 3 Plan 1: Eén botsingsregel — Summary

De dubbele-boekingscontrole van de provider vraagt het nu aan `botstMet` in `lib/recurrence.ts`;
er is nog precies één plek in de codebase die twee tijdvakken vergelijkt.

## Afwijking van het plan (en waarom)

Het plan schreef `lib/overlap.ts::botsen` voor, met `lib/recurrence.ts` en
`providers/SimpleDataProvider.tsx` als aanroepers. Dat plan is geschreven vóór fase 2.1 landde.
Zoals `03-AANPASSING.md` vastlegt heeft plan 02.1-01 de private `collides` al uit
`lib/recurrence.ts` gehaald en vervangen door de geëxporteerde `botstMet(slot, existing, vraag)`
op regel 141 — die geeft de botsende boeking terug in plaats van een boolean en kijkt ook naar
de baan. `planSeries` en `planGroepWijziging` lopen daar al doorheen.

Een `lib/overlap.ts` aanmaken zou dus een dérde variant naast `botstMet` en `overlaps` zetten —
precies wat dit plan wilde voorkomen. Daarom:

- **Geen nieuw bestand.** `botstMet` is de ene regel.
- **Geen nieuwe `botsen`.** De tests staan bij `botstMet` in `lib/recurrence.test.ts`.
- **Wel het echte overblijfsel gedaan:** `overlaps` in `providers/SimpleDataProvider.tsx` is weg.

## Wat er veranderd is

**Taak 1 — de grensgevallen vastgelegd** (`e33017b`)

`botstMet` had al negen tests. Twee gevallen uit de gedragslijst van het plan ontbraken en zijn
toegevoegd aan `lib/recurrence.test.ts`: een lege agenda geeft nooit een botsing, en een les die
het hele tijdvak omvat (een stage van 9 tot 13 tegen een uur van 10 tot 11) botst wél. De overige
gevallen — aansluitend is geen botsing, afgezegd houdt niets bezet, een andere trainer botst
niet — stonden er al en zijn ongewijzigd gebleven.

Eerlijk over TDD: dit is een refactor van bestaande code, dus deze twee tests slaagden meteen.
Er was geen RED-fase mogelijk zonder eerst werkende code te slopen. Het zijn
karakteriseringstests: ze leggen vast wat er ís, zodat taak 2 er veilig op kon leunen.

**Taak 2 — de provider wijst erheen** (`5578e4b`)

- `function overlaps(...)` (elf regels, `providers/SimpleDataProvider.tsx:265`) volledig weg,
  inclusief de Engelse doc-regel.
- `botstMet` toegevoegd aan de bestaande import van `'../lib/recurrence'`.
- `addBooking`: `if (overlaps(b, store.bookings))` werd
  `if (botstMet(b, store.bookings, { coachId: b.coach_id }) !== null)`. `overlaps` gaf een boolean,
  `botstMet` een boeking of `null` — de aanroep is dus aangepast, niet hernoemd. De foutmelding
  eromheen is woordelijk gelijk gebleven.
- Het kopcommentaar bij `botstMet` verwees nog naar `overlaps` als "woordelijk dezelfde regel";
  dat klopt niet meer en is vervangen door de vaststelling dat dit nu de enige vergelijking is,
  met de waarschuwing er meteen bij dat de vervangerszoeker van deze fase er ook doorheen hoort.

**Bewust géén baan meegegeven.** `botstMet` kan ook op de baan controleren als de vraag een
`courtId` bevat. `addBooking` geeft die niet mee, want de oude `overlaps` keek alleen naar de
agenda van de trainer. Wél een `courtId` meegeven zou de controle strenger maken en dus
waarneembaar gedrag veranderen — buiten de opdracht van dit plan, dat expliciet stelt dat er
niets aan het gedrag verandert. Dat een losse boeking op een baan kan landen waar een andere
trainer al staat, is een openstaand punt voor een later plan, geen regressie van dit plan.

## Verificatie (echte uitvoer)

```
$ npx tsc --noEmit
(geen uitvoer, exit 0)

$ npm test
Test Suites: 47 passed, 47 total
Tests:       1154 passed, 1154 total
Snapshots:   0 total
Time:        1.522 s

$ npx expo export --platform web
› web bundles (1):
_expo/static/js/web/entry-cce6e047004910e110c54e9c5956f183.js (3.79 MB)
› Files (2):
index.html (1.19 kB)
metadata.json (49 B)
Exported: dist

$ grep -rn "aStart < bEnd" --include='*.ts' --include='*.tsx' lib providers components app
lib/recurrence.ts:157:    return aStart < bEnd && bStart < aEnd;
count: 1

$ grep -rn "function overlaps\|function collides" --include='*.ts' --include='*.tsx' lib providers components app
geen
```

Geen bestaande verwachting is gewijzigd: de diff op `lib/recurrence.test.ts` bevat alleen
toevoegingen. Er is geen SQL uitgevoerd en geen verbinding met Supabase gemaakt.

## Succescriteria

- [x] De botsingsregel staat op precies één plek (`lib/recurrence.ts::botstMet`), bewezen met grep.
- [x] `lib/recurrence.ts` en `providers/SimpleDataProvider.tsx` hebben geen eigen kopie meer.
- [x] De grensgevallen liggen vast in tests, zonder `jest.mock` of `jest.fn`.
- [x] Niets aan het waarneembare gedrag van de app is veranderd.

## Self-Check: PASSED

- `lib/recurrence.ts` — aanwezig, `botstMet` op regel 141.
- `providers/SimpleDataProvider.tsx` — aanwezig, `botstMet` op regel 613, geen `overlaps` meer.
- Commit `e33017b` — aanwezig.
- Commit `5578e4b` — aanwezig.
