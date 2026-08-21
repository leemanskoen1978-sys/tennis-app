# De lesdag en de spraakmemo — implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Een trainer opent de app op de baan en legt met één ingedrukte knop een spraakmemo over een speler vast; 's avonds werkt hij die memo's uit tot voortgangsnotities.

**Architecture:** Een nieuw begrip `Memo` met een eigen tabel, audio als data-URL in de rij (net als `StudentProgress.voice_memo_uri` vandaag). Al het rekenwerk in twee nieuwe bestanden in `lib/` met tests ernaast (`lesdag.ts`, `memo.ts`); de schermen blijven dun. Het startscherm krijgt de lesdag bovenaan, de bestaande tegels schuiven eronder. Uitwerken hergebruikt het bestaande `ProgressForm` en schrijft de notitie én het opruimen van de memo weg in één `commit`.

**Tech Stack:** Expo / React Native (web + native), expo-router, TypeScript, Supabase (Postgres + RLS), Jest (`jest-expo`), `MediaRecorder` voor de opname op web.

**Ontwerp:** `docs/superpowers/specs/2026-08-22-lesdag-en-spraakmemo-design.md`

---

## Werkwijze in dit project — lees dit eerst

Deze afspraken staan in `OPENSTAAND.md` en gelden voor elke taak hieronder:

- **Nederlands** in de UI en in commentaar. Commentaar legt het *waarom* uit, niet het *wat*.
- **Rekenwerk in `lib/` met tests ernaast.** Zit er logica in een scherm die je niet kunt
  testen, dan hoort ze in `lib/`. Er zijn nog geen tests op schermen; die komen er in dit
  plan ook niet bij.
- **Voor elke commit:** `npx tsc --noEmit` en `npm test`.
- **De sleutel van een vertaling is de Nederlandse zin zelf.** Elke nieuwe zin in de UI komt
  ook in `lib/i18n-en.ts` te staan, anders staat er straks Nederlands in de Engelse app.
- Bestaande vormgeving hergebruiken: `components/ui/Card.tsx`, `ActionTile.tsx`,
  `Screen.tsx`, `constants/theme.ts`, `constants/tennis-colors.ts`. Geen nieuwe kleuren of
  maten verzinnen.
- **Let op:** de dev-server praat met de echte Supabase van de club. Test met de lokale
  opslag (zonder sleutels in `.env`), niet op productiegegevens.

## Bestandsindeling

| Bestand | Waar het over gaat |
| --- | --- |
| `lib/types.ts` *(wijzigen)* | Het type `Memo` erbij. |
| `lib/memo.ts` *(nieuw)* | Wat een geldige opname is, welke memo's nog uitgewerkt moeten, en wat een memo meegeeft aan een notitie. |
| `lib/memo.test.ts` *(nieuw)* | Tests daarvoor. |
| `lib/lesdag.ts` *(nieuw)* | De lessen van vandaag van één trainer, met wie erin staat en welke les opengeklapt hoort. |
| `lib/lesdag.test.ts` *(nieuw)* | Tests daarvoor. |
| `lib/sync.ts` *(wijzigen)* | `memos` als achtste tabel in het verschil tussen twee toestanden. |
| `providers/mockStore.ts` *(wijzigen)* | `memos` in `StoreData`, in de seed en in `withDefaults`. |
| `providers/supabaseStore.ts` *(wijzigen)* | `memos` ophalen en wegschrijven. |
| `supabase-schema.sql` *(wijzigen)* | De tabel `memos` met RLS. |
| `providers/SimpleDataProvider.tsx` *(wijzigen)* | `memos` in de context, plus `addMemo`, `deleteMemo`, `werkMemoUit`. |
| `components/useOpname.ts` *(nieuw)* | De opnamemotor, uit `VoiceRecorder` getrokken zodat twee knoppen hem delen. |
| `components/VoiceRecorder.tsx` *(wijzigen)* | Gebruikt voortaan die motor; gedrag verandert niet. |
| `components/lesdag/MemoKnop.tsx` *(nieuw)* | Indrukken, praten, loslaten. |
| `components/lesdag/Lesdag.tsx` *(nieuw)* | Het lesdagblok: lessen van vandaag, spelers, memoknoppen. |
| `app/index.tsx` *(wijzigen)* | Het lesdagblok bovenaan voor een trainer. |
| `app/memos.tsx` *(nieuw)* | De uitwerklijst. |
| `components/progress/ProgressForm.tsx` *(wijzigen)* | Twee nieuwe eigenschappen: beginwaarden en wie de nieuwe notitie wegschrijft. |
| `lib/i18n-en.ts` *(wijzigen)* | De Engelse zinnen. |

---

## Task 1: Het type `Memo` en `lib/memo.ts`

**Files:**
- Modify: `lib/types.ts` (achter `StudentProgress`, rond regel 253)
- Create: `lib/memo.ts`
- Test: `lib/memo.test.ts`

- [ ] **Step 1: Voeg het type toe**

In `lib/types.ts`, direct na de `StudentProgress`-interface:

```ts
/**
 * Een opname over één speler, gemaakt tijdens een les.
 *
 * Een memo is nadrukkelijk géén voortgangsnotitie: hij telt nergens als notitie mee en
 * bestaat om uitgewerkt te worden. Zodra dat gebeurt, verdwijnt hij. Juist omdat hij
 * tijdelijk is, mag de audio hier gewoon in de rij staan — de voorraad blijft klein omdat
 * de uitwerklijst een wérklijst is en geen archief.
 */
export interface Memo {
  id: string;
  student_id: string;
  coach_id: string;
  /**
   * De les waarin hij is opgenomen — een `Booking`, niet een `Lesson`. Dat is een andere
   * vraag dan `StudentProgress.lesson_id`, dat naar het lesmateriaal wijst. Leeg mag: een
   * memo buiten een les om, of een memo waarvan de les intussen geschrapt is.
   */
  booking_id?: string;
  /** De opname zelf: een data-URL, net als `StudentProgress.voice_memo_uri`. */
  audio_uri: string;
  duration_ms: number;
  created_at: string; // ISO
}
```

- [ ] **Step 2: Schrijf de falende tests**

Maak `lib/memo.test.ts`:

```ts
import {
  MAX_MEMO_MS, MIN_MEMO_MS, heeftMemo, memoDuur, memoNaarNotitie, opnameDeugt,
  resterend, uitTeWerken,
} from './memo';
import type { Memo } from './types';

const memo = (id: string, over: Partial<Memo> = {}): Memo => ({
  id,
  student_id: 'mathis',
  coach_id: 'koen',
  booking_id: 'b1',
  audio_uri: 'data:audio/webm;base64,AAAA',
  duration_ms: 8000,
  created_at: '2026-08-25T17:12:00.000Z',
  ...over,
});

describe('opnameDeugt', () => {
  it('gooit een misgreep weg en bewaart een echte opname', () => {
    expect(opnameDeugt(0)).toBe(false);
    expect(opnameDeugt(MIN_MEMO_MS - 1)).toBe(false);
    expect(opnameDeugt(MIN_MEMO_MS)).toBe(true);
    expect(opnameDeugt(8000)).toBe(true);
  });

  it('vertrouwt geen onzin die uit een teller kan komen', () => {
    expect(opnameDeugt(Number.NaN)).toBe(false);
    expect(opnameDeugt(-5000)).toBe(false);
  });
});

describe('memoDuur', () => {
  it('zegt hoe lang hij duurt, zoals een speler het toont', () => {
    expect(memoDuur(8000)).toBe('0:08');
    expect(memoDuur(65_000)).toBe('1:05');
    expect(memoDuur(0)).toBe('0:00');
  });

  it('rondt naar beneden af: 1,9 seconde is nog geen twee', () => {
    expect(memoDuur(1900)).toBe('0:01');
  });
});

describe('resterend', () => {
  it('zwijgt zolang het einde nog niet in zicht is', () => {
    expect(resterend(0)).toBeNull();
    expect(resterend(30_000)).toBeNull();
  });

  it('telt af zodra het einde nadert', () => {
    expect(resterend(50_000)).toBe(10);
    expect(resterend(55_000)).toBe(5);
  });

  it('gaat nooit onder nul', () => {
    expect(resterend(MAX_MEMO_MS + 3000)).toBe(0);
  });
});

describe('uitTeWerken', () => {
  it('geeft alleen de memo\'s van deze trainer', () => {
    const lijst = [memo('m1'), memo('m2', { coach_id: 'sanne' })];
    expect(uitTeWerken(lijst, 'koen').map((m) => m.id)).toEqual(['m1']);
  });

  it('zet de oudste bovenaan, want die vergeet je het snelst', () => {
    const lijst = [
      memo('nieuw', { created_at: '2026-08-25T18:14:00.000Z' }),
      memo('oud', { created_at: '2026-08-25T17:12:00.000Z' }),
      memo('midden', { created_at: '2026-08-25T17:31:00.000Z' }),
    ];
    expect(uitTeWerken(lijst, 'koen').map((m) => m.id)).toEqual(['oud', 'midden', 'nieuw']);
  });

  it('is leeg als er niets ligt', () => {
    expect(uitTeWerken([], 'koen')).toEqual([]);
  });
});

describe('heeftMemo', () => {
  const lijst = [memo('m1', { student_id: 'mathis', booking_id: 'b1' })];

  it('kent het vinkje toe aan de juiste speler in de juiste les', () => {
    expect(heeftMemo(lijst, 'b1', 'mathis')).toBe(true);
  });

  it('kijkt niet naar een andere speler of een andere les', () => {
    expect(heeftMemo(lijst, 'b1', 'lotte')).toBe(false);
    expect(heeftMemo(lijst, 'b2', 'mathis')).toBe(false);
  });

  it('rekent een memo zonder les nergens mee', () => {
    expect(heeftMemo([memo('m2', { booking_id: undefined })], 'b1', 'mathis')).toBe(false);
  });
});

describe('memoNaarNotitie', () => {
  it('geeft de speler, de opname en het tijdstip van de opname mee', () => {
    expect(memoNaarNotitie(memo('m1'))).toEqual({
      student_id: 'mathis',
      voice_memo_uri: 'data:audio/webm;base64,AAAA',
      created_at: '2026-08-25T17:12:00.000Z',
    });
  });
});
```

