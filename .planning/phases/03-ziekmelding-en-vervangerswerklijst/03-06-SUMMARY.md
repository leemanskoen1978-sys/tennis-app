---
phase: 03-ziekmelding-en-vervangerswerklijst
plan: 06
subsystem: het ziekmeldingsscherm (formulier, lijst, tegel)
tags: [ziekmelding, scherm, beheer, i18n, toegang]
requires: [lib/ziekmelding.ts, lib/hub.ts, lib/period.ts, lib/vakanties.ts, lib/rechten.ts, providers/SimpleDataProvider.tsx]
provides:
  - "app/admin/ziekmelding/index.tsx: het formulier (trainer, van–tot, reden) en de lijst lopend/ingetrokken"
  - "app/admin/index.tsx: de tegel Ziekmelding onder Club, alleen voor de beheerder"
  - "app/_layout.tsx: de koppen voor admin/ziekmelding/index en admin/ziekmelding/[id]"
  - "lib/i18n-en.ts: de Engelse kant van elke nieuwe zin"
affects: [app/admin/index.tsx, app/_layout.tsx, lib/i18n-en.ts]
tech-stack:
  added: []
  patterns: ["de isAdmin-poort vóór elke andere return", "valideren met lib/, dan de provideractie, dan doornavigeren", "actief/archief-splitsing met opacity 0.7"]
key-files:
  created: [app/admin/ziekmelding/index.tsx]
  modified: [app/admin/index.tsx, app/_layout.tsx, lib/i18n-en.ts]
decisions:
  - "D-12 uitgevoerd: de beheerdersgrens staat op het scherm zelf, niet alleen op de tegel"
  - "T-03-24 afgedekt: alleen doornavigeren als meldZiek een rij teruggaf"
  - "Elke uitlegzin staat als losse t()-sleutel, zodat geen enkele sleutel over meerdere regels loopt"
  - "VERV-04 en VERV-10 zijn nu bereikbaar voor de beheerder; de werklijst zelf volgt in plan 07"
metrics:
  duration: ~35 min
  completed: 2026-09-06
  tasks: 2
  tests_before: 1223
  tests_after: 1223
---

# Phase 3 Plan 06: Het ziekmeldingsscherm — Summary

De beheerder meldt een trainer ziek over een periode, komt meteen op de werklijst van die
melding uit, en trekt haar met één knop weer in — en een trainer die de link intikt krijgt het
scherm niet te zien.

## Wat er gebouwd is

**`app/admin/ziekmelding/index.tsx` (299 regels)** — naar het model van
`app/admin/lesgroepen/index.tsx`, met dezelfde opbouw en dezelfde `StyleSheet`-namen:

| Blok | Wat het doet |
|---|---|
| Kopcommentaar | Wat het scherm is, de grens met een afwijkende boekingsperiode (D-03), en wat het bewust níet doet: niemand verwittigen |
| De beheerderspoort | Het blok uit het lesgroepenscherm, letterlijk, met `t('Ziekmeldingen zijn alleen voor de beheerder.')` — vóór elke andere `return` (regel 76 tegenover 123) |
| Het formulier | `Chip`-rij over `coachesOf(users)`, twee `dd/mm/jjjj`-velden met `inputMode="numeric"`, een optioneel redenveld, en een foutregel |
| Indienen | `ziekmeldingFout(...)` → bij een melding stoppen; anders `meldZiek(...)`, formulier leeg, en door naar `/admin/ziekmelding/${nieuw.id}` |
| De lijst | "Lopend" uit `openZiekmeldingen(sickLeaves)`, met per rij naam, `periodeTekst`, reden, een knop naar de werklijst en "Intrekken" |
| Het archief | "Ingetrokken": de rest, in het gedempte blok (`opacity: 0.7`, hoofdletterkopje) |

Beide blokken staan op `van` aflopend: de melding waarvoor de beheerder het scherm opende, komt
bovenaan. Een lege lijst toont een gewone zin.

