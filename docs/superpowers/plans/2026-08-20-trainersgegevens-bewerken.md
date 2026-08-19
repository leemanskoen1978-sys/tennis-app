# Trainersgegevens bewerken — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Een trainer kan zijn eigen e-mailadres, gsm, lesdagen, lesuren en uurtarief aanpassen, en de agenda houdt zich aan die dagen en uren.

**Architecture:** De regels over beschikbaarheid komen als pure functies in `lib/slots.ts` te staan, zodat ze los van elk scherm te testen zijn. De provider krijgt één `updateUser` erbij, in dezelfde vorm als het bestaande `updateLesson`. Het bewerkscherm is een bodemvenster naar het model van `UserManagement.tsx`. Het trainersdossier en het boekscherm consumeren beide de pure functies; ze bevatten zelf geen regels.

**Tech Stack:** Expo Router, React Native (web-first), TypeScript, Jest (`jest-expo`). Geen nieuwe dependencies.

**Spec:** `docs/superpowers/specs/2026-08-20-trainersgegevens-bewerken-design.md`

---

## Bestandsoverzicht

| Bestand | Actie | Verantwoordelijkheid |
| --- | --- | --- |
| `lib/slots.ts` | Wijzigen | Alle regels over wanneer een trainer boekbaar is. Pure functies, geen React. |
| `lib/slots.test.ts` | Wijzigen | Tests op die regels. |
| `providers/SimpleDataProvider.tsx` | Wijzigen | `updateUser` toevoegen. |
| `components/CoachDetailsModal.tsx` | Aanmaken | Het bewerkformulier als bodemvenster. |
| `app/coaches/[id].tsx` | Wijzigen | Dagen/uren tonen, Bewerken-knop voor je eigen dossier. |
| `app/agenda/new.tsx` | Wijzigen | Dagen en uurvakken beperken tot wat de trainer geeft. |

Voer de taken in volgorde uit. Taak 1 en 2 leveren allebei werkende, geteste code op zonder dat er al een scherm aan hangt.

---

## Task 1: Beschikbaarheidsregels in `lib/slots.ts`

**Files:**
- Modify: `lib/slots.ts`
- Test: `lib/slots.test.ts`

- [ ] **Step 1: Schrijf de falende tests**

Voeg onderaan `lib/slots.test.ts` toe, en pas de importregel bovenaan het bestand aan:

```ts
// Bovenaan het bestand — vervang de bestaande importregel:
import {
  generateSlots,
  isDateBookable,
  worksOnDay,
  slotsForCoach,
  formatWorkingDays,
  DAY_LABELS,
} from './slots';
```

