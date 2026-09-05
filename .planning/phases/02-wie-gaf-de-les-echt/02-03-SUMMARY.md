---
phase: 02-wie-gaf-de-les-echt
plan: 03
subsystem: provider + schermen
tags: [provider, react-native, i18n, compileergrens, rechten]

requires:
  - phase: 02-wie-gaf-de-les-echt
    plan: 01
    provides: "Booking.taught_by_id in lib/types.ts en lesgeverId in lib/lesgever.ts"
  - phase: 02-wie-gaf-de-les-echt
    plan: 02
    provides: "de beheerdersgrens op taught_by_id in bewaak_betaalvelden (nog niet gedraaid)"
provides:
  - "setTaughtBy in providers/SimpleDataProvider.tsx — de enige schrijfweg naar taught_by_id"
  - "taught_by_id uitgesloten van updateBooking, in contexttype én implementatie"
  - "beide namen op het lesdetailblad, met beheerder-only keuzeknoppen"
  - "een vervangingsmarkering op de compacte leskaart"
  - "de Engelse kant van elke nieuwe zin"
affects: [02-04 (de migratie draaien en dit met de hand nalopen), fase 3 (de werklijst schrijft via setTaughtBy)]

tech-stack:
  added: []
  patterns:
    - "een uitgesloten veld in het patch-type van updateBooking als compileergrens naast één bewaakte provideractie — dezelfde vorm als payment_method/setPaymentMethod"
    - "isAdmin(currentUser) als eigen vraag naast canManage, waar canManage te ruim is"

key-files:
  created: []
  modified:
    - providers/SimpleDataProvider.tsx
    - components/BookingDetailSheet.tsx
    - components/LessonCards.tsx
    - lib/i18n-en.ts

key-decisions:
  - "De grens op het detailblad is isAdmin(currentUser), niet canManage: canManage laat de trainer van de les toe, en die zou daarmee zijn eigen loonstaat zetten (D-08)"
  - "Voor wie het niet mag wordt er geen Chip gerenderd — geen uitgeschakelde knop, maar helemaal geen onPress die setTaughtBy kan bereiken"
  - "setTaughtBy heeft geen plan*-functie: er valt niets te verzoenen, dus alleen lezen, afbreken bij een onbekende boeking, en één commit()"
  - "Leeg wordt weggeschreven als undefined, niet null — dat is wat het type zegt en wat lesgeverId leest (D-02)"
  - "De trainerskeuze filtert op isCoach(u) uit lib/rechten in plaats van u.role === 'coach' letterlijk uit te schrijven; dat is precies de verwarring die isCoach volgens zijn eigen doc-commentaar opruimt"
  - "Op de kaart blijft de naam van de vaste trainer staan met een markering erachter; twee volledige namen passen daar niet en staan één tik verder op het detailblad (D-07)"

patterns-established:
  - "Elk toekomstig loongevoelig veld krijgt dezelfde drieslag: uitgesloten van updateBooking, één eigen provideractie, en de echte grens in de databank"

requirements-completed: [VERV-01, VERV-03]

duration: 20min
completed: 2026-09-06
---

# Phase 02 Plan 03: De schrijfweg en de zichtbaarheid Summary

**`setTaughtBy` is de enige weg naar `taught_by_id` — TypeScript weigert de omweg via `updateBooking` — en bij een vervangen les staan de vaste trainer én de vervanger allebei in beeld, terwijl alleen een beheerder de invulknoppen krijgt.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 3
- **Files created:** 0
- **Files modified:** 4

## Accomplishments

### Taak 1 — de bewaakte weg en de compileergrens (`33d6124`)

- `setTaughtBy: (bookingId: string, coachId: string | null) => Promise<void>` in het contexttype, direct onder `setPaymentMethod`, met een Nederlands doc-commentaar dat drie dingen zegt: `null` wist het weer (D-02), alleen de beheerder mag dit (D-08, ook de trainer van de les niet), en de échte bewaking staat in `bewaak_betaalvelden` — dit is de weg ernaartoe, niet de grens zelf ("de app is niet de bewaker").
- De implementatie in de vorm van `setPaymentMethod` maar zonder `plan*`-functie: `storeRef.current` lezen, afbreken bij een ontbrekende store of boeking, en één `commit()` die alleen `taught_by_id: coachId ?? undefined` op die ene boeking zet. `coach_id` wordt nergens aangeraakt.
- `'taught_by_id'` toegevoegd aan de `Omit<>`-unie van `updateBooking` op beide plekken, en in diezelfde bewerking de gedocumenteerde drift hersteld: de implementatie miste `'attendance'`. Commentaar, contexttype en implementatie noemen nu alle drie dezelfde zes velden.
- Bedrading compleet op alle drie de plekken: contexttype, waarde-object en `useMemo`-afhankelijkhedenlijst.
- `lib/sync.ts`, `providers/mockStore.ts` en `providers/supabaseStore.ts` niet aangeraakt.

