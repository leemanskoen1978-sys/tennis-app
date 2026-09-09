# De Agenda-tab opheffen — implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** De zeven schermen van de Agenda-tab hebben een nieuw huis op Home, Spelers en Beheer, waarna de tab en zijn vier resterende schermen verdwijnen.

**Architecture:** Twee golven. Eerst krijgt alles een nieuw huis terwijl de oude tab blijft staan (taak 1 tot 8); pas als dat werkt gaan de schermen, de routes en de tab weg (taak 9 en 10). Twee selecties gaan naar `lib/` met tests — wat de lesdag van een speler toont, en welke lessen in de clubbrede export horen; de rest is verhuizen van schermwerk dat al bestaat.

**Tech Stack:** Expo Router, React Native (web), TypeScript, Jest. Nederlands in de UI en in commentaar; commentaar legt het *waarom* uit.

**Spec:** `docs/superpowers/specs/2026-09-09-agenda-tab-opheffen-design.md`

**Voor elke commit:**

```bash
npx tsc --noEmit && npm test
```

en vóór de laatste commit ook:

```bash
npx expo export --platform web --output-dir .webbuild-check && rm -rf .webbuild-check
```

**De volgorde is niet vrij.** De dev-server draait en herlaadt bij elke opslag. Taak 9 haalt
schermen weg waar taak 3 tot 8 hun inhoud uit overnemen; wie dat omdraait, laat een gat
achter waarin een trainer zijn aanvragen nergens kan goedkeuren.

---

## Golf 1 — alles een nieuw huis

### Taak 1: `lesdagVanSpeler` — wat een speler vandaag heeft

**Files:**
- Modify: `lib/lesdag.ts`
- Modify: `lib/lesdag.test.ts`

- [ ] **Stap 1: Schrijf de falende tests**

Zet onderaan `lib/lesdag.test.ts` bij (de hulpfuncties `les`, `OM` en `NU` staan er al
bovenaan; `les` maakt een les van trainer `koen` met speler `mathis` op dinsdag 25 augustus
2026):

```ts
describe('lesdagVanSpeler', () => {
  it('geeft de lessen van vandaag, op tijd oplopend', () => {
    const laat = les('l2', OM(19), OM(20));
    const vroeg = les('l1', OM(17), OM(18));
    const dag = lesdagVanSpeler([laat, vroeg], 'mathis', NU(12));
    expect(dag.vandaag.map((b) => b.id)).toEqual(['l1', 'l2']);
    expect(dag.volgende).toBeNull();
  });

  // Een les die al voorbij is blijft staan: hij is vandaag geweest, en dat is wat het blok
  // vertelt. Zo klopt het ook met de lesdag van de trainer.
  it('houdt een les van vanochtend erin', () => {
    const dag = lesdagVanSpeler([les('l1', OM(9), OM(10))], 'mathis', NU(20));
    expect(dag.vandaag.map((b) => b.id)).toEqual(['l1']);
  });

  it('laat een geannuleerde les weg', () => {
    const dag = lesdagVanSpeler(
      [les('l1', OM(17), OM(18), { status: 'cancelled' })], 'mathis', NU(12),
    );
    expect(dag.vandaag).toEqual([]);
    expect(dag.volgende).toBeNull();
  });

  // Meespelen telt: een deelnemer aan een groepsles moet zijn les net zo goed zien als de
  // betaler. Dezelfde regel als in zijn dossier (`playsIn`).
  it('telt een groepsles mee waarin hij meespeelt zonder betaler te zijn', () => {
    const groep = les('l1', OM(17), OM(18), { player_id: 'lotte', participant_ids: ['lotte', 'mathis'] });
    const dag = lesdagVanSpeler([groep], 'mathis', NU(12));
    expect(dag.vandaag.map((b) => b.id)).toEqual(['l1']);
  });

  it('laat de les van een ander weg', () => {
    const dag = lesdagVanSpeler([les('l1', OM(17), OM(18), { player_id: 'lotte' })], 'mathis', NU(12));
    expect(dag.vandaag).toEqual([]);
  });

  // Staat er vandaag niets, dan is de eerstvolgende les het antwoord op "wanneer heb ik les".
  it('geeft de eerstvolgende les als vandaag leeg is', () => {
    const morgen = new Date(2026, 7, 26, 17).toISOString();
    const morgenEind = new Date(2026, 7, 26, 18).toISOString();
    const overmorgen = new Date(2026, 7, 27, 17).toISOString();
    const overmorgenEind = new Date(2026, 7, 27, 18).toISOString();
    const dag = lesdagVanSpeler(
      [les('l2', overmorgen, overmorgenEind), les('l1', morgen, morgenEind)],
      'mathis', NU(12),
    );
    expect(dag.vandaag).toEqual([]);
    expect(dag.volgende?.id).toBe('l1');
  });

  it('heeft geen volgende les als er alleen verleden is', () => {
    const gisteren = new Date(2026, 7, 24, 17).toISOString();
    const gisterenEind = new Date(2026, 7, 24, 18).toISOString();
    const dag = lesdagVanSpeler([les('l1', gisteren, gisterenEind)], 'mathis', NU(12));
    expect(dag.vandaag).toEqual([]);
    expect(dag.volgende).toBeNull();
  });

  // Is er vandaag wél les, dan is de volgende niet interessant: het blok toont er één ding.
  it('laat de volgende leeg zolang er vandaag les is', () => {
    const morgen = new Date(2026, 7, 26, 17).toISOString();
    const morgenEind = new Date(2026, 7, 26, 18).toISOString();
    const dag = lesdagVanSpeler(
      [les('l1', OM(17), OM(18)), les('l2', morgen, morgenEind)], 'mathis', NU(12),
    );
    expect(dag.vandaag.map((b) => b.id)).toEqual(['l1']);
    expect(dag.volgende).toBeNull();
  });
});
```