- [ ] **Step 3: Draai de tests en zie ze falen**

Run: `npx jest lib/memo.test.ts`
Expected: FAIL — `Cannot find module './memo'`.

- [ ] **Step 4: Schrijf `lib/memo.ts`**

```ts
// De spraakmemo: ruw materiaal dat een trainer op de baan inspreekt.
//
// Alles wat over een memo te beslissen valt staat hier, en niet in de knop of in het
// scherm. De knop op de baan en de uitwerklijst stellen dezelfde vragen — is deze opname
// het bewaren waard, hoe lang duurt hij, wie is er nog niet uitgewerkt — en die vragen
// horen één antwoord te hebben.

import type { Memo, StudentProgress } from './types';

/**
 * Korter dan dit is geen memo maar een misgreep: op een baan raak je het scherm weleens
 * aan met je duim terwijl je een bal opraapt. Die opname verdwijnt zonder mededeling.
 */
export const MIN_MEMO_MS = 1000;

/**
 * Langer dan dit kapt de knop af. Een memo is een zin of twee; wie een minuut praat, is
 * eigenlijk een notitie aan het maken en kan dat beter 's avonds doen.
 */
export const MAX_MEMO_MS = 60_000;

/** Vanaf hier telt de knop zichtbaar af, zodat de afkap niemand verrast. */
export const WAARSCHUW_VANAF_MS = 50_000;

/** Is deze opname het bewaren waard? */
export function opnameDeugt(durationMs: number): boolean {
  return Number.isFinite(durationMs) && durationMs >= MIN_MEMO_MS;
}

/** Hoe lang hij duurt, zoals een speler het toont: "0:08", "1:05". */
export function memoDuur(durationMs: number): string {
  const totaal = Math.max(0, Math.floor(durationMs / 1000));
  const minuten = Math.floor(totaal / 60);
  const seconden = totaal % 60;
  return `${minuten}:${String(seconden).padStart(2, '0')}`;
}

/**
 * Hoeveel seconden er nog zijn voor de knop afkapt, of `null` zolang dat nog niet
 * interessant is. Zo hoeft de knop de grenzen niet te kennen en hoeft dit bestand niets
 * van een knop te weten.
 */
export function resterend(durationMs: number): number | null {
  if (durationMs < WAARSCHUW_VANAF_MS) return null;
  return Math.max(0, Math.ceil((MAX_MEMO_MS - durationMs) / 1000));
}

/** De memo's die deze trainer nog moet uitwerken: oudste eerst. */
export function uitTeWerken(memos: Memo[], coachId: string): Memo[] {
  return memos
    .filter((m) => m.coach_id === coachId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/**
 * Heeft deze speler al een memo in déze les? Dat is op een baan de enige vraag die telt:
 * wie heb ik al gehad. Een memo zonder les telt niet mee — die hoort bij geen enkel
 * vakje op het scherm.
 */
export function heeftMemo(memos: Memo[], bookingId: string, studentId: string): boolean {
  return memos.some((m) => m.booking_id === bookingId && m.student_id === studentId);
}

/** De velden waarmee de notitie begint die uit deze memo voortkomt. */
export interface MemoPreset {
  student_id: string;
  voice_memo_uri: string;
  /**
   * Het moment van de **opname**, niet van het uitwerken. Een notitie die 's avonds
   * getypt wordt gaat over wat er die middag gebeurde, en hoort in het dossier op die
   * middag te staan.
   */
  created_at: string;
}

export function memoNaarNotitie(memo: Memo): MemoPreset {
  return {
    student_id: memo.student_id,
    voice_memo_uri: memo.audio_uri,
    created_at: memo.created_at,
  };
}

/** Alleen om te laten zien dat de velden op elkaar passen; TypeScript bewaakt de rest. */
export type NotitieUitMemo = Pick<StudentProgress, 'student_id' | 'voice_memo_uri' | 'created_at'>;
```

> **Afwijking van de spec, met opzet:** de spec beschrijft `memoNaarNotitie` met een
> `Pick<StudentProgress, …>` waar ook `coach_id` in zat. Die valt weg: `ProgressForm` zet
> de trainer zelf uit `currentUser`, en twee plekken die dezelfde trainer invullen is één
> te veel. De rest is ongewijzigd.

- [ ] **Step 5: Draai de tests en zie ze slagen**

Run: `npx jest lib/memo.test.ts`
Expected: PASS — 15 tests.

- [ ] **Step 6: Controleer types en commit**

```bash
npx tsc --noEmit
git add lib/types.ts lib/memo.ts lib/memo.test.ts
git commit -m "feat(memo): wat een spraakmemo is, en wanneer hij deugt"
```

---

## Task 2: `lib/lesdag.ts` — de lessen van vandaag

**Files:**
- Create: `lib/lesdag.ts`
- Test: `lib/lesdag.test.ts`

- [ ] **Step 1: Schrijf de falende tests**

Maak `lib/lesdag.test.ts`:

```ts
import { lesdagVan } from './lesdag';
import type { Booking } from './types';

/** Een les op een gekozen dag en uur, van trainer `koen`, tenzij anders gezegd. */
const les = (id: string, start: string, eind: string, over: Partial<Booking> = {}): Booking => ({
  id,
  player_id: 'mathis',
  coach_id: 'koen',
  court_id: 'baan2',
  start_time: start,
  end_time: eind,
  status: 'confirmed',
  payment_method: 'open',
  ...over,
});

// Alles speelt zich af op dinsdag 25 augustus 2026, in lokale tijd — dezelfde dagbepaling
// als `bookingsOnDay` gebruikt.
const OM = (uur: number, minuut = 0): string =>
  new Date(2026, 7, 25, uur, minuut).toISOString();
const NU = (uur: number, minuut = 0): Date => new Date(2026, 7, 25, uur, minuut);

describe('lesdagVan', () => {
  it('is leeg op een dag zonder lessen', () => {
    expect(lesdagVan([], 'koen', NU(17))).toEqual([]);
  });

  it('geeft de lessen van vandaag op tijd oplopend', () => {
    const dag = lesdagVan(
      [les('c', OM(19), OM(20)), les('a', OM(17), OM(18)), les('b', OM(18), OM(19))],
      'koen',
      NU(17, 30),
    );
    expect(dag.map((l) => l.booking.id)).toEqual(['a', 'b', 'c']);
  });

  it('laat de lessen van een andere trainer weg', () => {
    const dag = lesdagVan(
      [les('a', OM(17), OM(18)), les('b', OM(18), OM(19), { coach_id: 'sanne' })],
      'koen',
      NU(17, 30),
    );
    expect(dag.map((l) => l.booking.id)).toEqual(['a']);
  });

  it('laat een geannuleerde les weg', () => {
    const dag = lesdagVan(
      [les('a', OM(17), OM(18), { status: 'cancelled' })],
      'koen',
      NU(17, 30),
    );
    expect(dag).toEqual([]);
  });

  it('laat een les van een andere dag weg', () => {
    const morgen = new Date(2026, 7, 26, 17).toISOString();
    const dag = lesdagVan([les('a', morgen, morgen)], 'koen', NU(17, 30));
    expect(dag).toEqual([]);
  });

  it('zet de betaler voorop en de meespelers erachter', () => {
    const dag = lesdagVan(
      [les('a', OM(17), OM(18), { participant_ids: ['lotte', 'sam'] })],
      'koen',
      NU(17, 30),
    );
    expect(dag[0].playerIds).toEqual(['mathis', 'lotte', 'sam']);
  });

  it('weet welke les nu bezig is, en klapt die open', () => {
    const dag = lesdagVan(
      [les('a', OM(17), OM(18)), les('b', OM(18), OM(19))],
      'koen',
      NU(17, 30),
    );
    expect(dag.map((l) => l.loopt)).toEqual([true, false]);
    expect(dag.map((l) => l.open)).toEqual([true, false]);
  });

  it('rekent het einde niet meer tot de les', () => {
    const dag = lesdagVan([les('a', OM(17), OM(18))], 'koen', NU(18));
    expect(dag[0].loopt).toBe(false);
    expect(dag[0].voorbij).toBe(true);
  });

  it('klapt tussen twee lessen de eerstvolgende open', () => {
    const dag = lesdagVan(
      [les('a', OM(17), OM(18)), les('b', OM(19), OM(20))],
      'koen',
      NU(18, 30),
    );
    expect(dag.map((l) => l.open)).toEqual([false, true]);
    expect(dag.map((l) => l.voorbij)).toEqual([true, false]);
  });

  it('klapt voor de eerste les die eerste les open', () => {
    const dag = lesdagVan(
      [les('a', OM(17), OM(18)), les('b', OM(19), OM(20))],
      'koen',
      NU(16, 45),
    );
    expect(dag.map((l) => l.open)).toEqual([true, false]);
  });

  it('klapt na de laatste les die laatste open, want daar gaat een memo achteraf over', () => {
    const dag = lesdagVan(
      [les('a', OM(17), OM(18)), les('b', OM(19), OM(20))],
      'koen',
      NU(21),
    );
    expect(dag.map((l) => l.voorbij)).toEqual([true, true]);
    expect(dag.map((l) => l.open)).toEqual([false, true]);
  });

  it('klapt er altijd precies één open zolang er lessen zijn', () => {
    for (const uur of [16, 17, 18, 19, 20, 21]) {
      const dag = lesdagVan(
        [les('a', OM(17), OM(18)), les('b', OM(19), OM(20))],
        'koen',
        NU(uur, 30),
      );
      expect(dag.filter((l) => l.open)).toHaveLength(1);
    }
  });
});
```

- [ ] **Step 2: Draai de tests en zie ze falen**

Run: `npx jest lib/lesdag.test.ts`
Expected: FAIL — `Cannot find module './lesdag'`.

- [ ] **Step 3: Schrijf `lib/lesdag.ts`**

```ts
// De lesdag van één trainer: wat het startscherm tekent als hij de app op de baan opent.
//
// Dit bestand beantwoordt drie vragen die allemaal op het scherm terechtkomen: welke lessen
// heb ik vandaag, wie staat daarin, en welke daarvan hoor ik nú te zien. Vooral die laatste
// vraag hoort hier en niet in het scherm: "de les die nu bezig is" klinkt eenvoudig tot je
// om kwart voor vijf, tussen twee lessen in of om negen uur 's avonds kijkt.

import { bookingsOnDay } from './hub';
import { lessonPlayerIds } from './groups';
import type { Booking } from './types';

/** Eén les van vandaag, met de spelers die erin staan. */
export interface Lesuur {
  booking: Booking;
  /** De spelers, betaler voorop. De namen worden op het scherm opgezocht. */
  playerIds: string[];
  /** Is deze les nu bezig? Hoogstens één les kan dit zijn. */
  loopt: boolean;
  /** Is hij al voorbij? Dan staat hij grijs — maar hij blijft staan. */
  voorbij: boolean;
  /**
   * De les die het scherm opengeklapt toont. Precies één les heeft dit, zolang er lessen
   * zijn: een trainer op een baan hoort niet eerst te moeten tikken voor hij iets ziet.
   */
  open: boolean;
}

/**
 * De lesdag van één trainer: zijn lessen van vandaag, op tijd oplopend.
 *
 * "Vandaag" komt van `bookingsOnDay`, dezelfde definitie die het hoofdscherm en de agenda
 * al gebruiken — een les van 's avonds laat hoort bij de dag zoals je hem op de klok ziet.
 * Geannuleerde lessen vallen daar al af: die gaan niet door, dus daar valt niets over in
 * te spreken.
 *
 * Welke les opengeklapt staat, in deze volgorde:
 *  1. de les die nu bezig is;
 *  2. is die er niet, de eerstvolgende — om kwart voor vijf wil je de les van vijf uur zien;
 *  3. is die er ook niet (de dag zit erop), de laatste les, want dáár gaat een memo
 *     achteraf over.
 */
export function lesdagVan(bookings: Booking[], coachId: string, now: Date): Lesuur[] {
  const mijne = bookingsOnDay(bookings, now).filter((b) => b.coach_id === coachId);
  const moment = now.getTime();

  const uren = mijne.map((booking) => {
    const start = new Date(booking.start_time).getTime();
    const eind = new Date(booking.end_time).getTime();
    return {
      booking,
      playerIds: lessonPlayerIds(booking),
      loopt: start <= moment && moment < eind,
      voorbij: eind <= moment,
      open: false,
    };
  });

  if (uren.length === 0) return uren;

  const lopend = uren.findIndex((u) => u.loopt);
  const volgend = uren.findIndex((u) => !u.voorbij);
  const gekozen = lopend >= 0 ? lopend : volgend >= 0 ? volgend : uren.length - 1;
  uren[gekozen].open = true;

  return uren;
}
```

- [ ] **Step 4: Draai de tests en zie ze slagen**

Run: `npx jest lib/lesdag.test.ts`
Expected: PASS — 12 tests.

- [ ] **Step 5: Controleer types en commit**

```bash
npx tsc --noEmit
git add lib/lesdag.ts lib/lesdag.test.ts
git commit -m "feat(lesdag): welke lessen vandaag, en welke je nu hoort te zien"
```

---

## Task 3: De memo's in de opslag

Dit is de taak waarin `memos` een achtste verzameling wordt, naast `users`, `bookings` en de
rest. Drie plekken moeten mee: de lokale opslag, het verschil-uitrekenen, en de databank.

**Files:**
- Modify: `lib/sync.ts:21` (`SyncTable`), `lib/sync.ts:49-58` (`SyncableStore`), `lib/sync.ts:110-125` (`diffStores`)
- Modify: `providers/mockStore.ts:14-26` (`StoreData`), `:28-40` (`freshSeed`), `:47-59` (`withDefaults`)
- Modify: `providers/supabaseStore.ts:29-37` (`TABLES`), `:70-104` (`loadFromSupabase`)
- Modify: `supabase-schema.sql`
- Test: `lib/sync.test.ts`

- [ ] **Step 1: Schrijf de falende test**

Voeg onderaan `lib/sync.test.ts` toe. Dat bestand heeft al een hulpfunctie `store(extra)`
die een `SyncableStore` opbouwt; gebruik die en maak geen tweede.

```ts
// Bij de bestaande imports bovenaan het bestand:
import type { Memo } from './types';

const memo = (id: string): Memo => ({
  id,
  student_id: 'u-mathis',
  coach_id: 'u-koen',
  booking_id: 'b1',
  audio_uri: 'data:audio/webm;base64,AAAA',
  duration_ms: 8000,
  created_at: '2026-08-25T17:12:00.000Z',
});

describe('diffStores — memos', () => {
  it('ziet een nieuwe memo als iets dat weggeschreven moet worden', () => {
    const verschil = diffStores(store(), store({ memos: [memo('m1')] }));
    const tabel = verschil.tables.find((tb) => tb.table === 'memos');
    expect(tabel?.upsert.map((r) => r.id)).toEqual(['m1']);
    expect(verschil.empty).toBe(false);
  });

  it('ziet een uitgewerkte memo als een verwijdering', () => {
    const verschil = diffStores(store({ memos: [memo('m1')] }), store({ memos: [] }));
    const tabel = verschil.tables.find((tb) => tb.table === 'memos');
    expect(tabel?.remove).toEqual(['m1']);
  });

  it('zwijgt als er aan de memos niets veranderde', () => {
    const zelfde = diffStores(store({ memos: [memo('m1')] }), store({ memos: [memo('m1')] }));
    expect(zelfde.empty).toBe(true);
  });
});
```