**Wat het scherm niet zelf uitrekent.** Er staat nul keer `retracted_at` in `app/` — welke
melding nog meetelt beslist `openZiekmeldingen`, en het archiefblok is de verzameling die daar
niet in zit (via een `Set` van id's). De validatie is `ziekmeldingFout` en niets anders: een half
getypte datum wordt een lege sleutel, en de melding die de gebruiker leest komt uit `lib/`. Er
staat geen tweede kopie van "kies wie er ziek is" of "vul beide dagen in" in het scherm.

**Waarom er meteen doorgenavigeerd wordt**, met commentaar erbij: het fasedoel is "binnen een
minuut", en een overzicht dat de beheerder eerst nog moet aanklikken kost precies die minuut
terwijl de zieke trainer nog aan de lijn hangt. Geeft `meldZiek` `null` terug, dan blijft het
scherm staan met een melding en wordt er niet genavigeerd (T-03-24): een werklijst van een id
die niet bestaat, ziet eruit alsof er geen enkele les geraakt is.

**De tegel** in `app/admin/index.tsx`, in de groep `'club'` direct naast `lesgroepen`, in exact
dezelfde vorm (`...(isAdmin(currentUser) ? [{ ... } as Tile] : [])`), met `Thermometer` als nieuw
icoon en één regel commentaar in de toon van de buren: dat de tegel wegblijft is wellevendheid en
geen bewaking.

**De routes** in `app/_layout.tsx`: `admin/ziekmelding/index` → `t('Ziekmelding')`, en vooruit
geregistreerd `admin/ziekmelding/[id]` → `t('Werklijst')`, dezelfde greep als bij
`admin/lesgroepen/[id]` destijds — zonder die regel krijgt het scherm van plan 07 straks geen kop.

**De Engelse kant**: een eigen gegroepeerd blok onderaan `lib/i18n-en.ts` met een
sectiecommentaar en 21 zinnen. De `MIST`-lus uit het plan is leeg.

## Deviations from Plan

**1. [Rule 3 - Blokkerend] De uitleg bovenaan staat per zin in plaats van als één samengestelde
tekst.**
- **Gevonden bij:** taak 2, bij het nalopen van de `MIST`-lus uit de acceptatiecriteria.
- **Probleem:** een `t('...' + '...' + '...')` over drie regels is met de controle uit het plan
  (`grep -o "t('[^']*'"` gevolgd door `grep -Fq` in `lib/i18n-en.ts`) niet als sleutel terug te
  vinden — het lesgroepenscherm heeft datzelfde gat. Praktisch gevolg: wie later controleert of
  het Engels compleet is, krijgt daar een vals alarm of, erger, mist een echt gat.
- **Oplossing:** de uitleg is in drie losse zinnen geknipt, elk één `t()`-sleutel op één regel,
  met een commentaarregel die uitlegt waarom ze niet aan elkaar geplakt zijn. Dezelfde tekst op
  het scherm.
- **Commit:** 421162e

**2. [Rule 3 - Blokkerend] De totstaat heet `totDag` in plaats van `tot`.**
- **Gevonden bij:** taak 2. `setTot('')` bij het leegmaken van het formulier levert bij de
  `t('...')`-extractie een lege sleutel op (de tekst `t('')` staat er letterlijk in), waardoor de
  `MIST`-lus een regel `MIST:` zonder inhoud gaf.
- **Oplossing:** de staat heet `totDag`/`setTotDag`; de lokale sleutels in de indienfunctie heten
  `vanSleutel`/`totSleutel`. Geen gedragsverschil.
- **Commit:** 421162e

**Buiten scope gelaten:** het lesgroepenscherm heeft beide bovenstaande eigenaardigheden ook.
Die zijn niet aangeraakt — pre-existent en niet veroorzaakt door dit plan.

**REQUIREMENTS.md:** VERV-04 en VERV-10 zijn met dit plan bereikbaar geworden voor de beheerder
(melden, terugzien, intrekken). Ze zijn hier nog niet afgevinkt: beide zinnen gaan over de
werklijst als geheel, en de knop "Werklijst openen" leidt tot plan 07 naar een route die nog
geen scherm heeft.

## Verificatie

```
npx tsc --noEmit                → schoon (exit 0, geen uitvoer)
npm test                        → 49 suites, 1223 tests, alles groen (was 49 / 1223)
npx expo export --platform web  → geslaagd (1 bundle, 3.8 MB, "Exported: dist")
```

Greps uit de acceptatiecriteria:

```
wc -l app/admin/ziekmelding/index.tsx                      299   (≥ 200)
isAdmin-poort op regel 76, laatste "return (" op regel 123  76 < 123
"Ziekmeldingen zijn alleen voor de beheerder."               1
retracted_at in het scherm                                   0
retracted_at in app/ (hele map)                              0
openZiekmeldingen(                                           1   (≥ 1)
ziekmeldingFout(                                             1   (≥ 1)
coachesOf(                                                   1   (≥ 1)
users.filter                                                 0
/admin/ziekmelding/${                                        2   (≥ 1)
letterlijke zin in een <Text> buiten t()                     0
key: 'ziekmelding' in app/admin/index.tsx                    1
   ... binnen een isAdmin(currentUser)-tak                   1
GraduationCap in app/admin/index.tsx                         2   (ongewijzigd)
Thermometer in app/admin/index.tsx                           2   (import + gebruik)
de MIST-lus over alle t()-zinnen van het scherm             leeg
'Ziekmelding': en 'Werklijst en vervangers': in i18n-en     beide aanwezig
```

## Known Stubs

De knop "Werklijst openen" en de doornavigatie na het opslaan wijzen naar
`/admin/ziekmelding/[id]`, en dat scherm bestaat nog niet — het is plan 03-07. De route is wel
al in `app/_layout.tsx` geregistreerd, dezelfde volgorde als bij de lesgroepen in fase 1. Tot
plan 07 landt, komt de beheerder daar op het lege routescherm van expo-router uit. Dat is de
opzet van de fase; dit plan levert het formulier en de lijst.

De `sick_leaves`-migratie is nog steeds bewust niet gedraaid. Tot de gebruiker dat doet, leest
`selectAllOptioneel` een lege lijst en toont dit scherm "Er loopt op dit moment geen enkele
ziekmelding."; een melding bewaren zal pas na de migratie blijven staan.

## Threat Flags

Geen nieuw aanvalsoppervlak buiten het dreigingsmodel van het plan. T-03-21 is afgedekt met de
`isAdmin`-poort vóór elke andere `return` plus de grep die de volgorde bewijst; T-03-22 met de
optionele reden en het scherm dat alleen voor de beheerder opengaat; T-03-23 met `parseDayInput`
dat `null` geeft en `ziekmeldingFout` dat daar één melding van maakt in plaats van te werpen;
T-03-24 met de `if (!nieuw)`-tak die niet navigeert.

## Self-Check: PASSED

- `app/admin/ziekmelding/index.tsx` — bestaat, 299 regels
- `app/admin/index.tsx`, `app/_layout.tsx`, `lib/i18n-en.ts` — gewijzigd en gecommit
- Commits 2b969c2 en 421162e — beide gevonden in `git log`