Breid de import bovenaan uit: `import { lesdagVan, lesdagVanSpeler } from './lesdag';`

Controleer in `lib/types.ts` hoe het veld voor deelnemers aan een groepsles heet
(`participant_ids`) en pas de test aan als het anders blijkt.

- [ ] **Stap 2: Draai de tests en zie ze falen**

Run: `npx jest lib/lesdag.test.ts`
Expected: FAIL — "lesdagVanSpeler is not a function" (of een typefout op de import).

- [ ] **Stap 3: Schrijf de implementatie**

Zet in `lib/lesdag.ts`, onder `lesdagVan`:

```ts
/** Wat het lesdagblok van een speler toont. Precies één van de twee draagt inhoud. */
export interface Spelerdag {
  /** Zijn lessen van vandaag, op tijd oplopend. Geannuleerde niet. */
  vandaag: Booking[];
  /** De eerstvolgende les, en alleen als er vandaag niets staat. */
  volgende: Booking | null;
}

/**
 * De lesdag van een speler: wat hij op Home ziet.
 *
 * Anders dan bij een trainer is dit blok op de meeste dagen leeg — een speler heeft
 * doorgaans één les per week. Een kop met "geen lessen vandaag" eronder is dan zes dagen op
 * zeven dode ruimte, en daarom valt dit terug op zijn eerstvolgende les: "wanneer heb ik
 * les" is de vraag die hij echt stelt.
 *
 * Meespelen telt, net als in zijn dossier: een deelnemer aan een groepsles betaalt niet en
 * staat niet als `player_id` genoteerd, maar het is wel zijn les.
 */
export function lesdagVanSpeler(bookings: Booking[], spelerId: string, now: Date): Spelerdag {
  const mijne = bookings.filter((b) => playsIn(b, spelerId) && b.status !== 'cancelled');

  const vandaag = bookingsOnDay(mijne, now);
  if (vandaag.length > 0) return { vandaag, volgende: null };

  const moment = now.getTime();
  const volgende = mijne
    .filter((b) => {
      const start = new Date(b.start_time).getTime();
      return Number.isFinite(start) && start >= moment;
    })
    .sort((a, b) => a.start_time.localeCompare(b.start_time))[0] ?? null;

  return { vandaag: [], volgende };
}
```

Vul de imports bovenaan aan: `playsIn` komt uit `./groups` (het bestand importeert daar al
`lessonPlayerIds` uit), `bookingsOnDay` uit `./hub` staat er al.

Let op: `bookingsOnDay` filtert zelf al op geannuleerd en sorteert op tijd; de filter
hierboven staat er voor de tweede helft van de functie, waar `bookingsOnDay` niet langskomt.

- [ ] **Stap 4: Draai de tests en zie ze slagen**

Run: `npx jest lib/lesdag.test.ts`
Expected: PASS — de bestaande tests van `lesdagVan` plus acht nieuwe.

- [ ] **Stap 5: Commit**

```bash
npx tsc --noEmit && npm test
git add lib/lesdag.ts lib/lesdag.test.ts
git commit -m "feat(lesdag): wat een speler vandaag heeft, of wanneer hij weer les heeft

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Taak 2: Het lesdagblok van de speler op Home

**Files:**
- Create: `components/lesdag/Lesdagspeler.tsx`
- Modify: `app/index.tsx`

- [ ] **Stap 1: Maak het component**

```tsx
// De lesdag van een speler: wat hij ziet als hij de app opent.
//
// Zijn tegenhanger `Lesdag.tsx` is gemaakt voor een trainer op de baan — namen, memoknoppen,
// afvinken. Daar heeft een speler niets aan: hij wil weten hoe laat, bij wie en op welke
// baan. Vandaar een eigen, korter blok in plaats van een tweede stand in hetzelfde bestand.
//
// Welke lessen dat zijn rekent lib/lesdag uit (`lesdagVanSpeler`); dit bestand tekent alleen.
// Staat er vandaag niets, dan komt daar zijn eerstvolgende les uit — en dan zegt de kop dat
// ook, want "Vandaag" boven een les van volgende week is een leugen.

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { lesdagVanSpeler } from '../../lib/lesdag';
import { bookingPaymentMeta } from '../../lib/payments';
import { formatTimeRange, formatDayTimeRange } from '../../lib/datetime';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography } from '../../constants/theme';
import { useT } from '../../lib/i18n';

