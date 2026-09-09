# Lessen zonder trainer overnemen — implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Een trainer ziet in de trainers-tab welke lessen er zonder trainer staan — door ziekte of doordat ze vrijgegeven zijn — en neemt er zelf een over.

**Architecture:** Eén nieuw veld op de boeking (`zoekt_trainer`) en één nieuw rekenbestand (`lib/openstaand.ts`) dat als enige de vraag "staat deze les open" beantwoordt, bovenop het bestaande `zoektVervanger` uit `lib/ziekmelding.ts`. Claimen zet `taught_by_id` — het bestaande enige antwoord op "wie gaf de les" — langs twee nieuwe bewaakte wegen in de provider. De databank bewaakt dezelfde grens met een verruimde policy en trigger.

**Tech Stack:** React Native + expo-router (web), TypeScript, Supabase (Postgres met RLS), jest (`jest-expo`). Alle tests staan in `lib/`.

**Spec:** `docs/superpowers/specs/2026-09-09-lessen-zonder-trainer-claimen-design.md`

**Afwijking van de spec, bewust:** de spec noemde "tests rond `claimLes` en `geefLesTerug` in de bestaande provider-tests". Die bestaan niet — deze codebase test uitsluitend in `lib/`. Daarom verhuist de beslissing "mag deze claim" naar `claimBezwaar` en `teruggeefBezwaar` in `lib/openstaand.ts` (getest, Taak 5) en roept de provider die alleen aan (Taak 6). Dat is dezelfde verdeling als `planMethodChange` in `lib/beurtenkaart.ts` en de provider die hem commit.

---

## Bestandsoverzicht

| Bestand | Verantwoordelijkheid |
| --- | --- |
| `lib/types.ts` (wijzigen) | Het veld `zoekt_trainer` op `Booking`. |
| `lib/openstaand.ts` (nieuw) | Puur rekenwerk: staat deze les open, welke staan er open, mag deze kijker claimen of teruggeven. De enige plek die deze vier vragen beantwoordt. |
| `lib/openstaand.test.ts` (nieuw) | De tests daarvan. |
| `providers/SimpleDataProvider.tsx` (wijzigen) | `claimLes` en `geefLesTerug`: de twee schrijfwegen, die de beslissing aan `lib/openstaand.ts` overlaten. |
| `app/coaches/openstaand.tsx` (nieuw) | Het scherm: openstaande lessen met reden en knop, en wat de kijker zelf overnam. |
| `app/coaches/index.tsx` (wijzigen) | De regel bij *Gereedschap* met het aantal. |
| `app/_layout.tsx` (wijzigen) | De route en zijn titel. |
| `components/BookingDetailSheet.tsx` (wijzigen) | De schakelaar "deze les zoekt een trainer". |
| `lib/i18n-en.ts` (wijzigen) | De Engelse kant van elke nieuwe zin. |
| `ZOEKT-TRAINER.sql` (nieuw) | Kolom, `les_staat_open()`, en de verruimde policy en trigger. |
| `OPENSTAAND.md` (wijzigen) | Wat er bij is gekomen en wat de gebruiker nog met de hand moet doen. |

---

## Taak 1: Branch

**Files:** geen

- [ ] **Stap 1: Controleer de werkkopie**

```bash
cd "/Users/leko/Downloads/tennis app"
git status -sb
```

Verwacht: `## main...origin/main` en geen gewijzigde bestanden.

**Staat er iets anders — een andere branch, of gewijzigde bestanden — stop dan en vraag het aan de gebruiker.** Op 9 september 2026 stond de werkkopie op `feat/afvinken-vanaf-home` met een niet-gecommitte wijziging in `providers/SimpleDataProvider.tsx`; dat is werk van iemand anders en dat neem je niet mee.

- [ ] **Stap 2: Maak de branch**

```bash
git checkout main && git pull && git checkout -b feat/lessen-zonder-trainer
```

Verwacht: `Switched to a new branch 'feat/lessen-zonder-trainer'`.

---

## Taak 2: Het veld op de boeking

**Files:**
- Modify: `lib/types.ts` (in `export interface Booking`, direct na `cancelled_by_sick_leave`)

- [ ] **Stap 1: Zet het veld erbij**

Voeg toe in `interface Booking`, na het blok van `cancelled_by_sick_leave`:

```ts
  /**
   * Het merkteken "deze les zoekt een trainer", buiten ziekte om. Aangezet door de trainer
   * van de les of door de beheerder, op het lesdetailblad.
   *
   * Het zegt niets over wie de les geeft. `coach_id` blijft van wie de les is en
   * `taught_by_id` blijft het enige antwoord op wie er werkelijk op de baan stond — zie
   * `lesgeverId` in lib/lesgever. Een tweede veld dat óók iets over de lesgever beweert, laat
   * een trainer betaald worden voor een les die hij niet gaf.
   *
   * Leeg of afwezig is de normale toestand: elke les die niemand vrijgaf, en elke les van
   * vóór dit veld. Of een les daarmee ook echt openstaat, beslist `staatOpen` in
   * lib/openstaand — daar telt ook mee of er al een lesgever op staat en of de les afgezegd is.
   */
  zoekt_trainer?: boolean;
```

- [ ] **Stap 2: Controleer dat het typt**

Run: `npx tsc --noEmit`
Verwacht: geen uitvoer (de bestaande code raakt het veld nog niet).

- [ ] **Stap 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat(openstaand): het merkteken 'deze les zoekt een trainer' op de boeking

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017MeqHGc981QKot47ruFebt"
```

---

## Taak 3: `staatOpen` en `openReden`

**Files:**
- Create: `lib/openstaand.ts`
- Test: `lib/openstaand.test.ts`

- [ ] **Stap 1: Schrijf de falende test**

Maak `lib/openstaand.test.ts`:

```ts
import { openReden, staatOpen } from './openstaand';
import type { Booking, SickLeave } from './types';

const ziekmelding: SickLeave = {
  id: 'z-1', coach_id: 'c-1', van: '2027-03-01', tot: '2027-03-05',
  created_at: '2027-02-28T09:00:00.000Z',
};

const basis: Booking = {
  id: 'b-1', player_id: 's-1', coach_id: 'c-1', court_id: 'baan-1',
  start_time: '2027-03-03T17:00:00.000Z', end_time: '2027-03-03T18:00:00.000Z',
  status: 'confirmed', payment_method: 'open',
};

/** Een les met een afwijking erop, zoals `ziek` in lib/ziekmelding.test. */
const les = (patch: Partial<Booking> = {}): Booking => ({ ...basis, ...patch });

