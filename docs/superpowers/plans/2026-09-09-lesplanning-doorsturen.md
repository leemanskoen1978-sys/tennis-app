# Lesmateriaal doorsturen per periode — implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** De beheerder stuurt lesmateriaal door voor een periode, aan een trainer en/of een lesgroep, en de trainer ziet bij zijn les welk materiaal er die periode aan de orde is.

**Architecture:** Eén nieuwe tabel (`les_planning`) met rijen die náást `Lesson` leven, en één nieuw rekenbestand (`lib/lesplanning.ts`) dat als enige de vraag "welk materiaal geldt voor deze les" beantwoordt. Er wordt niets op de boeking geschreven: het antwoord wordt afgeleid uit trainer, groep en datum, net als `zoektVervanger` en `staatOpen`. Twee schrijfwegen in de provider, verder alleen leeswerk.

**Tech Stack:** React Native + expo-router (web), TypeScript, Supabase (Postgres met RLS), jest (`jest-expo`). Alle tests staan in `lib/`.

**Spec:** `docs/superpowers/specs/2026-09-09-lesplanning-doorsturen-design.md`

---

## Bestandsoverzicht

| Bestand | Verantwoordelijkheid |
| --- | --- |
| `lib/types.ts` (wijzigen) | Het type `Lesplanning`. |
| `lib/lesplanning.ts` (nieuw) | Puur rekenwerk: deugt de invoer, geldt deze planning voor deze les, welk materiaal geldt er. De enige plek die die drie vragen beantwoordt. |
| `lib/lesplanning.test.ts` (nieuw) | De tests daarvan. |
| `lib/sync.ts` (wijzigen) | `lesPlanning` als verzameling die als rijen in een tabel leeft. |
| `lib/sync.test.ts` (wijzigen) | Dat een nieuwe, gewijzigde en verwijderde planningrij in het verschil terechtkomt. |
| `providers/mockStore.ts` (wijzigen) | `lesPlanning` in de opslagvorm en in de lege opslag. |
| `providers/supabaseStore.ts` (wijzigen) | De tabelnaam en het ophalen, met `selectAllOptioneel` zodat een club die de SQL nog niet draaide blijft laden. |
| `providers/SimpleDataProvider.tsx` (wijzigen) | `lesPlanning` in de context, plus `voegLesplanningToe` en `verwijderLesplanning`. |
| `app/admin/lesplanning/index.tsx` (nieuw) | Het beheerscherm: de lijst, het formulier, weghalen. |
| `app/admin/tennisschool.tsx` (wijzigen) | De tegel ernaartoe. |
| `app/_layout.tsx` (wijzigen) | De route en zijn titel. |
| `components/lesdag/Lesdag.tsx` (wijzigen) | "Deze periode: …" onder het lesuur. |
| `components/BookingDetailSheet.tsx` (wijzigen) | Idem op het lesdetail. |
| `lib/i18n-en.ts` (wijzigen) | De Engelse kant van elke nieuwe zin. |
| `LESPLANNING.sql` (nieuw) | De tabel, de check en de policies. |
| `supabase-schema.sql` (wijzigen) | Dezelfde inhoud, voor een verse installatie. |
| `OPENSTAAND.md` (wijzigen) | Wat er bij is gekomen en wat de gebruiker nog met de hand moet doen. |

---

## Taak 1: Werkplek

**Files:** geen

- [ ] **Stap 1: Controleer de werkkopie**

```bash
cd "/Users/leko/Downloads/tennis app"
git fetch -q && git status -sb
```

Verwacht: `## main...origin/main` en geen gewijzigde bestanden. Staat er iets anders, stop dan en vraag het aan de gebruiker — hij werkt soms in een tweede venster in dezelfde map.

- [ ] **Stap 2: Maak een worktree, los van die werkkopie**

```bash
git worktree add ~/.config/superpowers/worktrees/tennis-app/lesplanning -b feat/lesplanning main
ln -s "/Users/leko/Downloads/tennis app/node_modules" ~/.config/superpowers/worktrees/tennis-app/lesplanning/node_modules
cd ~/.config/superpowers/worktrees/tennis-app/lesplanning && npx jest 2>&1 | tail -4
```

Verwacht: alle tests slagen (1828 op 9 september 2026). Falen ze, meld dat en vraag of je verder mag — anders is straks niet te zien wat jij gebroken hebt.

**Werk vanaf hier in die worktree.** De shell springt na elk commando terug naar de projectmap, dus begin elk commando met `cd ~/.config/superpowers/worktrees/tennis-app/lesplanning &&`.

---

## Taak 2: Het type

**Files:**
- Modify: `lib/types.ts` (achteraan, naast `SickLeave`)

- [ ] **Stap 1: Zoek waar `SickLeave` staat**

```bash
grep -n "export interface SickLeave" lib/types.ts
```

- [ ] **Stap 2: Zet het type eronder**

```ts
/**
 * Eén doorsturing: dit lesmateriaal geldt deze periode voor deze trainer en/of deze groep.
 *
 * Leeft NAAST `Lesson` en niet erin: `Lesson.student_id` blijft persoonlijk materiaal voor één
 * speler. Een tweede betekenis op datzelfde veld hangen is dezelfde fout als een tweede antwoord
 * naast `taught_by_id` — zie het kopcommentaar van lib/lesgever.
 *
 * `van` en `tot` zijn dagen als `jjjj-mm-dd`, beide meegerekend, net als bij `SickLeave` en
 * `Vakantie`. Zo houdt een periode over de zomertijdwissel dezelfde dagen.
 *
 * Minstens één van `coach_id` en `group_id` staat er. Beide leeg zou stilzwijgend "de hele club"
 * betekenen, en dat is een beslissing die niemand met een lege invoer bedoeld heeft; `les_planning`
 * weigert zo'n rij ook in de databank. Welk materiaal er voor een les geldt, beslist
 * `materiaalVoor` in lib/lesplanning — de enige plek die die vraag beantwoordt.
 */
export interface Lesplanning {
  id: string;
  lesson_id: string;
  /** Alles wat deze trainer die periode geeft. Leeg = het gaat niet om een trainer. */
  coach_id?: string;
  /** Deze groep, bij wie hem ook geeft. Leeg = het gaat niet om een groep. */
  group_id?: string;
  van: string; // jjjj-mm-dd
  tot: string; // jjjj-mm-dd
  created_at: string; // ISO
}
```

- [ ] **Stap 3: Controleer**

Run: `cd ~/.config/superpowers/worktrees/tennis-app/lesplanning && npx tsc --noEmit`
Verwacht: geen uitvoer.

- [ ] **Stap 4: Commit**

```bash
git add lib/types.ts
git commit -m "feat(lesplanning): het type van een doorsturing

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Taak 3: `lesplanningFout`

**Files:**
- Create: `lib/lesplanning.ts`
- Test: `lib/lesplanning.test.ts`

- [ ] **Stap 1: Schrijf de falende test**

Maak `lib/lesplanning.test.ts`:

```ts
import { lesplanningFout } from './lesplanning';