### Taak 2 — beide namen, en de knoppen alleen voor de beheerder (`ae18b4a`)

- `vervangerNaam` naast het bestaande `coachName`, afgeleid met dezelfde `nameOf`.
- De regel `{t('Trainer')}: {coachName}` staat er ongewijzigd, altijd. Is er vervangen, dan komt er een tweede `Pressable` onder in exact dezelfde vorm (`partyLine` + `ChevronRight`), die doorklikt naar `/coaches/${booking.taught_by_id}` met het toegankelijkheidslabel `t('Open dossier van vervanger {naam}')`.
- Daaronder, uitsluitend binnen `{isAdmin(currentUser) ? (...) : null}`: het label `t('Wie gaf deze les?')` en een `chipRow` met een chip `t('Gaf hem zelf')` (`selected` als er niets ingevuld is, roept `setTaughtBy(booking.id, null)` aan) plus één chip per trainer behalve de vaste trainer zelf.
- Bewust geen uitgeschakelde chips voor een niet-beheerder: bij `isAdmin === false` wordt er geen enkele `Chip` gerenderd, dus er bestaat geen `onPress` die `setTaughtBy` kan bereiken.
- Nederlands commentaar erboven benoemt de bug die de grens voorkomt: een trainer die op zijn eigen les een vervanger invult, zet daarmee zijn eigen loonstaat — en daarom is `canManage` hier het verkeerde hek, want daar valt de trainer van de les onder.

### Taak 3 — de markering op de compacte kaart (`b976ae3`)

- De `other`-labelberekening kreeg er één tak bij: is `taught_by_id` gezet, dan `` `${nameOf(booking.coach_id)} (${t('vervangen')})` ``. De naam van de vervanger komt nergens op de kaart in plaats van de vaste trainer.
- De tak voor een trainer (`isCoach(currentUser)`, die de spelernaam toont) is ongewijzigd.
- Commentaar erbij met de reden: een kaart is een samenvatting, het detailblad de bron.

### `lib/i18n-en.ts`

Vijf nieuwe sleutels, elk met de Nederlandse zin letterlijk als sleutel: `'Vervanger'`, `'Wie gaf deze les?'`, `'Gaf hem zelf'`, `'vervangen'` en `'Open dossier van vervanger {naam}'`.

## De compileergrens is echt bewezen

Zoals het acceptatiecriterium vroeg, is `void updateBooking('x', { taught_by_id: 'y' });` tijdelijk in `providers/SimpleDataProvider.tsx` gezet. `npx tsc --noEmit` faalde toen met exitcode 2 en deze fout:

```
providers/SimpleDataProvider.tsx(768,29): error TS2353: Object literal may only specify
known properties, and 'taught_by_id' does not exist in type
'Partial<Omit<Booking, "participant_ids" | "taught_by_id" | "payment_method" |
"beurtenkaart_id" | "payment_split" | "attendance">>'.
```

De regel is daarna weer verwijderd; `npx tsc --noEmit` is opnieuw schoon. De omweg via `updateBooking` bestaat dus niet meer — hij compileert niet.

## Bewijs uit de acceptatiecriteria

```
grep -c "setTaughtBy" providers/SimpleDataProvider.tsx                       → 5   (≥4 gevraagd)
grep -cF "'payment_method' | ... | 'attendance' | 'taught_by_id'" provider   → 2   (type + implementatie)
grep -cF "'payment_method' | ... | 'payment_split'>>" provider               → 0   (oude 4-veldenvariant weg)
git diff --stat lib/sync.ts providers/mockStore.ts providers/supabaseStore.ts → leeg

grep -c "taught_by_id" components/BookingDetailSheet.tsx                     → 5   (≥3 gevraagd)
grep -n "isAdmin(currentUser)" BookingDetailSheet.tsx                        → 172, 356
grep -n "setTaughtBy" BookingDetailSheet.tsx                                 → 114 (destructurering),
                                                                               352 (commentaar),
                                                                               364 en 375 (aanroepen)
  → beide aanroepen liggen ná regel 356 en binnen diezelfde JSX-tak
grep -cF "{t('Trainer')}: {coachName}" BookingDetailSheet.tsx                → 1   (regel niet vervangen)

grep -c "taught_by_id" components/LessonCards.tsx                            → 1
grep -cF "nameOf(booking.coach_id)" components/LessonCards.tsx               → 2
grep -cF "nameOf(booking.taught_by_id)" components/LessonCards.tsx           → 0
grep -cF "'Vervanger':" lib/i18n-en.ts                                       → 1
grep -cF "'Wie gaf deze les?':" lib/i18n-en.ts                               → 1
grep -cF "'Gaf hem zelf':" lib/i18n-en.ts                                    → 1
grep -cF "'Open dossier van vervanger {naam}':" lib/i18n-en.ts               → 1
grep -cF "'vervangen':" lib/i18n-en.ts                                       → 1

grep -rn "taught_by_id" app/ | wc -l                                         → 0
grep -rn "taught_by_id ?? |taught_by_id ||" components/ providers/ app/      → niets
```