describe('openReden', () => {
  it('noemt een les van een zieke trainer ziek', () => {
    expect(openReden(les(), [ziekmelding])).toBe('ziek');
  });

  it('noemt een vrijgegeven les vrijgegeven', () => {
    expect(openReden(les({ zoekt_trainer: true }), [])).toBe('vrijgegeven');
  });

  it('noemt ziekte eerst als een zieke trainer zijn les ook vrijgaf', () => {
    // Beide gelden; de ziekmelding is wat de kijker moet weten, want die verklaart ook de
    // andere lessen van diezelfde trainer.
    expect(openReden(les({ zoekt_trainer: true }), [ziekmelding])).toBe('ziek');
  });

  it('geeft null voor een gewone les', () => {
    expect(openReden(les(), [])).toBeNull();
  });

  it('geeft null als er al een lesgever op staat', () => {
    // Zowel bij ziekte als bij het merkteken: geregeld is geregeld.
    expect(openReden(les({ taught_by_id: 'c-2' }), [ziekmelding])).toBeNull();
    expect(openReden(les({ taught_by_id: 'c-2', zoekt_trainer: true }), [])).toBeNull();
  });

  it('geeft null voor een afgezegde les', () => {
    expect(openReden(les({ status: 'cancelled' }), [ziekmelding])).toBeNull();
    expect(openReden(les({ status: 'cancelled', zoekt_trainer: true }), [])).toBeNull();
  });

  it('geeft null bij een ingetrokken ziekmelding', () => {
    // Dezelfde regel als `openZiekmeldingen`: ingetrokken telt nergens meer mee, en er hoeft
    // dus ook nooit iets aan de boeking bijgewerkt te worden.
    const in2 = { ...ziekmelding, retracted_at: '2027-03-02T08:00:00.000Z' };
    expect(openReden(les(), [in2])).toBeNull();
  });

  it('geeft null voor een les buiten de ziekteperiode', () => {
    expect(openReden(les({
      start_time: '2027-03-09T17:00:00.000Z', end_time: '2027-03-09T18:00:00.000Z',
    }), [ziekmelding])).toBeNull();
  });
});

describe('staatOpen', () => {
  it('zegt ja waar openReden een reden geeft en nee waar hij null geeft', () => {
    expect(staatOpen(les(), [ziekmelding])).toBe(true);
    expect(staatOpen(les({ zoekt_trainer: true }), [])).toBe(true);
    expect(staatOpen(les(), [])).toBe(false);
  });
});
```

- [ ] **Stap 2: Draai de test en zie hem falen**

Run: `npx jest lib/openstaand.test.ts`
Verwacht: FAIL — `Cannot find module './openstaand'`.

- [ ] **Stap 3: Schrijf `lib/openstaand.ts`**

```ts
// Staat deze les open om over te nemen, en welke staan er open voor deze trainer?
//
// Puur rekenwerk — geen store, geen scherm, geen schrijfweg — en de ENIGE plek die die vraag
// beantwoordt. Er zijn twee manieren waarop een les zonder trainer komt te staan: de vaste
// trainer is ziek gemeld, of iemand heeft de les vrijgegeven met `zoekt_trainer`. Wie die twee
// ergens anders nog eens optelt, laat een les uit de lijst vallen op de plek die hij vergat mee
// te wijzigen — en een les die niemand ziet, blijft zonder trainer staan. Dat is precies de
// fout waarvoor deze module en lib/ziekmelding bestaan.
//
// De ziektekant wordt hier niet nagebouwd maar aangeroepen: `zoektVervanger` in lib/ziekmelding
// weet al wat een openstaande melding is en welke dag een les valt. Zou dit bestand zijn eigen
// periodevergelijking schrijven, dan is er een kopie van `van <= dag <= tot` bij, en een kopie
// die ooit uiteenloopt zegt iets anders dan de werklijst van de beheerder.
//
// Er wordt hier nooit iets weggeschreven. Wie er uiteindelijk aan de les hangt, doet de provider
// met `claimLes` — en die vraagt eerst hier of het mag.

import { t } from './i18n';
import { vakantieOpMoment } from './vakanties';
import { zoektVervanger } from './ziekmelding';
import type { OpenZiekmelding } from './ziekmelding';
import type { Booking, Vakantie } from './types';

/** De velden die deze vragen van een les nodig hebben; meer weet dit bestand er niet van. */
export type OpenBoeking = Pick<
  Booking, 'coach_id' | 'taught_by_id' | 'start_time' | 'status' | 'zoekt_trainer'
> & { id?: string };

/** Waarom een les openstaat. Het scherm toont dit; het leidt het niet zelf af. */
export type OpenReden = 'ziek' | 'vrijgegeven';

/** Eén openstaande les met de reden erbij. Nooit alleen de reden: het scherm toont de les. */
export interface OpenstaandeLes<T> {
  les: T;
  reden: OpenReden;
}

/**
 * Waarom deze les openstaat, of `null` als hij niet openstaat.
 *
 * Ziekte gaat voor het merkteken als ze allebei gelden: de ziekmelding verklaart ook de andere
 * lessen van diezelfde trainer, en dat is wat de kijker moet weten.
 */
export function openReden(les: OpenBoeking, open: OpenZiekmelding[]): OpenReden | null {
  if (les.status === 'cancelled') return null;
  if (les.taught_by_id) return null;
  // `zoektVervanger` stelt dezelfde drie vragen nog eens (afgezegd, lesgever, ziek). Dat is
  // geen verspilling maar de reden dat dit bestand geen eigen ziektelogica heeft.
  if (zoektVervanger({ id: les.id ?? '', ...les }, open)) return 'ziek';
  return les.zoekt_trainer === true ? 'vrijgegeven' : null;
}

/** Staat deze les open om over te nemen? Zie `openReden` — dit is dezelfde vraag, korter. */
export function staatOpen(les: OpenBoeking, open: OpenZiekmelding[]): boolean {
  return openReden(les, open) !== null;
}
```

- [ ] **Stap 4: Draai de test en zie hem slagen**

Run: `npx jest lib/openstaand.test.ts`
Verwacht: PASS, 9 tests.

- [ ] **Stap 5: Commit**

```bash
git add lib/openstaand.ts lib/openstaand.test.ts
git commit -m "feat(openstaand): één plek die zegt of een les een trainer zoekt

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017MeqHGc981QKot47ruFebt"
```

---

## Taak 4: `openstaandeLessen`

**Files:**
- Modify: `lib/openstaand.ts`
- Test: `lib/openstaand.test.ts`

- [ ] **Stap 1: Schrijf de falende test**

Vul `lib/openstaand.test.ts` aan. Zet bovenaan `openstaandeLessen` bij de import, en zet onderaan:

```ts
describe('openstaandeLessen', () => {
  const nu = new Date('2027-03-01T08:00:00.000Z');
  const vrij = (patch: Partial<Booking>): Booking => les({ zoekt_trainer: true, ...patch });

  it('geeft de openstaande lessen op tijd gesorteerd, met hun reden', () => {
    const laat = vrij({ id: 'b-laat', start_time: '2027-03-04T17:00:00.000Z' });
    const vroeg = les({ id: 'b-vroeg', start_time: '2027-03-02T17:00:00.000Z' });
    const rijen = openstaandeLessen([laat, vroeg], [ziekmelding], [], nu, 'c-9');
    expect(rijen.map((r) => r.les.id)).toEqual(['b-vroeg', 'b-laat']);
    expect(rijen.map((r) => r.reden)).toEqual(['ziek', 'vrijgegeven']);
  });

  it('laat wat al begonnen is weg', () => {
    // Een les die loopt of geweest is valt niet meer over te nemen; daar valt niets te
    // beslissen en hij zou de lijst alleen vervuilen.
    const voorbij = vrij({ id: 'b-oud', start_time: '2027-02-27T17:00:00.000Z' });
    expect(openstaandeLessen([voorbij], [], [], nu, 'c-9')).toEqual([]);
  });

  it('laat een les weg op een dag dat de club dicht is', () => {
    // Die les gaat sowieso niet door: er een trainer voor zoeken is werk voor niets. Dezelfde
    // regel als `lessenVoorZiekmelding` in lib/ziekmelding.
    const vakanties: Vakantie[] = [{ van: '2027-03-03', tot: '2027-03-03', naam: 'Feestdag' }];
    expect(openstaandeLessen([vrij({ id: 'b-1' })], [], vakanties, nu, 'c-9')).toEqual([]);
  });

  it('laat de eigen lessen van de kijker weg', () => {
    // Jezelf overnemen betekent niets: `taught_by_id` gelijk aan `coach_id` is precies de
    // toestand die "de vaste trainer gaf hem zelf" al uitdrukt met leeg.
    expect(openstaandeLessen([vrij({ id: 'b-1' })], [], [], nu, 'c-1')).toEqual([]);
  });

  it('laat een onleesbare begintijd weg in plaats van te crashen', () => {
    const kapot = vrij({ id: 'b-kapot', start_time: 'geen datum' });
    expect(openstaandeLessen([kapot], [], [], nu, 'c-9')).toEqual([]);
  });
});
```

Zet ook `Vakantie` bij de type-import bovenaan het testbestand:

```ts
import type { Booking, SickLeave, Vakantie } from './types';
```

- [ ] **Stap 2: Draai de test en zie hem falen**

Run: `npx jest lib/openstaand.test.ts`
Verwacht: FAIL — `openstaandeLessen is not a function`.

- [ ] **Stap 3: Voeg de functie toe aan `lib/openstaand.ts`**

Onderaan het bestand:

```ts
/**
 * De lessen die deze kijker kan overnemen, op tijd gesorteerd — zo werkt hij de lijst van boven
 * naar beneden af. Het scherm sorteert niet nog eens.
 *
 * Wat er afvalt en waarom:
 *  - wat al begonnen is: daar valt niets meer over te beslissen;
 *  - een dag dat de club dicht is: die les gaat sowieso niet door, dezelfde regel als
 *    `lessenVoorZiekmelding`;
 *  - de eigen lessen van de kijker: jezelf overnemen betekent niets.
 *
 * Er staat met opzet GEEN bovengrens op hoe ver vooruit gekeken wordt. Een venster van een paar
 * weken is precies hoe een les blijft liggen tot hij te dichtbij is om nog op te lossen.
 *
 * Generiek in `T`, zodat het scherm er volle `Booking`-rijen in stopt en er volle rijen uit
 * krijgt — met baan, groep en spelers erin — zonder dat dit bestand daarvan hoeft te weten.
 */
