# De weekagenda naar de dossiers — implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Het weekraster verhuist van `/agenda/week` naar een tegel met een blad in het spelersdossier en het trainersdossier, en de namen op Home worden een doorklik naar het spelersdossier.

**Architecture:** `lib/week.ts` en de tekening in `components/WeekRaster.tsx` blijven; alleen de omhulling verhuist naar een nieuw `components/Weekagenda.tsx` dat zijn lessen als prop krijgt. Het lesdetail gaat uit het raster naar het dossier, want een `DetailSheet` neemt zijn inhoud mee als hij sluit. Eén regel gaat naar `lib/` met tests: waar het eigen dossier van een gebruiker staat.

**Tech Stack:** Expo Router, React Native (web), TypeScript, Jest. Nederlands in de UI en in commentaar; commentaar legt het *waarom* uit.

**Spec:** `docs/superpowers/specs/2026-09-09-weekagenda-in-de-dossiers-design.md`

**Voor elke commit** (afspraak uit `OPENSTAAND.md`):

```bash
npx tsc --noEmit && npm test
```

en vóór de laatste commit ook:

```bash
npx expo export --platform web --output-dir .webbuild-check && rm -rf .webbuild-check
```

De volgorde van de taken is niet vrij: de dev-server draait en herlaadt bij elke opslag, dus
`app/agenda/week.tsx` mag pas weg (taak 6) als `components/Weekagenda.tsx` bestaat (taak 3).

---

### Taak 1: `dossierPad` — waar het eigen dossier van een gebruiker staat

**Files:**
- Create: `lib/dossier.ts`
- Create: `lib/dossier.test.ts`

- [ ] **Stap 1: Schrijf de falende test**

Maak `lib/dossier.test.ts`:

```ts
import type { User } from './types';
import { dossierPad } from './dossier';

function lid(over: Partial<User> & Pick<User, 'id' | 'role'>): User {
  return { name: over.id, email: `${over.id}@club.be`, ...over };
}

const trainer = lid({ id: 'koen', role: 'coach' });
const speler = lid({ id: 'lotte', role: 'player' });
const ouder = lid({ id: 'marc', role: 'player' });

describe('dossierPad', () => {
  it('stuurt een trainer naar zijn trainersdossier', () => {
    expect(dossierPad(trainer, trainer)).toBe('/coaches/koen');
  });

  it('stuurt een speler naar zijn spelersdossier', () => {
    expect(dossierPad(speler, speler)).toBe('/players/lotte');
  });

  it('stuurt een ouder naar het dossier van het kind dat hij koos', () => {
    expect(dossierPad(ouder, speler)).toBe('/players/lotte');
  });

  // Een trainer is soms ook gewoon vader. Kijkt hij naar zijn kind, dan is de vraag "wiens
  // week is dit" beantwoord met dat kind en niet met zijn eigen lesrooster.
  it('stuurt een trainer die naar zijn kind kijkt naar het kind', () => {
    expect(dossierPad(trainer, speler)).toBe('/players/lotte');
  });

  it('heeft zonder ingelogde gebruiker geen bestemming', () => {
    expect(dossierPad(null, null)).toBeNull();
  });

  // Een speler zonder actieve speler komt niet voor, maar een pad naar `/players/undefined`
  // wél als niemand die vraag stelt.
  it('heeft zonder speler nog altijd het eigen dossier', () => {
    expect(dossierPad(speler, null)).toBe('/players/lotte');
  });
});
```

- [ ] **Stap 2: Draai de test en zie hem falen**

Run: `npx jest lib/dossier.test.ts`
Expected: FAIL — "Cannot find module './dossier'".

- [ ] **Stap 3: Schrijf de kleinst mogelijke implementatie**

Maak `lib/dossier.ts`:

```ts
// Waar het dossier van iemand staat.
//
// Sinds de weekagenda in de dossiers woont, is "mijn dossier" een bestemming geworden en
// niet langer alleen een scherm dat een trainer opent voor iemand anders. Wie waar terecht
// komt is een regel — een trainer heeft een trainersdossier, iedereen anders een
// spelersdossier — en geen opmaak, dus hij staat hier en niet in een scherm.
//
// Niet in lib/rechten.ts: dat bestand beantwoordt "mag het", en dit is "waarheen".

import { isCoach } from './rechten';
import type { User } from './types';

/**
 * Het pad naar het dossier waar deze gebruiker zijn eigen lessen terugvindt.
 *
 * `speler` is de actieve speler (`useActieveSpeler`): voor iedereen zichzelf, en voor een
 * ouder het kind dat hij koos. Wijkt die af van de ingelogde gebruiker, dan is dát het
 * dossier dat hij zoekt — ook als hij zelf trainer is, want op dat moment is hij vader.
 *
 * `null` als er niemand is ingelogd; het scherm hoort dan geen knop te tonen.
 */
export function dossierPad(user: User | null, speler: User | null): string | null {
  if (!user) return null;
  if (speler && speler.id !== user.id) return `/players/${speler.id}`;
  return isCoach(user) ? `/coaches/${user.id}` : `/players/${user.id}`;
}
```

- [ ] **Stap 4: Draai de test en zie hem slagen**

Run: `npx jest lib/dossier.test.ts`
Expected: PASS, 6 tests.

- [ ] **Stap 5: Commit**