describe('lesplanningFout', () => {
  it('klaagt als er geen materiaal gekozen is', () => {
    expect(lesplanningFout('', 'c-1', '', '2027-03-01', '2027-03-14')).not.toBeNull();
    expect(lesplanningFout('   ', 'c-1', '', '2027-03-01', '2027-03-14')).not.toBeNull();
  });

  it('klaagt als er geen trainer én geen groep gekozen is', () => {
    // Beide leeg zou "de hele club" betekenen, en dat bedoelt niemand met een leeg formulier.
    expect(lesplanningFout('l-1', '', '', '2027-03-01', '2027-03-14')).not.toBeNull();
  });

  it('klaagt over een half getypte of onbestaande datum in plaats van te crashen', () => {
    // Dit wordt gelezen terwijl iemand nog aan het typen is: "01/03" is nog niet af.
    expect(lesplanningFout('l-1', 'c-1', '', '01/03', '2027-03-14')).not.toBeNull();
    expect(lesplanningFout('l-1', 'c-1', '', '2027-03-01', '')).not.toBeNull();
    expect(lesplanningFout('l-1', 'c-1', '', '2027-02-30', '2027-03-14')).not.toBeNull();
  });

  it('weigert een periode die eindigt voor ze begint', () => {
    // Stil omdraaien kostte de eigenaar op 6 september 2026 een lege werklijst zonder uitleg;
    // `ziekmeldingFout` en `lesGroepFout` weigeren precies dezelfde vergissing.
    expect(lesplanningFout('l-1', 'c-1', '', '2027-03-14', '2027-03-01')).not.toBeNull();
  });

  it('geeft null voor een trainer, een groep, of beide', () => {
    expect(lesplanningFout('l-1', 'c-1', '', '2027-03-01', '2027-03-14')).toBeNull();
    expect(lesplanningFout('l-1', '', 'g-1', '2027-03-01', '2027-03-14')).toBeNull();
    expect(lesplanningFout('l-1', 'c-1', 'g-1', '2027-03-01', '2027-03-14')).toBeNull();
  });

  it('geeft null voor één enkele dag', () => {
    expect(lesplanningFout('l-1', 'c-1', '', '2027-03-01', '2027-03-01')).toBeNull();
  });
});
```

- [ ] **Stap 2: Draai de test en zie hem falen**

Run: `cd ~/.config/superpowers/worktrees/tennis-app/lesplanning && npx jest lib/lesplanning.test.ts`
Verwacht: FAIL — `Cannot find module './lesplanning'`.

- [ ] **Stap 3: Schrijf `lib/lesplanning.ts`**

```ts
// Welk lesmateriaal geldt er voor deze les?
//
// De tennisschool werkt met een lessenboekje: in een bepaalde periode doet een groep of een
// trainer een bepaalde training. Dit bestand beantwoordt als ENIGE de vraag welk materiaal er
// voor een gegeven les geldt. Wie die vraag ergens anders nog eens optelt, laat op de plek die
// hij vergat mee te wijzigen een instructie wegvallen — en een instructie die de app niet toont,
// is niet gegeven.
//
// Puur rekenwerk: geen store, geen scherm, geen schrijfweg. Wie een doorsturing aanmaakt of
// weghaalt, doet dat een laag hoger met `voegLesplanningToe` en `verwijderLesplanning`.
//
// Er wordt hier nooit iets aan een boeking geschreven. "Welk materiaal hoort bij deze les" is een
// afgeleid feit, net als `zoektVervanger` in lib/ziekmelding en `staatOpen` in lib/openstaand: een
// verwijzing per boeking zou honderden rijen per doorsturing kosten, opruimwerk bij elke
// periodewijziging, en geen materiaal op een les die later in die periode nog bijgeboekt wordt.

import { t } from './i18n';
import { dagSleutel, parseDag } from './vakanties';
import type { Booking, Lesplanning, Lesson } from './types';

/**
 * Waarom deze doorsturing niet klopt, of `null` als ze deugt. Wordt gelezen terwijl iemand nog
 * aan het typen is, dus een half ingevulde datum is geen fout maar "nog niet af" — dezelfde
 * afspraak als `ziekmeldingFout` en `vakantieFout`.
 *
 * De volgorde van de controles ligt vast: eerst wát er doorgestuurd wordt, dan aan wie, dan of
 * de datums leesbaar zijn, en pas daarna of ze goed om staan. Wie tijdens het typen te horen
 * krijgt dat zijn periode verkeerd om staat, leest een verwijt over een veld dat hij nog invult.
 *
 * Een omgekeerde periode wordt geweigerd en niet stil omgedraaid. Dat is dezelfde beslissing als
 * op 6 september 2026 bij de ziekmeldingen: de eigenaar vulde september tot augustus in, dat werd
 * gelezen als augustus tot september, en hij kreeg een leeg resultaat zonder één woord uitleg.
 */
export function lesplanningFout(
  lessonId: string,
  coachId: string,
  groupId: string,
  van: string,
  tot: string,
): string | null {
  if (lessonId.trim().length === 0) return t('Kies welk lesmateriaal je doorstuurt.');
  if (coachId.trim().length === 0 && groupId.trim().length === 0) {
    return t('Kies een trainer, een groep, of beide.');
  }
  if (parseDag(van) === null || parseDag(tot) === null) {
    return t('Vul beide dagen in als dd/mm/jjjj.');
  }
  // Eén dag mag: dan is `tot` gelijk aan `van` en eindigt er niets te vroeg.
  if (tot < van) return t('De periode eindigt voor ze begint.');
  return null;
}
```

- [ ] **Stap 4: Draai de test en zie hem slagen**

Run: `cd ~/.config/superpowers/worktrees/tennis-app/lesplanning && npx jest lib/lesplanning.test.ts`
Verwacht: PASS, 6 tests.

- [ ] **Stap 5: Zet de Engelse zinnen erbij**

In `lib/i18n-en.ts`, onderaan in het object, met een kop erboven zoals de andere blokken. Controleer eerst of een sleutel al bestaat — twee keer dezelfde sleutel is een typefout die `tsc` afkeurt:

```bash
grep -n "'Vul beide dagen in als dd/mm/jjjj.'\|'De periode eindigt voor ze begint.'" lib/i18n-en.ts
```

`'Vul beide dagen in als dd/mm/jjjj.'` bestaat al (van de ziekmeldingen) — laat die staan zoals hij is en voeg alleen toe wat er nog niet is:

```ts
  // --- lesmateriaal doorsturen -------------------------------------------
  'Kies welk lesmateriaal je doorstuurt.': 'Choose which lesson material you are sending on.',
  'Kies een trainer, een groep, of beide.': 'Choose a coach, a group, or both.',
  'De periode eindigt voor ze begint.': 'The period ends before it starts.',
```

- [ ] **Stap 6: Commit**

```bash
git add lib/lesplanning.ts lib/lesplanning.test.ts lib/i18n-en.ts
git commit -m "feat(lesplanning): de invoercontrole van een doorsturing

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Taak 4: `geldtVoor`

**Files:**
- Modify: `lib/lesplanning.ts`
- Test: `lib/lesplanning.test.ts`

- [ ] **Stap 1: Schrijf de falende test**

Zet `geldtVoor` bij de import bovenaan het testbestand en voeg onderaan toe:

```ts
import type { Booking, Lesplanning } from './types';

const basisPlanning: Lesplanning = {
  id: 'p-1', lesson_id: 'l-1', coach_id: 'c-1',
  van: '2027-03-01', tot: '2027-03-14',
  created_at: '2027-02-20T09:00:00.000Z',
};

/** Een doorsturing met een afwijking erop, zoals `ziek` in lib/ziekmelding.test. */
const planning = (patch: Partial<Lesplanning> = {}): Lesplanning => ({ ...basisPlanning, ...patch });

const basisLes: Booking = {
  id: 'b-1', player_id: 's-1', coach_id: 'c-1', court_id: 'baan-1',
  start_time: '2027-03-03T17:00:00.000Z', end_time: '2027-03-03T18:00:00.000Z',
  status: 'confirmed', payment_method: 'open',
};

const les = (patch: Partial<Booking> = {}): Booking => ({ ...basisLes, ...patch });

describe('geldtVoor', () => {
  it('geldt binnen de periode en op beide grensdagen', () => {
    expect(geldtVoor(planning(), les())).toBe(true);
    expect(geldtVoor(planning(), les({
      start_time: '2027-03-01T17:00:00.000Z', end_time: '2027-03-01T18:00:00.000Z',
    }))).toBe(true);
    expect(geldtVoor(planning(), les({
      start_time: '2027-03-14T17:00:00.000Z', end_time: '2027-03-14T18:00:00.000Z',
    }))).toBe(true);
  });

  it('geldt niet ervoor en niet erna', () => {
    expect(geldtVoor(planning(), les({
      start_time: '2027-02-28T17:00:00.000Z', end_time: '2027-02-28T18:00:00.000Z',
    }))).toBe(false);
    expect(geldtVoor(planning(), les({
      start_time: '2027-03-15T17:00:00.000Z', end_time: '2027-03-15T18:00:00.000Z',
    }))).toBe(false);
  });

  it('geldt niet voor de les van een andere trainer', () => {
    expect(geldtVoor(planning(), les({ coach_id: 'c-2' }))).toBe(false);
  });

  it('kijkt alleen naar de groep als er alleen een groep staat', () => {
    const perGroep = planning({ coach_id: undefined, group_id: 'g-1' });
    expect(geldtVoor(perGroep, les({ coach_id: 'c-9', group_id: 'g-1' }))).toBe(true);
    expect(geldtVoor(perGroep, les({ coach_id: 'c-1', group_id: 'g-2' }))).toBe(false);
    expect(geldtVoor(perGroep, les({ coach_id: 'c-1' }))).toBe(false);
  });

  it('eist bij beide dat ze beide kloppen', () => {
    const beide = planning({ group_id: 'g-1' });
    expect(geldtVoor(beide, les({ group_id: 'g-1' }))).toBe(true);
    expect(geldtVoor(beide, les({ group_id: 'g-2' }))).toBe(false);
    expect(geldtVoor(beide, les({ coach_id: 'c-2', group_id: 'g-1' }))).toBe(false);
  });

  it('blijft gelden voor een les die een vervanger overneemt', () => {
    // `taught_by_id` doet hier met opzet niet mee: het blijft de les van die trainer en van die
    // groep, dus hoort er hetzelfde materiaal bij. Zou dit `lesgeverId` vergelijken, dan
    // verdwijnt de instructie precies wanneer er iemand inspringt.
    expect(geldtVoor(planning(), les({ taught_by_id: 'c-9' }))).toBe(true);
  });

  it('leest de lokale dag en niet de UTC-datum', () => {
    // Een avondles op de laatste dag: in UTC schuift 23:00 lokaal naar de volgende dag, en dan
    // zou deze les stil buiten de periode vallen.
    const avond = les({
      start_time: '2027-03-14T22:30:00.000Z', end_time: '2027-03-14T23:30:00.000Z',
    });
    expect(geldtVoor(planning(), avond)).toBe(true);
  });

  it('geldt niet bij een onleesbare begintijd in plaats van te crashen', () => {
    expect(geldtVoor(planning(), les({ start_time: 'geen datum' }))).toBe(false);
  });
});
```

- [ ] **Stap 2: Draai de test en zie hem falen**

Run: `cd ~/.config/superpowers/worktrees/tennis-app/lesplanning && npx jest lib/lesplanning.test.ts`
Verwacht: FAIL — `geldtVoor is not a function`.

- [ ] **Stap 3: Voeg de functie toe aan `lib/lesplanning.ts`**

```ts
/** De velden die deze vragen van een les nodig hebben; meer weet dit bestand er niet van. */
export type PlanningBoeking = Pick<Booking, 'coach_id' | 'start_time'> & Pick<Partial<Booking>, 'group_id'>;

/**
 * Geldt deze doorsturing voor deze les? De dag valt binnen de periode, én de trainer klopt als
 * er een trainer staat, én de groep klopt als er een groep staat.
 *
 * DE TRAINER WORDT VERGELEKEN MET `coach_id` EN MET OPZET NIET MET `lesgeverId`. Neemt een
 * collega een les over van een zieke trainer, dan blijft het de les van die trainer en van die
 * groep, dus hoort er hetzelfde materiaal bij. De vervanger ziet het gewoon: het materiaal hangt
 * aan de les die hij geeft, niet aan zijn naam. Zou hier `lesgeverId` staan, dan verdwijnt de
 * instructie op het moment dat er iemand inspringt — precies wanneer een trainer haar het
 * hardst nodig heeft.
 *
 * De dag komt uit `dagSleutel` en nooit uit de ISO-tekst: die is in UTC gerenderd, dus een
 * avondles zou een dag opschuiven en op de verkeerde dag binnen of buiten de periode vallen.
 * Een onleesbare begintijd geldt als "niet in de periode": bij twijfel geen instructie in plaats
 * van een scherm dat struikelt op een datum die niet bestaat.
 */
export function geldtVoor(planning: Lesplanning, les: PlanningBoeking): boolean {
  const begin = new Date(les.start_time);
  if (Number.isNaN(begin.getTime())) return false;
  const dag = dagSleutel(begin);
  if (dag < planning.van || dag > planning.tot) return false;
  if (planning.coach_id && planning.coach_id !== les.coach_id) return false;
  if (planning.group_id && planning.group_id !== les.group_id) return false;
  return true;
}
```

- [ ] **Stap 4: Draai de test en zie hem slagen**

Run: `cd ~/.config/superpowers/worktrees/tennis-app/lesplanning && npx jest lib/lesplanning.test.ts`
Verwacht: PASS, 14 tests.

- [ ] **Stap 5: Commit**

```bash
git add lib/lesplanning.ts lib/lesplanning.test.ts
git commit -m "feat(lesplanning): wanneer een doorsturing voor een les geldt

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Taak 5: `materiaalVoor`

**Files:**
- Modify: `lib/lesplanning.ts`
- Test: `lib/lesplanning.test.ts`

- [ ] **Stap 1: Schrijf de falende test**

Zet `materiaalVoor` bij de import, zet `Lesson` bij de type-import, en voeg onderaan toe:

```ts
describe('materiaalVoor', () => {
  const training = (id: string, title: string): Lesson => ({
    id, title, uploaded_by: 'c-1',
  });

  const materiaal: Lesson[] = [
    training('l-1', 'Training 4'),
    training('l-2', 'Training 5'),
    training('l-3', 'Training 6'),
  ];

  it('geeft een lege lijst als er niets geldt', () => {
    expect(materiaalVoor(les(), [], materiaal)).toEqual([]);
    expect(materiaalVoor(les({ coach_id: 'c-9' }), [planning()], materiaal)).toEqual([]);
  });

  it('geeft het materiaal van de enige treffer', () => {
    expect(materiaalVoor(les(), [planning()], materiaal).map((l) => l.title))
      .toEqual(['Training 4']);
  });

  it('laat niets weg als er twee dingen gelden, bijzonderste eerst', () => {
    // De beheerder heeft ze beide ingevuld; een instructie die de app stil verbergt is een
    // instructie die niet gegeven is. Zelfde afspraak als `vervangersVoor` in lib/vervanger.
    const perTrainer = planning({ id: 'p-trainer', lesson_id: 'l-1' });
    const perGroep = planning({ id: 'p-groep', lesson_id: 'l-2', coach_id: undefined, group_id: 'g-1' });
    const perBeide = planning({ id: 'p-beide', lesson_id: 'l-3', group_id: 'g-1' });
    const uit = materiaalVoor(les({ group_id: 'g-1' }), [perTrainer, perGroep, perBeide], materiaal);
    expect(uit.map((l) => l.title)).toEqual(['Training 6', 'Training 5', 'Training 4']);
  });

  it('laat een planning weg waarvan het materiaal niet meer bestaat', () => {
    // De databank ruimt dit op met `on delete cascade`; dit is het vangnet voor de opslag in de
    // app, die tussen twee ophaalronden even uit de pas kan lopen.
    expect(materiaalVoor(les(), [planning({ lesson_id: 'l-weg' })], materiaal)).toEqual([]);
  });
});
```

- [ ] **Stap 2: Draai de test en zie hem falen**

Run: `cd ~/.config/superpowers/worktrees/tennis-app/lesplanning && npx jest lib/lesplanning.test.ts`
Verwacht: FAIL — `materiaalVoor is not a function`.

- [ ] **Stap 3: Voeg de functie toe aan `lib/lesplanning.ts`**

```ts
/**
 * Welk lesmateriaal geldt er voor deze les — van bijzonder naar algemeen: eerst wat voor deze
 * groep bij deze trainer doorgestuurd is, dan wat voor de groep geldt, dan wat voor de trainer
 * geldt.
 *
 * ER WORDT NIETS WEGGELATEN ALS ER TWEE DINGEN GELDEN. De beheerder heeft ze beide ingevuld, en
 * een instructie die de app stil verbergt is een instructie die niet gegeven is. Dezelfde
 * afspraak als `vervangersVoor` in lib/vervanger, dat ook nooit iemand stil wegfiltert: het
 * scherm mag rangschikken, niet verbergen.
 *
 * Een planning waarvan het materiaal niet meer in de lijst staat valt weg. In de databank kan
 * dat niet blijven staan (`on delete cascade`), maar de opslag in de app kan tussen twee
 * ophaalronden even uit de pas lopen, en dan is een lege regel op het scherm erger dan geen
 * regel.
 */