```ts
// Onderaan het bestand toevoegen:
describe('worksOnDay', () => {
  // 2026-08-24 is een maandag, 2026-08-25 een dinsdag.
  const maandag = new Date('2026-08-24T10:00:00');
  const dinsdag = new Date('2026-08-25T10:00:00');

  it('treats a coach without working_days as available every day', () => {
    expect(worksOnDay({}, maandag)).toBe(true);
    expect(worksOnDay({}, dinsdag)).toBe(true);
  });

  it('treats an empty working_days list as available every day', () => {
    expect(worksOnDay({ working_days: [] }, maandag)).toBe(true);
  });

  it('allows a day that is in working_days', () => {
    expect(worksOnDay({ working_days: [1, 3, 5] }, maandag)).toBe(true);
  });

  it('blocks a day that is not in working_days', () => {
    expect(worksOnDay({ working_days: [1, 3, 5] }, dinsdag)).toBe(false);
  });

  it('counts Sunday as 0, like Date.getDay()', () => {
    const zondag = new Date('2026-08-23T10:00:00');
    expect(worksOnDay({ working_days: [0] }, zondag)).toBe(true);
    expect(worksOnDay({ working_days: [0] }, maandag)).toBe(false);
  });
});

describe('slotsForCoach', () => {
  it('gives the full club window to a coach without working_hours', () => {
    expect(slotsForCoach({}, '12:00')).toEqual(['09:00', '10:00', '11:00']);
  });

  it('drops slots before the start hour', () => {
    expect(slotsForCoach({ working_hours: { start: '11:00', end: '21:00' } }, '13:00'))
      .toEqual(['11:00', '12:00']);
  });

  it('drops slots from the end hour onwards', () => {
    expect(slotsForCoach({ working_hours: { start: '09:00', end: '11:00' } }, '13:00'))
      .toEqual(['09:00', '10:00']);
  });

  it('never gives more than the club allows', () => {
    expect(slotsForCoach({ working_hours: { start: '07:00', end: '23:00' } }, '12:00'))
      .toEqual(['09:00', '10:00', '11:00']);
  });

  it('gives nothing when start equals end', () => {
    expect(slotsForCoach({ working_hours: { start: '09:00', end: '09:00' } }, '21:00'))
      .toEqual([]);
  });
});

describe('formatWorkingDays', () => {
  it('says every day when nothing is set', () => {
    expect(formatWorkingDays({})).toBe('Elke dag');
    expect(formatWorkingDays({ working_days: [] })).toBe('Elke dag');
  });

  it('lists the days Monday first, whatever order they were stored in', () => {
    expect(formatWorkingDays({ working_days: [5, 1, 3] })).toBe('Ma · Wo · Vr');
  });

  it('puts Sunday last', () => {
    expect(formatWorkingDays({ working_days: [0, 1] })).toBe('Ma · Zo');
  });
});

describe('DAY_LABELS', () => {
  it('is indexed by Date.getDay(), so Sunday comes first', () => {
    expect(DAY_LABELS[0]).toBe('Zo');
    expect(DAY_LABELS[1]).toBe('Ma');
    expect(DAY_LABELS[6]).toBe('Za');
  });
});
```

- [ ] **Step 2: Draai de tests en controleer dat ze falen**

Run: `npx jest lib/slots.test.ts`
Expected: FAIL — `worksOnDay is not a function` (en dezelfde fout voor de andere nieuwe namen).

- [ ] **Step 3: Schrijf de implementatie**

Vervang de volledige inhoud van `lib/slots.ts` door:

```ts
import type { User } from './types';

/**
 * Weekday labels indexed by `Date.getDay()`, so Sunday is 0. `User.working_days` uses the
 * same numbering; keeping one counting scheme avoids a whole class of off-by-one bugs.
 */
export const DAY_LABELS = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'] as const;

/** Reading order for people: Monday first, Sunday last. Storage order stays getDay(). */
const DISPLAY_DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/** Hourly HH:00 slots from 09:00 up to (excluding) endTime, e.g. '21:00'. */
export function generateSlots(endTime: string): string[] {
  const startHour = 9;
  const endHour = parseInt(endTime.slice(0, 2), 10);
  const slots: string[] = [];
  for (let h = startHour; h < endHour; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`);
  }
  return slots;
}

/** Booking is not allowed on the day itself or in the past. */
export function isDateBookable(date: Date, now: Date = new Date()): boolean {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return d.getTime() > t.getTime();
}

/**
 * Does this coach teach on this weekday? Nothing set means every day: every coach that
 * existed before this field was used has it empty, and "empty = never" would make the
 * whole club unbookable overnight.
 */
export function worksOnDay(coach: Pick<User, 'working_days'>, date: Date): boolean {
  const days = coach.working_days;
  if (days === undefined || days.length === 0) return true;
  return days.includes(date.getDay());
}

/**
 * The slots this coach actually teaches: the club window narrowed by their own hours.
 * The club window is the outer bound — a coach cannot extend past it, only sit inside it.
 * Times are zero-padded 'HH:MM', so plain string comparison is chronological.
 */
export function slotsForCoach(
  coach: Pick<User, 'working_hours'>,
  clubEndTime: string,
): string[] {
  const club = generateSlots(clubEndTime);
  const hours = coach.working_hours;
  if (hours === undefined) return club;
  return club.filter((slot) => slot >= hours.start && slot < hours.end);
}