```bash
npx tsc --noEmit && npm test
git add lib/dossier.ts lib/dossier.test.ts
git commit -m "feat(dossier): waar het eigen dossier van een gebruiker staat

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Taak 2: Het lesdetail uit `WeekRaster`

Het raster opent het lesdetail nu zelf. In een blad kan dat niet: een `DetailSheet` tekent
zijn inhoud alleen zolang hij zichtbaar is, dus zodra het weekblad sluit verdwijnt het
lesdetail mee. Het raster geeft de les voortaan naar boven door.

**Files:**
- Modify: `components/WeekRaster.tsx`
- Modify: `app/agenda/week.tsx` (blijft in deze taak werken; verdwijnt pas in taak 6)

- [ ] **Stap 1: Geef `WeekRaster` de nieuwe prop en haal het blad eruit**

In `components/WeekRaster.tsx`:

Verwijder deze twee imports:

```ts
import { BookingDetailSheet } from './BookingDetailSheet';
import { useKindkeuze } from '../providers/kindkeuze';
```

Vervang de kop van het component:

```tsx
export function WeekRaster({
  rooster,
  now,
}: {
  rooster: Rooster;
  now: Date;
}): React.JSX.Element {
  const t = useT();
  const { currentUser, users, courts, settings, clearError } = useSimpleData();
  // De clubkalender: op een gesloten dag hoort het raster niet te doen alsof er uren vrij zijn.
  const vakanties = settings.vakanties ?? [];
  const { kijktNaarZichzelf } = useKindkeuze();
  const { width } = useWindowDimensions();
  const [openBooking, setOpenBooking] = useState<Booking | null>(null);
```

door:

```tsx
export function WeekRaster({
  rooster,
  now,
  onBookingPress,
}: {
  rooster: Rooster;
  now: Date;
  /**
   * Een lesblok is aangetikt. Het raster opent het lesdetail niet zelf: het staat in een
   * blad, en een Modal binnen een gesloten Modal wordt niet meer getekend. Wie het raster
   * plaatst, tekent het lesdetail op schermniveau.
   */
  onBookingPress: (booking: Booking) => void;
}): React.JSX.Element {
  const t = useT();
  const { currentUser, users, courts, settings } = useSimpleData();
  // De clubkalender: op een gesloten dag hoort het raster niet te doen alsof er uren vrij zijn.
  const vakanties = settings.vakanties ?? [];
  const { width } = useWindowDimensions();
```

Verwijder `useState` uit de React-import als hij nergens anders meer gebruikt wordt:

```ts
import React from 'react';
```

Vervang in het lesblok:

```tsx
                        onPress={() => {
                          clearError();
                          setOpenBooking(b);
                        }}
```

door:

```tsx
                        onPress={() => onBookingPress(b)}
```

Verwijder onderaan het hele blok:

```tsx
      <BookingDetailSheet
        booking={openBooking}
        visible={openBooking !== null}
        canManage={isCoach(currentUser) && kijktNaarZichzelf}
        onClose={() => {
          clearError();
          setOpenBooking(null);
        }}
      />
```

De omhullende `<>…</>` mag dan weg: `return (<View style={styles.raster}> … </View>);`.

`isCoach` en `Booking` blijven geïmporteerd — `isCoach` voor de naam in het blok, `Booking`
voor de nieuwe prop.

- [ ] **Stap 2: Laat `app/agenda/week.tsx` het lesdetail zelf tekenen**

Dit scherm verdwijnt in taak 6, maar mag nu niet breken (de dev-server draait). In
`app/agenda/week.tsx`:

```tsx
import { BookingDetailSheet } from '../../components/BookingDetailSheet';
import { useKindkeuze } from '../../providers/kindkeuze';
import { isCoach } from '../../lib/rechten';
import type { Booking } from '../../lib/types';
```

```tsx
  const { currentUser, error, clearError } = useSimpleData();
  const { kijktNaarZichzelf } = useKindkeuze();
  const [openBooking, setOpenBooking] = useState<Booking | null>(null);
```

```tsx
      <WeekRaster
        rooster={rooster}
        now={now}
        onBookingPress={(b) => { clearError(); setOpenBooking(b); }}
      />

      <BookingDetailSheet
        booking={openBooking}
        visible={openBooking !== null}
        canManage={isCoach(currentUser) && kijktNaarZichzelf}
        onClose={() => { clearError(); setOpenBooking(null); }}
      />
```

- [ ] **Stap 3: Controleer**

Run: `npx tsc --noEmit && npm test`
Expected: geen fouten, 1794 tests groen (er verandert niets aan `lib/`).

- [ ] **Stap 4: Kijk het na in de browser**

Open <http://localhost:8081/agenda/week>, tik een lesblok aan: het lesdetail hoort te openen
en te sluiten zoals eerst.

- [ ] **Stap 5: Commit**

```bash
git add components/WeekRaster.tsx app/agenda/week.tsx
git commit -m "refactor(week): het lesdetail hoort bij wie het raster plaatst

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Taak 3: `components/Weekagenda.tsx`

De omhulling van het weekscherm — de kiezer, "Deze week", de urenregel en het raster —
wordt een component dat zijn lessen als prop krijgt. Zonder trainerbalk: in een dossier is
"van wie zijn deze lessen" al beantwoord.

**Files:**
- Create: `components/Weekagenda.tsx`
- Modify: `app/agenda/week.tsx`

- [ ] **Stap 1: Maak het component**

Maak `components/Weekagenda.tsx`:

```tsx
// De weekagenda: hoe vol staat de week van deze persoon. Geen telling van lessen maar van
// uren — een les van een half uur en een les van twee uur zijn allebei "één les", en dat is
// precies wat je hier níet wilt weten. Geannuleerde lessen staan er niet tussen: die kosten
// geen uur op de baan.
//
// Het beeld is een kalender en geen lijst: zeven kolommen naast een uren-as, elke les een
// blok waarvan de hoogte zijn duur is. Een lijst zegt wel hoeveel uur er staat, maar niet
// hoe die uren liggen — en of je week vol is, zie je juist aan de gaten. Het raster zelf
// staat in components/WeekRaster, het rekenwerk in lib/week.
//
// De lessen komen van buiten: dit component vraagt niet wie mag kijken. Het dossier waarin
// het staat heeft die vraag al beantwoord, en dat is ook waarom de trainerbalk hier niet
// meer staat.
//
// De gekozen week woont buiten dit component. Het staat in een blad, en een blad wordt
// weggegooid zodra het sluit — dan zou je na het bekijken van één les weer op deze week
// staan terwijl je drie weken vooruit keek.

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import { WeekRaster } from './WeekRaster';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Chip } from './ui/Chip';
import { shiftPeriod, periodLabel, type Period } from '../lib/period';
import {
  formatUren, isDezeWeek, weekAgenda, weekLessen, weekMinuten, weekPeriod, weekRooster,
} from '../lib/week';
import type { Booking } from '../lib/types';
import { tennisColors } from '../constants/tennis-colors';
import { spacing, typography } from '../constants/theme';
import { useT } from '../lib/i18n';

export function Weekagenda({
  bookings,
  week,
  onWeek,
  onBookingPress,
}: {
  /** De lessen van de persoon over wie dit dossier gaat, geannuleerde eruit. */
  bookings: Booking[];
  week: Period;
  onWeek: (week: Period) => void;
  onBookingPress: (booking: Booking) => void;
}): React.JSX.Element {
  const t = useT();

  // Eén moment voor het hele blok, net als op Historiek: anders kan "deze week" tijdens het
  // kijken van betekenis veranderen.
  const now = useMemo(() => new Date(), []);

  const dagen = useMemo(() => weekAgenda(bookings, week), [bookings, week]);
  const rooster = useMemo(() => weekRooster(dagen), [dagen]);
  const minuten = weekMinuten(dagen);
  const lessen = weekLessen(dagen);

  return (
    <View style={styles.blok}>
      {/* De drie delen blijven als groep bij elkaar, zoals in de periodekiezer. */}
      <View style={styles.pagerRow}>
        <Button
          label={t('Vorige')}
          variant="secondary"
          fullWidth={false}
          icon={<ChevronLeft size={16} color={tennisColors.text} />}
          onPress={() => onWeek(shiftPeriod(week, -1))}
        />
        <Text style={styles.weekLabel}>{periodLabel(week)}</Text>
        <Button
          label={t('Volgende')}
          variant="secondary"
          fullWidth={false}
          icon={<ChevronRight size={16} color={tennisColors.text} />}
          onPress={() => onWeek(shiftPeriod(week, 1))}
        />
      </View>

      {/* Terug naar nu, zonder te tellen hoeveel weken je vooruit bent gebladerd. */}
      <View style={styles.chipRow}>
        <Chip
          label={t('Deze week')}
          selected={isDezeWeek(week, now)}
          onPress={() => onWeek(weekPeriod(now))}
        />
      </View>

      <Card>
        <Text style={styles.total}>
          {t('{uren} geboekt', { uren: formatUren(minuten) })}
          {' · '}
          {lessen === 1 ? t('1 les') : t('{n} lessen', { n: lessen })}
        </Text>
        <Text style={styles.totalNote}>
          {t('Geannuleerde lessen tellen niet mee en staan er niet tussen.')}
        </Text>
      </Card>

      {/* Het raster tekent alle zeven dagen, ook de lege: juist het gat op donderdag is
          iets wat je wilt zien als je naar een week kijkt. */}
      <WeekRaster rooster={rooster} now={now} onBookingPress={onBookingPress} />

      {lessen === 0 ? (
        <Text style={styles.leeg}>{t('Geen lessen deze week.')}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  blok: { gap: spacing.md },
  pagerRow: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center',
    justifyContent: 'center', gap: spacing.md,
  },
  // Een minimumbreedte, zodat de knoppen niet verspringen als "1 sep – 7 sep 2026" korter
  // uitvalt dan "28 dec 2026 – 3 jan 2027".
  weekLabel: { ...typography.h3, color: tennisColors.text, minWidth: 190, textAlign: 'center' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  total: { ...typography.body, color: tennisColors.text, fontWeight: '600' },
  totalNote: { ...typography.label, color: tennisColors.textMuted, marginTop: spacing.xs },
  leeg: { ...typography.body, color: tennisColors.textMuted, textAlign: 'center' },
});
```

- [ ] **Stap 2: Laat `app/agenda/week.tsx` het component gebruiken**

Alles tussen `<Screen>` en `</Screen>` — behalve `<CoachFilter …/>`, de foutregel en het
lesdetail — wordt vervangen door:

```tsx
      <CoachFilter coaches={coaches} value={coachId} onChange={setCoachId} />

      <Weekagenda
        bookings={bookings}
        week={week}
        onWeek={setWeek}
        onBookingPress={(b) => { clearError(); setOpenBooking(b); }}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
```

De ongebruikte imports (`WeekRaster`, `Card`, `Chip`, `ChevronLeft`, `ChevronRight`,
`formatUren`, `weekAgenda`, `weekLessen`, `weekMinuten`, `weekRooster`, `periodLabel`,
`shiftPeriod`) gaan eruit; `weekPeriod` en `Period` blijven voor de weekstand.

- [ ] **Stap 3: Controleer**

Run: `npx tsc --noEmit && npm test`
Expected: geen fouten, alle tests groen.

- [ ] **Stap 4: Kijk het na in de browser**

<http://localhost:8081/agenda/week>: bladeren, "Deze week", de urenregel en het raster horen
zich te gedragen zoals eerst.

- [ ] **Stap 5: Commit**

```bash
git add components/Weekagenda.tsx app/agenda/week.tsx
git commit -m "refactor(week): de omhulling van de weekagenda wordt een component

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Taak 4: De tegel Weekagenda in het spelersdossier

**Files:**
- Modify: `app/players/[id].tsx`

- [ ] **Stap 1: Imports en stand**

Voeg toe:

```tsx
import { CalendarRange } from 'lucide-react-native';   // bij de bestaande lucide-import
import { BookingDetailSheet } from '../../components/BookingDetailSheet';
import { Weekagenda } from '../../components/Weekagenda';
import { useKindkeuze } from '../../providers/kindkeuze';
import { formatUren, weekAgenda, weekMinuten, weekPeriod } from '../../lib/week';
import type { Booking } from '../../lib/types';   // bij de bestaande type-import
```

Breid de sectielijst uit:

```tsx
type SectionKey = 'lesdagen' | 'week' | 'lesplan' | 'doelen' | 'administratie';
```

En bij de andere `useState`-regels:

```tsx
  const { kijktNaarZichzelf } = useKindkeuze();
  // De week woont hier en niet in het blad: een blad wordt weggegooid als het sluit, en het
  // sluit zodra je een les opent. Anders stond je daarna weer op deze week.
  const [week, setWeek] = useState<Period>(() => weekPeriod(new Date()));
  const [weekBooking, setWeekBooking] = useState<Booking | null>(null);
```

- [ ] **Stap 2: De tegel**

Onder de bestaande berekening van `lesdagenSummary`:

```tsx
  // Dezelfde som als in het blad erachter (lib/week), zodat de tegel geen ander aantal uren
  // belooft dan wat je erachter te zien krijgt.
  const weekUren = formatUren(weekMinuten(weekAgenda(playerBookings, week)));
```

En in `tiles`, meteen na de tegel Lesdagen:

```tsx
    { key: 'lesdagen', title: t('Lesdagen'), subtitle: lesdagenSummary, icon: CalendarDays },
```

komt:

```tsx
    // Alleen voor wie dit dossier hoort te zien. Het scherm zelf staat vandaag nog open voor
    // medespelers (punt 10 in OPENSTAAND.md); daar hoort niet ook nog het weekritme van een
    // kind bij te komen. `magBewerken` is precies die test: trainer, jezelf, of de ouder.
    ...(magBewerken
      ? [{ key: 'week' as const, title: t('Weekagenda'), subtitle: t('{uren} deze week', { uren: weekUren }), icon: CalendarRange }]
      : []),
```

- [ ] **Stap 3: Het blad**

Meteen na het blad `Lesdagen` (`</DetailSheet>`):

```tsx
      {/* De week zoals ze ligt. Een les aantikken opent het lesdetail; dit blad sluit
          daarvoor, zie `stacked`. */}
      <DetailSheet title={t('Weekagenda')} visible={sheetOpen('week')} onClose={closeSheet}>
        <Weekagenda
          bookings={playerBookings}
          week={week}
          onWeek={setWeek}
          onBookingPress={setWeekBooking}
        />
      </DetailSheet>
```

- [ ] **Stap 4: Het lesdetail op schermniveau, en de stapel**

Breid `stacked` uit:

```tsx
  const stacked = progressOpen || openEntry !== null || openHorizon !== null
    || assignOpen || detailOpen || gegevensOpen || weekBooking !== null;
```

(neem de bestaande regel over en zet er `|| weekBooking !== null` achter — de opsomming in
het bestand kan afwijken van wat hier staat, de toevoeging is wat telt.)

En bij de andere bladen die op het scherm zelf staan, onderaan:

```tsx
      {/* Het lesdetail hoort bij het scherm en niet in het weekblad: een Modal binnen een
          gesloten Modal wordt niet meer getekend. Hetzelfde als de bladen hierboven. */}
      <BookingDetailSheet
        booking={weekBooking}
        visible={weekBooking !== null}
        canManage={coach && kijktNaarZichzelf}
        onClose={() => setWeekBooking(null)}
      />
```

- [ ] **Stap 5: Controleer**

Run: `npx tsc --noEmit && npm test`
Expected: geen fouten, alle tests groen.

- [ ] **Stap 6: Kijk het na in de browser**

Open als trainer een speler: de tegel Weekagenda staat er met de uren van deze week → tik →
bladeren werkt → tik een lesblok → het lesdetail staat er en het weekblad is dicht → sluit
het lesdetail → het weekblad staat er weer, op dezelfde week.

- [ ] **Stap 7: Commit**

```bash
git add "app/players/[id].tsx"
git commit -m "feat(dossier): de weekagenda van de speler

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Taak 5: De tegel Weekagenda in het trainersdossier

Dit scherm kent de stapel-regel nog niet; die komt hier erbij.

**Files:**
- Modify: `app/coaches/[id].tsx`

- [ ] **Stap 1: Imports en stand**

```tsx
import { CalendarRange } from 'lucide-react-native';   // bij de bestaande lucide-import
import { BookingDetailSheet } from '../../components/BookingDetailSheet';
import { Weekagenda } from '../../components/Weekagenda';
import { useKindkeuze } from '../../providers/kindkeuze';
import { isCoach } from '../../lib/rechten';   // naast isAdmin, magContactZien, magLoonZien
import { formatUren, weekAgenda, weekMinuten, weekPeriod } from '../../lib/week';
import type { Period } from '../../lib/period';
import type { Booking } from '../../lib/types';
```

```tsx
type SectionKey = 'agenda' | 'week' | 'spelers';
```

```tsx
  const { kijktNaarZichzelf } = useKindkeuze();
  // De week woont hier en niet in het blad: een blad wordt weggegooid als het sluit, en het
  // sluit zodra je een les opent.
  const [week, setWeek] = useState<Period>(() => weekPeriod(new Date()));
  const [weekBooking, setWeekBooking] = useState<Booking | null>(null);
```

- [ ] **Stap 2: De tegel**

Naast `agendaSummary`:

```tsx
  // Dezelfde som als in het blad erachter (lib/week): een tegel mag geen ander aantal uren
  // beloven dan wat je erachter vindt.
  const weekUren = formatUren(weekMinuten(weekAgenda(coachBookings, week)));
```

En in `tiles`, tussen Agenda en Spelers:

```tsx
  const tiles: Array<{ key: SectionKey; title: string; subtitle: string; icon: LucideIcon }> = [
    { key: 'agenda', title: t('Agenda'), subtitle: agendaSummary, icon: CalendarDays },
    { key: 'week', title: t('Weekagenda'), subtitle: t('{uren} deze week', { uren: weekUren }), icon: CalendarRange },
    { key: 'spelers', title: t('Spelers'), subtitle: spelersSummary, icon: Users },
  ];
```

Geen rolcontrole: `/coaches` staat alleen in de tabs van een trainer, en wanneer een trainer
lesgeeft staat al op de kop-kaart onder "Geeft les".

- [ ] **Stap 3: De stapel-regel**

Dit scherm opende tot nu toe nooit iets bovenop een blad. Vervang:

```tsx
  const closeSheet = () => setOpenSection(null);
```

door:

```tsx
  // Een blad dat iets bovenop zich opent, sluit zolang dat openstaat: twee bladen over
  // elkaar is rommelig, en op Android sluit één druk op terug ze allebei. `openSection`
  // blijft ondertussen staan, dus je komt terug waar je was. Zelfde truc als in het
  // spelersdossier.
  const stacked = weekBooking !== null;
  const sheetOpen = (key: SectionKey) => openSection === key && !stacked;
  const closeSheet = () => setOpenSection(null);
```

En vervang in de twee bestaande bladen `visible={openSection === 'agenda'}` door
`visible={sheetOpen('agenda')}`, en `visible={openSection === 'spelers'}` door
`visible={sheetOpen('spelers')}`.

- [ ] **Stap 4: Het blad en het lesdetail**

Na het blad `Agenda`:

```tsx
      <DetailSheet title={t('Weekagenda')} visible={sheetOpen('week')} onClose={closeSheet}>
        <Weekagenda
          bookings={coachBookings}
          week={week}
          onWeek={setWeek}
          onBookingPress={setWeekBooking}
        />
      </DetailSheet>
```

En vlak vóór de afsluitende `</Screen>`:

```tsx
      {/* Op schermniveau en niet in het blad: een Modal binnen een gesloten Modal wordt
          niet meer getekend. */}
      <BookingDetailSheet
        booking={weekBooking}
        visible={weekBooking !== null}
        canManage={isCoach(currentUser) && kijktNaarZichzelf}
        onClose={() => setWeekBooking(null)}
      />
```

- [ ] **Stap 5: Controleer**

Run: `npx tsc --noEmit && npm test`
Expected: geen fouten, alle tests groen.

- [ ] **Stap 6: Kijk het na in de browser**

Open Trainers → jezelf: de tegel Weekagenda met de uren van deze week; het blad, het
bladeren, het lesdetail en de terugkeer naar dezelfde week gedragen zich als in het
spelersdossier.

- [ ] **Stap 7: Commit**

```bash
git add "app/coaches/[id].tsx"
git commit -m "feat(dossier): de weekagenda van de trainer

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Taak 6: Het oude scherm opruimen

Nu pas: de dossiers werken, dus `/agenda/week` mag weg.

**Files:**
- Delete: `app/agenda/week.tsx`
- Modify: `app/_layout.tsx`
- Modify: `app/agenda/overzicht.tsx`

- [ ] **Stap 1: De tegel op Overzicht wijst naar het eigen dossier**

In `app/agenda/overzicht.tsx`:

```tsx
import { useActieveSpeler } from '../../providers/kindkeuze';
import { useSimpleData, useSchoneLei } from '../../providers/SimpleDataProvider';
import { dossierPad } from '../../lib/dossier';
```

```tsx
  const { currentUser } = useSimpleData();
  const speler = useActieveSpeler();
  // De weekagenda woont sinds stuk 3 in het dossier van de persoon zelf. Deze tegel blijft
  // staan omdat het voor een speler de enige weg naar zijn eigen dossier is.
  const pad = dossierPad(currentUser, speler);
```

En de derde tegel:

```tsx
        {pad ? (
          <ActionTile
            title={t('Weekagenda')}
            // Uren en niet lessen: dat is wat deze tegel toevoegt aan de twee erboven.
            subtitle={t('{uren} geboekt deze week', { uren: formatUren(weekMinutenNu) })}
            icon={CalendarRange}
            onPress={() => router.push(pad)}
          />
        ) : null}
```

- [ ] **Stap 2: Haal het scherm en zijn route weg**

```bash
rm app/agenda/week.tsx
```

In `app/_layout.tsx` verdwijnt de regel:

```tsx
  { name: 'agenda/week', title: t('Weekagenda') },
```

- [ ] **Stap 3: Controleer dat er niets meer naar verwijst**

Run: `grep -rn "agenda/week" app components lib providers`
Expected: geen enkele treffer.

Run: `npx tsc --noEmit && npm test`
Expected: geen fouten, alle tests groen.

- [ ] **Stap 4: Kijk het na in de browser**

Home → Mijn agenda → Overzicht → Weekagenda: je komt in je eigen dossier, met de tegel
Weekagenda erin. Als trainer in `/coaches/<jezelf>`, als speler in `/players/<jezelf>`.

- [ ] **Stap 5: Commit**

```bash
git add -A app/_layout.tsx app/agenda/overzicht.tsx
git add -A app/agenda
git commit -m "refactor(agenda): het weekscherm verhuist naar de dossiers

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Taak 7: De naam op Home wordt een doorklik

**Files:**
- Modify: `components/lesdag/Lesdag.tsx`

- [ ] **Stap 1: Maak de naam aanklikbaar**

Vervang in de lijst met deelnemers:

```tsx
                  <View key={id} style={styles.speler}>
                    <Text style={styles.naam} numberOfLines={1}>{naamVan(id)}</Text>
```

door:

```tsx
                  <View key={id} style={styles.speler}>
                    {/* De trainer heeft het kind voor zich staan en wil bij zijn doelen,
                        zijn voortgang of zijn week. Zonder deze tik is dat: terug naar
                        Home, naar Spelers, en de naam opzoeken in een lijst van 555. */}
                    <Pressable
                      onPress={() => router.push(`/players/${id}`)}
                      accessibilityRole="button"
                      accessibilityLabel={t('Dossier van {naam}', { naam: naamVan(id) })}
                      style={[styles.naamKnop, webCursor]}
                    >
                      <Text style={styles.naam} numberOfLines={1}>{naamVan(id)}</Text>
                    </Pressable>
```

en zet de bestaande `</View>` van de speler-rij op zijn plaats (er komt geen niveau bij:
de `Pressable` vervangt de `Text`, de `MemoKnop` blijft de tweede kind van de rij).

Voeg bij de stijlen toe:

```tsx
  // De tik moet ook naast de letters raak zijn; de naam mag krimpen als de memoknop breed is.
  naamKnop: { flexShrink: 1, paddingVertical: spacing.xs, paddingRight: spacing.sm },
```

De kop van de les blijft doen wat hij deed: openklappen en dichtklappen, ook bij een les met
één speler waar in die kop een naam staat. Twee betekenissen op één tik maken beide
onbetrouwbaar — niet aanpassen.

- [ ] **Stap 2: Controleer**

Run: `npx tsc --noEmit && npm test`
Expected: geen fouten, alle tests groen.

- [ ] **Stap 3: Kijk het na in de browser**

Home als trainer, een les met spelers openklappen, op een naam tikken: het dossier van dat
kind opent. De memoknop ernaast blijft werken en het openklappen van de les ook.

- [ ] **Stap 4: Commit**

```bash
git add components/lesdag/Lesdag.tsx
git commit -m "feat(home): de naam in een les opent het dossier

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Taak 8: De stand van zaken bijwerken en pushen

**Files:**
- Modify: `OPENSTAAND.md`

- [ ] **Stap 1: De tabel met de vier stukken**

Zet stuk 3 op **af**, en schrijf bij stuk 4 dat het gat gedicht is:

```markdown
| 3 | Weekagenda naar de dossiers van speler en trainer | **af** |
```

Vervang de alinea "**Het gat dat stuk 4 moet dichten:**" door:

```markdown
**Het gat dat stuk 4 moest dichten, is dicht.** De beheerder had maar één weg naar het
lesdetail van een oude les — Beheer → Lesgroepen → groep → les — en die werkt alleen voor
lessen die aan een lesgroep hangen. Sinds stuk 3 opent het weekraster in de dossiers
hetzelfde blad, en dat kent het verschil tussen een losse les en een groepsles niet: blader
naar de week van de les en tik hem aan.
```

Voeg bij "Wat er nog moet gebeuren" onder punt 10 (het spelersdossier staat open voor
medespelers) toe:

```markdown
    Sinds stuk 3 staat de tegel Weekagenda alleen in het dossier voor wie het hoort te zien
    (`magBewerken`). De rest van het scherm is nog niet dicht.
```

- [ ] **Stap 2: De volledige controle**

```bash
npx tsc --noEmit && npm test && npx expo export --platform web --output-dir .webbuild-check && rm -rf .webbuild-check
```

Expected: geen typefouten, alle tests groen, de webbuild slaagt.

- [ ] **Stap 3: Commit en push**

```bash
git add OPENSTAAND.md
git commit -m "docs: stuk 3 is af, het gat van stuk 4 is dicht

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git push
```

Elke push naar `main` bouwt en zet de site online
(<https://leemanskoen1978-sys.github.io/tennis-app/>).

- [ ] **Stap 4: Met de hand na te lopen op de echte site**

1. Als trainer een speler openen → Weekagenda → bladeren → een lesblok → lesdetail → sluiten
   → terug op dezelfde week.
2. Hetzelfde in het eigen trainersdossier.
3. Als beheerder een **losse** les van vorige maand opzoeken via het raster en daar de
   aanwezigheid rechtzetten. Dit is het gat uit stuk 4.
4. Als speler: Home → Mijn agenda → Overzicht → Weekagenda → je eigen dossier opent.
5. Op Home een les openklappen en op een naam tikken → het dossier van dat kind.
6. Als medespeler (een kind in een groepsles) het dossier van een ander kind openen: de
   tegel Weekagenda staat er niet.