export function openstaandeLessen<T extends OpenBoeking>(
  bookings: T[],
  open: OpenZiekmelding[],
  vakanties: Vakantie[],
  nu: Date,
  kijkerId: string,
): OpenstaandeLes<T>[] {
  const rijen: OpenstaandeLes<T>[] = [];
  for (const les of bookings) {
    if (les.coach_id === kijkerId) continue;
    // Een onleesbare begintijd geeft NaN, en NaN is nooit groter: bij twijfel valt de les uit
    // de lijst in plaats van het scherm te laten struikelen op een datum die niet bestaat.
    if (!(Date.parse(les.start_time) > nu.getTime())) continue;
    if (vakantieOpMoment(vakanties, les.start_time) !== null) continue;
    const reden = openReden(les, open);
    if (reden === null) continue;
    rijen.push({ les, reden });
  }
  // `rijen` is hier zelf opgebouwd, dus deze sortering raakt de meegegeven lijst niet aan.
  // `Date.parse` en niet de tekst: een tijdstip met een zone-aanduiding sorteert als tekst fout.
  return rijen.sort((a, b) => Date.parse(a.les.start_time) - Date.parse(b.les.start_time));
}
```

- [ ] **Stap 4: Draai de test en zie hem slagen**

Run: `npx jest lib/openstaand.test.ts`
Verwacht: PASS, 14 tests.

- [ ] **Stap 5: Commit**

```bash
git add lib/openstaand.ts lib/openstaand.test.ts
git commit -m "feat(openstaand): de lijst met lessen die een trainer kan overnemen

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017MeqHGc981QKot47ruFebt"
```

---

## Taak 5: `claimBezwaar` en `teruggeefBezwaar`

**Files:**
- Modify: `lib/openstaand.ts`
- Test: `lib/openstaand.test.ts`

- [ ] **Stap 1: Schrijf de falende test**

Zet `claimBezwaar, teruggeefBezwaar` bij de import bovenaan het testbestand en voeg onderaan toe:

```ts
describe('claimBezwaar', () => {
  const nu = new Date('2027-03-01T08:00:00.000Z');

  it('geeft null voor een openstaande les van een collega', () => {
    expect(claimBezwaar(les(), 'c-9', [ziekmelding], nu)).toBeNull();
  });

  it('klaagt als de les niet meer bestaat', () => {
    expect(claimBezwaar(undefined, 'c-9', [], nu)).not.toBeNull();
  });

  it('klaagt over je eigen les', () => {
    expect(claimBezwaar(les(), 'c-1', [ziekmelding], nu)).not.toBeNull();
  });

  it('zegt dat een collega je voor was als er al een lesgever op staat', () => {
    // Twee trainers kunnen tegelijk naar dezelfde lijst kijken. De tweede hoort te lezen wat
    // er gebeurd is, en niet een knop in te drukken die stil niets doet.
    const bezwaar = claimBezwaar(les({ taught_by_id: 'c-2' }), 'c-9', [ziekmelding], nu);
    expect(bezwaar).not.toBeNull();
    expect(bezwaar).toContain('collega');
  });

  it('klaagt over een les die al begonnen is', () => {
    const laat = new Date('2027-03-03T17:30:00.000Z');
    expect(claimBezwaar(les(), 'c-9', [ziekmelding], laat)).not.toBeNull();
  });

  it('klaagt over een les die niet openstaat', () => {
    expect(claimBezwaar(les(), 'c-9', [], nu)).not.toBeNull();
  });
});

describe('teruggeefBezwaar', () => {
  const nu = new Date('2027-03-01T08:00:00.000Z');

  it('geeft null voor je eigen overgenomen les', () => {
    expect(teruggeefBezwaar(les({ taught_by_id: 'c-9' }), 'c-9', nu)).toBeNull();
  });

  it('klaagt als de les niet meer bestaat', () => {
    expect(teruggeefBezwaar(undefined, 'c-9', nu)).not.toBeNull();
  });

  it('klaagt over de les van iemand anders', () => {
    expect(teruggeefBezwaar(les({ taught_by_id: 'c-2' }), 'c-9', nu)).not.toBeNull();
    expect(teruggeefBezwaar(les(), 'c-9', nu)).not.toBeNull();
  });

  it('klaagt over een les die al begonnen is', () => {
    const laat = new Date('2027-03-03T17:30:00.000Z');
    expect(teruggeefBezwaar(les({ taught_by_id: 'c-9' }), 'c-9', laat)).not.toBeNull();
  });
});
```

- [ ] **Stap 2: Draai de test en zie hem falen**

Run: `npx jest lib/openstaand.test.ts`
Verwacht: FAIL — `claimBezwaar is not a function`.

- [ ] **Stap 3: Voeg beide functies toe aan `lib/openstaand.ts`**

Onderaan het bestand:

```ts
/**
 * Waarom deze trainer deze les niet kan overnemen, of `null` als het mag.
 *
 * Een zin en geen boolean, en nooit stil niets doen: twee trainers kunnen tegelijk naar dezelfde
 * lijst kijken, en wie op een knop drukt die niets doet, drukt hem nog eens en gaat daarna bellen.
 *
 * De volgorde van de controles ligt vast en de eerste die nee zegt wint — dezelfde afspraak als
 * `kanVervangen` in lib/vervanger. "Er staat al een lesgever" wordt vóór "staat niet open"
 * gevraagd, want dat is de reden die de kijker moet lezen: een collega was hem voor.
 *
 * Dit is het bezwaar van de app. De databank stelt dezelfde vragen nog eens in
 * `les_staat_open()` en in `bewaak_betaalvelden` (ZOEKT-TRAINER.sql) — dezelfde verdeling als
 * tussen lib/rechten en de policies: hier zodat er geen knop staat die daarna geweigerd wordt,
 * daar omdat dát de bewaking is.
 */