export function materiaalVoor(
  les: PlanningBoeking,
  planningen: Lesplanning[],
  lessons: Lesson[],
): Lesson[] {
  const rang = (p: Lesplanning): number => {
    if (p.coach_id && p.group_id) return 0;
    if (p.group_id) return 1;
    return 2;
  };
  return planningen
    .filter((p) => geldtVoor(p, les))
    // `filter` gaf al een nieuwe lijst, dus deze sortering raakt de invoer niet aan.
    .sort((a, b) => rang(a) - rang(b))
    .map((p) => lessons.find((l) => l.id === p.lesson_id))
    .filter((l): l is Lesson => l !== undefined);
}
```

- [ ] **Stap 4: Draai de test en zie hem slagen**

Run: `cd ~/.config/superpowers/worktrees/tennis-app/lesplanning && npx jest lib/lesplanning.test.ts`
Verwacht: PASS, 18 tests.

- [ ] **Stap 5: Commit**

```bash
git add lib/lesplanning.ts lib/lesplanning.test.ts
git commit -m "feat(lesplanning): welk materiaal er voor een les geldt

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Taak 6: De opslag kent de nieuwe verzameling

**Files:**
- Modify: `lib/sync.ts` (`SyncTable` rond regel 22, `SyncableStore` rond regel 65, de lege `before` rond regel 122, de `tables`-lijst rond regel 141)
- Modify: `lib/sync.test.ts`
- Modify: `providers/mockStore.ts` (rond regel 32, 53 en 83)
- Modify: `providers/supabaseStore.ts` (de tabelnamen rond regel 43, en `loadFromSupabase` rond regel 175)

- [ ] **Stap 1: Schrijf de falende test**

In `lib/sync.test.ts`: zet `Lesplanning` bij de type-import, `lesPlanning: []` in de `store`-helper (naast `sickLeaves: []`), en voeg onderaan toe:

```ts
const gestuurd = (id: string, extra: Partial<Lesplanning> = {}): Lesplanning => ({
  id, lesson_id: 'l-1', coach_id: 'u-koen',
  van: '2027-03-01', tot: '2027-03-14',
  created_at: '2027-02-20T09:00:00.000Z',
  ...extra,
});

describe('diffStores — lesPlanning', () => {
  it('ziet een nieuwe doorsturing', () => {
    const verschil = diffStores(store(), store({ lesPlanning: [gestuurd('p1')] }));
    const tabel = verschil.tables.find((tb) => tb.table === 'lesPlanning');
    expect(tabel?.upsert.map((r) => r.id)).toEqual(['p1']);
  });

  it('ziet een verwijderde doorsturing', () => {
    const verschil = diffStores(store({ lesPlanning: [gestuurd('p1')] }), store({ lesPlanning: [] }));
    const tabel = verschil.tables.find((tb) => tb.table === 'lesPlanning');
    expect(tabel?.remove).toEqual(['p1']);
  });

  it('ziet een gewijzigde periode', () => {
    const verschil = diffStores(
      store({ lesPlanning: [gestuurd('p1')] }),
      store({ lesPlanning: [gestuurd('p1', { tot: '2027-03-21' })] }),
    );
    const tabel = verschil.tables.find((tb) => tb.table === 'lesPlanning');
    expect(tabel?.upsert.map((r) => r.id)).toEqual(['p1']);
  });

  it('meldt niets als er niets veranderde', () => {
    const zelfde = diffStores(
      store({ lesPlanning: [gestuurd('p1')] }),
      store({ lesPlanning: [gestuurd('p1')] }),
    );
    expect(zelfde.tables.find((tb) => tb.table === 'lesPlanning')).toBeUndefined();
  });

  it('geeft de allereerste doorsturing door, ook zonder vorige toestand', () => {
    // Zonder `lesPlanning: []` in de lege `before` leest hij als undefined in plaats van als
    // een lege lijst, en dan valt het verschil weg dat er nu wél een doorsturing is — dezelfde
    // val als bij `lesGroepen` en `sickLeaves`.
    const verschil = diffStores(null, store({ lesPlanning: [gestuurd('p1')] }));
    const tabel = verschil.tables.find((tb) => tb.table === 'lesPlanning');
    expect(tabel?.upsert.map((r) => r.id)).toEqual(['p1']);
  });
});
```

- [ ] **Stap 2: Draai de test en zie hem falen**

Run: `cd ~/.config/superpowers/worktrees/tennis-app/lesplanning && npx jest lib/sync.test.ts`
Verwacht: FAIL — `lesPlanning` bestaat niet op `SyncableStore` (een typefout van `tsc` in jest, of een test die `undefined` vindt).

- [ ] **Stap 3: Breid `lib/sync.ts` uit**

Vier plekken:

```ts
export type SyncTable =
  | 'users' | 'courts' | 'bookings' | 'lessons' | 'progress' | 'goals' | 'beurtenkaarten'
  | 'memos' | 'relaties' | 'lesGroepen' | 'sickLeaves' | 'lesPlanning';
```

In `SyncableStore`, onder `sickLeaves`:

```ts
  /** Het doorgestuurde lesmateriaal per periode. Zie lib/types: Lesplanning. */
  lesPlanning: Lesplanning[];
```

In de lege `before` (bij `lesGroepen: []` en `sickLeaves: []`):

```ts
    lesPlanning: [],
```

En in de `tables`-lijst, **na** `lessons` en `lesGroepen`: een planningrij verwijst naar
`lessons(id)` en naar `lesson_groups(id)`, dus die twee moeten eerst geschreven zijn — anders
weigert Postgres de rij. Zet hem achteraan, na `sickLeaves`:

```ts
    changeFor('lesPlanning', before.lesPlanning, next.lesPlanning),
```

Zet `Lesplanning` bij de type-import bovenaan `lib/sync.ts`.

- [ ] **Stap 4: Breid `providers/mockStore.ts` uit**

Drie plekken, naast `sickLeaves`:

```ts
  lesPlanning: Lesplanning[];
```
```ts
    lesPlanning: [],
```
```ts
    lesPlanning: data.lesPlanning ?? [],
```

Zet `Lesplanning` bij de type-import.

- [ ] **Stap 5: Breid `providers/supabaseStore.ts` uit**

De tabelnaam, naast `sickLeaves: 'sick_leaves'`:

```ts
  lesPlanning: 'les_planning',
```

En in `loadFromSupabase`: `lesPlanning` erbij in de bestemming van de `await Promise.all([...])`, en als laatste in de lijst:

```ts
    selectAllOptioneel<Lesplanning>('les_planning'),
```

`selectAllOptioneel` en niet `selectAll`, om precies de reden die er in het commentaar al staat: de beheerder draait deze migratie zelf, en tot hij dat gedaan heeft hoort de app te laden met nog geen enkele doorsturing in plaats van te weigeren op te starten. Zet `lesPlanning` ook in het object dat de functie teruggeeft, naast `sickLeaves`, en `Lesplanning` bij de type-import.

- [ ] **Stap 6: Draai de tests en de typecontrole**

Run: `cd ~/.config/superpowers/worktrees/tennis-app/lesplanning && npx tsc --noEmit && npx jest`
Verwacht: geen typefouten; alle tests slagen.

- [ ] **Stap 7: Commit**