/** "Ma · Wo · Vr" for the profile card, or "Elke dag" when nothing is set. */
export function formatWorkingDays(coach: Pick<User, 'working_days'>): string {
  const days = coach.working_days;
  if (days === undefined || days.length === 0) return 'Elke dag';
  return DISPLAY_DAY_ORDER.filter((d) => days.includes(d))
    .map((d) => DAY_LABELS[d])
    .join(' · ');
}
```

- [ ] **Step 4: Draai de tests en controleer dat ze slagen**

Run: `npx jest lib/slots.test.ts`
Expected: PASS — alle beschrijvingen groen, inclusief de bestaande `generateSlots` en `isDateBookable`.

- [ ] **Step 5: Controleer de types**

Run: `npx tsc --noEmit`
Expected: geen uitvoer, exit 0.

- [ ] **Step 6: Commit**

```bash
git add lib/slots.ts lib/slots.test.ts
git commit -m "feat(slots): beschikbaarheid van een trainer als pure functies"
```

---

## Task 2: `updateUser` in de provider

**Files:**
- Modify: `providers/SimpleDataProvider.tsx`

Er is geen testopstelling voor de provider in dit project (de tests zitten allemaal op `lib/`), dus deze taak leunt op `tsc` en op de doorloop in taak 6. Voeg er geen testinfrastructuur voor toe.

- [ ] **Step 1: Zet de functie in het contracttype**

In `providers/SimpleDataProvider.tsx`, in `interface DataShape`, direct onder de regel `addUser: (u: Omit<User, 'id'>) => Promise<void>;`:

```ts
  /** `role` blijft erbuiten: van een trainer een speler maken raakt boekingen,
   *  lessen en voortgang, en is geen formulierdetail. */
  updateUser: (id: string, patch: Partial<Omit<User, 'id' | 'role'>>) => Promise<void>;
```

- [ ] **Step 2: Schrijf de implementatie**

In hetzelfde bestand, direct onder de bestaande `addUser`-callback (die eindigt op `}, [store, commit]);`):

```ts
  const updateUser = useCallback(
    async (id: string, patch: Partial<Omit<User, 'id' | 'role'>>) => {
      if (!store) return;
      await commit({
        ...store,
        users: store.users.map((u) => (u.id === id ? { ...u, ...patch } : u)),
      });
    },
    [store, commit],
  );
```

- [ ] **Step 3: Geef hem door in de context-waarde**

Twee plekken in het `useMemo`-blok onderaan de provider. In het object, direct onder `addUser,`:

```ts
    updateUser,
```

En in de dependency-array, in dezelfde regel als `addUser`, zodat die regel wordt:

```ts
    addBooking, updateBooking, deleteBooking, addUser, updateUser, addLesson,
```

- [ ] **Step 4: Controleer de types**

Run: `npx tsc --noEmit`
Expected: geen uitvoer, exit 0.

- [ ] **Step 5: Commit**

```bash
git add providers/SimpleDataProvider.tsx
git commit -m "feat(provider): updateUser om gebruikersgegevens te wijzigen"
```

---

## Task 3: Het bewerkscherm `CoachDetailsModal`

**Files:**
- Create: `components/CoachDetailsModal.tsx`

Dit is een presentatiecomponent met formulierlogica; er komt geen test bij. De regels die het waard zijn om te testen zitten in `lib/slots.ts` (taak 1).

- [ ] **Step 1: Maak het bestand aan**

Maak `components/CoachDetailsModal.tsx` met precies deze inhoud:

```tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal, View, Text, TextInput, Pressable, ScrollView, StyleSheet,
} from 'react-native';
import { X, Save } from 'lucide-react-native';
import { Chip } from './ui/Chip';
import { Button } from './ui/Button';
import { tennisColors } from '../constants/tennis-colors';
import { spacing, typography, radius, webCursor } from '../constants/theme';
import { useSimpleData } from '../providers/SimpleDataProvider';
import { generateSlots, DAY_LABELS } from '../lib/slots';
import type { User } from '../lib/types';