export function claimBezwaar(
  les: OpenBoeking | undefined,
  kijkerId: string,
  open: OpenZiekmelding[],
  nu: Date,
): string | null {
  if (!les) return t('Deze les bestaat niet meer.');
  if (les.coach_id === kijkerId) return t('Dit is je eigen les.');
  if (les.taught_by_id) return t('Een collega was je voor: deze les heeft al een lesgever.');
  if (!(Date.parse(les.start_time) > nu.getTime())) return t('Deze les is al begonnen.');
  if (!staatOpen(les, open)) return t('Deze les zoekt geen trainer meer.');
  return null;
}

/**
 * Waarom deze trainer deze les niet kan teruggeven, of `null` als het mag.
 *
 * Alleen wie er zelf als lesgever op staat, en alleen zolang de les nog moet beginnen. Wat
 * geweest is blijft staan zoals het was: `taught_by_id` bepaalt wie er betaald wordt, en een
 * gegeven les laat je niet achteraf van naam wisselen.
 *
 * Ook een les die de beheerder toewees mag terug. Teruggeven maakt een les niet onzichtbaar maar
 * juist weer zichtbaar: hij komt terug in deze lijst en op de werklijst van de beheerder.
 */
export function teruggeefBezwaar(
  les: OpenBoeking | undefined,
  kijkerId: string,
  nu: Date,
): string | null {
  if (!les) return t('Deze les bestaat niet meer.');
  if (les.taught_by_id !== kijkerId) return t('Deze les staat niet op jouw naam.');
  if (!(Date.parse(les.start_time) > nu.getTime())) return t('Deze les is al begonnen.');
  return null;
}
```

- [ ] **Stap 4: Draai de test en zie hem slagen**

Run: `npx jest lib/openstaand.test.ts`
Verwacht: PASS, 24 tests.

- [ ] **Stap 5: Zet de Engelse zinnen erbij**

In `lib/i18n-en.ts`, onderaan in het object (een blok met een kop erboven, zoals de andere blokken):

```ts
  // --- lessen zonder trainer ---------------------------------------------
  'Deze les bestaat niet meer.': 'This lesson no longer exists.',
  'Dit is je eigen les.': 'This is your own lesson.',
  'Een collega was je voor: deze les heeft al een lesgever.':
    'A colleague beat you to it: this lesson already has a coach.',
  'Deze les is al begonnen.': 'This lesson has already started.',
  'Deze les zoekt geen trainer meer.': 'This lesson is no longer looking for a coach.',
  'Deze les staat niet op jouw naam.': 'This lesson is not in your name.',
```

- [ ] **Stap 6: Commit**

```bash
git add lib/openstaand.ts lib/openstaand.test.ts lib/i18n-en.ts
git commit -m "feat(openstaand): wanneer een trainer een les mag nemen of teruggeven

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017MeqHGc981QKot47ruFebt"
```

---

## Taak 6: De twee schrijfwegen in de provider

**Files:**
- Modify: `providers/SimpleDataProvider.tsx` (import bovenaan; het typeblok bij `setTaughtBy` rond regel 157; de implementatie na `zetVervangerVoorLessen` rond regel 1045; de contextwaarde rond regel 1643 en de dependency-lijst rond regel 1684)

- [ ] **Stap 1: Voeg de import toe**

Naast `import { herstelNaVerwijdering } from '../lib/ziekmelding';` (regel 31):

```ts
import { claimBezwaar, teruggeefBezwaar } from '../lib/openstaand';
```

- [ ] **Stap 2: Zet de twee functies in het contexttype**

In de interface, direct na de regel van `zetVervangerVoorLessen`:

```ts
  /**
   * Een trainer neemt zelf een openstaande les over: `taught_by_id` komt op hemzelf te staan.
   *
   * Geeft de reden terug als het niet mag, of `null` als het gelukt is. Nooit stil niets doen —
   * twee trainers kunnen tegelijk naar dezelfde lijst kijken, en de tweede hoort te lezen dat
   * een collega hem voor was. De beslissing zelf staat in `claimBezwaar` (lib/openstaand); hier
   * wordt hij alleen gecommit.
   *
   * Raakt precies één boeking, ook als ze bij een reeks of een lesgroep hoort. Wie hier de hele
   * reeks meeneemt, laat een half seizoen aan lessen van eigenaar wisselen voor lessen waar
   * niemand voor uitviel — dezelfde regel als D-07 op de werklijst.
   */
  claimLes: (bookingId: string) => Promise<string | null>;
  /** De trainer geeft een les die op zijn naam staat terug; zie `teruggeefBezwaar`. */
  geefLesTerug: (bookingId: string) => Promise<string | null>;
```

- [ ] **Stap 3: Schrijf de implementatie**

Direct na de `zetVervangerVoorLessen`-callback:

```ts
  // Claimen en teruggeven zetten hetzelfde veld als `setTaughtBy`, maar langs een eigen weg:
  // `setTaughtBy` is de handeling van de beheerder ("ik wijs jou aan") en heeft geen bezwaar,
  // deze twee zijn de handeling van de trainer zelf en hebben er wél een. Eén functie met een
  // vlaggetje zou die twee regels in elkaar schuiven, en dan is niet meer te zien welke van de
  // twee er ergens aangeroepen wordt.
  const claimLes = useCallback(async (bookingId: string): Promise<string | null> => {
    const store = storeRef.current;
    if (!store || !currentUserId) return null;
    const booking = store.bookings.find((b) => b.id === bookingId);
    const bezwaar = claimBezwaar(booking, currentUserId, store.sickLeaves, new Date());
    if (bezwaar !== null) return bezwaar;
    await commit({
      ...store,
      bookings: store.bookings.map((b) =>
        b.id === bookingId ? { ...b, taught_by_id: currentUserId } : b),
    });
    return null;
  }, [commit, currentUserId]);

  const geefLesTerug = useCallback(async (bookingId: string): Promise<string | null> => {
    const store = storeRef.current;
    if (!store || !currentUserId) return null;
    const booking = store.bookings.find((b) => b.id === bookingId);
    const bezwaar = teruggeefBezwaar(booking, currentUserId, new Date());
    if (bezwaar !== null) return bezwaar;
    await commit({
      ...store,
      bookings: store.bookings.map((b) =>
        // Leeg is `undefined` op het type, niet `null` (D-02): zo leest `lesgeverId` het.
        b.id === bookingId ? { ...b, taught_by_id: undefined } : b),
    });
    return null;
  }, [commit, currentUserId]);