Voeg in de bestaande hulpfunctie `store()` (rond regel 15) `memos: []` toe, naast
`beurtenkaarten: []` — anders klopt de vorm niet meer met `SyncableStore`.

- [ ] **Step 2: Draai de test en zie hem falen**

Run: `npx jest lib/sync.test.ts`
Expected: FAIL — TypeScript kent `memos` niet op `SyncableStore`, en `'memos'` is geen
`SyncTable`.

- [ ] **Step 3: Voeg `memos` toe aan `lib/sync.ts`**

Drie wijzigingen in dat bestand:

```ts
// 1. De import erbij:
import type {
  Beurtenkaart, Booking, Court, Lesson, Memo, PlayerGoal, Settings, StudentProgress, User,
} from './types';

// 2. De tabelnaam erbij:
export type SyncTable =
  | 'users' | 'courts' | 'bookings' | 'lessons' | 'progress' | 'goals' | 'beurtenkaarten'
  | 'memos';

// 3. In `SyncableStore`, achter `beurtenkaarten`:
  memos: Memo[];
```

En in `diffStores`, in de lege begintoestand én in de lijst met tabellen:

```ts
  const before: SyncableStore = previous ?? {
    users: [], courts: [], bookings: [], lessons: [], progress: [], goals: [],
    beurtenkaarten: [], memos: [], settings: next.settings, installed_catalogues: [],
  };

  const tables: TableChange[] = [
    changeFor('users', before.users, next.users),
    changeFor('courts', before.courts, next.courts),
    changeFor('bookings', before.bookings, next.bookings),
    changeFor('lessons', before.lessons, next.lessons),
    changeFor('progress', before.progress, next.progress),
    changeFor('goals', before.goals, next.goals),
    changeFor('beurtenkaarten', before.beurtenkaarten, next.beurtenkaarten),
    changeFor('memos', before.memos, next.memos),
  ].filter((c) => c.upsert.length > 0 || c.remove.length > 0);
```

- [ ] **Step 4: Voeg `memos` toe aan de lokale opslag**

In `providers/mockStore.ts`:

```ts
// In StoreData, achter `progress`:
  memos: Memo[];

// In freshSeed(), achter `progress: [...]`:
    memos: [],

// In withDefaults(), achter `progress: data.progress ?? []`:
    // Een opslag van vóór de memo's heeft dit veld niet; leeg is dan het goede antwoord.
    memos: data.memos ?? [],
```

Vergeet de import van `Memo` bovenaan `mockStore.ts` niet.

- [ ] **Step 5: Draai de test en zie hem slagen**

Run: `npx jest lib/sync.test.ts`
Expected: PASS.

- [ ] **Step 6: Laat de databank de memo's ophalen en wegschrijven**

In `providers/supabaseStore.ts`:

```ts
// In de import van types: Memo erbij.

// In TABLES, achter beurtenkaarten:
  memos: 'memos',

// In loadFromSupabase, in de Promise.all — let op de tweede parameter:
// `created_at` hoort hier wél bij de app (de uitwerklijst zet de oudste bovenaan),
// dus alleen `auth_id` valt weg.
  const [users, courts, bookings, lessons, progress, goals, beurtenkaarten, memos] =
    await Promise.all([
      selectAll<User>('users'),
      selectAll<Court>('courts'),
      selectAll<Booking>('bookings'),
      selectAll<Lesson>('lessons'),
      selectAll<StudentProgress>('student_progress', ['auth_id']),
      selectAll<PlayerGoal>('player_goals'),
      selectAll<Beurtenkaart>('beurtenkaarten', ['auth_id']),
      selectAll<Memo>('memos', ['auth_id']),
    ]);

// En in het object dat teruggegeven wordt, achter `beurtenkaarten,`:
    memos,
```

- [ ] **Step 7: Voeg de tabel toe aan `supabase-schema.sql`**

Zet dit direct ná het blok van `student_progress` (rond regel 129), zodat de tabellen in
dezelfde volgorde staan als de app ze kent:

```sql
-- Spraakmemo's: ruw materiaal dat een trainer op de baan inspreekt en later uitwerkt.
-- De audio staat als data-URL in de rij, net als bij student_progress.voice_memo_uri. Dat
-- mag hier omdat een memo tijdelijk is: uitwerken verwijdert hem. Wordt dat ooit anders,
-- dan hoort de audio in Supabase Storage en niet meer hier.
create table if not exists memos (
  id text primary key,
  student_id text not null references users(id) on delete cascade,
  coach_id text not null references users(id) on delete cascade,
  -- De les mag verdwijnen zonder de memo mee te nemen: wat er over een speler gezegd is,
  -- hoort niet weg te vallen omdat een boeking geschrapt wordt.
  booking_id text references bookings(id) on delete set null,
  audio_uri text not null,
  duration_ms int not null,
  created_at timestamptz not null default now()
);

create index if not exists memos_coach_idx on memos (coach_id);
```

En bij de RLS-regels, ná het blok van `student_progress` (rond regel 355):

```sql
alter table memos enable row level security;

-- Een memo is ruw materiaal, geen mededeling: een speler ziet zijn memo's níét. Wat hij te
-- zien krijgt, is de notitie die de trainer eruit maakt. En een trainer ziet alleen zijn
-- eigen memo's — de opname van een collega is niet aan hem.
drop policy if exists memos_select on memos;
create policy memos_select on memos for select
  to authenticated using (coach_id = app_user_id());
drop policy if exists memos_write on memos;
create policy memos_write on memos for all
  to authenticated using (coach_id = app_user_id()) with check (coach_id = app_user_id());
```

Zet `alter table memos enable row level security;` bij de andere `alter table`-regels
(rond regel 255-263), niet los eronder.

- [ ] **Step 8: Draai alles en commit**

```bash
npx tsc --noEmit
npm test
git add lib/sync.ts lib/sync.test.ts providers/mockStore.ts providers/supabaseStore.ts supabase-schema.sql
git commit -m "feat(opslag): memo's als achtste verzameling, met eigen RLS"
```

> **Voor de eigenaar van de club:** deze tabel moet met de hand in Supabase aangemaakt
> worden door het gewijzigde `supabase-schema.sql` te draaien. Zonder die stap werkt de
> lokale opslag wel en de databank niet.

---

## Task 4: De drie handelingen in de provider

**Files:**
- Modify: `providers/SimpleDataProvider.tsx:35` (de vorm van de context), `:115-130` (de
  handelingen), rond `:709` (bij `addProgress`), en het `value`-object onderaan (`:816`).

- [ ] **Step 1: Breid de contextvorm uit**

In de `DataShape`-interface, achter `progress`:

```ts
  memos: Memo[];
```

En bij de handelingen, achter `deleteProgress`:

```ts
  /** Een opname bewaren. `id` en `created_at` worden hier gezet. */
  addMemo: (memo: Omit<Memo, 'id' | 'created_at'>) => Promise<void>;
  /** Weggooien zonder er een notitie van te maken. Onomkeerbaar. */
  deleteMemo: (id: string) => Promise<void>;
  /**
   * De memo uitwerken: de notitie erbij, de memo weg — in één opslag.
   *
   * Dat is geen nettigheid maar de kern: zouden dit twee opslagen zijn, dan bestaat er een
   * moment waarop de tweede kan mislukken, en houd je een dubbele notitie of een memo die
   * al uitgewerkt is. Dezelfde reden waarom een beurt afboeken en de les op factuur zetten
   * één stap zijn.
   */
  werkMemoUit: (memoId: string, notitie: Omit<StudentProgress, 'id'>) => Promise<void>;
```

- [ ] **Step 2: Schrijf de drie handelingen**

Direct ná `deleteProgress` (rond regel 730):

```ts
  const addMemo = useCallback(async (memo: Omit<Memo, 'id' | 'created_at'>) => {
    const store = storeRef.current;
    if (!store) return;
    const entry: Memo = { ...memo, id: newId('memo'), created_at: nowISO() };
    await commit({ ...store, memos: [...store.memos, entry] });
  }, [commit]);

  const deleteMemo = useCallback(async (id: string) => {
    const store = storeRef.current;
    if (!store) return;
    await commit({ ...store, memos: store.memos.filter((m) => m.id !== id) });
  }, [commit]);

  const werkMemoUit = useCallback(async (
    memoId: string,
    notitie: Omit<StudentProgress, 'id'>,
  ) => {
    const store = storeRef.current;
    if (!store) return;
    const entry: StudentProgress = {
      ...notitie,
      id: newId('p'),
      created_at: notitie.created_at ?? nowISO(),
    };
    // Eén commit: de notitie erbij en de memo weg, of geen van beide.
    await commit({
      ...store,
      progress: [...store.progress, entry],
      memos: store.memos.filter((m) => m.id !== memoId),
    });
  }, [commit]);
```