## Task Commits

1. **Taak 1: setTaughtBy als enige schrijfweg, en de Omit-uitsluiting** — `33d6124` (feat)
2. **Taak 2: Beide namen op het lesdetailblad, knoppen alleen voor de beheerder** — `ae18b4a` (feat)
3. **Taak 3: Op de compacte kaart is te zien dát er vervangen is** — `b976ae3` (feat)

## Verification

```
npx tsc --noEmit                → schoon (0 fouten)
npm test                        → 46 suites, 1036 tests, allemaal groen
npx expo export --platform web  → geslaagd, exit 0, "Exported: dist"
```

## Deviations from Plan

Eén kleine, bewuste afwijking, en verder niets.

**1. [Rule 2 — conventie boven letterlijke tekst] De trainersfilter gebruikt `isCoach(u)` in plaats van `u.role === 'coach'`**

- **Gevonden bij:** Taak 2
- **Aanleiding:** Het plan schrijft de filter letterlijk als `users.filter((u) => u.role === 'coach')`. Het kopcommentaar van `isCoach` in `lib/rechten.ts` zegt echter met zoveel woorden dat die vraag op vijfendertig plekken los uitgeschreven stond en dat daar precies één verwarring uit voortkomt.
- **Wat er staat:** `users.filter((u) => isCoach(u) && u.id !== booking.coach_id)`, met `isCoach` toegevoegd aan de bestaande `../lib/rechten`-importregel.
- **Gevolg:** functioneel identiek; geen acceptatiecriterium raakt eraan.
- **Bestand:** `components/BookingDetailSheet.tsx` — **commit:** `ae18b4a`

Verder is er geen deviatie. Er zijn géén pakketten geïnstalleerd, geen SQL gedraaid en geen verbinding met Supabase gemaakt.

## Known Stubs

Geen. Elke knop is bedraad naar `setTaughtBy`, en `setTaughtBy` doet een echte `commit()`.

De enige onvoltooide schakel zit buiten dit plan en is met opzet zo: de migratie uit plan 02 staat nog niet in de databank, dus `bookings.taught_by_id` bestaat daar nog niet. In mock-modus werkt de hele weg vandaag al; in Supabase-modus wordt het veld pas bewaard nadat plan 04 de migratie draait. Dat is de veilige tussentoestand die plan 01 al beschreef: zolang de kolom er niet is, is het veld overal leeg en rekent alles zoals vóór deze fase.

## Threat Flags

Geen nieuw oppervlak buiten het dreigingsmodel van dit plan. T-02-07 (de `updateBooking`-omweg) en T-02-08 (de keuzeknoppen) zijn gemitigeerd zoals het register vroeg; T-02-09 (de vervanger die de vaste trainer uit beeld duwt) is met de grep-criteria op beide schermen afgedekt.

## Issues Encountered

Geen.

## User Setup Required

None — er is niets te installeren en niets in te stellen. Wat nog openstaat, is de migratie uit plan 02 in de SQL-editor van Supabase draaien; dat is plan 04 en doet de gebruiker zelf (D-10).

## Next Phase Readiness

- De hele keten staat: veld → rekenregel (plan 01) → databankgrens als tekst (plan 02) → schrijfweg en zichtbaarheid (dit plan). Wat rest is plan 04: de migratie draaien en met de hand nalopen dat de trigger een niet-beheerder werkelijk tegenhoudt.
- Fase 3 (de werklijst bij een ziekmelding) kan `setTaughtBy` rechtstreeks aanroepen; er hoeft geen tweede schrijfweg bij, en er mag er ook geen bij.

---
*Phase: 02-wie-gaf-de-les-echt*
*Completed: 2026-09-06*

## Self-Check: PASSED
- FOUND: providers/SimpleDataProvider.tsx, components/BookingDetailSheet.tsx, components/LessonCards.tsx, lib/i18n-en.ts
- FOUND: 33d6124, ae18b4a, b976ae3
- Geen TODO/FIXME/placeholder in de gewijzigde bestanden.