```bash
git add lib/sync.ts lib/sync.test.ts providers/mockStore.ts providers/supabaseStore.ts
git commit -m "feat(lesplanning): de opslag kent de doorsturingen

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Taak 7: De twee schrijfwegen

**Files:**
- Modify: `providers/SimpleDataProvider.tsx` (het contexttype rond regel 307 bij `verwijderZiekmelding`; de implementatie na `verwijderZiekmelding` rond regel 1540; de contextwaarde rond regel 1671 en 1729; de dependency-lijst rond regel 1755)

- [ ] **Stap 1: Zet de velden in het contexttype**

Naast `sickLeaves: SickLeave[];` (rond regel 56):

```ts
  lesPlanning: Lesplanning[];
```

En naast `verwijderZiekmelding` (rond regel 307):

```ts
  /**
   * Lesmateriaal doorsturen voor een periode, aan een trainer en/of een groep.
   *
   * Of de invoer deugt is al gevraagd door het scherm (`lesplanningFout` in lib/lesplanning);
   * hier wordt de rij alleen weggeschreven. De id wordt op één plek gemaakt, net als bij elke
   * andere `add*`-actie.
   */
  voegLesplanningToe: (
    p: Omit<Lesplanning, 'id' | 'created_at'>,
  ) => Promise<void>;
  /** Een doorsturing weghalen. Raakt geen enkele boeking: welk materiaal er geldt, wordt
   *  afgeleid door `materiaalVoor` — zodra de rij weg is, is dat antwoord vanzelf overal nee. */
  verwijderLesplanning: (id: string) => Promise<void>;
```

- [ ] **Stap 2: Schrijf de implementatie**

Direct na de `verwijderZiekmelding`-callback:

```ts
  // Lesmateriaal doorsturen
  //
  // Een doorsturing is een periode op een trainer en/of een groep, en niets meer. Welke lessen
  // ze raakt wordt nergens opgeslagen maar uitgerekend in lib/lesplanning — hier wordt de rij
  // alleen aangemaakt en weggehaald. Daarom raakt weghalen ook geen enkele boeking: zodra de rij
  // weg is, geeft `materiaalVoor` vanzelf niets meer terug, overal waar iemand het opnieuw
  // vraagt. Wie hier "even netjes opruimt" met een map over de boekingen, wist iets wat er nooit
  // op stond.
  const voegLesplanningToe = useCallback(async (
    p: Omit<Lesplanning, 'id' | 'created_at'>,
  ): Promise<void> => {
    const store = storeRef.current;
    if (!store) return;
    const aangemaakt: Lesplanning = { ...p, id: newId('lp'), created_at: nowISO() };
    await commit({ ...store, lesPlanning: [...store.lesPlanning, aangemaakt] });
  }, [commit]);

  const verwijderLesplanning = useCallback(async (id: string): Promise<void> => {
    const store = storeRef.current;
    if (!store) return;
    await commit({
      ...store,
      lesPlanning: store.lesPlanning.filter((p) => p.id !== id),
    });
  }, [commit]);
```

- [ ] **Stap 3: Hang ze in de contextwaarde**

Naast `sickLeaves: store?.sickLeaves ?? [],` (rond regel 1671):

```ts
    lesPlanning: store?.lesPlanning ?? [],
```

Naast `verwijderZiekmelding,` in de opsomming (rond regel 1729):

```ts
    voegLesplanningToe,
    verwijderLesplanning,
```

En in de dependency-lijst van diezelfde `useMemo` (rond regel 1755), naast `verwijderZiekmelding`:

```ts
    voegLesplanningToe, verwijderLesplanning,
```

Zet `Lesplanning` bij de type-import bovenaan het bestand.

- [ ] **Stap 4: Controleer**

Run: `cd ~/.config/superpowers/worktrees/tennis-app/lesplanning && npx tsc --noEmit && npx jest`
Verwacht: geen typefouten, alle tests slagen.

- [ ] **Stap 5: Commit**

```bash
git add providers/SimpleDataProvider.tsx
git commit -m "feat(lesplanning): doorsturen en weghalen in de provider

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Taak 8: De databank

**Files:**
- Create: `LESPLANNING.sql`
- Modify: `supabase-schema.sql` (onderaan, na het blok "Een les vrijgeven, en een trainer die er zelf een overneemt")

- [ ] **Stap 1: Schrijf `LESPLANNING.sql`**

```sql
-- Lesmateriaal doorsturen voor een periode, per trainer en per groep.
--
-- Draai dit in de Supabase SQL-editor. Twee keer draaien kan geen kwaad.
--
-- WAAROM DIT NODIG IS. De tennisschool werkt met een lessenboekje: in een bepaalde periode doet
-- een groep of een trainer een bepaalde training. Lesmateriaal (`lessons`) hangt vandaag aan
-- precies één speler (`student_id`) of aan niemand, dus die afspraak leefde buiten de app — in
-- een mail of op papier — en een trainer die op zijn lesdag keek, zag niet wat hij hoorde te
-- geven.
--
-- Dezelfde inhoud staat onderaan supabase-schema.sql. Lopen die twee uiteen, dan werkt de app
-- bij de club anders dan bij een verse installatie.

create table if not exists les_planning (
  id text primary key,
  lesson_id text not null references lessons(id) on delete cascade,
  coach_id text references users(id) on delete cascade,
  group_id text references lesson_groups(id) on delete cascade,
  van date not null,
  tot date not null,
  created_at timestamptz not null default now(),
  -- Dezelfde regel als `lesplanningFout` in lib/lesplanning: beide leeg zou stilzwijgend "de
  -- hele club" betekenen. De app zorgt dat er geen knop is die hier geweigerd wordt; dit is de
  -- bewaking (zie het kopcommentaar van lib/rechten.ts).
  constraint les_planning_doelwit check (coach_id is not null or group_id is not null)
);

-- `on delete cascade` op alle drie de verwijzingen, en met opzet niet `set null` zoals bij
-- `bookings.taught_by_id`. Dat verschil zit hierin: een boeking blijft bestaan en valt bij een
-- lege waarde terug op een geldige toestand ("de vaste trainer gaf hem zelf"). Een planningrij
-- heeft die terugval niet — zonder materiaal, of zonder de trainer of groep waar ze over ging,
-- betekent ze niets meer en hoort ze weg.

create index if not exists les_planning_coach_idx on les_planning (coach_id);
create index if not exists les_planning_group_idx on les_planning (group_id);
create index if not exists les_planning_lesson_idx on les_planning (lesson_id);

alter table les_planning enable row level security;

-- Lezen: elke trainer, want hij moet de planning van zijn eigen lessen zien. Dat is dezelfde
-- grens die `lessons_select` al hanteert voor de bibliotheek.
--
-- DE SPELER STAAT HIER MET OPZET NIET BIJ (beslist op 9 september 2026). Dit is werkinstructie
-- voor de trainer. Zou een speler het moeten zien, dan kost dat twee openingen in de bestaande
-- bewaking in plaats van nul: `lessons_select` laat hem alleen materiaal lezen dat aan hemzelf
-- hangt, en `lesson_groups_select` is alleen voor de beheerder.
drop policy if exists les_planning_select on les_planning;
create policy les_planning_select on les_planning for select
  to authenticated using (is_coach() or is_admin());

-- Schrijven: alleen de beheerder, zoals bij `lesson_groups` en `sick_leaves`. Wat de club die
-- periode geeft, beslist de tennisschool en niet een trainer voor zichzelf.
drop policy if exists les_planning_write on les_planning;
create policy les_planning_write on les_planning for all
  to authenticated using (is_admin()) with check (is_admin());
```

- [ ] **Stap 2: Zet dezelfde inhoud onderaan `supabase-schema.sql`**

Onderaan het bestand, met een kop in dezelfde vorm als de andere secties:

```sql
-- ---------------------------------------------------------------------------
-- Lesmateriaal doorsturen voor een periode
-- ---------------------------------------------------------------------------
```

Dan de `create table`, de indexen, `enable row level security` en de twee policies uit stap 1,
met hetzelfde commentaar. Onderaan en niet hoger in het bestand, om dezelfde harde reden als bij
`les_staat_open`: deze tabel verwijst naar `lessons` en naar `lesson_groups`, en die worden
verderop in het bestand aangemaakt.

- [ ] **Stap 3: Controleer dat het draait**