export function Lesdagspeler({ spelerId }: { spelerId: string }): React.JSX.Element | null {
  const t = useT();
  const { bookings, users, courts } = useSimpleData();

  // Eén moment voor het hele blok: anders zou de ene les op een andere "nu" beoordeeld
  // worden dan de volgende.
  const dag = useMemo(
    () => lesdagVanSpeler(bookings, spelerId, new Date()),
    [bookings, spelerId],
  );

  const naamVan = (id: string): string => users.find((u) => u.id === id)?.name ?? t('Onbekend');
  const baanVan = (id: string): string => courts.find((c) => c.id === id)?.name ?? t('Onbekend');

  // Niets vandaag en niets in het vooruitzicht: dan hoort er ook geen kop te staan. Een lege
  // sectie op het hoofdscherm suggereert dat er iets stuk is.
  if (dag.vandaag.length === 0 && dag.volgende === null) return null;

  const vandaag = dag.vandaag.length > 0;
  const lessen = vandaag ? dag.vandaag : (dag.volgende ? [dag.volgende] : []);

  return (
    <View style={styles.blok}>
      <Text style={styles.kop}>{vandaag ? t('Vandaag') : t('Je volgende les')}</Text>
      {lessen.map((b) => {
        const betaling = bookingPaymentMeta(b);
        return (
          <Card key={b.id} style={styles.les}>
            <Text style={styles.tijd}>
              {/* Bij een les van vandaag is de dag overbodig; bij de volgende les is hij
                  juist het enige wat telt. */}
              {vandaag
                ? formatTimeRange(b.start_time, b.end_time)
                : formatDayTimeRange(b.start_time, b.end_time)}
              {' · '}
              {/* Je eigen naam hoef je niet te lezen: een speler ziet zijn trainer. */}
              {naamVan(b.coach_id)}
            </Text>
            <Text style={styles.baan}>{baanVan(b.court_id)}</Text>
            <Badge label={betaling.label} color={betaling.color} subtle={betaling.subtle} />
          </Card>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  blok: { gap: spacing.sm },
  kop: {
    ...typography.label, color: tennisColors.textMuted,
    textTransform: 'uppercase', fontWeight: '700',
  },
  les: { gap: spacing.xs },
  tijd: { ...typography.h3, color: tennisColors.text },
  baan: { ...typography.label, color: tennisColors.textMuted },
});
```

Controleer voor je verdergaat of `formatDayTimeRange` bestaat in `lib/datetime.ts` (`app/index.tsx`
gebruikt hem al) en of `bookingPaymentMeta` de velden `label`, `color` en `subtle` teruggeeft
(`app/agenda/index.tsx` gebruikt hem zo).

- [ ] **Stap 2: Zet het blok op Home**

In `app/index.tsx` staat:

```tsx
      {coach ? <Lesdag coachId={currentUser.id} /> : null}
```

Maak daarvan:

```tsx
      {/* De lesdag hoort bovenaan: wat een trainer om vijf voor vijf wil zien, is de les
          van vijf uur — niet een keuzemenu. Voor een speler is dat dezelfde vraag met een
          ander antwoord: hoe laat, bij wie, op welke baan. */}
      {coach
        ? <Lesdag coachId={currentUser.id} />
        : speler ? <Lesdagspeler spelerId={speler.id} /> : null}
```

`speler` komt uit de bestaande `useKindkeuze()` in dat bestand — voor een ouder is dat het
kind dat hij koos, en dat is precies wiens lessen hij hoort te zien. Voeg de import toe:

```tsx
import { Lesdagspeler } from '../components/lesdag/Lesdagspeler';
```

- [ ] **Stap 3: Controleer**

Run: `npx tsc --noEmit && npm test`
Expected: geen fouten, alle tests groen.

- [ ] **Stap 4: Kijk het na in de browser**

Dev-server op <http://localhost:8081>. Log in als speler (Mathis Leemans is het testaccount):
staat er een les vandaag, dan toont Home hem met uur, trainer en baan; staat er niets, dan
zijn eerstvolgende les met de dag erbij.

- [ ] **Stap 5: Commit**

```bash
git add components/lesdag/Lesdagspeler.tsx app/index.tsx
git commit -m "feat(home): de speler ziet zijn les van vandaag

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Taak 3: De goedkeuringswachtrij naar Home

**Files:**
- Modify: `app/index.tsx`
- Lees: `app/agenda/index.tsx:120-196` (blijft in deze golf bestaan)

- [ ] **Stap 1: Neem de twee blokken over**

`app/agenda/index.tsx` tekent twee secties die hier naartoe verhuizen. Neem ze **letterlijk**
over — inclusief hun commentaar, hun kaarten, de knoppen Goedkeuren en Weigeren, en de
foutregel eronder:

1. `{teKeuren.length > 0 ? … }` — de sectie **Goed te keuren** (voor een trainer), met per
   aanvraag de naam, de dag en de baan, de regel "In de agenda van {trainer}" als het niet
   zijn eigen agenda is, en de twee knoppen die `approveBooking` en `rejectBooking`
   aanroepen.
2. `{gevraagd.length > 0 ? … }` — de sectie **Wacht op goedkeuring** (voor een speler).

Neem ook de stijlen mee die die blokken gebruiken (`section`, `sectionLabel`, `newCard`,
`newRow`, `newIcon`, `newBody`, `lessonTime`, `lessonCourt`, `decide`, `decideButton`,
`error`) en voeg ze toe aan de `StyleSheet` van `app/index.tsx`, met een andere naam als er
al een stijl met die naam bestaat.

- [ ] **Stap 2: Vul de stand van Home aan**

`app/index.tsx` telt de aanvragen al, maar alleen als getal:

```tsx
  const teKeuren = coach
    ? awaitingApprovalFor(bookings, currentUser.id, magInElkeAgenda(currentUser)).length
    : 0;
  const gevraagd = coach ? 0 : awaitingApprovalOf(bookings, speler?.id).length;
```

Maak daar de lijsten zelf van, want het scherm toont ze nu:

```tsx
  // Niet langer alleen een getal: de lijst staat hier, dus de kaarten hebben de lessen zelf
  // nodig. `.length` gebruiken we nog voor de badge op de tegel Mijn agenda.
  const teKeuren = coach
    ? awaitingApprovalFor(bookings, currentUser.id, magInElkeAgenda(currentUser))
    : [];
  const gevraagd = coach ? [] : awaitingApprovalOf(bookings, speler?.id);
```

Pas de plekken aan waar die twee als getal gebruikt worden (de ondertitels van de tegels
Agenda en Mijn agenda) naar `teKeuren.length` en `gevraagd.length`.

Haal uit `useSimpleData()` erbij wat de knoppen nodig hebben:

```tsx
  const { currentUser, users, bookings, courts, approveBooking, rejectBooking, error } = useSimpleData();
```

En de hulpfuncties die de kaarten gebruiken:

```tsx
  const nameOf = (id: string): string => users.find((u) => u.id === id)?.name ?? t('Onbekend');
  const courtName = (id: string): string => courts.find((c) => c.id === id)?.name ?? t('Onbekende baan');
```

Voeg de imports toe die nog ontbreken: `BellRing` uit `lucide-react-native`,
`formatDayTime` uit `../lib/datetime`, en `groupSize, shortGroupLabel` uit `../lib/groups`.

- [ ] **Stap 3: Zet de blokken op hun plek**

Boven de lesdag, onder de `SpelerKiezer`:

```tsx
      {/* Wat op een beslissing wacht, staat boven de lesdag: zolang de trainer niets zegt,
          gaat die les niet door. Vroeger stond deze lijst op de Agenda-tab terwijl de badge
          op Home stond — een melding die naar een ander scherm wijst dan waar je hem
          afhandelt, laat je zoeken. */}
```

Dan de sectie Goed te keuren, daarna de sectie Wacht op goedkeuring, en dan pas de lesdag.

- [ ] **Stap 4: Controleer**

Run: `npx tsc --noEmit && npm test`
Expected: geen fouten, alle tests groen.

- [ ] **Stap 5: Kijk het na in de browser**

Vraag als speler (Mathis) een les aan → Home toont "Wacht op goedkeuring". Log in als de
trainer van die les → Home toont hem bovenaan onder "Goed te keuren"; Goedkeuren zet hem
daarna in de lesdag, Weigeren laat de speler een bericht zien.

- [ ] **Stap 6: Commit**

```bash
git add app/index.tsx
git commit -m "feat(home): goedkeuren gebeurt waar de melding staat

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Taak 4: De tegels van Home

**Files:**
- Modify: `app/index.tsx`

- [ ] **Stap 1: Trainer — Afvinken en Nieuwe afspraak erbij, Agenda wordt Mijn agenda**

`coachTiles` begint nu met de tegel Agenda (`onPress: () => router.push('/agenda')`, met de
badge `teKeuren`). Vervang die door drie tegels:

```tsx
    // Bovenaan, want dit is de tegel die je aantikt terwijl de kinderen voor je staan.
    {
      key: 'afvinken',
      title: t('Afvinken'),
      subtitle: nu.length > 0
        ? t('Nu: {tijd} · geef je gsm door', {
          tijd: formatTimeRange(nu[0].start_time, nu[0].end_time),
        })
        : t('Wie is er? Bij het begin van de les'),
      icon: UserCheck,
      onPress: () => router.push('/afvinken'),
    },
    {
      key: 'new',
      title: t('Nieuwe afspraak'),
      subtitle: t('Les inplannen voor een speler'),
      icon: CalendarPlus,
      onPress: () => router.push('/agenda/new'),
    },
    {
      key: 'mijn',
      title: t('Mijn agenda'),
      subtitle: plural(today, 'vandaag', 'vandaag'),
      icon: CalendarDays,
      // Zijn eigen dossier: zijn agenda, zijn week en zijn spelers staan daar bij elkaar.
      onPress: () => { if (dossier) router.push(dossier); },
    },
```

`nu` bestaat nog niet op Home; neem de berekening over uit `app/agenda/index.tsx`:

```tsx
  // Loopt er nu een les, dan zegt de tegel Afvinken meteen welke — anders moet de trainer
  // hem openen om te zien of hij op het juiste moment kijkt.
  const nu = coach && currentUser
    ? lessenNu(bookings, currentUser.id, new Date())
    : [];
```

met `import { lessenNu } from '../lib/afvinken';`, `formatTimeRange` uit `../lib/datetime` en
`UserCheck` uit `lucide-react-native`.

De badge met openstaande aanvragen gaat van de tegel af: de lijst staat er sinds taak 3 zelf.

- [ ] **Stap 2: Speler — Mijn agenda wijst naar zijn dossier**

In `playerTiles` staat de tegel `mine` met `onPress: () => router.push('/agenda')`. Maak
daarvan:

```tsx
      onPress: () => { if (dossier) router.push(dossier); },
```

De ondertitel en de badge blijven zoals ze zijn.

- [ ] **Stap 3: Het pad naar het eigen dossier, één keer**

Boven de tegellijsten:

```tsx
  // Waar "mijn agenda" heen gaat: een trainer naar zijn trainersdossier, iedereen anders
  // naar zijn spelersdossier, en een ouder naar het kind dat hij koos. De regel staat in
  // lib/dossier (stuk 3), zodat Home en Overzicht dezelfde bestemming kiezen.
  const dossier = dossierPad(currentUser, speler);
```

met `import { dossierPad } from '../lib/dossier';`.

- [ ] **Stap 4: Het openstaand saldo klikt naar hetzelfde dossier**

De kaart met het saldo doet nu `onPress={() => router.push('/agenda/overzicht')}`. Maak er
`onPress={() => { if (dossier) router.push(dossier); }}` van.

- [ ] **Stap 5: Controleer**

Run: `npx tsc --noEmit && npm test`
Expected: geen fouten, alle tests groen.

- [ ] **Stap 6: Kijk het na in de browser**

Als trainer: de drie tegels staan er, Afvinken opent het afvinkscherm, Nieuwe afspraak het
boekingsscherm, Mijn agenda je eigen trainersdossier. Als speler (Mathis): Mijn agenda en de
saldokaart openen allebei zijn spelersdossier.

- [ ] **Stap 7: Commit**

```bash
git add app/index.tsx
git commit -m "feat(home): afvinken, nieuwe afspraak en de weg naar je eigen dossier

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Taak 5: Betalingen krijgen een ingang op Spelers

**Files:**
- Modify: `app/players/index.tsx`

- [ ] **Stap 1: De tegel erbij**

Het scherm heeft bovenaan een `TileGrid` met één tegel (Voortgang toevoegen). Zet de tweede
ernaast:

```tsx
          <TileGrid>
            <ActionTile
              title={t('Voortgang toevoegen')}
              subtitle={t('Notitie na de les, voor eender welke speler')}
              icon={NotebookPen}
              primary
              onPress={() => setProgressOpen(true)}
            />
            {/* Openstaande betalingen gaan over mensen, dus ze horen ook hier te vinden te
                zijn — niet alleen in Beheer. Het scherm erachter is hetzelfde. */}
            <ActionTile
              title={t('Betalingen')}
              subtitle={t('Openstaande lessen afhandelen')}
              icon={CreditCard}
              badge={pending.length}
              onPress={() => router.push('/admin/payments')}
            />
          </TileGrid>
```

Met erbij:

```tsx
import { CreditCard } from 'lucide-react-native';
import { usePendingPaymentBookings } from '../../providers/SimpleDataProvider';
```

en in het component:

```tsx
  const pending = usePendingPaymentBookings();
```

Dezelfde hook als `app/admin/index.tsx` gebruikt, zodat het getal op beide tegels hetzelfde is.

Controleer of `ActionTile` een `badge`-prop heeft (`app/admin/index.tsx` geeft die mee); zo
niet, laat de badge dan weg en meld het.

- [ ] **Stap 2: Controleer**

Run: `npx tsc --noEmit && npm test`
Expected: geen fouten, alle tests groen.

- [ ] **Stap 3: Kijk het na in de browser**

Spelers → de tegel Betalingen staat naast Voortgang toevoegen, met hetzelfde getal als in
Beheer, en opent `/admin/payments`. Voor een speler staat het hele blok er niet.

- [ ] **Stap 4: Commit**

```bash
git add app/players/index.tsx
git commit -m "feat(spelers): openstaande betalingen ook vanaf de spelerslijst

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Taak 6: De exports van Historiek naar Rapport

**Files:**
- Modify: `app/admin/reports.tsx`
- Lees: `app/agenda/historiek.tsx:76-160` (blijft in deze golf bestaan)

- [ ] **Stap 1: Neem het exportblok over**

`app/admin/reports.tsx` heeft `period`, `coachId` en `shown` (de lessen van de selectie) al.
Voeg toe:

```tsx
  // Eigen state: een mislukte download is geen opslagfout, dus hij hoort niet in de globale
  // error van de provider thuis. Zelfde keuze als op Historiek, waar deze knoppen vandaan
  // komen.
  const [exportError, setExportError] = useState<string | null>(null);

  const rows = useMemo(() => csvRows(shown, users, courts), [shown, users, courts]);
  const csvNaam = periodFilename(period, 'csv');
  const xlsxNaam = periodFilename(period, 'xlsx');

  // Twee vormen van dezelfde selectie, dus ook één plek waar het misgaan opgevangen wordt.
  async function exporteer(maak: () => Promise<void>): Promise<void> {
    try {
      await maak();
      setExportError(null);
    } catch {
      setExportError(t('Exporteren is niet gelukt. Probeer het opnieuw.'));
    }
  }
```

met erbij:

```tsx
import { Download } from 'lucide-react-native';
import { Button } from '../../components/ui/Button';
import { csvRows, toCsv, toXlsx } from '../../lib/csv';
import { shareCsv, shareXlsx, xlsxWordtOndersteund } from '../../lib/share';
import { periodFilename } from '../../lib/period';
```

(`periodFilename` komt bij de bestaande import uit `../../lib/period`.)

- [ ] **Stap 2: De knoppen onderaan het scherm**

Onder de bestaande cijfers, vóór het einde van de `<Screen>`:

```tsx
      {/* De export draagt dezelfde bedragen als het scherm — prijs per les en loon van de
          trainer — dus hij staat achter dezelfde grens als de omzetkaarten. Een speler die
          dit scherm opent, krijgt zijn eigen cijfers en geen bestand. */}
      {coach ? (
        <View style={styles.exportBlock}>
          {/* Excel voorop: dat is wat een trainer opent. De CSV blijft ernaast staan voor
              wie het bestand ergens anders in laadt — een boekhoudpakket vraagt er nog vaak
              om. */}
          <View style={styles.exportRow}>
            {xlsxWordtOndersteund ? (
              <Button
                label={t('Excel')}
                variant="secondary"
                fullWidth={false}
                disabled={rows.length === 0}
                icon={<Download size={16} color={tennisColors.text} />}
                onPress={() => { void exporteer(() => shareXlsx(xlsxNaam, toXlsx(rows))); }}
              />
            ) : null}
            <Button
              label={t('CSV')}
              variant="secondary"
              fullWidth={false}
              disabled={rows.length === 0}
              icon={<Download size={16} color={tennisColors.text} />}
              onPress={() => { void exporteer(() => shareCsv(csvNaam, toCsv(rows))); }}
            />
          </View>
          {exportError ? <Text style={styles.error}>{exportError}</Text> : null}
        </View>
      ) : null}
```

Neem de bijbehorende stijlen over uit `app/agenda/historiek.tsx` (`exportBlock`, `exportRow`,
`error`) en voeg ze toe aan de `StyleSheet` van `reports.tsx`, met een andere naam als er al
een stijl met die naam staat.

Controleer de precieze aanroepvorm van `shareCsv` en `shareXlsx` in
`app/agenda/historiek.tsx` en neem die letterlijk over.

**Let op één verschil met Historiek, en dat is met opzet:** Historiek exporteerde alleen wat
geweest was (`pastBookings`), Rapport exporteert zijn hele periode — dus ook de lessen die
deze maand nog moeten komen. Dat is de selectie die het scherm zelf toont, en een export die
iets anders bevat dan wat erboven staat, is precies wat we niet willen.

- [ ] **Stap 3: Controleer**

Run: `npx tsc --noEmit && npm test`
Expected: geen fouten, alle tests groen.

- [ ] **Stap 4: Kijk het na in de browser**

Beheer → Rapport: kies een periode, download de Excel en de CSV, en controleer dat het aantal
regels klopt met het aantal lessen op het scherm. Een lege periode geeft grijze knoppen.

- [ ] **Stap 5: Commit**

```bash
git add app/admin/reports.tsx
git commit -m "feat(rapport): de bestanden van Historiek horen bij de cijfers

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Taak 7: De clubbrede agenda-export in Beheer → Kalender

**Files:**
- Modify: `lib/ics.ts`
- Modify: `lib/ics.test.ts`
- Modify: `app/admin/kalender.tsx`

- [ ] **Stap 1: Schrijf de falende tests voor `clubAgenda`**

Zet onderaan `lib/ics.test.ts` bij (neem de hulpfunctie voor een les over uit dat bestand;
heet ze daar anders, gebruik dan die naam):

```ts
describe('clubAgenda', () => {
  const nu = new Date(2026, 8, 9, 12);
  const les = (id: string, dag: number, coach: string, over: Partial<Booking> = {}): Booking => ({
    id,
    player_id: 'mathis',
    coach_id: coach,
    court_id: 'baan2',
    start_time: new Date(2026, 8, dag, 17).toISOString(),
    end_time: new Date(2026, 8, dag, 18).toISOString(),
    status: 'confirmed',
    payment_method: 'open',
    ...over,
  });

  it('neemt alleen mee wat nog moet komen', () => {
    const geweest = les('oud', 1, 'koen');
    const komt = les('nieuw', 20, 'koen');
    expect(clubAgenda([geweest, komt], null, nu).map((b) => b.id)).toEqual(['nieuw']);
  });

  it('laat geannuleerde lessen weg', () => {
    const weg = les('weg', 20, 'koen', { status: 'cancelled' });
    expect(clubAgenda([weg], null, nu)).toEqual([]);
  });

  it('geeft ze op tijd oplopend', () => {
    const laat = les('laat', 25, 'koen');
    const vroeg = les('vroeg', 20, 'koen');
    expect(clubAgenda([laat, vroeg], null, nu).map((b) => b.id)).toEqual(['vroeg', 'laat']);
  });

  it('bakt af op één trainer als daarom gevraagd wordt', () => {
    const vanKoen = les('k', 20, 'koen');
    const vanJan = les('j', 21, 'jan');
    expect(clubAgenda([vanKoen, vanJan], 'jan', nu).map((b) => b.id)).toEqual(['j']);
  });

  it('geeft alle trainers als er geen gekozen is', () => {
    const vanKoen = les('k', 20, 'koen');
    const vanJan = les('j', 21, 'jan');
    expect(clubAgenda([vanKoen, vanJan], null, nu)).toHaveLength(2);
  });
});
```

- [ ] **Stap 2: Draai de tests en zie ze falen**

Run: `npx jest lib/ics.test.ts`
Expected: FAIL — "clubAgenda is not a function".

- [ ] **Stap 3: Schrijf de implementatie**

In `lib/ics.ts`:

```ts
/**
 * De lessen voor de clubbrede export: alles wat nog moet komen, van de hele club of van één
 * trainer.
 *
 * Anders dan de persoonlijke export gaat deze niet over wie er kijkt maar over wie er
 * lesgeeft — de beheerder maakt hem voor de club of voor één collega. Wat geweest is gaat er
 * niet in: dit bestand komt in een agenda terecht, en een agenda gaat vooruit.
 */
export function clubAgenda(
  bookings: Booking[],
  coachId: string | null,
  now: Date = new Date(),
): Booking[] {
  const moment = now.getTime();
  return bookings
    .filter((b) => b.status !== 'cancelled')
    .filter((b) => coachId === null || b.coach_id === coachId)
    .filter((b) => {
      const start = new Date(b.start_time).getTime();
      return Number.isFinite(start) && start >= moment;
    })
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
}
```

- [ ] **Stap 4: Draai de tests en zie ze slagen**

Run: `npx jest lib/ics.test.ts`
Expected: PASS, de bestaande tests plus vijf nieuwe.

- [ ] **Stap 5: Zet de export op het scherm**

`app/admin/kalender.tsx` bestaat uit twee helften met een `SectieKop` erboven. Voeg onderaan
een derde toe:

```tsx
      <SectieKop titel={t('Agenda-bestand')} icoon={<CalendarPlus size={18} color={tennisColors.primary} />} />

      <Card style={styles.exportKaart}>
        {/* Alle lessen van de club, of die van één trainer. De persoonlijke variant staat in
            het dossier van de speler zelf: die gaat over jouw lessen, deze over de club. */}
        <CoachFilter coaches={coaches} value={exportCoach} onChange={setExportCoach} />
        <Text style={styles.exportTelling}>
          {teExporteren.length === 1
            ? t('1 geplande les')
            : t('{n} geplande lessen', { n: teExporteren.length })}
        </Text>
        <Button
          label={t('Agenda-bestand (.ics)')}
          variant="secondary"
          disabled={teExporteren.length === 0}
          icon={<CalendarPlus size={16} color={tennisColors.text} />}
          onPress={() => { void exporteerAgenda(); }}
        />
        {exportFout ? <Text style={styles.exportFout}>{exportFout}</Text> : null}
        <Text style={styles.exportNoot}>
          {t('Het bestand bevat precies de lessen die hierboven geteld zijn, klaar om in '
            + 'Outlook, Google Agenda of Apple Agenda te openen. Exporteer je later opnieuw, '
            + 'dan werkt je agenda dezelfde afspraken bij in plaats van ze een tweede keer '
            + 'toe te voegen.')}
        </Text>
      </Card>
```

met daarboven in het component:

```tsx
  const { currentUser, users, courts, bookings } = useSimpleData();
  const coaches = useMemo(() => coachesOf(users), [users]);
  const [exportCoach, setExportCoach] = useState<string | null>(null);
  const [exportFout, setExportFout] = useState<string | null>(null);

  const teExporteren = useMemo(
    () => clubAgenda(bookings, exportCoach, new Date()),
    [bookings, exportCoach],
  );

  async function exporteerAgenda(): Promise<void> {
    try {
      // Het moment van exporteren zit in het bestand (DTSTAMP en het volgnummer), dus dat is
      // `new Date()`: een bestand dat een uur oud zegt te zijn wint het niet van wat er al in
      // de agenda staat.
      await shareIcs(icsFilename(), toIcs(teExporteren, {
        users,
        courts,
        // De beheerder maakt dit bestand voor de club: in de titel hoort de speler te staan,
        // net als bij een trainer die zijn eigen agenda exporteert.
        viewerIsCoach: true,
      }));
      setExportFout(null);
    } catch {
      setExportFout(t('Exporteren is niet gelukt. Probeer het opnieuw.'));
    }
  }
```

en de imports:

```tsx
import { CalendarPlus } from 'lucide-react-native';
import { CoachFilter } from '../../components/ui/CoachFilter';
import { clubAgenda, icsFilename, toIcs } from '../../lib/ics';
import { shareIcs } from '../../lib/share';
```

(`coachesOf` komt uit `../../lib/hub`, dat het bestand al importeert; `Card` en `Button`
staan er ook al.) Voeg de stijlen `exportKaart`, `exportTelling`, `exportFout` en
`exportNoot` toe; kijk voor de maten naar de andere stijlen in dat bestand.

- [ ] **Stap 6: Controleer**

Run: `npx tsc --noEmit && npm test`
Expected: geen fouten, alle tests groen.

- [ ] **Stap 7: Kijk het na in de browser**

Beheer → Kalender: onderaan staat het agenda-bestand. Download hem voor de hele club, kies
dan één trainer en download opnieuw; het aantal lessen boven de knop hoort mee te veranderen.

- [ ] **Stap 8: Commit**

```bash
git add lib/ics.ts lib/ics.test.ts app/admin/kalender.tsx
git commit -m "feat(kalender): een agenda-bestand voor de hele club

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Taak 8: De persoonlijke agenda-export in het spelersdossier

**Files:**
- Modify: `app/players/[id].tsx`

- [ ] **Stap 1: De knop in het blad Lesdagen**

In het blad `Lesdagen` staat de lijst `upcoming` onder de kop "Aankomend". Zet de knop
daarboven, en de twee zinnen uitleg onder de lijst:

```tsx
            {upcoming.length > 0 ? (
              <>
                <Text style={styles.subLabel}>{t('Aankomend')}</Text>
                {/* Boven de lijst: met een seizoen aan lessen erin scrol je anders langs
                    tientallen regels voor je de knop ziet, en dan lijkt de export er niet te
                    zijn. */}
                <Button
                  label={t('Agenda-bestand (.ics)')}
                  variant="secondary"
                  icon={<CalendarPlus size={16} color={tennisColors.text} />}
                  onPress={() => { void exporteerAgenda(); }}
                />
                {icsFout ? <Text style={styles.error}>{icsFout}</Text> : null}
```

en onder de lijst met aankomende lessen, binnen dezelfde `<>`:

```tsx
                <Text style={styles.muted}>
                  {t('Het bestand bevat precies de lessen die je hier ziet, klaar om in '
                    + 'Outlook, Google Agenda of Apple Agenda te openen. Exporteer je later '
                    + 'opnieuw, dan werkt je agenda dezelfde afspraken bij in plaats van ze '
                    + 'een tweede keer toe te voegen.')}
                </Text>
                <Text style={styles.muted}>
                  {t('Een les die na je export geannuleerd wordt, verdwijnt niet vanzelf uit '
                    + 'je agenda — die haal je daar zelf weg.')}
                </Text>
```

- [ ] **Stap 2: De stand en de handeling**

Bij de andere `useState`-regels:

```tsx
  // Eigen state: een mislukte download is geen opslagfout, dus hij hoort niet in de globale
  // error van de provider thuis.
  const [icsFout, setIcsFout] = useState<string | null>(null);
```

En bij de andere hulpfuncties in het component:

```tsx
  /** Zijn aankomende lessen als agendabestand — precies de lijst die eronder staat. */
  async function exporteerAgenda(): Promise<void> {
    try {
      await shareIcs(icsFilename(), toIcs(upcoming, {
        users,
        courts,
        // Een trainer leest de naam van zijn speler in de titel, een speler die van zijn
        // trainer — dezelfde regel als op de leskaarten.
        viewerIsCoach: coach,
      }));
      setIcsFout(null);
    } catch {
      setIcsFout(t('Exporteren is niet gelukt. Probeer het opnieuw.'));
    }
  }
```

met de imports:

```tsx
import { CalendarPlus } from 'lucide-react-native';
import { icsFilename, toIcs } from '../../lib/ics';
import { shareIcs } from '../../lib/share';
```

(`CalendarPlus` staat al in de lucide-import van dit bestand; `Button` ook.) Bestaat de stijl
`error` nog niet in dit bestand, voeg hem dan toe:
`error: { color: tennisColors.danger, fontSize: 14 }`.

- [ ] **Stap 3: Controleer**

Run: `npx tsc --noEmit && npm test`
Expected: geen fouten, alle tests groen.

- [ ] **Stap 4: Kijk het na in de browser**

Open het dossier van Mathis → Lesdagen → download het `.ics`-bestand en controleer dat het
aantal afspraken klopt met de lijst Aankomend eronder.

- [ ] **Stap 5: Commit**

```bash
git add "app/players/[id].tsx"
git commit -m "feat(dossier): je eigen lessen in je eigen agenda

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Golf 2 — de tab opheffen

### Taak 9: De vier schermen, hun routes en de tab

**Files:**
- Delete: `app/agenda/index.tsx`, `app/agenda/overzicht.tsx`, `app/agenda/historiek.tsx`, `app/agenda/komend.tsx`
- Modify: `app/_layout.tsx`
- Modify: `components/ui/TabBar.tsx`

- [ ] **Stap 1: Controleer eerst dat niets er nog heen wijst**

```bash
grep -rn "'/agenda'\|\"/agenda\"\|agenda/overzicht\|agenda/historiek\|agenda/komend" app components lib providers
```

Expected: geen treffers behalve in `components/ui/TabBar.tsx` (de tab zelf) en in de vier
bestanden die je gaat verwijderen. Vind je er nog een, los die dan eerst op — taak 3 tot 8
horen elke weg te hebben vervangen.

- [ ] **Stap 2: Weg ermee**

```bash
git rm app/agenda/index.tsx app/agenda/overzicht.tsx app/agenda/historiek.tsx app/agenda/komend.tsx
```

In `app/_layout.tsx` verdwijnen vier regels uit de schermenlijst:

```tsx
  { name: 'agenda/index', title: t('Agenda') },
  { name: 'agenda/overzicht', title: t('Overzicht') },
  { name: 'agenda/historiek', title: t('Historiek') },
  { name: 'agenda/komend', title: t('Nog te komen') },
```

en `'agenda/index'` verdwijnt uit de `HEADLESS`-verzameling.

In `components/ui/TabBar.tsx` verdwijnt uit `coachTabs`:

```tsx
  { label: t('Agenda'), href: '/agenda', icon: CalendarDays, segment: 'agenda' },
```

Laat `playerTabs` ongemoeid: de tab Reserveren wijst naar `/agenda/new`, dat blijft bestaan,
en zijn `segment: 'agenda'` blijft daardoor kloppen. Haal `CalendarDays` uit de import als
niemand in dat bestand hem nog gebruikt.

- [ ] **Stap 3: Controleer**

```bash
grep -rn "agenda/index\|agenda/overzicht\|agenda/historiek\|agenda/komend" app components lib providers
npx tsc --noEmit
npm test
```

Expected: geen treffers, geen typefouten, alle tests groen.

Kijk in `/tmp/expo-dev.log` dat Metro schoon bundelt en er geen "unmatched route" verschijnt.

- [ ] **Stap 4: Kijk het na in de browser**

Als trainer: vier tabs onderaan (Home, Spelers, Trainers, Beheer). Als speler: Reserveren
werkt nog. `/agenda` met de hand in de adresbalk typen geeft de gewone "pagina niet
gevonden", niet een leeg scherm.

- [ ] **Stap 5: Commit**

```bash
git add -A app/agenda app/_layout.tsx components/ui/TabBar.tsx
git commit -m "refactor(agenda): de tab is opgeheven

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Taak 10: De stand van zaken, de volledige controle en live

**Files:**
- Modify: `OPENSTAAND.md`

- [ ] **Stap 1: Werk de stand van zaken bij**

Zet in de tabel met de vier stukken stuk 4 op **af**, en vervang de inleidende alinea van dat
blok ("De Agenda-tab wordt opgeheven — vier stukken") door een korte terugblik: waar de zeven
schermen terechtgekomen zijn (Home, Spelers, Beheer en de dossiers), en dat `/agenda/new` als
enige is blijven staan omdat het de tab Reserveren van een speler is.

Werk ook het aantal tests bij als dat veranderd is (zie de uitvoer van `npm test`).

- [ ] **Stap 2: De volledige controle**

```bash
npx tsc --noEmit && npm test && npx expo export --platform web --output-dir .webbuild-check && rm -rf .webbuild-check
```

Expected: geen typefouten, alle tests groen, de webbuild slaagt.

- [ ] **Stap 3: Commit en live**

```bash
git add OPENSTAAND.md
git commit -m "docs: de Agenda-tab is opgeheven, stuk 4 is af

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git push
```

Elke push naar `main` bouwt en zet de site online
(<https://leemanskoen1978-sys.github.io/tennis-app/>).

- [ ] **Stap 4: Met de hand nalopen op de echte site**

1. Als trainer met een openstaande aanvraag: Home toont hem bovenaan, Goedkeuren werkt, en
   de les staat daarna in de lesdag.
2. Als speler een les aanvragen → Home toont "Wacht op goedkeuring".
3. Als speler met een les vandaag: Home toont die les. Zonder les vandaag: zijn
   eerstvolgende.
4. Home → Mijn agenda opent je eigen dossier, voor allebei de rollen; het openstaand saldo
   ook.
5. Spelers → Betalingen opent de openstaande lessen, met het juiste aantal op de badge.
6. Beheer → Rapport: een periode kiezen en de CSV en de Excel downloaden.
7. Beheer → Kalender: het `.ics`-bestand voor de hele club, en daarna voor één trainer.
8. Een spelersdossier → Lesdagen → het `.ics`-bestand met precies zijn aankomende lessen.
9. Geen enkele weg leidt nog naar `/agenda`; Reserveren en Nieuwe afspraak werken nog.