```

Let op: `currentUserId` (de state, rond regel 374) en niet `currentUser` — die wordt pas rond regel 1592 afgeleid, ná deze callbacks.

- [ ] **Stap 4: Hang ze in de contextwaarde**

Zet `claimLes, geefLesTerug,` bij de opsomming naast `setTaughtBy,` (rond regel 1643), en `claimLes, geefLesTerug,` in de dependency-lijst van diezelfde `useMemo` (rond regel 1684).

- [ ] **Stap 5: Controleer dat het typt en dat alles nog draait**

Run: `npx tsc --noEmit && npx jest`
Verwacht: geen uitvoer van `tsc`; jest slaagt volledig (676 bestaande tests plus de 24 nieuwe).

- [ ] **Stap 6: Commit**

```bash
git add providers/SimpleDataProvider.tsx
git commit -m "feat(openstaand): een trainer neemt een les over of geeft ze terug

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017MeqHGc981QKot47ruFebt"
```

---

## Taak 7: De databank

**Files:**
- Create: `ZOEKT-TRAINER.sql`
- Modify: `supabase-schema.sql` (de kolom bij het `taught_by_id`-blok rond regel 953; `bookings_update` rond regel 762; `bewaak_betaalvelden` rond regel 974)

Beide bestanden krijgen dezelfde inhoud, zoals bij `AFZEGGING-MERKTEKEN.sql`: `ZOEKT-TRAINER.sql` is wat de gebruiker draait op een databank die er al staat, `supabase-schema.sql` is wat een nieuwe databank opbouwt. Lopen ze uiteen, dan werkt de app bij de club anders dan bij een verse installatie.

- [ ] **Stap 1: Schrijf `ZOEKT-TRAINER.sql`**

```sql
-- Een les vrijgeven, en een trainer die er zelf een overneemt.
--
-- Draai dit in de Supabase SQL-editor. Twee keer draaien kan geen kwaad.
--
-- WAAROM DIT NODIG IS. Tot nu vulde alleen de beheerder in wie een les werkelijk gaf: de trigger
-- `bewaak_betaalvelden` weigerde elke wijziging van `taught_by_id` die niet van hem kwam, en de
-- policy `bookings_update` liet een trainer de rij van een collega sowieso niet aanraken. Dat
-- klopte zolang toewijzen alleen vanaf de werklijst gebeurde. Nu neemt een trainer zelf een
-- openstaande les over, en daar hoort precies één opening bij — geen algemeen schrijfrecht op de
-- lessen van collega's.

-- 1. Het merkteken: deze les zoekt een trainer, buiten ziekte om.
--
-- Onwaar is de normale toestand, dus er hoeft niets ingevuld te worden voor wat er al staat. Het
-- veld zegt niets over wie de les geeft: `coach_id` blijft van wie de les is en `taught_by_id`
-- blijft het enige antwoord op wie er werkelijk stond.
alter table bookings
  add column if not exists zoekt_trainer boolean not null default false;

-- 2. Staat deze les open om over te nemen?
--
-- De tegenhanger van `staatOpen` in lib/openstaand.ts. Dezelfde dubbeling als tussen
-- lib/rechten.ts en de policies hieronder: de app zorgt dat er geen knop staat die hier geweigerd
-- wordt, dit is de bewaking. Lopen ze uiteen, dan is het gevolg een geweigerde knop met een
-- melding — en nooit een stille wijziging.
--
-- `least`/`greatest` op de ziekteperiode, net als `dektDag` in lib/ziekmelding.ts: er staat
-- minstens één omgekeerde rij in de databank van vóór de controle van 6 september 2026, en die
-- hoort hier hetzelfde te dekken als in de app.
--
-- De dag komt uit de Brusselse tijdzone en niet uit de UTC-datum van `start_time`: een avondles
-- schuift in UTC een dag op, en zou dan op de verkeerde dag ziek of juist gewoon lijken.
create or replace function les_staat_open(b bookings)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select b.status <> 'cancelled'
     and b.taught_by_id is null
     and (
       b.zoekt_trainer
       or exists (
         select 1 from sick_leaves z
          where z.coach_id = b.coach_id
            and z.retracted_at is null
            and (date(b.start_time at time zone 'Europe/Brussels'))::text
                between least(z.van, z.tot) and greatest(z.van, z.tot)
       )
     );
$$;

-- 3a. De policy: een trainer mag aan een rij komen die openstaat, of aan een rij waar hij zelf
-- als lesgever op staat. Een policy kent alleen hele rijen en geen kolommen — wélke kolom er mag
-- veranderen, zegt de trigger hieronder.
drop policy if exists bookings_update on bookings;
create policy bookings_update on bookings for update
  to authenticated using (
    coach_id = app_user_id()
    or is_admin()
    or player_id = app_user_id()
    or is_mijn_kind(player_id)
    or exists (
      select 1 from jsonb_array_elements_text(coalesce(participant_ids, '[]'::jsonb)) as p(id)
      where p.id = app_user_id() or is_mijn_kind(p.id)
    )
    -- Nieuw: de openstaande les van een collega, en de les die hij zelf overnam.
    or (is_coach() and (les_staat_open(bookings) or taught_by_id = app_user_id()))
  )
  with check (
    coach_id = app_user_id()
    or is_admin()
    or player_id = app_user_id()
    or is_mijn_kind(player_id)
    or exists (
      select 1 from jsonb_array_elements_text(coalesce(participant_ids, '[]'::jsonb)) as p(id)
      where p.id = app_user_id() or is_mijn_kind(p.id)
    )
    or (is_coach() and (taught_by_id = app_user_id() or taught_by_id is null))
  );

-- 3b. De trigger. De regel "alleen een beheerder vult in wie de les gaf" wordt drie gevallen, en
-- blijft staan waar hij stond: vóór "de trainer van deze les mag alles", want ook de vaste
-- trainer zet dit veld niet zelf.
--
-- De eis "er verandert verder niets aan de rij" is het hart van deze wijziging. Zonder die eis
-- geeft de claimtak een trainer schrijfrecht op de hele boeking van een collega — het uur, de
-- baan, de spelers, de betaalwijze.
create or replace function bewaak_betaalvelden()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mijn text[];
  vandaag timestamptz;
  alleen_lesgever boolean;