Er is geen lokale Postgres. Draai het tegen een wegwerpdatabank in Docker, met een minimale
nabouw van de tabellen waar het naar verwijst:

```bash
docker run -d --rm --name pgplanning -e POSTGRES_PASSWORD=x postgres:16-alpine >/dev/null
for i in $(seq 1 40); do docker exec pgplanning pg_isready -q && break; sleep 1; done
docker exec -i pgplanning psql -U postgres -q -v ON_ERROR_STOP=1 <<'SQL'
create schema if not exists auth;
create table users (id text primary key, auth_id uuid, role text, is_admin boolean default false);
create table lessons (id text primary key, title text, student_id text);
create table lesson_groups (id text primary key, name text);
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create or replace function is_admin() returns boolean language sql stable as $$ select coalesce((select is_admin from users where auth_id = auth.uid()), false) $$;
create or replace function is_coach() returns boolean language sql stable as $$ select exists (select 1 from users where auth_id = auth.uid() and role = 'coach') $$;
create role authenticated;
SQL
docker exec -i pgplanning psql -U postgres -q -v ON_ERROR_STOP=1 < LESPLANNING.sql && echo "LESPLANNING.sql DRAAIT SCHOON"
```

Verwacht: `LESPLANNING.sql DRAAIT SCHOON`.

- [ ] **Stap 4: Controleer dat de check echt weigert**

```bash
docker exec -i pgplanning psql -U postgres <<'SQL'
insert into lessons (id, title) values ('l-1', 'Training 4');
insert into users (id, role) values ('c-1', 'coach');
\echo '--- met een trainer (hoort te lukken)'
insert into les_planning (id, lesson_id, coach_id, van, tot) values ('p-1', 'l-1', 'c-1', '2027-03-01', '2027-03-14');
\echo '--- zonder trainer en zonder groep (hoort te falen)'
insert into les_planning (id, lesson_id, van, tot) values ('p-2', 'l-1', '2027-03-01', '2027-03-14');
\echo '--- materiaal weg neemt de planning mee'
delete from lessons where id = 'l-1';
select count(*) as planningen_over from les_planning;
SQL
docker stop pgplanning >/dev/null
```

Verwacht: de eerste `INSERT 0 1`, de tweede een fout over `les_planning_doelwit`, en
`planningen_over` gelijk aan `0`.

- [ ] **Stap 5: Commit**

```bash
git add LESPLANNING.sql supabase-schema.sql
git commit -m "feat(lesplanning): de tabel met de doorsturingen

Nagekeken op een echte Postgres 16: het bestand draait schoon, de check weigert een rij
zonder trainer én zonder groep, en materiaal weghalen neemt zijn planningen mee.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Stap 6: Vraag de gebruiker de SQL te draaien**

Zeg tegen de gebruiker: draai `LESPLANNING.sql` in de Supabase SQL-editor en herlaad daarna de
app hard. Vóór dat gebeurd is werkt het scherm wel en het opslaan niet.

---

## Taak 9: Het beheerscherm

**Files:**
- Create: `app/admin/lesplanning/index.tsx`
- Modify: `app/admin/tennisschool.tsx`
- Modify: `app/_layout.tsx`
- Modify: `lib/i18n-en.ts`

- [ ] **Stap 1: Lees hoe het ziekmeldingscherm zijn formulier en lijst bouwt**

```bash
sed -n 1,120p app/admin/ziekmelding/index.tsx
```

Volg die vorm: de invoer boven, de lijst eronder, de foutmelding uit de lib-functie bij het
formulier, en een bevestigingsvak in het scherm zelf voor het weghalen. Geen `Alert` — die
blokkeert op web.

- [ ] **Stap 2: Schrijf het scherm**

`app/admin/lesplanning/index.tsx`:

```tsx
// Beheer → Lessen beheren → Lesplanning: welk lesmateriaal er wanneer aan de orde is.
//
// Waarom dit scherm bestaat: de tennisschool werkt met een lessenboekje, en tot nu leefde die
// afspraak buiten de app. Een trainer die op zijn lesdag keek, zag niet wat hij hoorde te geven.
//
// Dit scherm rekent zelf niets uit. Of de invoer deugt weet `lesplanningFout`, en welk materiaal
// er voor een les geldt weet `materiaalVoor` — beide in lib/lesplanning, met tests eromheen.
// Hier staat alleen hoe het eruitziet en welke knop welke schrijfweg aanroept.
//
// Wat voorbij is blijft in de lijst staan. Die rijen zijn de geschiedenis van wat er wanneer
// gegeven werd, en dat is de helft van waarom ze bestaan; wie ze opruimt, maakt van een
// planning een momentopname.

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { Screen } from '../../../components/ui/Screen';
import { Card } from '../../../components/ui/Card';
import { Chip } from '../../../components/ui/Chip';
import { Button } from '../../../components/ui/Button';
import { DatumVeld } from '../../../components/ui/DatumVeld';
import { useSimpleData } from '../../../providers/SimpleDataProvider';
import { lesplanningFout } from '../../../lib/lesplanning';
import { dagSleutel, periodeTekst } from '../../../lib/vakanties';
import { parseDayInput } from '../../../lib/datetime';
import { coachesOf } from '../../../lib/hub';
import { isAdmin } from '../../../lib/rechten';
import { useT } from '../../../lib/i18n';
import { tennisColors } from '../../../constants/tennis-colors';
import { spacing, typography } from '../../../constants/theme';