- [ ] **Step 3: Geef ze door**

In het `value`-object (rond regel 816) `memos: store.memos` (of hoe de andere verzamelingen
daar staan — sluit aan bij `progress`), plus `addMemo, deleteMemo, werkMemoUit`. Zet ze ook
in de afhankelijkhedenlijst van de `useMemo` eronder (rond regel 830), naast
`deleteProgress`.

- [ ] **Step 4: Controleer en commit**

Run: `npx tsc --noEmit && npm test`
Expected: geen fouten, 700+ tests groen. Ziet TypeScript ergens een `StoreData` zonder
`memos`, vul die plek aan met `memos: []`.

```bash
git add providers/SimpleDataProvider.tsx
git commit -m "feat(memo): opnemen, weggooien en uitwerken — dat laatste in één opslag"
```

---

## Task 5: De opnamemotor uit `VoiceRecorder` trekken

Twee knoppen gaan opnemen: het bestaande blad en de knop op de baan. Twee keer
`MediaRecorder` bedienen betekent twee keer dezelfde randgevallen oplossen — en dan doet de
ene het wel en de andere niet.

**Files:**
- Create: `components/useOpname.ts`
- Modify: `components/VoiceRecorder.tsx:37-115`

- [ ] **Step 1: Schrijf de haak**

Maak `components/useOpname.ts`:

```ts
// De opnamemotor, los van elke knop.
//
// Hij wordt door twee knoppen gebruikt: het voortgangsblad (start- en stopknop) en de
// memoknop op de baan (indrukken en loslaten). Ze verschillen alleen in hoe ze eruitzien —
// wat eronder gebeurt is hetzelfde, en dat hoort dus één keer te bestaan.
//
// Alleen web. Op een telefoon-app is `MediaRecorder` er niet; `kanOpnemen` is dan false en
// de knop hoort iets anders te tonen in plaats van niets te doen. Zie
// docs/voice-memo-native.md voor de weg daarheen.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useT } from '../lib/i18n';

export interface Opname {
  /** Loopt er op dit moment een opname? */
  bezig: boolean;
  /** Hoe lang die loopt, in milliseconden. Nul zodra hij gestopt is. */
  ms: number;
  /** Wat er misging, in een zin die op de knop past. */
  fout: string | null;
  /** Kan dit toestel überhaupt opnemen? */
  kanOpnemen: boolean;
  start: () => Promise<void>;
  stop: () => void;
}

/** Hoe fijn de teller loopt. Fijn genoeg voor een aftelling, grof genoeg om niets te kosten. */
const TIK_MS = 100;

/**
 * `onKlaar` krijgt de opname als data-URL, met hoe lang hij duurde. Wat er daarna mee
 * gebeurt — bewaren, weggooien omdat hij te kort was — beslist de knop; deze haak oordeelt
 * niet over de inhoud.
 *
 * `maxMs` kapt de opname vanzelf af. Weglaten betekent: geen grens, zoals het
 * voortgangsblad zich altijd al gedroeg.
 */
export function useOpname(
  onKlaar: (dataUrl: string, durationMs: number) => void,
  maxMs?: number,
): Opname {
  const t = useT();
  const [bezig, setBezig] = useState(false);
  const [ms, setMs] = useState(0);
  const [fout, setFout] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const beginRef = useRef<number>(0);
  // De laatste versie van de terugroep, zonder de haak opnieuw op te bouwen bij elke render.
  const klaarRef = useRef(onKlaar);
  klaarRef.current = onKlaar;

  const kanOpnemen = Platform.OS === 'web'
    && typeof navigator !== 'undefined'
    && typeof MediaRecorder !== 'undefined';

  const stopTimer = (): void => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  // Een venster dat sluit terwijl de microfoon nog aanstaat, laat het lampje branden.
  useEffect(() => () => {
    stopTimer();
    recorderRef.current?.stream?.getTracks().forEach((track) => track.stop());
  }, []);

  const stop = useCallback((): void => {
    recorderRef.current?.stop();
    setBezig(false);
    stopTimer();
  }, []);

  const start = useCallback(async (): Promise<void> => {
    setFout(null);
    if (!kanOpnemen) {
      setFout(t('Opnemen kan hier niet.'));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      beginRef.current = Date.now();

      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const duur = Date.now() - beginRef.current;
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') klaarRef.current(reader.result, duur);
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((track) => track.stop());
        setMs(0);
      };

      recorderRef.current = rec;
      rec.start();
      setBezig(true);
      setMs(0);
      timerRef.current = setInterval(() => {
        const gelopen = Date.now() - beginRef.current;
        setMs(gelopen);
        // De afkap zit hier en niet in de knop: een knop die je loslaat op het moment dat
        // de grens valt, zou hem anders missen.
        if (maxMs !== undefined && gelopen >= maxMs) stop();
      }, TIK_MS);
    } catch {
      setFout(t('Microfoon niet beschikbaar of geweigerd.'));
    }
  }, [kanOpnemen, maxMs, stop, t]);

  return { bezig, ms, fout, kanOpnemen, start, stop };
}
```

- [ ] **Step 2: Laat `VoiceRecorder` de haak gebruiken**

Vervang in `components/VoiceRecorder.tsx` de hele functie `WebVoiceRecorder` — de
`useState`s, de refs, het `useEffect`, `start` en `stop` verdwijnen naar de haak:

```tsx
function WebVoiceRecorder({
  value, onRecorded, onClear,
}: { value?: string; onRecorded?: (uri: string) => void; onClear?: () => void }) {
  const t = useT();
  // Geen bovengrens hier: dit blad kende die nooit, en een blad waar je rustig bij zit is
  // niet dezelfde plek als een knop op een baan.
  const opname = useOpname((dataUrl) => onRecorded?.(dataUrl));
  const mmss = memoDuur(opname.ms);

  return (
    <View style={styles.box}>
      {opname.bezig ? (
        <Pressable onPress={opname.stop} style={[styles.btn, styles.stopBtn, webCursor]} accessibilityRole="button" accessibilityLabel={t('Stop opname')}>
          <Square size={18} color={tennisColors.onFill} />
          <Text style={styles.btnTextLight}>{t('Stop')} • {mmss}</Text>
        </Pressable>
      ) : (
        <Pressable onPress={() => { void opname.start(); }} style={[styles.btn, styles.recBtn, webCursor]} accessibilityRole="button" accessibilityLabel={t('Start opname')}>
          <Mic size={18} color={tennisColors.onFill} />
          <Text style={styles.btnTextLight}>{value ? t('Opnieuw opnemen') : t('Opnemen')}</Text>
        </Pressable>
      )}

      {value && !opname.bezig ? (
        <>
          {/* Native <audio> element (web only). */}
          {React.createElement('audio', { src: value, controls: true, style: { height: 32 } })}
          <Pressable onPress={() => onClear?.()} style={[styles.iconBtn, webCursor]} accessibilityRole="button" accessibilityLabel={t('Verwijder opname')}>
            <Trash2 size={18} color={tennisColors.danger} />
          </Pressable>
        </>
      ) : null}

      {value && !opname.bezig ? null : (
        <View style={styles.hintWrap}><Play size={14} color={tennisColors.textMuted} /><Text style={styles.hint}>{t('Neem een korte memo op')}</Text></View>
      )}

      {opname.fout ? <Text style={styles.error}>{opname.fout}</Text> : null}
    </View>
  );
}
```

Bovenaan erbij: `import { useOpname } from './useOpname';` en
`import { memoDuur } from '../lib/memo';`. De imports van `useEffect`, `useRef` en
`useState` uit React kunnen weg als niets anders in het bestand ze nog gebruikt; `tsc`
zegt het als er iets blijft hangen.

De teller stond op `00:07` en wordt `0:07` — dezelfde vorm als in de uitwerklijst, en één
vorm is beter dan twee.

- [ ] **Step 3: Controleer dat er niets veranderd is in gedrag**

Run: `npx tsc --noEmit && npm test`
Expected: geen fouten.

Daarna met de hand: `npx expo start --web`, ga naar een spelersdossier → Voortgang
toevoegen, neem op, stop, speel af, gooi weg. Alles moet zich gedragen als voorheen.

- [ ] **Step 4: Commit**

```bash
git add components/useOpname.ts components/VoiceRecorder.tsx
git commit -m "refactor(opname): één motor voor beide opnameknoppen"
```