begin
  if auth.uid() is null then return new; end if;

  if new.taught_by_id is distinct from old.taught_by_id and not is_admin() then
    alleen_lesgever := (to_jsonb(new) - 'taught_by_id') = (to_jsonb(old) - 'taught_by_id');
    if not (
      alleen_lesgever
      and old.start_time > now()
      and (
        -- Overnemen: van leeg naar zichzelf, op een les die openstaat.
        (old.taught_by_id is null and new.taught_by_id = app_user_id()
           and is_coach() and les_staat_open(old))
        -- Teruggeven: van zichzelf naar leeg. Ook een les die de beheerder toewees mag terug —
        -- ze komt daarmee weer op de werklijst te staan en verdwijnt dus niet.
        or (old.taught_by_id = app_user_id() and new.taught_by_id is null)
      )
    ) then
      raise exception 'Alleen een beheerder kan invullen wie de les werkelijk gaf.';
    end if;
    return new;
  end if;

  if is_admin() or old.coach_id = app_user_id() then return new; end if;

  if (to_jsonb(new) - 'payment_method' - 'beurtenkaart_id' - 'attendance')
     is distinct from (to_jsonb(old) - 'payment_method' - 'beurtenkaart_id' - 'attendance') then
    raise exception 'Alleen de betaalwijze en je eigen aanwezigheid mag je zelf wijzigen.';
  end if;

  -- Vanaf hier ongewijzigd overgenomen uit supabase-schema.sql. De functie wordt in zijn geheel
  -- vervangen; wat je weglaat, ben je kwijt.
  if (new.payment_method is distinct from old.payment_method
      or new.beurtenkaart_id is distinct from old.beurtenkaart_id)
     and not (old.player_id = app_user_id() or is_mijn_kind(old.player_id)) then
    raise exception 'De betaalwijze zet de speler die de rekening krijgt.';
  end if;

  if new.attendance is distinct from old.attendance then
    -- "Vandaag" is een dag op de kalender hier, niet in UTC: een les van vanochtend om negen
    -- uur hoort tot vanavond van de speler te blijven, en met de UTC-dag zou dat verschuiven.
    vandaag := date_trunc('day', now() at time zone 'Europe/Brussels') at time zone 'Europe/Brussels';
    if old.start_time < vandaag then
      raise exception 'Wie er bij een les uit het verleden stond, noteert de trainer.';
    end if;
    -- Voor wie je spreekt: jezelf en je goedgekeurde kinderen. Al de rest van de lijst moet
    -- na de wijziging nog letterlijk hetzelfde zijn.
    mijn := array(
      select coalesce(app_user_id(), '')
      union
      select child_id from ouder_kind
        where parent_id = app_user_id() and status = 'approved'
    );
    if (coalesce(new.attendance, '{}'::jsonb) - mijn)
       is distinct from (coalesce(old.attendance, '{}'::jsonb) - mijn) then
      raise exception 'Je past alleen je eigen aanwezigheid aan.';
    end if;
  end if;

  return new;
end;
$$;
```

Controleer voor je dit overneemt of de bestaande functie sinds 9 september 2026 veranderd is:

```bash
sed -n '/^create or replace function bewaak_betaalvelden/,/^\$\$;/p' supabase-schema.sql
```

Staat er iets anders dan hierboven vanaf `if (new.payment_method`, neem dan wat er stáát en zet alleen het eerste blok (`taught_by_id`) erin zoals hier beschreven.

- [ ] **Stap 2: Werk `supabase-schema.sql` bij**

Drie plekken, met dezelfde inhoud als hierboven:
1. bij het `taught_by_id`-blok (rond regel 953) de `alter table ... add column ... zoekt_trainer` met zijn commentaar;
2. de functie `les_staat_open` ernaast — die moet vóór de policy staan, want de policy roept hem aan;
3. `bookings_update` (rond regel 762) en `bewaak_betaalvelden` (rond regel 974) vervangen.

**`bewaak_betaalvelden` staat twee keer in `supabase-schema.sql`** — één keer rond regel 400 en één keer rond regel 974. De laatste wint bij het opbouwen van een verse databank. Werk ze allebei bij; laat je de eerste staan, dan verschilt het bestand van zichzelf en leest de volgende lezer de verkeerde regels.

- [ ] **Stap 3: Controleer dat de twee bestanden hetzelfde zeggen**

```bash
grep -c "les_staat_open" ZOEKT-TRAINER.sql supabase-schema.sql
```

Verwacht: beide bestanden noemen `les_staat_open` (de aantallen mogen verschillen door de commentaarregels, de aanroepen niet: in beide staat hij in de policy en in de trigger).

- [ ] **Stap 4: Commit**

```bash
git add ZOEKT-TRAINER.sql supabase-schema.sql
git commit -m "feat(openstaand): de databank laat een trainer een openstaande les overnemen

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017MeqHGc981QKot47ruFebt"
```

- [ ] **Stap 5: Vraag de gebruiker de SQL te draaien**

Zeg tegen de gebruiker: draai `ZOEKT-TRAINER.sql` in de Supabase SQL-editor en herlaad daarna de app hard. Vóór dat gebeurd is, weigert de databank elke claim — het scherm werkt wel, de knop niet.

---

## Taak 8: Het scherm

**Files:**
- Create: `app/coaches/openstaand.tsx`
- Modify: `app/_layout.tsx` (de titellijst rond regel 81)

- [ ] **Stap 1: Schrijf het scherm**

```tsx
// Trainers → Lessen zonder trainer: wat er openstaat, en wat de kijker zelf overnam.
//
// Waarom dit scherm bestaat: een les die zonder trainer in de agenda blijft staan, is precies de
// fout die deze module moet voorkomen — er staan spelers voor een dichte baan. Tot nu loste
// alleen de beheerder dat op vanaf de werklijst van een ziekmelding, en bij een uitval van
// vandaag voor morgen is dat te traag.
//
// Er wordt hier niets weggefilterd. Een les die niet bij de uren van de kijker past staat er ook,
// met de reden eronder — dezelfde afspraak als `vervangersVoor` aan de beheerderskant. Een lijst
// waar iets zonder uitleg uit verdwijnt, laat de trainer twijfelen of de app het wel goed ziet,
// en een les die niemand ziet blijft zonder trainer staan.
//
// Dit scherm rekent zelf niets uit. Wat er openstaat weet `openstaandeLessen`, of het mag weet
// `claimBezwaar`, en wie wanneer kan weet `kanVervangen` — alle drie in lib/, met tests eromheen.

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { formatDay, formatTimeRange } from '../../lib/datetime';
import { groupSize, groupSizeLabel } from '../../lib/groups';
import { openstaandeLessen } from '../../lib/openstaand';
import { kanVervangen } from '../../lib/vervanger';
import { openZiekmeldingen } from '../../lib/ziekmelding';
import { isCoach } from '../../lib/rechten';
import { useT } from '../../lib/i18n';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography } from '../../constants/theme';
import type { VervangerReden } from '../../lib/vervanger';
import type { Booking } from '../../lib/types';