/** Reading order for the day toggles: Monday first, Sunday last. Values stay getDay(). */
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/**
 * A coach edits their own details. Only ever opened for the logged-in coach — the caller
 * decides that; this sheet does not check it a second time.
 */
export function CoachDetailsModal({
  coach, visible, onClose,
}: {
  coach: User;
  visible: boolean;
  onClose: () => void;
}) {
  const { updateUser, settings } = useSimpleData();

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [days, setDays] = useState<number[]>([]);
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [rate, setRate] = useState('');

  // Refill from the stored coach every time the sheet opens, so a cancelled edit
  // does not leak into the next one.
  useEffect(() => {
    if (!visible) return;
    setEmail(coach.email);
    setPhone(coach.phone ?? '');
    setDays(coach.working_days ?? []);
    setStart(coach.working_hours?.start ?? null);
    setEnd(coach.working_hours?.end ?? null);
    setRate(coach.hourly_rate !== undefined ? String(coach.hourly_rate) : '');
  }, [visible, coach]);

  // The club window bounds the choices, so an hour outside it cannot even be picked.
  const startOptions = useMemo(
    () => generateSlots(settings.booking_end_time),
    [settings.booking_end_time],
  );
  const endOptions = useMemo(
    () => [...startOptions.slice(1), settings.booking_end_time],
    [startOptions, settings.booking_end_time],
  );

  const toggleDay = (d: number) => {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  const clearHours = () => { setStart(null); setEnd(null); };

  const parsedRate = Number(rate.replace(',', '.'));
  const rateOk = rate.trim() === '' || (Number.isFinite(parsedRate) && parsedRate >= 0);
  // Half-filled hours are not a saveable state: you pick both, or neither.
  const hoursOk =
    (start === null && end === null) || (start !== null && end !== null && start < end);
  const canSave = email.trim().length > 0 && rateOk && hoursOk;

  const save = async () => {
    if (!canSave) return;
    await updateUser(coach.id, {
      email: email.trim(),
      phone: phone.trim() || undefined,
      working_days: days.length > 0 ? [...days].sort((a, b) => a - b) : undefined,
      working_hours: start !== null && end !== null ? { start, end } : undefined,
      hourly_rate: rate.trim() === '' ? undefined : parsedRate,
    });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Mijn gegevens</Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Sluiten"
              style={[styles.closeButton, webCursor]}
            >
              <X size={22} color={tennisColors.textMuted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body}>
            <Text style={styles.label}>E-mailadres</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="naam@club.be"
              placeholderTextColor={tennisColors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <Text style={styles.label}>Gsm</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="0470 12 34 56"
              placeholderTextColor={tennisColors.textMuted}
              keyboardType="phone-pad"
            />

            <Text style={styles.label}>Lesdagen</Text>
            <View style={styles.chipRow}>
              {DAY_ORDER.map((d) => (
                <Chip
                  key={d}
                  label={DAY_LABELS[d]}
                  selected={days.includes(d)}
                  onPress={() => toggleDay(d)}
                />
              ))}
            </View>
            <Text style={styles.helper}>
              Niets aangevinkt betekent: elke dag beschikbaar.
            </Text>

            <Text style={styles.label}>Lesuren</Text>
            <View style={styles.chipRow}>
              <Chip label="Hele dag" selected={start === null} onPress={clearHours} />
            </View>
            <Text style={styles.subLabel}>Van</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {startOptions.map((h) => (
                  <Chip key={h} label={h} selected={start === h} onPress={() => setStart(h)} />
                ))}
              </View>
            </ScrollView>
            <Text style={styles.subLabel}>Tot</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {endOptions.map((h) => (
                  <Chip key={h} label={h} selected={end === h} onPress={() => setEnd(h)} />
                ))}
              </View>
            </ScrollView>
            {!hoursOk ? (
              <Text style={styles.error}>
                Kies een van-uur en een tot-uur, met het van-uur eerst.
              </Text>
            ) : null}

            <Text style={styles.label}>Uurtarief (€)</Text>
            <TextInput
              style={styles.input}
              value={rate}
              onChangeText={setRate}
              placeholder="45"
              placeholderTextColor={tennisColors.textMuted}
              keyboardType="decimal-pad"
            />
            {!rateOk ? <Text style={styles.error}>Vul een getal in, of laat leeg.</Text> : null}

            <Button
              label="Opslaan"
              variant="primary"
              icon={<Save size={18} color={tennisColors.white} />}
              disabled={!canSave}
              onPress={() => { void save(); }}
              style={styles.saveButton}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(28, 43, 30, 0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: tennisColors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  title: { ...typography.h2, color: tennisColors.text },
  closeButton: { padding: spacing.xs, borderRadius: radius.sm },
  body: { paddingBottom: spacing.lg },
  label: {
    ...typography.label, color: tennisColors.textMuted,
    marginTop: spacing.lg, marginBottom: spacing.sm,
  },
  subLabel: {
    fontSize: 12, fontWeight: '700', color: tennisColors.textMuted,
    marginTop: spacing.sm, marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: tennisColors.surface,
    borderWidth: 1, borderColor: tennisColors.border, borderRadius: radius.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    fontSize: 15, color: tennisColors.text,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  helper: { ...typography.caption, color: tennisColors.textMuted, marginTop: spacing.sm },
  error: { color: tennisColors.danger, fontSize: 13, marginTop: spacing.sm },
  saveButton: { marginTop: spacing.xl },
});
```

- [ ] **Step 2: Controleer de types**

Run: `npx tsc --noEmit`
Expected: geen uitvoer, exit 0.

- [ ] **Step 3: Commit**

```bash
git add components/CoachDetailsModal.tsx
git commit -m "feat: bewerkvenster voor de eigen trainersgegevens"
```

---

## Task 4: Dagen, uren en de Bewerken-knop op het trainersdossier

**Files:**
- Modify: `app/coaches/[id].tsx`

- [ ] **Step 1: Vul de imports aan**

In `app/coaches/[id].tsx`, vervang de importregels bovenaan door:

```tsx
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronRight, Pencil } from 'lucide-react-native';
import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { CoachDetailsModal } from '../../components/CoachDetailsModal';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { playersForCoach } from '../../lib/relations';
import { formatWorkingDays } from '../../lib/slots';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography, webCursor } from '../../constants/theme';
```

- [ ] **Step 2: Haal `currentUser` op en voeg de venster-state toe**

Vervang de regel:

```tsx
  const { users, bookings, courts, lessons, progress } = useSimpleData();
```

door:

```tsx
  const { users, bookings, courts, lessons, progress, currentUser } = useSimpleData();
  const [editOpen, setEditOpen] = useState(false);
```

- [ ] **Step 3: Toon dagen en uren, en de knop op je eigen dossier**

Vervang het volledige eerste `<Card>`-blok (van `<Card>` tot en met de bijbehorende `</Card>`, het blok met `coach.name`) door:

```tsx
      <Card>
        <Text style={styles.name}>{coach.name}</Text>
        <Badge label="Trainer" color={tennisColors.primary} />
        {coach.email ? <Text style={styles.contact}>{coach.email}</Text> : null}
        {coach.phone ? <Text style={styles.contact}>{coach.phone}</Text> : null}

        <Text style={styles.fieldLabel}>Geeft les</Text>
        <Text style={styles.fieldValue}>{formatWorkingDays(coach)}</Text>
        <Text style={styles.fieldValue}>
          {coach.working_hours
            ? `${coach.working_hours.start} – ${coach.working_hours.end}`
            : 'De hele dag'}
        </Text>

        {/* Display only: the revenue sums run on the court rate, never on this. */}
        {coach.hourly_rate ? (
          <Text style={styles.rate}>Uurtarief: €{coach.hourly_rate} per uur</Text>
        ) : null}

        {/* Only your own details. A colleague's card has no button at all — a control
            you may never use should not be sitting there greyed out. */}
        {currentUser?.id === coach.id ? (
          <Button
            label="Bewerken"
            variant="secondary"
            icon={<Pencil size={16} color={tennisColors.text} />}
            onPress={() => setEditOpen(true)}
            style={styles.editButton}
          />
        ) : null}
      </Card>

      {currentUser?.id === coach.id ? (
        <CoachDetailsModal
          coach={coach}
          visible={editOpen}
          onClose={() => setEditOpen(false)}
        />
      ) : null}
```

- [ ] **Step 4: Voeg de stijlen toe**

In het `StyleSheet.create`-blok onderaan, direct onder de regel die begint met `rate:`:

```tsx
  fieldLabel: {
    fontSize: 12, fontWeight: '700', color: tennisColors.textMuted,
    textTransform: 'uppercase', marginTop: spacing.md,
  },
  fieldValue: { fontSize: 14, color: tennisColors.text, marginTop: 2 },
  editButton: { marginTop: spacing.lg },
```

- [ ] **Step 5: Controleer de types**

Run: `npx tsc --noEmit`
Expected: geen uitvoer, exit 0.

- [ ] **Step 6: Commit**

```bash
git add "app/coaches/[id].tsx"
git commit -m "feat(trainers): eigen gegevens bewerken vanaf het dossier"
```

---

## Task 5: De agenda houdt zich aan de beschikbaarheid

**Files:**
- Modify: `app/agenda/new.tsx`

- [ ] **Step 1: Vervang de lokale dagnamen door die uit `lib/slots`**

Vervang de importregel:

```tsx
import { generateSlots, isDateBookable } from '../../lib/slots';
```

door:

```tsx
import {
  generateSlots, isDateBookable, slotsForCoach, worksOnDay, formatWorkingDays, DAY_LABELS,
} from '../../lib/slots';
```

Verwijder de regel met de lokale kopie:

```tsx
const DAY_NAMES = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'];
```

Vervang daarna elk voorkomen van `DAY_NAMES` in dit bestand door `DAY_LABELS`. Controleer met:

```bash
grep -n "DAY_NAMES" app/agenda/new.tsx
```

Expected: geen uitvoer.

- [ ] **Step 2: Leid de gekozen trainer af en bepaal de uurvakken daaruit**

Vervang het `slots`-blok:

```tsx
  const slots: string[] = useMemo(
    () => generateSlots(settings.booking_end_time),
    [settings.booking_end_time],
  );
```

door:

```tsx
  // The coach whose agenda is being filled — their own days and hours bound what is
  // bookable. Without a specific coach ("Alle coaches") the club window stands; that is
  // a browse-only state anyway.
  const bookingCoach: User | null = useMemo(
    () => coaches.find((c) => c.id === bookingCoachId) ?? null,
    [coaches, bookingCoachId],
  );

  const slots: string[] = useMemo(
    () => (bookingCoach
      ? slotsForCoach(bookingCoach, settings.booking_end_time)
      : generateSlots(settings.booking_end_time)),
    [bookingCoach, settings.booking_end_time],
  );

  const dayIsWorked: boolean =
    selectedDate === null || bookingCoach === null || worksOnDay(bookingCoach, selectedDate);
```

- [ ] **Step 3: Schakel dagen uit waarop de trainer geen les geeft**

In de datumstrook, vervang:

```tsx
          const bookable = isDateBookable(day);
```

door:

```tsx
          const worked = bookingCoach === null || worksOnDay(bookingCoach, day);
          const bookable = isDateBookable(day) && worked;
```

En vervang in dezelfde `<Pressable>` de regel:

```tsx
              accessibilityLabel={dayLabel}
```

door:

```tsx
              accessibilityLabel={
                worked ? dayLabel : `${dayLabel}, ${bookingCoach?.name ?? ''} geeft dan geen les`
              }
```

- [ ] **Step 4: Zet de reden onder de datumstrook**

Direct ná de sluitende `</ScrollView>` van de datumstrook, en vóór de regel `{/* Slot grid */}`:

```tsx
      {bookingCoach ? (
        <Text style={styles.hint}>
          {bookingCoach.name} geeft les op {formatWorkingDays(bookingCoach)}
          {bookingCoach.working_hours
            ? `, ${bookingCoach.working_hours.start}–${bookingCoach.working_hours.end}`
            : ''}
          .
        </Text>
      ) : null}
```

- [ ] **Step 5: Blokkeer de uurvakken op een dag zonder les**

Vervang in het uurvak-raster:

```tsx
          const disabled = selectedDate === null || !canBook || isTaken;
```

door:

```tsx
          const disabled = selectedDate === null || !canBook || isTaken || !dayIsWorked;
```

En voeg direct ónder het blok `{!canBook && ( … )}` toe:

```tsx
      {!dayIsWorked && (
        <Text style={styles.hint}>
          {bookingCoach?.name} geeft geen les op deze dag.
        </Text>
      )}
```

- [ ] **Step 6: Controleer de types**

Run: `npx tsc --noEmit`
Expected: geen uitvoer, exit 0. Klaagt hij dat `User` ongebruikt of ontbrekend is, controleer dan of de bestaande regel `import type { User } from '../../lib/types';` nog bovenaan staat — die wordt hier hergebruikt voor `bookingCoach`.

- [ ] **Step 7: Draai de volledige testsuite**

Run: `npx jest`
Expected: alle suites groen. Het aantal tests is gegroeid met de tests uit taak 1.

- [ ] **Step 8: Commit**

```bash
git add app/agenda/new.tsx
git commit -m "feat(agenda): boeken beperkt tot de dagen en uren van de trainer"
```

---

## Task 6: Doorloop in de app

**Files:** geen — dit is een controle, geen wijziging.

- [ ] **Step 1: Start de app**

Run: `npm run web`
Open de URL die Expo toont.

- [ ] **Step 2: Loop het pad na**

Meld je aan als een trainer (Koen). Ga naar **Trainers → Koen**. Verwacht: op de kaart staat nu "Geeft les — Elke dag — De hele dag", en er staat een **Bewerken**-knop.

Open een collega (Sanne). Verwacht: dezelfde regels, maar **geen** Bewerken-knop.

- [ ] **Step 3: Bewerk je eigen gegevens**

Open bij Koen het bewerkvenster. Vul in: gsm `0470 12 34 56`, vink **Ma**, **Wo** en **Vr** aan, kies van `16:00` en tot `21:00`, uurtarief `45`. Sla op.

Verwacht: het venster sluit en de kaart toont "Ma · Wo · Vr" en "16:00 – 21:00".

- [ ] **Step 4: Controleer dat de agenda meebeweegt**

Ga naar **Agenda → Nieuwe afspraak**. Verwacht: onder de datumstrook staat "Koen geeft les op Ma · Wo · Vr, 16:00–21:00.", dinsdagen en donderdagen zijn niet aanklikbaar, en na het kiezen van een woensdag beginnen de uurvakken bij 16:00 in plaats van bij 09:00.

- [ ] **Step 5: Controleer de terugweg**

Open het bewerkvenster opnieuw, kies **Hele dag** bij Lesuren en vink alle dagen uit. Sla op. Verwacht: de agenda toont weer alle dagen en alle uurvakken vanaf 09:00 — het gedrag van vóór deze wijziging.

- [ ] **Step 6: Controleer de console**

Verwacht: geen fouten in de browserconsole tijdens de hele doorloop.

- [ ] **Step 7: Werk het ontwerpdocument bij als er iets afweek**

Wijkt het gebouwde af van de spec, pas dan `docs/superpowers/specs/2026-08-20-trainersgegevens-bewerken-design.md` aan en commit die wijziging apart. Klopt alles, sla deze stap over.