---

## Task 6: De memoknop

**Files:**
- Create: `components/lesdag/MemoKnop.tsx`
- Modify: `lib/i18n-en.ts`

- [ ] **Step 1: Schrijf de knop**

Maak `components/lesdag/MemoKnop.tsx`:

```tsx
// Indrukken, praten, loslaten. De hele notitie op de baan zit in deze ene knop.
//
// Waarom vasthouden en niet aan/uit: een knop die aanblijft, blijft aan. Op een baan leg je
// je telefoon neer en dan neemt hij nog een kwartier op. Vasthouden kan niet per ongeluk
// blijven doorlopen, en loslaten is dezelfde beweging als ophouden met praten.

import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Check, Mic, RefreshCw } from 'lucide-react-native';
import { useOpname } from '../useOpname';
import { MAX_MEMO_MS, memoDuur, opnameDeugt, resterend } from '../../lib/memo';
import { useT } from '../../lib/i18n';
import { tennisColors } from '../../constants/tennis-colors';
import { radius, minTapTarget, spacing, webCursor } from '../../constants/theme';

export function MemoKnop({ naam, alGehad, onOpname }: {
  /** Voor de schermlezer: om welke speler gaat deze knop? */
  naam: string;
  /** Staat er al een memo voor deze speler in deze les? Dan het vinkje ernaast. */
  alGehad: boolean;
  /**
   * Een geldige opname bewaren. Te korte opnames komen hier niet aan.
   *
   * Geeft een belofte terug die kapotgaat als het wegschrijven mislukt — en dán houdt deze
   * knop de opname vast in plaats van hem te laten verdampen. Een memo die stil verdwijnt,
   * kost meer vertrouwen dan een memo die niet gemaakt kon worden.
   */
  onOpname: (audioUri: string, durationMs: number) => Promise<void>;
}) {
  const t = useT();
  const [teKort, setTeKort] = useState(false);
  // Een opname die er wel is maar nog niet bewaard. Blijft staan tot het lukt of tot de
  // trainer hem weggooit.
  const [blijftHangen, setBlijftHangen] = useState<{ uri: string; ms: number } | null>(null);

  const bewaar = async (uri: string, ms: number): Promise<void> => {
    try {
      await onOpname(uri, ms);
      setBlijftHangen(null);
    } catch {
      setBlijftHangen({ uri, ms });
    }
  };

  const opname = useOpname((dataUrl, durationMs) => {
    // Een misgreep verdwijnt zonder mededeling — maar wel met een kort teken, anders denkt
    // een trainer dat hij iets bewaard heeft.
    if (!opnameDeugt(durationMs)) {
      setTeKort(true);
      setTimeout(() => setTeKort(false), 2000);
      return;
    }
    void bewaar(dataUrl, durationMs);
  }, MAX_MEMO_MS);

  if (!opname.kanOpnemen) {
    return <Text style={styles.kanNiet}>{t('Opnemen kan hier niet')}</Text>;
  }

  const nogSeconden = resterend(opname.ms);

  return (
    <View style={styles.rij}>
      <Pressable
        onPressIn={() => { void opname.start(); }}
        onPressOut={opname.stop}
        accessibilityRole="button"
        accessibilityLabel={t('Memo opnemen voor {naam}', { naam })}
        style={[styles.knop, opname.bezig && styles.knopBezig, webCursor]}
      >
        <Mic size={20} color={opname.bezig ? tennisColors.onFill : tennisColors.primary} />
        {opname.bezig ? <Text style={styles.teller}>{memoDuur(opname.ms)}</Text> : null}
      </Pressable>

      {/* Het aftellen staat naast de knop en niet erin: je duim ligt op de knop. */}
      {nogSeconden !== null ? (
        <Text style={styles.aftellen}>{t('nog {n}s', { n: nogSeconden })}</Text>
      ) : null}
      {teKort ? <Text style={styles.teKort}>{t('te kort')}</Text> : null}
      {opname.fout ? <Text style={styles.fout}>{opname.fout}</Text> : null}

      {/* De opname is er wel, maar staat nog nergens. Hij blijft in beeld tot dat gelukt is. */}
      {blijftHangen ? (
        <Pressable
          onPress={() => { void bewaar(blijftHangen.uri, blijftHangen.ms); }}
          accessibilityRole="button"
          accessibilityLabel={t('Nog niet bewaard — opnieuw proberen')}
          style={[styles.opnieuw, webCursor]}
        >
          <RefreshCw size={16} color={tennisColors.danger} />
          <Text style={styles.fout}>{t('niet bewaard — opnieuw')}</Text>
        </Pressable>
      ) : null}

      {alGehad && !opname.bezig && !blijftHangen
        ? <Check size={18} color={tennisColors.success} />
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  rij: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  // Ruim boven minTapTarget: dit wordt aangeraakt door iemand die ergens anders naar kijkt.
  knop: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    minWidth: minTapTarget, minHeight: minTapTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: tennisColors.primaryTint,
    justifyContent: 'center',
  },
  knopBezig: { backgroundColor: tennisColors.danger },
  teller: { color: tennisColors.onFill, fontWeight: '700', fontSize: 14 },
  aftellen: { color: tennisColors.danger, fontSize: 12, fontWeight: '700' },
  teKort: { color: tennisColors.textMuted, fontSize: 12 },
  opnieuw: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  fout: { color: tennisColors.danger, fontSize: 12, flexShrink: 1 },
  kanNiet: { color: tennisColors.textMuted, fontSize: 12 },
});
```

> Controleer of `tennisColors.success` bestaat in `constants/tennis-colors.ts`. Zo niet,
> gebruik `tennisColors.primary` — geen nieuwe kleur toevoegen.

- [ ] **Step 2: Zet de zinnen in het Engels**

In `lib/i18n-en.ts`, onderaan vóór de sluitende `};`:

```ts
  // De lesdag en de spraakmemo.
  'Opnemen kan hier niet.': 'Recording is not possible here.',
  'Opnemen kan hier niet': 'Recording not possible here',
  'Memo opnemen voor {naam}': 'Record a memo for {naam}',
  'nog {n}s': '{n}s left',
  'te kort': 'too short',
  'niet bewaard — opnieuw': 'not saved — retry',
  'Nog niet bewaard — opnieuw proberen': 'Not saved yet — try again',
```

- [ ] **Step 3: Controleer en commit**

Run: `npx tsc --noEmit && npm test`

```bash
git add components/lesdag/MemoKnop.tsx lib/i18n-en.ts
git commit -m "feat(memo): de knop die je indrukt en waarin je praat"
```

---

## Task 7: Het lesdagblok op het startscherm

**Files:**
- Create: `components/lesdag/Lesdag.tsx`
- Modify: `app/index.tsx:101-150` (in de `return`, vóór de `TileGrid`)
- Modify: `lib/i18n-en.ts`

- [ ] **Step 1: Schrijf het blok**

Maak `components/lesdag/Lesdag.tsx`:

```tsx
// De lesdag: wat een trainer ziet als hij de app op de baan opent.
//
// Welke lessen dat zijn en welke opengeklapt hoort, rekent `lib/lesdag.ts` uit — dit
// bestand tekent alleen. De ene beslissing die hier wél valt, is dat een ingeklapte les
// opengaat als je hem aantikt: dat is een voorkeur van het moment en hoort niet in de
// opslag.

import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { Card } from '../ui/Card';
import { MemoKnop } from './MemoKnop';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { lesdagVan } from '../../lib/lesdag';
import { heeftMemo, uitTeWerken } from '../../lib/memo';
import { formatTimeRange } from '../../lib/datetime';
import { tennisColors } from '../../constants/tennis-colors';
import { radius, spacing, typography, webCursor } from '../../constants/theme';
import { useT } from '../../lib/i18n';

export function Lesdag({ coachId }: { coachId: string }) {
  const t = useT();
  const router = useRouter();
  const { users, courts, bookings, memos, addMemo } = useSimpleData();

  // Eén moment voor het hele blok: anders zou de ene les op een andere "nu" beoordeeld
  // worden dan de volgende, en zouden er twee lessen tegelijk open kunnen staan.
  const now = new Date();
  const dag = useMemo(
    () => lesdagVan(bookings, coachId, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bookings, coachId],
  );

  // Welke les de trainer zelf openklapte. Niets gekozen = wat lesdagVan koos.
  const [gekozen, setGekozen] = useState<string | null>(null);
  const openId = gekozen ?? dag.find((l) => l.open)?.booking.id ?? null;

  const werk = uitTeWerken(memos, coachId);
  const naamVan = (id: string): string =>
    users.find((u) => u.id === id)?.name ?? t('Onbekend');
  const baanVan = (id: string): string =>
    courts.find((c) => c.id === id)?.name ?? t('Onbekend');

  if (dag.length === 0) {
    return (
      <View style={styles.leeg}>
        <Text style={styles.leegTekst}>{t('Vandaag geen lessen.')}</Text>
        {werk.length > 0 ? <Werkregel aantal={werk.length} /> : null}
      </View>
    );
  }

  return (
    <View style={styles.blok}>
      {dag.map((uur) => {
        const open = uur.booking.id === openId;
        return (
          <Card key={uur.booking.id} style={{ ...styles.les, ...(uur.voorbij ? styles.voorbij : {}) }}>
            <Pressable
              onPress={() => setGekozen(open ? '' : uur.booking.id)}
              accessibilityRole="button"
              accessibilityLabel={formatTimeRange(uur.booking.start_time, uur.booking.end_time)}
              accessibilityState={{ expanded: open }}
              style={[styles.kop, webCursor]}
            >
              {uur.loopt ? <View style={styles.nuStip} /> : null}
              <Text style={styles.tijd}>
                {formatTimeRange(uur.booking.start_time, uur.booking.end_time)}
              </Text>
              <Text style={styles.baan}>{baanVan(uur.booking.court_id)}</Text>
              <Text style={styles.aantal}>
                {uur.playerIds.length === 1
                  ? naamVan(uur.playerIds[0])
                  : t('{n} spelers', { n: uur.playerIds.length })}
              </Text>
            </Pressable>

            {open ? (
              <View style={styles.spelers}>
                {uur.playerIds.map((id) => (
                  <View key={id} style={styles.speler}>
                    <Text style={styles.naam} numberOfLines={1}>{naamVan(id)}</Text>
                    <MemoKnop
                      naam={naamVan(id)}
                      alGehad={heeftMemo(memos, uur.booking.id, id)}
                      // De belofte gaat terug naar de knop en wordt hier níét weggegooid:
                      // mislukt het wegschrijven, dan houdt de knop de opname vast.
                      onOpname={(audio_uri, duration_ms) => addMemo({
                        student_id: id,
                        coach_id: coachId,
                        booking_id: uur.booking.id,
                        audio_uri,
                        duration_ms,
                      })}
                    />
                  </View>
                ))}
              </View>
            ) : null}
          </Card>
        );
      })}

      {werk.length > 0 ? <Werkregel aantal={werk.length} /> : null}
    </View>
  );

  function Werkregel({ aantal }: { aantal: number }) {
    return (
      <Pressable
        onPress={() => router.push('/memos')}
        accessibilityRole="button"
        accessibilityLabel={t('{n} memo\'s uit te werken', { n: aantal })}
        style={[styles.werk, webCursor]}
      >
        <Text style={styles.werkTekst}>
          {aantal === 1 ? t('1 memo uit te werken') : t('{n} memo\'s uit te werken', { n: aantal })}
        </Text>
        <ChevronRight size={18} color={tennisColors.primary} />
      </Pressable>
    );
  }
}

const styles = StyleSheet.create({
  blok: { gap: spacing.sm },
  les: { gap: spacing.sm },
  // Een gegeven les blijft staan maar vraagt geen aandacht meer.
  voorbij: { opacity: 0.6 },
  kop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  nuStip: { width: 8, height: 8, borderRadius: 4, backgroundColor: tennisColors.primary },
  tijd: { ...typography.h3, color: tennisColors.text },
  baan: { fontSize: 13, color: tennisColors.textMuted },
  aantal: { fontSize: 13, color: tennisColors.text, marginLeft: 'auto' },
  spelers: { gap: spacing.sm },
  speler: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  naam: { ...typography.h3, color: tennisColors.text, flexShrink: 1 },
  werk: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    borderRadius: radius.sm, backgroundColor: tennisColors.primaryTint,
  },
  werkTekst: { color: tennisColors.primary, fontWeight: '700', fontSize: 14 },
  leeg: { gap: spacing.sm },
  leegTekst: { color: tennisColors.textMuted, fontSize: 14 },
});
```

> Let op de `setGekozen(open ? '' : uur.booking.id)`: een lege tekst betekent "alles dicht"
> en is iets anders dan `null` ("nog niets gekozen, dus wat `lesdagVan` koos"). Dat verschil
> is de reden dat een trainer een les kán dichtklappen.

- [ ] **Step 2: Zet het blok op het startscherm**

In `app/index.tsx`, in de `return`, direct ná het `header`-blok en vóór het saldo-blok:

```tsx
      {/* De lesdag hoort bovenaan: wat een trainer om vijf voor vijf wil zien, is de les
          van vijf uur — niet een keuzemenu. De tegels blijven eronder staan. */}
      {isCoach ? <Lesdag coachId={currentUser.id} /> : null}
```

En bovenaan `import { Lesdag } from '../components/lesdag/Lesdag';`.

- [ ] **Step 3: De Engelse zinnen**

In `lib/i18n-en.ts`:

```ts
  'Vandaag geen lessen.': 'No lessons today.',
  '1 memo uit te werken': '1 memo to write up',
  '{n} memo\'s uit te werken': '{n} memos to write up',
```

(`'{n} spelers'` en `'Onbekend'` staan er al.)

- [ ] **Step 4: Controleer en commit**

Run: `npx tsc --noEmit && npm test`

Daarna met de hand op `npx expo start --web`: log in als trainer, maak een les die nú bezig
is, en kijk of de lesdag bovenaan staat met de juiste les open.

```bash
git add components/lesdag/Lesdag.tsx app/index.tsx lib/i18n-en.ts
git commit -m "feat(lesdag): het startscherm opent op de lessen van vandaag"
```

---

## Task 8: De uitwerklijst

**Files:**
- Modify: `components/progress/ProgressForm.tsx:29-40` (de eigenschappen), `:56-70` (het
  terugzetten van de velden), `:88-98` (`persist`)
- Create: `app/memos.tsx`
- Modify: `lib/i18n-en.ts`

- [ ] **Step 1: Geef `ProgressForm` beginwaarden en een eigen opslagweg**

Twee nieuwe eigenschappen. Voeg toe aan de parameterlijst en aan het type:

```tsx
export function ProgressForm({
  visible, onClose, studentId, entry = null, canEdit = true, preset, onCreate,
}: {
  visible: boolean;
  onClose: () => void;
  studentId?: string;
  entry?: StudentProgress | null;
  canEdit?: boolean;
  /**
   * Waarmee een níeuwe notitie begint. De uitwerklijst geeft hier de opname en het
   * tijdstip van de memo mee: die staan al vast, alleen de tekst moet er nog bij.
   */
  preset?: { voice_memo_uri?: string; created_at?: string };
  /**
   * Wie de nieuwe notitie wegschrijft. Leeg is `addProgress`, zoals altijd. De
   * uitwerklijst geeft hier `werkMemoUit` mee, zodat de notitie en het opruimen van de
   * memo één opslag zijn en niet twee.
   */
  onCreate?: (notitie: Omit<StudentProgress, 'id'>) => Promise<void>;
}) {
```

In het `useEffect` dat de velden terugzet (rond regel 56), de spraakmemoregel vervangen:

```tsx
    setVoiceUri(entry?.voice_memo_uri ?? preset?.voice_memo_uri);
```

En de afhankelijkheden van dat effect uitbreiden naar `[visible, entry?.id, preset?.voice_memo_uri]`.

In `persist` (rond regel 88), de nieuwe-notitietak:

```tsx
    if (!currentUser) return;
    const notitie: Omit<StudentProgress, 'id'> = {
      ...fields(),
      student_id: targetId,
      coach_id: currentUser.id,
      // Het tijdstip van de opname, niet van het uitwerken: een notitie hoort in het
      // dossier op de dag te staan waar hij over gaat.
      created_at: preset?.created_at,
    };
    if (onCreate) {
      await onCreate(notitie);
      return;
    }
    await addProgress(notitie);
```

- [ ] **Step 2: Schrijf de uitwerklijst**

Maak `app/memos.tsx`:

```tsx
// De memo's die nog uitgewerkt moeten worden. Oudste bovenaan, want die vergeet je het snelst.
//
// Uitwerken hergebruikt het gewone voortgangsblad: het zijn dezelfde velden, en een tweede
// blad ernaast zou bij elke wijziging aan het formulier uit de pas gaan lopen. De speler,
// de opname en het tijdstip staan al ingevuld; er valt alleen nog te typen wat je hoorde.

import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { Screen } from '../components/ui/Screen';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ProgressForm } from '../components/progress/ProgressForm';
import { AudioMemo } from '../components/progress/ProgressViews';
import { useSimpleData } from '../providers/SimpleDataProvider';
import { memoDuur, memoNaarNotitie, uitTeWerken } from '../lib/memo';
import { formatDayTime } from '../lib/datetime';
import { tennisColors } from '../constants/tennis-colors';
import { spacing, typography, webCursor } from '../constants/theme';
import { useT } from '../lib/i18n';
import type { Memo } from '../lib/types';

export default function Memos() {
  const t = useT();
  const { currentUser, users, memos, deleteMemo, werkMemoUit } = useSimpleData();
  const [bezig, setBezig] = useState<Memo | null>(null);
  // Weggooien is onomkeerbaar, dus het gebeurt nooit met één tik.
  const [weg, setWeg] = useState<string | null>(null);

  const lijst = currentUser ? uitTeWerken(memos, currentUser.id) : [];
  const naamVan = (id: string): string =>
    users.find((u) => u.id === id)?.name ?? t('Onbekend');
  const preset = bezig ? memoNaarNotitie(bezig) : null;

  return (
    <Screen>
      <Text style={styles.titel}>{t('Nog uit te werken')}</Text>

      {lijst.length === 0 ? (
        <Text style={styles.leeg}>{t('Niets meer uit te werken. Netjes.')}</Text>
      ) : (
        lijst.map((memo) => (
          <Card key={memo.id} style={styles.rij}>
            <View style={styles.kop}>
              <Text style={styles.naam}>{naamVan(memo.student_id)}</Text>
              <Text style={styles.duur}>{memoDuur(memo.duration_ms)}</Text>
              <Text style={styles.wanneer}>{formatDayTime(memo.created_at)}</Text>
            </View>

            <AudioMemo uri={memo.audio_uri} />

            <View style={styles.knoppen}>
              <Button label={t('Uitwerken')} onPress={() => setBezig(memo)} />
              <Pressable
                onPress={() => setWeg(weg === memo.id ? null : memo.id)}
                accessibilityRole="button"
                accessibilityLabel={t('Memo weggooien')}
                style={[styles.weg, webCursor]}
              >
                <Trash2 size={18} color={tennisColors.danger} />
              </Pressable>
            </View>

            {weg === memo.id ? (
              <View style={styles.bevestig}>
                <Text style={styles.bevestigTekst}>
                  {t('Weggooien? De opname is niet terug te halen.')}
                </Text>
                <Button
                  label={t('Weggooien')}
                  variant="danger"
                  onPress={() => { setWeg(null); void deleteMemo(memo.id); }}
                />
              </View>
            ) : null}
          </Card>
        ))
      )}

      {/* Hetzelfde blad als overal, alleen met de speler, de opname en de dag al ingevuld. */}
      {bezig && preset ? (
        <ProgressForm
          visible
          studentId={preset.student_id}
          preset={{ voice_memo_uri: preset.voice_memo_uri, created_at: preset.created_at }}
          onCreate={(notitie) => werkMemoUit(bezig.id, notitie)}
          onClose={() => setBezig(null)}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  titel: { ...typography.h1, color: tennisColors.text },
  leeg: { color: tennisColors.textMuted, fontSize: 14 },
  rij: { gap: spacing.sm },
  kop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  naam: { ...typography.h3, color: tennisColors.text },
  duur: { fontSize: 13, color: tennisColors.text },
  wanneer: { fontSize: 13, color: tennisColors.textMuted, marginLeft: 'auto' },
  knoppen: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  weg: { padding: 8 },
  bevestig: { gap: spacing.sm },
  bevestigTekst: { fontSize: 13, color: tennisColors.text },
});
```

> Controleer twee dingen in bestaande bestanden voor je dit overneemt:
> `AudioMemo` moet uit `components/progress/ProgressViews.tsx` geëxporteerd zijn (dat is hij,
> `ProgressForm` gebruikt hem al), en `Button` moet een variant `danger` kennen — zo niet,
> gebruik de variant die elders bij verwijderen gebruikt wordt (kijk in `ProgressForm` bij
> `confirmingDelete`).

- [ ] **Step 3: De Engelse zinnen**

```ts
  'Nog uit te werken': 'To write up',
  'Niets meer uit te werken. Netjes.': 'Nothing left to write up. Well done.',
  'Uitwerken': 'Write up',
  'Memo weggooien': 'Discard memo',
  'Weggooien? De opname is niet terug te halen.': 'Discard? The recording cannot be recovered.',
  'Weggooien': 'Discard',
```

- [ ] **Step 4: Controleer en commit**

Run: `npx tsc --noEmit && npm test`

```bash
git add components/progress/ProgressForm.tsx app/memos.tsx lib/i18n-en.ts
git commit -m "feat(memo): de uitwerklijst, en de notitie die eruit voortkomt"
```

---

## Task 9: Met de hand nalopen en het openstaande werk bijwerken

**Files:**
- Modify: `OPENSTAAND.md`

- [ ] **Step 1: Loop deze lijst na in de browser**

Draai `npx expo start --web` **zonder** Supabase-sleutels in `.env`, zodat je op de lokale
opslag test en niet op de gegevens van de club.

- [ ] Opnemen: knop indrukken, praten, loslaten → er verschijnt een vinkje bij die speler.
- [ ] Te kort: even aantikken en loslaten → "te kort", geen memo erbij.
- [ ] Aftellen: vasthouden tot voorbij de vijftig seconden → er verschijnt "nog 10s", en bij
      zestig stopt hij vanzelf en is de memo bewaard.
- [ ] Toestemming weigeren in de browser → een regel op de knop, geen venster.
- [ ] Een dag zonder lessen → "Vandaag geen lessen." en de tegels eronder.
- [ ] Een les die nu bezig is staat open; een dag waarvan alles voorbij is toont de laatste les.
- [ ] Uitwerken: het blad opent met de speler en de opname erin; bewaren maakt één notitie in
      het dossier van die speler, met de datum van de opname, en de memo is uit de lijst weg.
- [ ] Opslaan mislukt: zet het netwerk uit (of gebruik de databankmodus zonder verbinding),
      neem op → de opname blijft in beeld met "niet bewaard — opnieuw", en die knop bewaart
      hem alsnog zodra de verbinding er weer is.
- [ ] Weggooien vraagt eerst na.
- [ ] Als speler inloggen: geen lesdag, geen memoregel, het startscherm zoals het was.
- [ ] Taal op Engels zetten: nergens Nederlands blijven staan.

- [ ] **Step 2: Werk `OPENSTAAND.md` bij**

In "Wat er nog moet gebeuren", punt 3 van de lijst met grotere dingen: streep punt 8
("Voortgang over tijd") niet door — die staat er nog — maar voeg onder "Achterstallig klein
werk" toe:

```markdown
- **Memo's blijven liggen als je ze nooit uitwerkt.** Dat is met opzet (het is een
  werklijst, geen postvak dat opruimt), maar er staat geen grens op. Een trainer die een
  half jaar niets uitwerkt, sleept al die audio bij elke start mee. Zodra dat gebeurt, is
  Supabase Storage het antwoord — zie de spec van 22 augustus.
- **Spraak-naar-tekst** zou het uitwerken van een memo bijna overbodig maken; op web bestaat
  het in deze app nog niet (`components/SpeechToText.tsx` is een plaatshouder).
```

En noteer bij "Waar staat het nu" dat de tabel `memos` in Supabase aangemaakt moet worden
door het bijgewerkte `supabase-schema.sql` te draaien.

- [ ] **Step 3: Commit**

```bash
git add OPENSTAAND.md
git commit -m "docs(openstaand): wat de memo's nog openlaten"
```

---

## Wat dit plan bewust niet doet

- **Geen aanwezigheid.** Wie er was en wie niet raakt de beurtenkaart en de facturatie en is
  een eigen onderwerp.
- **Geen offline opslag.** Mislukt het wegschrijven, dan meldt de app dat en blijft de
  opname in beeld — maar hij staat nog niet in een wachtrij. Dat is de volgende spec en
  raakt `commit` in `providers/SimpleDataProvider.tsx:194`, niet deze schermen.
- **Geen tests op schermen.** Dit project heeft ze nergens; deze taak is niet de plek om dat
  te veranderen. Dat is ook precies waarom alles wat te beslissen valt in `lib/memo.ts` en
  `lib/lesdag.ts` staat en niet in de knop.
- **Geen opname op een telefoon-app.** `MediaRecorder` bestaat daar niet; de knop toont dan
  dat opnemen niet kan. De weg daarheen staat in `docs/voice-memo-native.md`.