export default function LesplanningScreen(): React.JSX.Element {
  const t = useT();
  const {
    currentUser, users, lessons, lesGroepen, lesPlanning,
    voegLesplanningToe, verwijderLesplanning, error,
  } = useSimpleData();

  const [lessonId, setLessonId] = useState('');
  const [coachId, setCoachId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [van, setVan] = useState('');
  const [tot, setTot] = useState('');
  // Welke rij om een bevestiging vraagt voor ze weggaat; null = geen.
  const [weghalen, setWeghalen] = useState<string | null>(null);

  // De grens staat op het scherm zelf en niet alleen op de tegel ernaartoe: een trainer kan deze
  // link intikken (TOEG-01, zie de werklijst van een ziekmelding).
  if (!isAdmin(currentUser)) {
    return (
      <Screen scroll={false}>
        <Text style={styles.muted}>{t('Lesplanning is alleen voor de beheerder.')}</Text>
      </Screen>
    );
  }

  // De bibliotheek: materiaal dat niet aan één speler hangt. Zelfde filter als
  // `AssignLessonModal` — persoonlijk materiaal stuur je niet naar een hele groep door.
  const bibliotheek = lessons.filter((l) => !l.student_id);
  const trainers = coachesOf(users);
  const groepen = lesGroepen.filter((g) => !g.archived);

  // `DatumVeld` levert dd/mm/jjjj; `lesplanningFout` en `Lesplanning` rekenen met jjjj-mm-dd.
  // Een half getypte datum wordt een lege sleutel, en `lesplanningFout` maakt daar de ene
  // melding van die overal in de app hetzelfde luidt — hier staat met opzet geen tweede versie
  // van diezelfde regel. Zelfde omzetting als in het ziekmeldingscherm.
  const vanDatum = parseDayInput(van);
  const totDatum = parseDayInput(tot);
  const vanSleutel = vanDatum ? dagSleutel(vanDatum) : '';
  const totSleutel = totDatum ? dagSleutel(totDatum) : '';

  const fout = lesplanningFout(lessonId, coachId, groupId, vanSleutel, totSleutel);

  const rijen = useMemo(
    () => [...lesPlanning].sort((a, b) => b.van.localeCompare(a.van)),
    [lesPlanning],
  );

  const titelVan = (id: string): string =>
    lessons.find((l) => l.id === id)?.title ?? t('Onbekend lesmateriaal');
  const naamVan = (id: string): string => users.find((u) => u.id === id)?.name ?? t('Onbekend');
  const groepVan = (id: string): string =>
    lesGroepen.find((g) => g.id === id)?.name ?? t('Onbekende groep');

  const stuurDoor = async (): Promise<void> => {
    if (fout !== null) return;
    await voegLesplanningToe({
      lesson_id: lessonId,
      // Leeg is `undefined` op het type en niet een lege tekst: zo leest `geldtVoor` het, en zo
      // komt er ook geen lege verwijzing in de databank.
      coach_id: coachId === '' ? undefined : coachId,
      group_id: groupId === '' ? undefined : groupId,
      van: vanSleutel,
      tot: totSleutel,
    });
    setLessonId(''); setCoachId(''); setGroupId(''); setVan(''); setTot('');
  };

  return (
    <Screen>
      <Text style={styles.uitleg}>
        {t('Kies lesmateriaal en een periode, en zeg voor wie het geldt: een trainer, een '
          + 'groep, of een groep bij een trainer. De trainer ziet het bij zijn les staan.')}
      </Text>

      <Text style={styles.section}>{t('Lesmateriaal')}</Text>
      <View style={styles.chipRow}>
        {bibliotheek.map((l) => (
          <Chip
            key={l.id}
            label={l.title}
            selected={lessonId === l.id}
            onPress={() => setLessonId(lessonId === l.id ? '' : l.id)}
          />
        ))}
      </View>
      {bibliotheek.length === 0 ? (
        <Text style={styles.muted}>{t('Er staat nog geen lesmateriaal in de bibliotheek.')}</Text>
      ) : null}

      <Text style={styles.section}>{t('Trainer')}</Text>
      <View style={styles.chipRow}>
        {trainers.map((c) => (
          <Chip
            key={c.id}
            label={c.name}
            selected={coachId === c.id}
            onPress={() => setCoachId(coachId === c.id ? '' : c.id)}
          />
        ))}
      </View>

      <Text style={styles.section}>{t('Groep')}</Text>
      <View style={styles.chipRow}>
        {groepen.map((g) => (
          <Chip
            key={g.id}
            label={g.name}
            selected={groupId === g.id}
            onPress={() => setGroupId(groupId === g.id ? '' : g.id)}
          />
        ))}
      </View>

      <Text style={styles.section}>{t('Periode')}</Text>
      <View style={styles.datumRij}>
        <View style={styles.veld}>
          <Text style={styles.label}>{t('Van')}</Text>
          <DatumVeld waarde={van} onChange={setVan} />
        </View>
        <View style={styles.veld}>
          <Text style={styles.label}>{t('Tot en met')}</Text>
          <DatumVeld waarde={tot} onChange={setTot} />
        </View>
      </View>

      {/* De melding staat bij het formulier en niet in een alert: die blokkeert op web, en je
          wil hem kunnen lezen terwijl je het veld verbetert. */}
      {fout !== null && (van !== '' || tot !== '' || lessonId !== '') ? (
        <Text style={styles.fout}>{fout}</Text>
      ) : null}
      {error ? <Text style={styles.fout}>{error}</Text> : null}

      <Button
        label={t('Doorsturen')}
        disabled={fout !== null}
        onPress={() => { void stuurDoor(); }}
      />

      <Text style={styles.section}>{t('Doorgestuurd')}</Text>
      {rijen.length === 0 ? (
        <Text style={styles.muted}>{t('Er is nog niets doorgestuurd.')}</Text>
      ) : null}
      {rijen.map((p) => (
        <Card key={p.id}>
          <Text style={styles.titel}>{titelVan(p.lesson_id)}</Text>
          <Text style={styles.meta}>{periodeTekst(p.van, p.tot)}</Text>
          <Text style={styles.meta}>
            {p.coach_id && p.group_id
              ? t('{groep} bij {trainer}', { groep: groepVan(p.group_id), trainer: naamVan(p.coach_id) })
              : p.group_id
                ? groepVan(p.group_id)
                : naamVan(p.coach_id ?? '')}
          </Text>
          {weghalen === p.id ? (
            <View style={styles.knoppen}>
              <Button
                label={t('Ja, weghalen')}
                onPress={() => { setWeghalen(null); void verwijderLesplanning(p.id); }}
              />
              <Button label={t('Laat maar')} variant="secondary" onPress={() => setWeghalen(null)} />
            </View>
          ) : (
            <Button label={t('Weghalen')} variant="secondary" onPress={() => setWeghalen(p.id)} />
          )}
        </Card>
      ))}
    </Screen>
  );
}
```

De datumvelden gebruiken de bestaande `components/ui/DatumVeld` — dezelfde component met een
kalender die het ziekmeldingscherm ook gebruikt. Schrijf er geen tweede: twee datumvelden in de
app betekent op termijn twee schrijfwijzen.

De styles onderaan het bestand:

```tsx
const styles = StyleSheet.create({
  uitleg: { ...typography.body, color: tennisColors.textMuted },
  section: { ...typography.h2, color: tennisColors.text, marginTop: spacing.sm },
  label: { ...typography.label, color: tennisColors.textMuted, marginTop: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  datumRij: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  veld: { flexGrow: 1, flexBasis: 140 },
  titel: { ...typography.h3, color: tennisColors.text },
  meta: { fontSize: 13, color: tennisColors.textMuted },
  knoppen: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  fout: { color: tennisColors.danger, fontSize: 14, marginTop: spacing.sm },
  muted: { ...typography.body, color: tennisColors.textMuted },
});
```

Controleer voor je begint of `Chip` en `Button` de props hebben die hierboven gebruikt worden:

```bash
sed -n 1,40p components/ui/Chip.tsx components/ui/Button.tsx
```

- [ ] **Stap 3: Zet de tegel in `app/admin/tennisschool.tsx`**

Na de tegel *Ziekmelding*:

```tsx
        <ActionTile
          title={t('Lesplanning')}
          subtitle={t('Materiaal per periode en groep')}
          icon={CalendarRange}
          onPress={() => router.push('/admin/lesplanning')}
        />
```

Zet `CalendarRange` bij de bestaande `lucide-react-native`-import van dat bestand.

- [ ] **Stap 4: Registreer de route in `app/_layout.tsx`**

Naast de andere `admin/`-titels:

```ts
  { name: 'admin/lesplanning/index', title: t('Lesplanning') },
```

Controleer hoe de bestaande mappen-routes daar heten:

```bash
grep -n "admin/ziekmelding\|admin/lesgroepen" app/_layout.tsx
```

Volg exact die schrijfwijze.

- [ ] **Stap 5: Zet de Engelse zinnen erbij**

In `lib/i18n-en.ts`, in het blok "lesmateriaal doorsturen". Controleer eerst welke er al bestaan
(`Lesmateriaal`, `Trainer`, `Groep`, `Van`, `Periode` en `Laat maar` bestaan mogelijk al) — twee
keer dezelfde sleutel keurt `tsc` af:

```bash
grep -n "^  'Lesplanning'\|^  'Trainer'\|^  'Groep'\|^  'Van'\|^  'Tot en met'\|^  'Periode'\|^  'Doorsturen'\|^  'Weghalen'\|^  'Laat maar'\|^  'Lesmateriaal'" lib/i18n-en.ts
```

Voeg alleen toe wat er nog niet staat, uit deze lijst:

```ts
  'Lesplanning': 'Lesson planning',
  'Materiaal per periode en groep': 'Material per period and group',
  'Lesplanning is alleen voor de beheerder.': 'Lesson planning is for the administrator only.',
  'Kies lesmateriaal en een periode, en zeg voor wie het geldt: een trainer, een groep, of een groep bij een trainer. De trainer ziet het bij zijn les staan.':
    'Choose lesson material and a period, and say who it applies to: a coach, a group, or a group with a coach. The coach sees it with their lesson.',
  'Er staat nog geen lesmateriaal in de bibliotheek.': 'There is no lesson material in the library yet.',
  'Tot en met': 'Up to and including',
  'Doorsturen': 'Send on',
  'Doorgestuurd': 'Sent on',
  'Er is nog niets doorgestuurd.': 'Nothing has been sent on yet.',
  '{groep} bij {trainer}': '{groep} with {trainer}',
  'Onbekend lesmateriaal': 'Unknown lesson material',
  'Onbekende groep': 'Unknown group',
  'Weghalen': 'Remove',
  'Ja, weghalen': 'Yes, remove it',
```

- [ ] **Stap 6: Controleer**

Run: `cd ~/.config/superpowers/worktrees/tennis-app/lesplanning && npx tsc --noEmit && npx jest && npx expo export --platform web 2>&1 | tail -2`
Verwacht: geen typefouten, alle tests slagen, de export slaagt.

- [ ] **Stap 7: Controleer dat er geen dubbele vertaalsleutel in staat**

```bash
python3 -c "
import re,pathlib
s=pathlib.Path('lib/i18n-en.ts').read_text()
keys=re.findall(r\"^  '((?:[^'\\\\\\\\]|\\\\\\\\.)*)':\", s, re.M)
dup=[k for k in set(keys) if keys.count(k)>1]
print('dubbele sleutels:', dup)
"
```

Verwacht: `dubbele sleutels: []`.

- [ ] **Stap 8: Commit**

```bash
git add app/admin/lesplanning/index.tsx app/admin/tennisschool.tsx app/_layout.tsx lib/i18n-en.ts
git commit -m "feat(lesplanning): het beheerscherm om materiaal door te sturen

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Taak 10: De trainer ziet het bij zijn les

**Files:**
- Modify: `components/lesdag/Lesdag.tsx`
- Modify: `components/BookingDetailSheet.tsx`
- Modify: `lib/i18n-en.ts`

- [ ] **Stap 1: Zet het op de lesdag**

In `components/lesdag/Lesdag.tsx`: haal `lesPlanning`, `lessons` en `settings` erbij uit
`useSimpleData()` (kijk wat er al gehaald wordt), en zet boven de `return`:

```tsx
  const openMateriaal = (lessonId: string): void => {
    router.push(`/coaches/lessons?lesId=${lessonId}`);
  };
```

Controleer eerst hoe je in deze app naar één stuk lesmateriaal navigeert:

```bash
grep -rn "coaches/lessons" app components | head
```

Gebruik het pad dat daar al gebruikt wordt om materiaal te openen; bestaat er geen pad naar één
stuk materiaal, laat de regel dan **tekst zonder tik** en zet geen knop die niets doet.

In het open blok van een lesuur, onder de spelers:

```tsx
                {/* Wat de tennisschool voor deze periode doorstuurde. Welk materiaal dat is
                    weet `materiaalVoor` in lib/lesplanning en niets anders; gelden er twee,
                    dan staan ze er beide met de bijzonderste bovenaan.

                    Geldt er niets, dan staat er niets — ook geen kop. Een kop zonder inhoud
                    leest als "er is niets gepland", en dat is iets anders dan "er is nooit
                    iets ingevuld". */}
                {materiaalVoor(uur.booking, lesPlanning, lessons).map((l) => (
                  <Text key={l.id} style={styles.periode}>
                    {t('Deze periode: {titel}', { titel: l.title })}
                  </Text>
                ))}
```

En in de styles:

```tsx
  periode: { fontSize: 13, color: tennisColors.textMuted, paddingTop: spacing.xs },
```

Zet `materiaalVoor` bij de imports (`import { materiaalVoor } from '../../lib/lesplanning';`).

- [ ] **Stap 2: Zet het op het lesdetail**

In `components/BookingDetailSheet.tsx`: haal `lesPlanning` erbij uit `useSimpleData()` (`lessons`
wordt daar al gehaald — controleer dat met `grep -n "lessons" components/BookingDetailSheet.tsx`),
en zet de regels onder de trainer-regel, boven de schakelaar "Deze les zoekt een trainer":

```tsx
        {/* Wat de tennisschool voor deze periode doorstuurde; zie `materiaalVoor` in
            lib/lesplanning. Geen kop als er niets geldt, om dezelfde reden als op de lesdag. */}
        {materiaalVoor(booking, lesPlanning, lessons).map((l) => (
          <Text key={l.id} style={styles.hint}>
            {t('Deze periode: {titel}', { titel: l.title })}
          </Text>
        ))}
```

`styles.hint` bestaat daar al (de ziekmeldingsregel gebruikt hem). Zet `materiaalVoor` bij de
imports.

- [ ] **Stap 3: Zet de Engelse zin erbij**

```ts
  'Deze periode: {titel}': 'This period: {titel}',
```

- [ ] **Stap 4: Controleer**

Run: `cd ~/.config/superpowers/worktrees/tennis-app/lesplanning && npx tsc --noEmit && npx jest && npx expo export --platform web 2>&1 | tail -2`
Verwacht: geen typefouten, alle tests slagen, de export slaagt.

- [ ] **Stap 5: Commit**

```bash
git add components/lesdag/Lesdag.tsx components/BookingDetailSheet.tsx lib/i18n-en.ts
git commit -m "feat(lesplanning): de trainer ziet bij zijn les wat er die periode geldt

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Taak 11: Oplevering

**Files:**
- Modify: `OPENSTAAND.md`

- [ ] **Stap 1: Draai alles**

```bash
cd ~/.config/superpowers/worktrees/tennis-app/lesplanning
npx tsc --noEmit && npx jest && npx expo export --platform web 2>&1 | tail -2
```

Verwacht: geen typefouten, alle tests slagen (1828 bestaande plus 23 nieuwe), de export slaagt.
Faalt er iets, los dat op vóór de volgende stap — niet melden dat het af is terwijl het rood
staat.

- [ ] **Stap 2: Schrijf op wat er bij is gekomen**

Zet in `OPENSTAAND.md` een blok in dezelfde vorm als de bestaande punten (zie punt 1c over de
lessen zonder trainer): wat er werkt, welk bestand de vraag beantwoordt (`lib/lesplanning.ts`),
dat de speler het met opzet niet ziet en waarom, en wat er met de hand nog moet —
`LESPLANNING.sql` draaien in Supabase, daarna hard herladen, en dan doorlopen: materiaal
doorsturen voor een groep, en met een traineraccount kijken of het bij de juiste les staat.

- [ ] **Stap 3: Werk bij op main en controleer opnieuw**

`main` beweegt terwijl je werkt, dus dit is geen formaliteit:

```bash
cd ~/.config/superpowers/worktrees/tennis-app/lesplanning
git fetch -q origin && git rebase main
npx tsc --noEmit && npx jest && npx expo export --platform web 2>&1 | tail -2
```

Loopt de rebase op een conflict, los het dan op door **beide** kanten te behouden — de conflicten
die dit werk oplevert zitten in opsommingen (de contextwaarde en de dependency-lijst van de
provider, de imports van een scherm), en daar horen de regels van beide kanten in. Draai de
controles daarna opnieuw.

Is `supabase-schema.sql` geraakt, kijk dan of `bewaak_betaalvelden` of een policy onderweg
gewijzigd is, en of `LESPLANNING.sql` daar nog bij past.

- [ ] **Stap 4: Zet het op main**

```bash
cd "/Users/leko/Downloads/tennis app"
git status -sb   # moet schoon zijn en op main staan; zo niet: vraag het aan de gebruiker
git merge --no-ff feat/lesplanning -m "merge: lesmateriaal doorsturen per periode

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
npx tsc --noEmit && npx jest && npx expo export --platform web 2>&1 | tail -2
git push
```

- [ ] **Stap 5: Ruim op**

```bash
cd "/Users/leko/Downloads/tennis app"
git worktree remove ~/.config/superpowers/worktrees/tennis-app/lesplanning --force
git branch -d feat/lesplanning
```

- [ ] **Stap 6: Zeg wat de gebruiker zelf moet doen**

Twee dingen, en niet één ervan overslaan:
1. `LESPLANNING.sql` draaien in de Supabase SQL-editor, daarna de app hard herladen — de app
   leest de databank bij het opstarten. Vóór die SQL werkt het scherm wel en het opslaan niet.
2. Met de hand doorlopen op de echte site: materiaal doorsturen voor een groep en een periode,
   en met een traineraccount nakijken of het bij de juiste lessen staat en niet bij de andere.
   Let erop dat de dev-server met de echte databank van de club praat.