export default function OpenstaandScreen(): React.JSX.Element {
  const t = useT();
  const {
    currentUser, users, courts, bookings, lesGroepen, sickLeaves, settings,
    claimLes, geefLesTerug,
  } = useSimpleData();

  // Wat de laatste handeling opleverde: de reden waarom het niet mocht, of de bevestiging.
  // Blijft staan tot de volgende handeling — stil niets doen is hier de gevaarlijkste uitkomst.
  const [melding, setMelding] = useState<string | null>(null);
  // Welke les om een bevestiging vraagt omdat hij niet bij de uren van de kijker past.
  const [bevestigen, setBevestigen] = useState<string | null>(null);

  const openMeldingen = useMemo(() => openZiekmeldingen(sickLeaves), [sickLeaves]);

  // De grens staat hier en niet alleen op de regel die hiernaartoe wijst: een scherm dat zijn
  // grens erft van waar je vandaan kwam heeft er geen, want een speler kan deze link intikken
  // (TOEG-01, zie de werklijst).
  const rijen = useMemo(() => (
    currentUser === null ? [] : openstaandeLessen(
      bookings, openMeldingen, settings.vakanties ?? [], new Date(), currentUser.id,
    )
  ), [bookings, openMeldingen, settings.vakanties, currentUser]);

  const mijne = useMemo(() => (
    currentUser === null ? [] : bookings
      .filter((b) => b.taught_by_id === currentUser.id && b.status !== 'cancelled')
      .filter((b) => Date.parse(b.start_time) > Date.now())
      .sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time))
  ), [bookings, currentUser]);

  if (!isCoach(currentUser)) {
    return (
      <Screen scroll={false}>
        <Text style={styles.muted}>{t('Deze lijst is voor trainers.')}</Text>
      </Screen>
    );
  }

  const nameOf = (id: string): string => users.find((u) => u.id === id)?.name ?? t('Onbekend');
  const baanNaam = (id: string): string =>
    courts.find((c) => c.id === id)?.name ?? t('Onbekend terrein');

  /** De groep als de les eraan hangt, anders de naam van de speler. Zelfde opzoeking als de
   *  werklijst; een tweede manier om een groepsnaam af te leiden gaat ooit iets anders tonen. */
  const wieVan = (b: Booking): string => {
    const groep = b.group_id ? (lesGroepen.find((g) => g.id === b.group_id) ?? null) : null;
    return groep ? groep.name : nameOf(b.player_id);
  };

  /** Waarom de kijker dit uur niet kan, als zin. Een `Record` over alle redenen en geen `switch`
   *  met een `default`: komt er ooit een reden bij, dan is dat hier een typefout die niemand kan
   *  overslaan, in plaats van een lege regel waar de trainer de reden verwacht. */
  const redenZin: Record<VervangerReden, string> = {
    kan: '',
    eigen_les: t('Je geeft dan zelf al les.'),
    buiten_uren: t('Dit valt buiten je uren.'),
    afwijkende_periode: t('Je bent die periode afwezig.'),
    clubvakantie: t('De club is die dag dicht.'),
    zelf_ziek: t('Je bent zelf ziek gemeld.'),
  };

  const bezwaarVan = (b: Booking): VervangerReden => kanVervangen(
    currentUser,
    { start_time: b.start_time, end_time: b.end_time },
    bookings,
    settings.vakanties ?? [],
    openMeldingen,
    settings.booking_end_time,
  ).reden;

  const neem = async (b: Booking): Promise<void> => {
    setBevestigen(null);
    const bezwaar = await claimLes(b.id);
    setMelding(bezwaar ?? t('De les staat nu op jouw naam.'));
  };

  const terug = async (b: Booking): Promise<void> => {
    const bezwaar = await geefLesTerug(b.id);
    setMelding(bezwaar ?? t('De les staat weer open.'));
  };

  return (
    <Screen>
      {melding !== null && <Text style={styles.melding}>{melding}</Text>}

      <Text style={styles.section}>{t('Openstaand')}</Text>
      {rijen.length === 0 && (
        <Text style={styles.muted}>{t('Er staat op dit moment geen les zonder trainer.')}</Text>
      )}
      {rijen.map(({ les, reden }) => {
        const kan = bezwaarVan(les);
        const groot = groupSize(les);
        return (
          <Card key={les.id}>
            <Text style={styles.titel}>
              {formatDay(les.start_time)} · {formatTimeRange(les.start_time, les.end_time)}
            </Text>
            <Text style={styles.meta}>{baanNaam(les.court_id)} · {wieVan(les)}
              {groot > 1 ? ` · ${groupSizeLabel(groot)}` : ''}</Text>
            <Text style={styles.meta}>
              {reden === 'ziek'
                ? t('{naam} is ziek gemeld.', { naam: nameOf(les.coach_id) })
                : t('Vrijgegeven door {naam}.', { naam: nameOf(les.coach_id) })}
            </Text>
            {kan !== 'kan' && <Text style={styles.waarschuwing}>{redenZin[kan]}</Text>}
            {bevestigen === les.id ? (
              <View style={styles.knoppen}>
                <Button label={t('Toch nemen')} onPress={() => { void neem(les); }} />
                <Button
                  label={t('Laat maar')}
                  variant="secondary"
                  onPress={() => setBevestigen(null)}
                />
              </View>
            ) : (
              <Button
                label={t('Ik neem deze les')}
                onPress={() => {
                  // Past het uur niet, dan eerst een vraag in het scherm zelf — geen `Alert`,
                  // die blokkeert op web. Zelfde bevestigingsvak als bij de beurtenkaarten.
                  if (kan === 'kan') { void neem(les); } else { setBevestigen(les.id); }
                }}
              />
            )}
          </Card>
        );
      })}

      {mijne.length > 0 && (
        <>
          <Text style={styles.section}>{t('Door mij overgenomen')}</Text>
          {mijne.map((b) => (
            <Card key={b.id}>
              <Text style={styles.titel}>
                {formatDay(b.start_time)} · {formatTimeRange(b.start_time, b.end_time)}
              </Text>
              <Text style={styles.meta}>{baanNaam(b.court_id)} · {wieVan(b)}</Text>
              <Text style={styles.meta}>{t('Vaste trainer: {naam}', { naam: nameOf(b.coach_id) })}</Text>
              <Button
                label={t('Teruggeven')}
                variant="secondary"
                onPress={() => { void terug(b); }}
              />
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { ...typography.h2, color: tennisColors.text, marginTop: spacing.sm },
  titel: { ...typography.h3, color: tennisColors.text },
  meta: { fontSize: 13, color: tennisColors.textMuted },
  waarschuwing: { fontSize: 13, color: tennisColors.warning ?? tennisColors.textMuted },
  melding: { fontSize: 14, color: tennisColors.text },
  muted: { fontSize: 14, color: tennisColors.textMuted },
  knoppen: { flexDirection: 'row', gap: spacing.sm },
});
```

Controleer bij het schrijven twee dingen tegen de bestaande code, en pas het scherm aan wat er echt staat:
- of `tennisColors.warning` bestaat (`grep -n "warning" constants/tennis-colors.ts`); zo niet, gebruik dezelfde kleur als de werklijst voor een waarschuwing;
- de props van `Button` en `Card` (`sed -n 1,40p components/ui/Button.tsx components/ui/Card.tsx`).

- [ ] **Stap 2: Registreer de route**

In `app/_layout.tsx`, in de titellijst naast `{ name: 'coaches/drawing', title: t('Tekenveld') }`:

```ts
  { name: 'coaches/openstaand', title: t('Lessen zonder trainer') },
```

- [ ] **Stap 3: Zet de Engelse zinnen erbij**

In `lib/i18n-en.ts`, in het blok "lessen zonder trainer" van Taak 5:

```ts
  'Lessen zonder trainer': 'Lessons without a coach',
  'Deze lijst is voor trainers.': 'This list is for coaches.',
  'Openstaand': 'Open',
  'Er staat op dit moment geen les zonder trainer.':
    'There is no lesson without a coach right now.',
  '{naam} is ziek gemeld.': '{naam} has been reported sick.',
  'Vrijgegeven door {naam}.': 'Released by {naam}.',
  'Je geeft dan zelf al les.': 'You are already teaching then.',
  'Dit valt buiten je uren.': 'This falls outside your hours.',
  'Je bent die periode afwezig.': 'You are away during that period.',
  'De club is die dag dicht.': 'The club is closed that day.',
  'Je bent zelf ziek gemeld.': 'You have been reported sick yourself.',
  'Ik neem deze les': 'I will take this lesson',
  'Toch nemen': 'Take it anyway',
  'Laat maar': 'Never mind',
  'De les staat nu op jouw naam.': 'The lesson is now in your name.',
  'De les staat weer open.': 'The lesson is open again.',
  'Door mij overgenomen': 'Taken over by me',
  'Vaste trainer: {naam}': 'Regular coach: {naam}',
  'Teruggeven': 'Give back',
```

- [ ] **Stap 4: Controleer dat het typt en bouwt**

Run: `npx tsc --noEmit && npx expo export --platform web`
Verwacht: geen typefouten; de export slaagt.

- [ ] **Stap 5: Commit**

```bash
git add app/coaches/openstaand.tsx app/_layout.tsx lib/i18n-en.ts
git commit -m "feat(openstaand): het scherm waar een trainer een les overneemt

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017MeqHGc981QKot47ruFebt"
```

---

## Taak 9: De regel in de trainers-tab

**Files:**
- Modify: `app/coaches/index.tsx`

- [ ] **Stap 1: Voeg de regel toe**

Bij de imports:

```tsx
import { CalendarSearch } from 'lucide-react-native';
import { openstaandeLessen } from '../../lib/openstaand';
import { openZiekmeldingen } from '../../lib/ziekmelding';
import { isCoach } from '../../lib/rechten';
```

Zet `CalendarSearch` bij de bestaande `lucide-react-native`-import in plaats van een tweede regel. Haal `currentUser, sickLeaves, settings` bij `useSimpleData()` erbij.

Boven de `return`, naast `coaches`:

```tsx
  // Alleen voor wie zelf lesgeeft. Een ouder die leest dat de les van zijn kind geen trainer
  // heeft, belt de club over iets wat binnen het uur opgelost is.
  const mijnOpenstaand = isCoach(currentUser)
    ? openstaandeLessen(
      bookings, openZiekmeldingen(sickLeaves), settings.vakanties ?? [], new Date(), currentUser.id,
    ).length
    : 0;
```

En in de sectie *Gereedschap*, als eerste regel boven `Lesmateriaal`:

```tsx
      {isCoach(currentUser) && (
        <Card
          onPress={() => router.push('/coaches/openstaand')}
          accessibilityLabel={t('Lessen zonder trainer')}
          style={styles.row}
        >
          <View style={styles.rowContent}>
            <View style={styles.icon}><CalendarSearch size={20} color={tennisColors.primary} /></View>
            <Text style={styles.rowLabel}>{t('Lessen zonder trainer')}</Text>
            {/* Staat er niets open, dan staat er "geen" en verdwijnt de regel niet: een regel
                die weggaat laat je twijfelen of je hem wel goed onthouden had. */}
            <Text style={styles.meta}>
              {mijnOpenstaand === 0 ? t('geen') : String(mijnOpenstaand)}
            </Text>
            <ChevronRight size={20} color={tennisColors.textMuted} />
          </View>
        </Card>
      )}
```

- [ ] **Stap 2: Zet de Engelse zin erbij**

In `lib/i18n-en.ts`, in hetzelfde blok:

```ts
  'geen': 'none',
```

Staat `'geen'` er al in, laat hem dan staan zoals hij is — de sleutel is de Nederlandse zin, en twee keer dezelfde sleutel is een fout.

- [ ] **Stap 3: Controleer**

Run: `npx tsc --noEmit && npx jest`
Verwacht: geen typefouten, alle tests slagen.

- [ ] **Stap 4: Commit**

```bash
git add app/coaches/index.tsx lib/i18n-en.ts
git commit -m "feat(openstaand): de regel met het aantal in de trainers-tab

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017MeqHGc981QKot47ruFebt"
```

---

## Taak 10: De schakelaar op het lesdetail

**Files:**
- Modify: `components/BookingDetailSheet.tsx`

- [ ] **Stap 1: Lees hoe het blad zijn knoppen zet**

```bash
grep -n "canManage" components/BookingDetailSheet.tsx | head -20
```

Zoek een bestaande knop of schakelaar in het blad en volg díé vorm — kop, knop, afstand. Een nieuwe vorm bedenken maakt het blad rommelig.

- [ ] **Stap 2: Voeg de schakelaar toe**

Onderin het blad, bij de andere handelingen van de trainer:

```tsx
      {/* "Deze les zoekt een trainer": het merkteken buiten ziekte om. Alleen de trainer van de
          les en de beheerder — de databank bewaakt dezelfde grens, dit voorkomt een knop die
          daarna geweigerd wordt. Staat er al een lesgever op, dan zoekt deze les niemand meer. */}
      {canManage && !selected.taught_by_id && (
        <Button
          label={selected.zoekt_trainer === true
            ? t('Toch zelf geven')
            : t('Deze les zoekt een trainer')}
          variant="secondary"
          onPress={() => {
            void updateBooking(selected.id, { zoekt_trainer: selected.zoekt_trainer !== true });
          }}
        />
      )}
```

`canManage` is de prop die het blad al heeft ("alleen een trainer wijzigt of annuleert; een speler mag wel kijken"). Controleer dat die op de aanroepplekken waar is voor de trainer van de les én voor de beheerder; is dat niet zo, gebruik dan `isAdmin(currentUser) || selected.coach_id === currentUser?.id` en zet de reden in het commentaar.

- [ ] **Stap 3: Zet de Engelse zinnen erbij**

```ts
  'Deze les zoekt een trainer': 'This lesson needs a coach',
  'Toch zelf geven': 'Teach it myself after all',
```

- [ ] **Stap 4: Controleer**

Run: `npx tsc --noEmit && npx jest`
Verwacht: geen typefouten, alle tests slagen.

- [ ] **Stap 5: Commit**

```bash
git add components/BookingDetailSheet.tsx lib/i18n-en.ts
git commit -m "feat(openstaand): een les vrijgeven vanaf het lesdetail

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017MeqHGc981QKot47ruFebt"
```

---

## Taak 11: Oplevering

**Files:**
- Modify: `OPENSTAAND.md`

- [ ] **Stap 1: Draai alles**

```bash
npx tsc --noEmit && npx jest && npx expo export --platform web
```

Verwacht: geen typefouten, alle tests slagen (676 bestaande + 24 nieuwe), de export slaagt. Faalt er iets, los dat op vóór de volgende stap — niet melden dat het af is terwijl het rood staat.

- [ ] **Stap 2: Schrijf op wat er bij is gekomen**

Zet in `OPENSTAAND.md` onder "Wat er nog moet gebeuren" een blok in dezelfde vorm als de bestaande punten: wat er werkt (de lijst, het claimen, het teruggeven, het merkteken), welk bestand de vraag beantwoordt (`lib/openstaand.ts`), en wat er met de hand nog moet: `ZOEKT-TRAINER.sql` draaien in Supabase, daarna hard herladen, en dan met de hand doorlopen — een les vrijgeven, hem als andere trainer overnemen, en hem teruggeven.

- [ ] **Stap 3: Commit en push**

```bash
git add OPENSTAAND.md
git commit -m "docs: lessen zonder trainer overnemen staat erin

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017MeqHGc981QKot47ruFebt"
git push -u origin feat/lessen-zonder-trainer
```

- [ ] **Stap 4: Zeg wat de gebruiker zelf moet doen**

Twee dingen, en niet één ervan overslaan:
1. `ZOEKT-TRAINER.sql` draaien in de Supabase SQL-editor, daarna de app hard herladen — de app leest de databank bij het opstarten. Vóór die SQL werkt het claimen niet.
2. Met de hand doorlopen op de echte site: een les vrijgeven op het lesdetail, met een tweede trainersaccount de lijst openen, de les nemen, en hem daarna teruggeven. Let er bij het testen op dat de dev-server met de echte databank van de club praat.
