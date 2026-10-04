# Facturatie Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Koen factureert zijn trainersuren aan VZW Gantoise en VZW Racso vanuit de app in plaats van vanuit `facturen.xlsx`.

**Architecture:** Vier nieuwe `lib/`-modules met het volledige rekenwerk (zuivere functies, volledig getest), een uitbreiding van de bestaande xlsx-schrijver voor een vrij blad, een eigen opslaglaag naast `SimpleDataProvider` (zoals `bezetteUren` dat al doet), en één scherm onder `/admin/facturatie` met vier bladen. De facturatie schrijft nooit in de rest van de app; ze leest alleen `bookings` om de uren van Gantoise te kunnen tonen.

**Tech Stack:** TypeScript, React Native / Expo Router, Jest (`jest-expo`), Supabase (PostgREST + RLS). Geen nieuwe pakketten.

**Spec:** `docs/superpowers/specs/2026-10-04-facturatie-design.md` — lees die eerst.

> **Bijgewerkt op 4 oktober 2026, ná taak 1 en 2.** Racso vraagt elke maand een overzicht
> van de extra lessen. Dat komt als tweede tabblad mee in hetzelfde bestand. Geraakt:
> taak 4 (een type en een functie erbij), taak 5 (een werkmap met twee vrije bladen),
> taak 6 (het tweede tabblad), taak 7 (een kolom erbij), taak 10 (twee knoppen) en
> taak 12 (de extra lessen meegeven).

---

## Belangrijk voor wie dit uitvoert

- **Taal.** Code, commentaar, commits en schermteksten zijn Nederlands. Commentaar legt uit *waarom*, niet *wat*. Kijk naar `lib/money.ts` en `lib/lesgever.ts` voor de toon.
- **Veldnamen in TypeScript zijn `snake_case`**, gelijk aan de kolomnamen in de databank. Dat doet de rest van de app ook (`Booking.coach_id`, `start_time`), en het scheelt een vertaallaag.
- **De dev-server praat met de echte databank van de club.** Draai `FACTURATIE.sql` pas als taak 7 af is, en test daarna alleen op het eigen account.
- **Elke oplevering:** `npx tsc --noEmit`, `npm test`, `npx expo export -p web`.
- **Niet pushen naar `main`** zonder dat de gebruiker het vraagt.

## Bestandsoverzicht

| bestand | verantwoordelijkheid |
|---|---|
| `lib/facturatie.ts` | types, toegang, clubherkenning, urentelling, een factuur samenstellen |
| `lib/facturatie.test.ts` | tests daarvan |
| `lib/facturatie-plak.ts` | de plaktekst lezen en ontdubbelen — kent geen databank en geen scherm |
| `lib/facturatie-plak.test.ts` | tests daarvan |
| `lib/facturatie-xlsx.ts` | een `Factuur` omzetten naar een blad voor de xlsx-schrijver |
| `lib/facturatie-xlsx.test.ts` | tests daarvan |
| `lib/xlsx.ts` (wijzigen) | erbij: een blad met cellen op hun plaats in plaats van een tabel |
| `lib/xlsx.test.ts` (wijzigen) | tests erbij |
| `FACTURATIE.sql` | de vier tabellen met hun RLS |
| `providers/facturatieStore.ts` | de Supabase-kant van laden en bewaren |
| `providers/facturatieLokaal.ts` | dezelfde vorm op AsyncStorage, voor een app zonder `.env` |
| `providers/backend.ts` (wijzigen) | `facturatie` erbij op `Backend` |
| `app/admin/facturatie.tsx` | de schil: laden, rechten, de vier bladen |
| `components/facturatie/LessenBlad.tsx` | plakken, de lijst, privélessen |
| `components/facturatie/InstellingenBlad.tsx` | mijn gegevens en de klanten |
| `components/facturatie/FactuurBlad.tsx` | de maand, de bronkeuze, de factuur maken |
| `components/facturatie/RegisterBlad.tsx` | de gemaakte facturen |
| `app/admin/index.tsx` (wijzigen) | de tegel ernaartoe |
| `OPENSTAAND.md` (wijzigen) | de stand bijwerken |

---

## Task 1: Het fundament van `lib/facturatie.ts`

De types die alle andere bestanden gebruiken, plus de kleine helpers. Zonder dit compileert niets anders.

**Files:**
- Create: `lib/facturatie.ts`
- Test: `lib/facturatie.test.ts`

- [ ] **Step 1: Write the failing test**

Maak `lib/facturatie.test.ts`:

```ts
import {
  magFactureren, schoon, sleutelVan, rond2, plusDagen, MAANDNAMEN, urenVan,
  type Factuurles,
} from './facturatie';

/** Een geplakte les met alleen de velden die de test nodig heeft ingevuld. */
function les(velden: Partial<Factuurles>): Factuurles {
  return {
    id: 'l1',
    bron: 'geplakt',
    club_tekst: 'GANTOISE',
    aanbod: '',
    doelgroep: '',
    groep: 'Duoles - Groep 4',
    dag_uur: 'wo 09/09/2026 14:00 - 15:00',
    trainer: 'Leemans Koen',
    status: '',
    datum: '2026-09-09',
    uren: 1,
    uren_handmatig: null,
    actief: true,
    naam_prive: '',
    type_prive: '',
    sleutel: sleutelVan('GANTOISE', 'Duoles - Groep 4', 'wo 09/09/2026 14:00 - 15:00'),
    ...velden,
  };
}

describe('magFactureren', () => {
  it('laat het adres van Koen door, in elke schrijfwijze', () => {
    expect(magFactureren('leemanskoen@telenet.be')).toBe(true);
    expect(magFactureren('  Leemanskoen@Telenet.BE ')).toBe(true);
  });

  it('houdt elk ander adres tegen', () => {
    expect(magFactureren('trainer@trainer.be')).toBe(false);
    expect(magFactureren('')).toBe(false);
    expect(magFactureren(null)).toBe(false);
    expect(magFactureren(undefined)).toBe(false);
  });
});

describe('schoon', () => {
  it('haalt spaties aan de randen weg en knijpt dubbele spaties samen', () => {
    expect(schoon('  T.C.   RACSO ')).toBe('T.C. RACSO');
  });

  it('negeert hoofdletters', () => {
    expect(schoon('t.c. racso')).toBe('T.C. RACSO');
  });

  it('behandelt een tab als een spatie — zo komt tekst uit Excel binnen', () => {
    expect(schoon('T.C.\tRACSO')).toBe('T.C. RACSO');
  });
});

describe('sleutelVan', () => {
  it('maakt dezelfde sleutel van dezelfde les, hoe hij ook getypt staat', () => {
    expect(sleutelVan(' gantoise ', 'Duoles - Groep 4', 'wo 09/09/2026 14:00 - 15:00'))
      .toBe(sleutelVan('GANTOISE', 'DUOLES - GROEP 4', 'WO 09/09/2026 14:00 - 15:00'));
  });

  it('houdt twee verschillende groepen uit elkaar', () => {
    expect(sleutelVan('GANTOISE', 'Groep 4', 'wo 09/09/2026 14:00 - 15:00'))
      .not.toBe(sleutelVan('GANTOISE', 'Groep 5', 'wo 09/09/2026 14:00 - 15:00'));
  });

  it('botst niet als een veld zelf een scheidingsteken bevat', () => {
    expect(sleutelVan('A|B', 'C', 'D')).not.toBe(sleutelVan('A', 'B|C', 'D'));
  });
});

describe('rond2', () => {
  it('rondt af op twee decimalen', () => {
    expect(rond2(1.005)).toBe(1.01);
    expect(rond2(33 * 1.5)).toBe(49.5);
  });

  it('rondt een half naar boven, ook waar het binaire getal er net onder ligt', () => {
    expect(rond2(35.855)).toBe(35.86);
    expect(rond2(5.015)).toBe(5.02);
  });

  it('laat een bedrag dat al klopt met rust', () => {
    expect(rond2(248)).toBe(248);
    expect(rond2(31 * 8)).toBe(248);
  });

  it('rondt een negatief half getal van nul weg', () => {
    expect(rond2(-1.005)).toBe(-1.01);
  });
});

describe('plusDagen', () => {
  it('telt vijftien dagen op bij een factuurdatum', () => {
    expect(plusDagen('2026-10-01', 15)).toBe('2026-10-16');
  });

  it('gaat over de maandgrens', () => {
    expect(plusDagen('2026-10-25', 15)).toBe('2026-11-09');
  });

  it('gaat over de jaargrens', () => {
    expect(plusDagen('2026-12-28', 15)).toBe('2027-01-12');
  });

  it('kan ook achteruit', () => {
    expect(plusDagen('2026-01-03', -5)).toBe('2025-12-29');
  });
});

describe('MAANDNAMEN', () => {
  it('begint bij januari en eindigt bij december', () => {
    expect(MAANDNAMEN).toHaveLength(12);
    expect(MAANDNAMEN[0]).toBe('Januari');
    expect(MAANDNAMEN[8]).toBe('September');
    expect(MAANDNAMEN[11]).toBe('December');
  });
});

describe('urenVan', () => {
  it('neemt de gerekende uren als er niets met de hand gezet is', () => {
    expect(urenVan(les({ uren: 1.5 }))).toBe(1.5);
  });

  it('laat een handmatig getal voorgaan, ook als dat nul is', () => {
    expect(urenVan(les({ uren: 1, uren_handmatig: 0.5 }))).toBe(0.5);
    expect(urenVan(les({ uren: 1, uren_handmatig: 0 }))).toBe(0);
  });

  it('geeft nul als er niets gerekend is en niets gezet', () => {
    expect(urenVan(les({ uren: 0, uren_handmatig: null }))).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest lib/facturatie.test.ts`
Expected: FAIL — "Cannot find module './facturatie'".

- [ ] **Step 3: Write the implementation**

Maak `lib/facturatie.ts`:

```ts
// Facturatie — het rekenwerk achter Beheer → Facturatie.
//
// Dit bestand kent geen databank en geen scherm. Het kent lessen, klanten en facturen, en
// het rekent. Daardoor is alles hier te testen zonder Supabase en zonder React.
//
// De veldnamen zijn snake_case en gelijk aan de kolomnamen in FACTURATIE.sql, net zoals
// `Booking` in lib/types dat is. Dat scheelt een vertaallaag tussen scherm en databank, en
// een vertaallaag is precies de plek waar een veld stilletjes verdwijnt.

/**
 * Wie deze schermen mag zien.
 *
 * Eén adres, want dit is de boekhouding van één persoon en geen voorziening van de club.
 * De app is hier niet de bewaker — dat is de RLS in FACTURATIE.sql, die op `auth.uid()`
 * kijkt. Dit zorgt alleen dat het scherm niet aangeboden wordt aan wie er niets te zoeken
 * heeft.
 */
const FACTURATIE_ADRES = 'leemanskoen@telenet.be';

export function magFactureren(email: string | null | undefined): boolean {
  return (email ?? '').trim().toLowerCase() === FACTURATIE_ADRES;
}

/**
 * Een naam zoals hij vergeleken wordt: zonder spaties aan de randen, zonder dubbele spaties
 * binnenin, en zonder verschil tussen hoofd- en kleine letters.
 *
 * Verder niets. Geen "begint met", geen gedeeltelijke match: anders zou de clubnaam `RACSO`
 * ook `T.C. RACSO II` vangen, en dan telt een factuur uren van een club die er niet bij
 * hoort.
 */
export function schoon(tekst: string): string {
  return tekst.trim().replace(/\s+/g, ' ').toUpperCase();
}

/**
 * Waarmee de drie velden van een sleutel gescheiden worden: U+001F, "unit separator".
 *
 * Een gewoon leesteken zou botsen. Met een streepje krijgen ("A|B", "C", "D") en
 * ("A", "B|C", "D") dezelfde sleutel, en dan houdt de ontdubbeling twee verschillende
 * lessen voor één en verdwijnt er één van de factuur — precies het omgekeerde van waarvoor
 * de sleutel bestaat. U+001F komt in geplakte tekst niet voor.
 *
 * Niet U+0000, hoe verleidelijk ook: Postgres weigert dat teken in een tekstkolom, en deze
 * sleutel gaat de databank in.
 */
const VELDSCHEIDER = '\u001f';

/**
 * Wanneer zijn twee geplakte regels dezelfde les: club, groep en dag/uur gelijk.
 *
 * Dit is wat een tweede plakbeurt tegenhoudt. Zonder zo'n sleutel komt elke les die je in
 * oktober nog eens plakt er een tweede keer bij, en telt de factuur van september dubbel.
 */
export function sleutelVan(clubTekst: string, groep: string, dagUur: string): string {
  return [schoon(clubTekst), schoon(groep), schoon(dagUur)].join(VELDSCHEIDER);
}

/**
 * Twee decimalen. Elk bedrag en elk urental in dit bestand gaat hier doorheen.
 *
 * Niet `Math.round(n * 100) / 100`: 35,855 ligt als binair getal nét ónder 35,855, en dan
 * wordt het 35,85 terwijl iedereen 35,86 verwacht. Op een factuur is dat de cent waar de
 * optelling van wie het natelt op strandt. De speling van een miljardste vangt dat op; ze
 * is absoluut en niet relatief, en bij bedragen van deze grootte is dat ruim genoeg.
 *
 * Een half bedrag gaat van nul wég, ook met een minteken ervoor: -1,005 wordt -1,01 en
 * niet -1,00. Zo is afronden dezelfde bewerking aan beide kanten van nul.
 */
export function rond2(n: number): number {
  const teken = n < 0 ? -1 : 1;
  return (teken * Math.round(Math.abs(n) * 100 + 1e-9)) / 100;
}

/**
 * Een dag verderop, op een datum van de vorm `2026-10-01`.
 *
 * Met `Date.UTC` en niet met een gewone `new Date(tekst)`: een factuurdatum is een dag op de
 * kalender en geen tijdstip, en bij een zomertijdsprong schuift een tijdstip een uur op —
 * genoeg om er een dag naast te zitten.
 */
export function plusDagen(iso: string, dagen: number): string {
  const [j, m, d] = iso.split('-').map(Number);
  const ms = Date.UTC(j, m - 1, d) + dagen * 86_400_000;
  const uit = new Date(ms);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${uit.getUTCFullYear()}-${two(uit.getUTCMonth() + 1)}-${two(uit.getUTCDate())}`;
}

/**
 * De maandnamen zoals ze op de factuur komen; index 0 is januari.
 *
 * Een eigen lijst naast die in lib/kalenderrooster en `monthName` in lib/period, om
 * dezelfde reden als daar: een factuur is een Belgisch document en blijft Nederlands, ook
 * als iemand de app op Engels zet. Zou hij door `t()` gaan, dan stond er "Invoice for
 * September" op een factuur aan een Gentse vzw.
 */
export const MAANDNAMEN = [
  'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
  'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December',
] as const;

// ---------------------------------------------------------------------------
// Wat er in de databank staat
// ---------------------------------------------------------------------------

/** Mijn eigen gegevens, zoals ze bovenaan de factuur komen. Er is er precies één van. */
export interface Leverancier {
  id: string;
  naam: string;
  adres: string;
  btw: string;
  iban: string;
  bic: string;
}

/** Waar de uren van een klant vandaan komen. Zie "Twee bronnen" in de spec. */
export type Bron = 'geplakt' | 'app';

/** Een club waaraan gefactureerd wordt. */
export interface Klant {
  id: string;
  klantnaam: string;
  adres: string;
  postcode_gemeente: string;
  btw_nummer: string;
  uurtarief: number;
  korte_naam: string;
  /** Onder welke naam deze club in de geplakte tekst staat — "T.C. RACSO", niet "RACSO". */
  naam_in_lijst: string;
  btw_percentage: number;
  bron_voorkeur: Bron;
  volgorde: number;
}

/** Een geplakte les, of een privéles die met de hand is bijgetikt. */
export type Lesbron = 'geplakt' | 'prive';

export interface Factuurles {
  id: string;
  bron: Lesbron;
  /** De clubnaam zoals hij in de plaktekst stond. Bij een privéles: de korte naam. */
  club_tekst: string;
  aanbod: string;
  doelgroep: string;
  groep: string;
  dag_uur: string;
  trainer: string;
  status: string;
  /** `2026-09-09`. Een dag op de kalender, geen tijdstip. */
  datum: string;
  uren: number;
  /** Met de hand gezet; gaat voor op `uren`. `null` betekent "niets aangepast". */
  uren_handmatig: number | null;
  /** Geschrapt is `false`. De rij blijft bestaan, anders komt ze bij de volgende plakbeurt terug. */
  actief: boolean;
  naam_prive: string;
  type_prive: string;
  sleutel: string;
}

/** Een extra lijn op de factuur, los van het uurtarief. */
export interface VrijeLijn {
  omschrijving: string;
  aantal: number;
  eenheid: string;
  tarief: number;
}

/**
 * Een gemaakte factuur.
 *
 * De klantgegevens staan hier uitgeschreven en niet als verwijzing naar `Klant`: verhuist een
 * club volgend jaar, dan mag een factuur van vorig jaar niet van adres veranderen.
 */
export interface Factuur {
  id: string;
  factuurnr: string;
  klant_naam: string;
  klant_adres: string;
  klant_postcode_gemeente: string;
  klant_btw: string;
  factuurdatum: string;
  vervaldatum: string;
  omschrijving: string;
  dienstmaand: number;
  dienstjaar: number;
  aantal_uren: number;
  uurtarief: number;
  netto: number;
  btw_percentage: number;
  btw_bedrag: number;
  totaal: number;
  vrije_lijnen: VrijeLijn[];
  betaald: boolean;
  betaald_op: string | null;
  opmerking: string;
  aangemaakt: string;
}

/** Alles wat het scherm nodig heeft, in één keer opgehaald. */
export interface FacturatieData {
  leverancier: Leverancier;
  klanten: Klant[];
  lessen: Factuurles[];
  facturen: Factuur[];
}

/** De uren van één les: wat met de hand gezet is, anders wat gerekend is. */
export function urenVan(les: Factuurles): number {
  return les.uren_handmatig ?? les.uren;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest lib/facturatie.test.ts`
Expected: PASS — 19 tests.

- [ ] **Step 5: Check types**

Run: `npx tsc --noEmit`
Expected: geen uitvoer.

- [ ] **Step 6: Commit**

```bash
git add lib/facturatie.ts lib/facturatie.test.ts
git commit -m "feat(facturatie): de types en de kleine helpers"
```

---

## Task 2: De plaktekst lezen

**Files:**
- Create: `lib/facturatie-plak.ts`
- Test: `lib/facturatie-plak.test.ts`

- [ ] **Step 1: Write the failing test**

Maak `lib/facturatie-plak.test.ts`:

```ts
import { leesPlaktekst, verwerkPlak, type GeplakteLes } from './facturatie-plak';
import { sleutelVan, type Factuurles } from './facturatie';

const KOP = [
  'Club', 'Aanbod', 'Doelgroep', 'Groep', 'Dag + uur', 'Trainer',
  'Aanwezigh.', 'Uur/locatie gewijzigd?', 'Status', 'Bedrag',
].join('\n');

/** Eén regel zoals hij uit het clubsysteem komt: velden gescheiden door tabs. */
function regel(club: string, groep: string, dagUur: string): string {
  return [club, 'Tennis - Jaarcyclus 2026 - 2027', 'Duoles', groep, dagUur,
    'Leemans Koen', '0/2', 'Nee', 'Te bevestigen', '0 €', ''].join('\t');
}

describe('leesPlaktekst', () => {
  it('leest een gewone regel', () => {
    const uit = leesPlaktekst(regel('GANTOISE', 'Duoles - Groep 4', 'wo 09/09/2026 14:00 - 15:00'));
    expect(uit.overgeslagen).toEqual([]);
    expect(uit.lessen).toHaveLength(1);
    expect(uit.lessen[0]).toMatchObject({
      club_tekst: 'GANTOISE',
      groep: 'Duoles - Groep 4',
      dag_uur: 'wo 09/09/2026 14:00 - 15:00',
      trainer: 'Leemans Koen',
      status: 'Te bevestigen',
      datum: '2026-09-09',
      uren: 1,
    });
  });

  it('slaat de koprij over zonder hem te melden', () => {
    const uit = leesPlaktekst(`${KOP}\n${regel('GANTOISE', 'G4', 'wo 09/09/2026 14:00 - 15:00')}`);
    expect(uit.lessen).toHaveLength(1);
    expect(uit.overgeslagen).toEqual([]);
  });

  it('slaat de koprij ook over als hij met tabs op één regel staat', () => {
    const koprij = KOP.split('\n').join('\t');
    const uit = leesPlaktekst(`${koprij}\n${regel('GANTOISE', 'G4', 'wo 09/09/2026 14:00 - 15:00')}`);
    expect(uit.lessen).toHaveLength(1);
    expect(uit.overgeslagen).toEqual([]);
  });

  it('rekent anderhalf uur uit een les van 14:00 tot 15:30', () => {
    const uit = leesPlaktekst(regel('GANTOISE', 'G4', 'wo 09/09/2026 14:00 - 15:30'));
    expect(uit.lessen[0].uren).toBe(1.5);
  });

  it('meldt een eindtijd die niet na de begintijd ligt', () => {
    const uit = leesPlaktekst(regel('GANTOISE', 'G4', 'wo 09/09/2026 15:00 - 14:00'));
    expect(uit.lessen).toEqual([]);
    expect(uit.overgeslagen).toHaveLength(1);
    expect(uit.overgeslagen[0].reden).toBe('de eindtijd ligt niet na de begintijd');
  });

  it('meldt een dag die niet bestaat', () => {
    const uit = leesPlaktekst(regel('GANTOISE', 'G4', 'wo 31/09/2026 14:00 - 15:00'));
    expect(uit.lessen).toEqual([]);
    expect(uit.overgeslagen[0].reden).toBe('die dag bestaat niet');
  });

  it('meldt een regel met te weinig velden', () => {
    const uit = leesPlaktekst('GANTOISE\tDuoles\two 09/09/2026 14:00 - 15:00');
    expect(uit.lessen).toEqual([]);
    expect(uit.overgeslagen[0].reden).toBe('minder dan vijf velden');
  });

  it('meldt een regel waarvan het vijfde veld geen dag en uur is', () => {
    const uit = leesPlaktekst(['A', 'B', 'C', 'D', 'ergens volgende week', 'F'].join('\t'));
    expect(uit.lessen).toEqual([]);
    expect(uit.overgeslagen[0].reden).toBe('geen leesbaar dag- en uurveld');
  });

  it('telt lege regels niet als overgeslagen', () => {
    const uit = leesPlaktekst(`\n   \n${regel('GANTOISE', 'G4', 'wo 09/09/2026 14:00 - 15:00')}\n\n`);
    expect(uit.lessen).toHaveLength(1);
    expect(uit.overgeslagen).toEqual([]);
  });

  it('leest regels die met \\r\\n gescheiden zijn', () => {
    const twee = [
      regel('GANTOISE', 'G4', 'wo 09/09/2026 14:00 - 15:00'),
      regel('T.C. RACSO', 'G36', 'za 03/10/2026 12:00 - 13:00'),
    ].join('\r\n');
    expect(leesPlaktekst(twee).lessen).toHaveLength(2);
  });

  it('geeft elke les een sleutel uit club, groep en dag/uur', () => {
    const uit = leesPlaktekst(regel('GANTOISE', 'Duoles - Groep 4', 'wo 09/09/2026 14:00 - 15:00'));
    expect(uit.lessen[0].sleutel)
      .toBe(sleutelVan('GANTOISE', 'Duoles - Groep 4', 'wo 09/09/2026 14:00 - 15:00'));
  });
});

describe('verwerkPlak', () => {
  function geplakt(groep: string, dagUur: string): GeplakteLes {
    return leesPlaktekst(regel('GANTOISE', groep, dagUur)).lessen[0];
  }

  it('noemt alles nieuw als er nog niets staat', () => {
    const uit = verwerkPlak([], [geplakt('G4', 'wo 09/09/2026 14:00 - 15:00')]);
    expect(uit.nieuw).toHaveLength(1);
    expect(uit.bekend).toBe(0);
  });

  it('herkent een les die al in de databank staat', () => {
    const les = geplakt('G4', 'wo 09/09/2026 14:00 - 15:00');
    const bestaand: Factuurles[] = [{
      ...les, id: 'x', uren_handmatig: null, actief: true, naam_prive: '', type_prive: '',
    }];
    const uit = verwerkPlak(bestaand, [les]);
    expect(uit.nieuw).toEqual([]);
    expect(uit.bekend).toBe(1);
  });

  it('herkent een geschrapte les ook als bekend, zodat schrappen blijft gelden', () => {
    const les = geplakt('G4', 'wo 09/09/2026 14:00 - 15:00');
    const bestaand: Factuurles[] = [{
      ...les, id: 'x', uren_handmatig: null, actief: false, naam_prive: '', type_prive: '',
    }];
    expect(verwerkPlak(bestaand, [les]).nieuw).toEqual([]);
  });

  it('houdt een dubbel binnen dezelfde plakbeurt tegen', () => {
    const les = geplakt('G4', 'wo 09/09/2026 14:00 - 15:00');
    const uit = verwerkPlak([], [les, les]);
    expect(uit.nieuw).toHaveLength(1);
    expect(uit.bekend).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest lib/facturatie-plak.test.ts`
Expected: FAIL — "Cannot find module './facturatie-plak'".

- [ ] **Step 3: Write the implementation**

Maak `lib/facturatie-plak.ts`:

```ts
// De lijst uit het clubsysteem lezen.
//
// Wat erin komt is wat iemand uit een webpagina kopieert en in een tekstvak plakt: velden
// gescheiden door tabs, regels gescheiden door een nieuwe regel, met of zonder koprij.
//
// Eén regel hierover: wat niet gelezen kan worden, verdwijnt niet stilletjes. Het komt als
// overgeslagen regel met reden terug, en het scherm toont hem letterlijk. Een factuur die
// twee uur te weinig telt omdat één regel niet geparsed werd, is erger dan een melding.

import { rond2, schoon, sleutelVan, type Factuurles } from './facturatie';

/** Een gelezen regel: een `Factuurles` zonder de velden die pas bij het bewaren ontstaan. */
export type GeplakteLes =
  Omit<Factuurles, 'id' | 'uren_handmatig' | 'actief' | 'naam_prive' | 'type_prive'>;

export interface OvergeslagenRegel {
  regel: string;
  reden: string;
}

export interface PlakResultaat {
  lessen: GeplakteLes[];
  overgeslagen: OvergeslagenRegel[];
}

/**
 * De woorden van de koprij. Ze worden stilzwijgend overgeslagen, ook als ze elk op een eigen
 * regel staan — zo komt een koprij uit een webpagina vaak binnen.
 *
 * Waarom een lijst en geen "sla de eerste regel over": bij een plakbeurt zonder koprij zou
 * dat een echte les kosten, en die telt dan niet mee op de factuur zonder dat iemand het
 * merkt.
 */
const KOPWOORDEN = new Set([
  'CLUB', 'AANBOD', 'DOELGROEP', 'GROEP', 'DAG + UUR', 'TRAINER',
  'AANWEZIGH.', 'UUR/LOCATIE GEWIJZIGD?', 'STATUS', 'BEDRAG',
]);

/** `wo 09/09/2026 14:00 - 15:00` — de dagafkorting telt niet mee, de rest wel. */
const DAG_UUR = /^[a-z]{2,3}\s+(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/i;

interface Gelezen {
  datum: string;
  uren: number;
}

/** Het dag-en-uurveld, of een reden waarom het niet te lezen is. */
function leesDagUur(veld: string): Gelezen | string {
  const m = DAG_UUR.exec(veld.trim().replace(/\s+/g, ' '));
  if (!m) return 'geen leesbaar dag- en uurveld';

  const [, dd, mm, jjjj, su, sm, eu, em] = m;
  const d = Number(dd), maand = Number(mm), jaar = Number(jjjj);
  const proef = new Date(jaar, maand - 1, d);
  if (proef.getFullYear() !== jaar || proef.getMonth() !== maand - 1 || proef.getDate() !== d) {
    return 'die dag bestaat niet';
  }

  const minuten = (Number(eu) * 60 + Number(em)) - (Number(su) * 60 + Number(sm));
  // Nul of minder is geen les van nul uur maar een regel die niet klopt. Nul uur zou
  // stilletjes goed gaan en op de factuur niets zijn; een melding is eerlijker.
  if (minuten <= 0) return 'de eindtijd ligt niet na de begintijd';

  const two = (n: number) => String(n).padStart(2, '0');
  return { datum: `${jaar}-${two(maand)}-${two(d)}`, uren: rond2(minuten / 60) };
}

/** Is dit de koprij — als volledige rij, of als los kopwoord op een eigen regel? */
function isKop(velden: string[]): boolean {
  return velden.every((v) => KOPWOORDEN.has(schoon(v)));
}

/**
 * De geplakte tekst uit elkaar halen.
 *
 * De kolom `Bedrag` wordt bewust niet gelezen: in de lijst van Gantoise staat daar 0 €, en
 * het echte tarief staat bij de klant. Een factuur die zijn tarief uit de plaktekst haalt,
 * zou voor Gantoise nul euro bedragen.
 */
export function leesPlaktekst(tekst: string): PlakResultaat {
  const lessen: GeplakteLes[] = [];
  const overgeslagen: OvergeslagenRegel[] = [];

  for (const ruw of tekst.split(/\r\n|\r|\n/)) {
    if (ruw.trim() === '') continue;

    const velden = ruw.split('\t').map((v) => v.trim());
    if (isKop(velden.filter((v) => v !== ''))) continue;

    if (velden.length < 5) {
      overgeslagen.push({ regel: ruw.trim(), reden: 'minder dan vijf velden' });
      continue;
    }

    const gelezen = leesDagUur(velden[4]);
    if (typeof gelezen === 'string') {
      overgeslagen.push({ regel: ruw.trim(), reden: gelezen });
      continue;
    }

    const [club_tekst, aanbod, doelgroep, groep, dag_uur] = velden;
    lessen.push({
      bron: 'geplakt',
      club_tekst,
      aanbod,
      doelgroep,
      groep,
      dag_uur,
      trainer: velden[5] ?? '',
      status: velden[8] ?? '',
      datum: gelezen.datum,
      uren: gelezen.uren,
      sleutel: sleutelVan(club_tekst, groep, dag_uur),
    });
  }

  return { lessen, overgeslagen };
}

export interface VerwerkResultaat {
  nieuw: GeplakteLes[];
  bekend: number;
}

/**
 * Wat van een plakbeurt er echt bij komt.
 *
 * Een bekende sleutel raakt niets aan — ook niet als die les geschrapt was of andere uren
 * had gekregen. Anders zou één plakbeurt het handwerk van vorige maand ongedaan maken, en
 * dat is precies het soort stille schade waar niemand achteraf nog op komt.
 */
export function verwerkPlak(
  bestaand: readonly Factuurles[],
  gelezen: readonly GeplakteLes[],
): VerwerkResultaat {
  const gezien = new Set(bestaand.map((l) => l.sleutel));
  const nieuw: GeplakteLes[] = [];
  let bekend = 0;

  for (const les of gelezen) {
    if (gezien.has(les.sleutel)) {
      bekend++;
      continue;
    }
    gezien.add(les.sleutel);
    nieuw.push(les);
  }

  return { nieuw, bekend };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest lib/facturatie-plak.test.ts`
Expected: PASS — 15 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/facturatie-plak.ts lib/facturatie-plak.test.ts
git commit -m "feat(facturatie): de geplakte lijst lezen en ontdubbelen"
```

---

## Task 3: Uren tellen — de twee bronnen en de onbekende clubs

**Files:**
- Modify: `lib/facturatie.ts` (erbij onderaan)
- Modify: `lib/facturatie.test.ts` (erbij onderaan)
- Read-only: `lib/__fixtures__/facturatie-plaktekst.txt` (staat al in de repo)

- [ ] **Step 1: Write the failing test**

Zet bovenaan `lib/facturatie.test.ts` de imports erbij:

```ts
import { readFileSync } from 'fs';
import { join } from 'path';
import { leesPlaktekst } from './facturatie-plak';
import {
  magFactureren, schoon, sleutelVan, rond2, plusDagen, MAANDNAMEN, urenVan,
  urenPerClub, urenUitApp, onbekendeClubs,
  type Factuurles, type Klant, type AppBoeking,
} from './facturatie';
```

En onderaan dit erbij:

```ts
// ---------------------------------------------------------------------------
// De echte lijst uit het clubsysteem. Zie lib/__fixtures__/LEESMIJ.md.
// ---------------------------------------------------------------------------

const PLAKTEKST = readFileSync(
  join(__dirname, '__fixtures__', 'facturatie-plaktekst.txt'),
  'utf-8',
);

/** De 69 lessen uit het voorbeeldbestand, als rijen zoals ze in de databank staan. */
function voorbeeldLessen(): Factuurles[] {
  return leesPlaktekst(PLAKTEKST).lessen.map((l, i) => ({
    ...l,
    id: `l${i}`,
    uren_handmatig: null,
    actief: true,
    naam_prive: '',
    type_prive: '',
  }));
}

function klant(velden: Partial<Klant>): Klant {
  return {
    id: 'k1',
    klantnaam: 'VZW Racso',
    adres: 'Graaf Wickmanstraat 16',
    postcode_gemeente: '9070 Destelbergen',
    btw_nummer: 'BE0418482744',
    uurtarief: 31,
    korte_naam: 'Racso',
    naam_in_lijst: 'T.C. RACSO',
    btw_percentage: 0,
    bron_voorkeur: 'geplakt',
    volgorde: 2,
    ...velden,
  };
}

const GANTOISE = klant({
  id: 'k0', klantnaam: 'VZW Gantoise', uurtarief: 33, korte_naam: 'Gantoise',
  naam_in_lijst: 'GANTOISE', bron_voorkeur: 'app', volgorde: 1,
});
const RACSO = klant({});

describe('urenPerClub', () => {
  it('leest het voorbeeldbestand uit zonder overgeslagen regels', () => {
    const gelezen = leesPlaktekst(PLAKTEKST);
    expect(gelezen.overgeslagen).toEqual([]);
    expect(gelezen.lessen).toHaveLength(69);
  });

  it('geeft Gantoise 35 uur in september 2026 — het getal uit facturen.xlsx', () => {
    const uit = urenPerClub(voorbeeldLessen(), [GANTOISE, RACSO], 9, 2026);
    expect(uit.find((r) => r.klant.id === 'k0')?.urenGeplakt).toBe(35);
  });

  it('geeft Racso 0 uur in september en 9 uur in oktober 2026', () => {
    const lessen = voorbeeldLessen();
    expect(urenPerClub(lessen, [RACSO], 9, 2026)[0].urenGeplakt).toBe(0);
    expect(urenPerClub(lessen, [RACSO], 10, 2026)[0].urenGeplakt).toBe(9);
  });

  it('geeft Gantoise 25 uur in oktober 2026', () => {
    expect(urenPerClub(voorbeeldLessen(), [GANTOISE], 10, 2026)[0].urenGeplakt).toBe(25);
  });

  it('matcht de clubnaam ongeacht hoofdletters en dubbele spaties', () => {
    const soepel = klant({ naam_in_lijst: '  t.c.   racso ' });
    expect(urenPerClub(voorbeeldLessen(), [soepel], 10, 2026)[0].urenGeplakt).toBe(9);
  });

  it('matcht NIET op een deel van de naam — "RACSO" is niet "T.C. RACSO"', () => {
    const fout = klant({ naam_in_lijst: 'RACSO' });
    expect(urenPerClub(voorbeeldLessen(), [fout], 10, 2026)[0].urenGeplakt).toBe(0);
  });

  it('laat een geschrapte les wegvallen', () => {
    const lessen = voorbeeldLessen();
    const eerste = lessen.findIndex((l) => l.datum.startsWith('2026-09'));
    lessen[eerste] = { ...lessen[eerste], actief: false };
    expect(urenPerClub(lessen, [GANTOISE], 9, 2026)[0].urenGeplakt).toBe(34);
  });

  it('laat handmatige uren voorgaan', () => {
    const lessen = voorbeeldLessen();
    const eerste = lessen.findIndex((l) => l.datum.startsWith('2026-09'));
    lessen[eerste] = { ...lessen[eerste], uren_handmatig: 0.5 };
    expect(urenPerClub(lessen, [GANTOISE], 9, 2026)[0].urenGeplakt).toBe(34.5);
  });

  it('telt privélessen apart, op de korte naam van de klant', () => {
    const lessen: Factuurles[] = [...voorbeeldLessen(), {
      id: 'p1', bron: 'prive', club_tekst: 'Racso', aanbod: '', doelgroep: '', groep: '',
      dag_uur: '', trainer: '', status: '', datum: '2026-10-05', uren: 1,
      uren_handmatig: null, actief: true, naam_prive: 'Stan', type_prive: 'sponsor',
      sleutel: 'p1',
    }];
    const uit = urenPerClub(lessen, [RACSO], 10, 2026)[0];
    expect(uit.urenGeplakt).toBe(9);
    expect(uit.urenPrive).toBe(1);
  });

  it('houdt de volgorde van de klanten aan', () => {
    const uit = urenPerClub(voorbeeldLessen(), [RACSO, GANTOISE], 10, 2026);
    expect(uit.map((r) => r.klant.id)).toEqual(['k0', 'k1']);
  });

  it('laat bij gelijke volgorde de binnengekomen volgorde staan', () => {
    const a = klant({ id: 'a', volgorde: 1 });
    const b = klant({ id: 'b', volgorde: 1 });
    expect(urenPerClub([], [a, b], 10, 2026).map((r) => r.klant.id)).toEqual(['a', 'b']);
    expect(urenPerClub([], [b, a], 10, 2026).map((r) => r.klant.id)).toEqual(['b', 'a']);
  });

  it('telt een les op de eerste en op de laatste dag van de maand mee', () => {
    const lessen = voorbeeldLessen().slice(0, 1).map((l, i) => ({
      ...l, id: `r${i}`, club_tekst: 'T.C. RACSO', datum: '2026-09-01',
    }));
    lessen.push({ ...lessen[0], id: 'r-laatst', datum: '2026-09-30', sleutel: 'r-laatst' });
    expect(urenPerClub(lessen, [RACSO], 9, 2026)[0].urenGeplakt).toBe(2);
  });

  it('negeert een klant waarvan de naam in de lijst nog niet ingevuld is', () => {
    // Zo maakt het instellingenscherm een nieuwe club aan: alle velden leeg.
    const nieuw = klant({ id: 'leeg', naam_in_lijst: '', korte_naam: '' });
    const blanco = voorbeeldLessen().slice(0, 1).map((l) => ({ ...l, club_tekst: '' }));
    expect(urenPerClub(blanco, [nieuw], 9, 2026)[0].urenGeplakt).toBe(0);
  });

  it('telt dezelfde lessen bij twee klanten met dezelfde naam — het scherm waarschuwt', () => {
    const tweeling = klant({ id: 'k2', naam_in_lijst: 'T.C. RACSO', volgorde: 3 });
    const uit = urenPerClub(voorbeeldLessen(), [RACSO, tweeling], 10, 2026);
    expect(uit.map((r) => r.urenGeplakt)).toEqual([9, 9]);
  });
});

describe('onbekendeClubs', () => {
  it('meldt de clubs die bij geen enkele klant uitkomen', () => {
    expect(onbekendeClubs(voorbeeldLessen(), [GANTOISE], 10, 2026))
      .toEqual([{ naam: 'T.C. RACSO', aantal: 9 }]);
  });

  it('zwijgt als elke club gekend is', () => {
    expect(onbekendeClubs(voorbeeldLessen(), [GANTOISE, RACSO], 10, 2026)).toEqual([]);
  });

  it('kijkt alleen naar de gevraagde maand', () => {
    expect(onbekendeClubs(voorbeeldLessen(), [GANTOISE], 9, 2026)).toEqual([]);
  });

  it('meldt een lege clubnaam in plaats van hem te verzwijgen', () => {
    const nieuw = klant({ id: 'leeg', naam_in_lijst: '' });
    const blanco = voorbeeldLessen().slice(0, 1).map((l) => ({ ...l, club_tekst: '' }));
    expect(onbekendeClubs(blanco, [nieuw], 9, 2026)).toEqual([{ naam: '(leeg)', aantal: 1 }]);
  });
});

describe('urenUitApp', () => {
  function boeking(velden: Partial<AppBoeking>): AppBoeking {
    return {
      coach_id: 'koen',
      start_time: '2026-09-09T14:00:00.000Z',
      end_time: '2026-09-09T15:00:00.000Z',
      status: 'confirmed',
      ...velden,
    };
  }

  it('telt de lessen van de gevraagde trainer in de gevraagde maand', () => {
    expect(urenUitApp([boeking({}), boeking({})], 'koen', 9, 2026)).toBe(2);
  });

  it('telt een les van anderhalf uur als 1,50', () => {
    const lang = boeking({ end_time: '2026-09-09T15:30:00.000Z' });
    expect(urenUitApp([lang], 'koen', 9, 2026)).toBe(1.5);
  });

  it('telt een les van een andere trainer niet mee', () => {
    expect(urenUitApp([boeking({ coach_id: 'ann' })], 'koen', 9, 2026)).toBe(0);
  });

  it('telt een les mee die hij van een collega overnam', () => {
    const overgenomen = boeking({ coach_id: 'ann', taught_by_id: 'koen' });
    expect(urenUitApp([overgenomen], 'koen', 9, 2026)).toBe(1);
  });

  it('telt een les niet mee die hij liet overnemen', () => {
    const afgestaan = boeking({ coach_id: 'koen', taught_by_id: 'ann' });
    expect(urenUitApp([afgestaan], 'koen', 9, 2026)).toBe(0);
  });

  it('telt een afgezegde les niet mee', () => {
    expect(urenUitApp([boeking({ status: 'cancelled' })], 'koen', 9, 2026)).toBe(0);
  });

  it('telt een les uit een andere maand niet mee', () => {
    const okt = boeking({
      start_time: '2026-10-07T14:00:00.000Z', end_time: '2026-10-07T15:00:00.000Z',
    });
    expect(urenUitApp([okt], 'koen', 9, 2026)).toBe(0);
  });

  it('slikt een boeking met een onleesbaar tijdstip in plaats van NaN terug te geven', () => {
    expect(urenUitApp([boeking({ end_time: 'later' })], 'koen', 9, 2026)).toBe(0);
  });

  it('rekent een les die over middernacht de maand uit loopt bij de maand van de start', () => {
    const overMiddernacht = boeking({
      start_time: new Date(2026, 8, 30, 23, 30).toISOString(),
      end_time: new Date(2026, 9, 1, 0, 30).toISOString(),
    });
    expect(urenUitApp([overMiddernacht], 'koen', 9, 2026)).toBe(1);
    expect(urenUitApp([overMiddernacht], 'koen', 10, 2026)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest lib/facturatie.test.ts`
Expected: FAIL — `urenPerClub is not a function`.

- [ ] **Step 3: Write the implementation**

Zet eerst bovenaan `lib/facturatie.ts`, onder het kopcommentaar, de enige import die dit
bestand nodig heeft:

```ts
import { lesgeverId } from './lesgever';
```

`lib/lesgever.ts` heeft zelf alleen een *type*-import van `Booking`, en die verdwijnt bij
het compileren. Deze module krijgt er dus geen runtime-afhankelijkheid van `lib/types.ts`
bij.

Zet daarna onderaan `lib/facturatie.ts` erbij:

```ts
// ---------------------------------------------------------------------------
// Uren tellen
// ---------------------------------------------------------------------------

/** Valt deze datum (`2026-09-09`) in deze maand? */
function inMaand(datum: string, maand: number, jaar: number): boolean {
  const two = String(maand).padStart(2, '0');
  return datum.startsWith(`${jaar}-${two}-`);
}

export interface ClubUren {
  klant: Klant;
  /** Wat de geplakte lijst voor deze club zegt. */
  urenGeplakt: number;
  /** De privélessen die met de hand bijgetikt zijn. Tellen altijd mee, bij beide bronnen. */
  urenPrive: number;
}

/**
 * Per klant de uren van één maand, uit de geplakte lijst en uit de privélessen.
 *
 * De volgorde van het antwoord is die van `volgorde` op de klant, niet die van de lijst die
 * binnenkwam: het scherm zet de kaarten eronder en die horen altijd in dezelfde volgorde te
 * staan. Bij gelijke `volgorde` blijft de binnengekomen volgorde staan, want `sort` is
 * stabiel.
 *
 * Aangenomen wordt dat `naam_in_lijst` en `korte_naam` uniek zijn over alle klanten. Staan
 * er twee klanten met dezelfde naam, dan krijgen ze allebei dezelfde uren en wordt er
 * dubbel gefactureerd. Dat wordt hier niet tegengehouden maar in het instellingenscherm
 * gemeld: hier weten we niet of het een vergissing is of niet, en een telling hoort geen
 * rijen te laten verdwijnen die iemand bewust zo heeft gezet.
 */
export function urenPerClub(
  lessen: readonly Factuurles[],
  klanten: readonly Klant[],
  maand: number,
  jaar: number,
): ClubUren[] {
  const opVolgorde = [...klanten].sort((a, b) => a.volgorde - b.volgorde);

  return opVolgorde.map((klant) => {
    const geplakteNaam = schoon(klant.naam_in_lijst);
    const korteNaam = schoon(klant.korte_naam);
    let urenGeplakt = 0;
    let urenPrive = 0;

    for (const les of lessen) {
      if (!les.actief) continue;
      if (!inMaand(les.datum, maand, jaar)) continue;
      const club = schoon(les.club_tekst);
      // Een privéles hangt aan de korte naam ("Racso"), een geplakte les aan de naam zoals
      // die in de lijst staat ("T.C. RACSO"). Dat zijn twee verschillende namen voor
      // dezelfde club, en ze allebei aan één veld hangen zou er één van de twee breken.
      //
      // Een lege ingestelde naam matcht niets. Zonder die regel zou een club die net
      // toegevoegd is en nog niet ingevuld — het instellingenscherm maakt hem met lege
      // velden aan — elke regel claimen waarvan de clubkolom leeg is.
      if (les.bron === 'prive') {
        if (korteNaam !== '' && club === korteNaam) urenPrive += urenVan(les);
      } else if (geplakteNaam !== '' && club === geplakteNaam) {
        urenGeplakt += urenVan(les);
      }
    }

    return { klant, urenGeplakt: rond2(urenGeplakt), urenPrive: rond2(urenPrive) };
  });
}

/**
 * De clubs in de geplakte lijst die bij geen enkele klant uitkomen.
 *
 * Zonder deze functie verdwijnen die uren geruisloos: ze staan in de databank, ze staan op
 * geen enkele factuur, en niemand merkt het. Zo ging het in `facturen.xlsx` met `T.C. RACSO`
 * tegen `RACSO`. Het scherm toont dit, met een knop om de club bij te maken.
 */
export function onbekendeClubs(
  lessen: readonly Factuurles[],
  klanten: readonly Klant[],
  maand: number,
  jaar: number,
): Array<{ naam: string; aantal: number }> {
  // Een klant zonder ingevulde naam telt niet als "gekend": anders zou een lege clubkolom
  // in de plaktekst op hem uitkomen en nooit gemeld worden.
  const gekend = new Set(
    klanten.map((k) => schoon(k.naam_in_lijst)).filter((naam) => naam !== ''),
  );
  const geteld = new Map<string, { naam: string; aantal: number }>();

  for (const les of lessen) {
    if (les.bron !== 'geplakt' || !les.actief) continue;
    if (!inMaand(les.datum, maand, jaar)) continue;
    const sleutel = schoon(les.club_tekst);
    if (gekend.has(sleutel)) continue;
    // De naam zoals hij in de lijst stond, niet de opgeschoonde: dat is wat de gebruiker
    // straks in het veld "naam in de lijst" moet overnemen. Een lege naam krijgt een
    // woord, want "0 lessen bij een club die ik niet ken: " leest als een bug.
    const al = geteld.get(sleutel);
    if (al) al.aantal++;
    else geteld.set(sleutel, { naam: les.club_tekst.trim() || '(leeg)', aantal: 1 });
  }

  return [...geteld.values()];
}

/**
 * De velden van een boeking die deze telling nodig heeft.
 *
 * Met opzet geen `import type { Booking }`: dit bestand hoort niets te weten van spelers,
 * banen of betalingen. `Booking` past hier structureel in, dus het scherm geeft hem gewoon
 * door.
 */
export interface AppBoeking {
  coach_id: string;
  taught_by_id?: string;
  start_time: string;
  end_time: string;
  status: string;
}

/**
 * De maand waarin een boeking telt, is die van de begintijd.
 *
 * Een les van 23:30 op 30 september tot 00:30 op 1 oktober hoort bij september: zo staat
 * hij in de agenda en zo praat men erover. Het alternatief — de uren splitsen over twee
 * maanden — zou twee facturen een half uur geven dat op geen van beide klopt.
 */

/**
 * De uren die al in de app staan: de lessen waarvan deze trainer de lesgever was.
 *
 * Dezelfde definitie als het bedrag op zijn profiel (`coachPayoutThisMonth` in lib/reports):
 * wie de les werkelijk gaf telt, niet van wie de les was. Die vraag wordt beantwoord door
 * `lesgeverId` in lib/lesgever en door niets anders — dat bestand zegt in zijn kop waarom,
 * en een tweede `taught_by_id ?? coach_id` hier zou precies het gat terugzetten waar het
 * voor waarschuwt.
 *
 * Dit getal kent geen clubs: de app weet niet bij welke club een boeking hoort. Het heeft
 * dus alleen betekenis bij de ene klant waarvoor `bron_voorkeur` op `'app'` staat.
 */
export function urenUitApp(
  boekingen: readonly AppBoeking[],
  trainerId: string,
  maand: number,
  jaar: number,
): number {
  let uren = 0;

  for (const b of boekingen) {
    if (b.status === 'cancelled') continue;
    if (lesgeverId(b) !== trainerId) continue;

    const start = new Date(b.start_time);
    const eind = new Date(b.end_time);
    const ms = eind.getTime() - start.getTime();
    // Een onleesbaar tijdstip geeft NaN, en NaN zou het hele totaal wegvagen zonder dat er
    // iets op het scherm verandert. Zo'n boeking telt niet mee.
    if (!Number.isFinite(ms) || ms <= 0) continue;
    // De maand van de kalender, niet van UTC: een les van 's avonds laat hoort bij de dag
    // die je op de klok ziet.
    if (start.getFullYear() !== jaar || start.getMonth() + 1 !== maand) continue;

    uren += ms / 3_600_000;
  }

  return rond2(uren);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest lib/facturatie.test.ts`
Expected: PASS — 47 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/facturatie.ts lib/facturatie.test.ts
git commit -m "feat(facturatie): de uren per club, uit de lijst en uit de app"
```

---

## Task 4: Een factuur samenstellen, en de startgegevens

Hier komt ook het overzicht van de extra lessen bij dat Racso elke maand vraagt.

**Files:**
- Modify: `lib/facturatie.ts` (één veld op `Factuur`, de rest erbij onderaan)
- Modify: `lib/facturatie.test.ts` (erbij onderaan)

- [ ] **Step 1: Write the failing test**

Vul de import bovenaan `lib/facturatie.test.ts` aan met `factuurUit, extraLessenUit, standaardLeverancier, standaardKlanten` en zet onderaan erbij:

```ts
describe('extraLessenUit', () => {
  /** Een privéles bij Racso: zo zet het scherm er een weg. */
  function extra(naam: string, datum: string, velden: Partial<Factuurles> = {}): Factuurles {
    return {
      id: `p-${naam}-${datum}`, bron: 'prive', club_tekst: 'Racso', aanbod: '',
      doelgroep: '', groep: '', dag_uur: '', trainer: '', status: '', datum, uren: 1,
      uren_handmatig: null, actief: true, naam_prive: naam, type_prive: 'sponsor',
      sleutel: `p|${naam}|${datum}`, ...velden,
    };
  }

  it('geeft de extra lessen van die klant en die maand, oudste eerst', () => {
    const lessen = [extra('Veerle', '2026-09-14'), extra('Stan', '2026-09-07')];
    expect(extraLessenUit(lessen, RACSO, 9, 2026)).toEqual([
      { datum: '2026-09-07', naam: 'Stan', type: 'sponsor', uren: 1 },
      { datum: '2026-09-14', naam: 'Veerle', type: 'sponsor', uren: 1 },
    ]);
  });

  it('laat een geschrapte les weg', () => {
    const lessen = [extra('Stan', '2026-09-07', { actief: false })];
    expect(extraLessenUit(lessen, RACSO, 9, 2026)).toEqual([]);
  });

  it('laat een andere maand en een andere club weg', () => {
    const lessen = [extra('Stan', '2026-10-05'), extra('Stan', '2026-09-07', { club_tekst: 'Gantoise' })];
    expect(extraLessenUit(lessen, RACSO, 9, 2026)).toEqual([]);
  });

  it('neemt handmatige uren over', () => {
    const lessen = [extra('Stan', '2026-09-07', { uren_handmatig: 0.5 })];
    expect(extraLessenUit(lessen, RACSO, 9, 2026)[0].uren).toBe(0.5);
  });

  it('telt op tot hetzelfde getal als urenPrive', () => {
    const lessen = [extra('Stan', '2026-09-07'), extra('Veerle', '2026-09-07')];
    const overzicht = extraLessenUit(lessen, RACSO, 9, 2026);
    const som = overzicht.reduce((t, l) => t + l.uren, 0);
    expect(som).toBe(urenPerClub(lessen, [RACSO], 9, 2026)[0].urenPrive);
  });

  it('geeft een lege lijst en niet undefined als er niets is', () => {
    expect(extraLessenUit([], RACSO, 9, 2026)).toEqual([]);
  });

  it('zegt hetzelfde als urenPerClub voor een club die nog niet ingevuld is', () => {
    // Zo maakt het instellingenscherm een nieuwe club aan: alle velden leeg. Zou dit
    // overzicht wél een les tonen, dan spreken blad 1 en blad 2 van dezelfde factuur
    // elkaar tegen: nul uur in het bedrag, één les in de lijst erachter.
    const leeg = klant({ id: 'leeg', korte_naam: '', naam_in_lijst: '' });
    const blanco = [extra('Stan', '2026-09-07', { club_tekst: '' })];
    expect(extraLessenUit(blanco, leeg, 9, 2026)).toEqual([]);
    expect(urenPerClub(blanco, [leeg], 9, 2026)[0].urenPrive).toBe(0);
  });
});

describe('factuurUit', () => {
  const basis = {
    id: 'f1',
    klant: RACSO,
    uren: 8,
    vrijeLijnen: [],
    extraLessen: [],
    factuurnr: 'NG-0007',
    factuurdatum: '2026-10-01',
    omschrijving: 'Tennislessen September 2026',
    maand: 9,
    jaar: 2026,
    aangemaakt: '2026-10-01T09:00:00.000Z',
  };

  it('rekent 8 uur aan € 31 tot € 248', () => {
    const f = factuurUit(basis);
    expect(f.netto).toBe(248);
    expect(f.btw_bedrag).toBe(0);
    expect(f.totaal).toBe(248);
  });

  it('zet de vervaldatum vijftien dagen later', () => {
    expect(factuurUit(basis).vervaldatum).toBe('2026-10-16');
  });

  it('schrijft de klantgegevens uit in plaats van ernaar te verwijzen', () => {
    const f = factuurUit(basis);
    expect(f.klant_naam).toBe('VZW Racso');
    expect(f.klant_adres).toBe('Graaf Wickmanstraat 16');
    expect(f.klant_postcode_gemeente).toBe('9070 Destelbergen');
    expect(f.klant_btw).toBe('BE0418482744');
    expect(f.uurtarief).toBe(31);
  });

  it('telt een vrije lijn bij het netto', () => {
    const f = factuurUit({
      ...basis,
      vrijeLijnen: [{ omschrijving: 'Verplaatsing', aantal: 2, eenheid: 'stuk', tarief: 12.5 }],
    });
    expect(f.netto).toBe(273);
    expect(f.vrije_lijnen).toHaveLength(1);
  });

  it('rekent BTW als het percentage van de klant niet nul is', () => {
    const metBtw = factuurUit({ ...basis, klant: klant({ btw_percentage: 21 }) });
    expect(metBtw.btw_bedrag).toBe(52.08);
    expect(metBtw.totaal).toBe(300.08);
  });

  it('laat de urenlijn optellen tot het netto, ook bij uren met drie decimalen', () => {
    // 8,005 u wordt op de factuur 8,01 u. Het bedrag op die regel hoort dan 8,01 × € 31 te
    // zijn en niet 8,005 × € 31, anders staat er een regel van € 248,31 boven een netto
    // van € 248,16.
    const f = factuurUit({ ...basis, uren: 8.005 });
    expect(f.aantal_uren).toBe(8.01);
    expect(f.netto).toBe(rond2(f.aantal_uren * f.uurtarief));
  });

  it('rondt elke lijn apart af en telt daarna pas op', () => {
    const f = factuurUit({
      ...basis,
      uren: 1,
      klant: klant({ uurtarief: 0.335 }),
      vrijeLijnen: [{ omschrijving: 'x', aantal: 1, eenheid: 'stuk', tarief: 0.335 }],
    });
    expect(f.netto).toBe(0.68);
  });

  it('begint onbetaald en zonder opmerking', () => {
    const f = factuurUit(basis);
    expect(f.betaald).toBe(false);
    expect(f.betaald_op).toBeNull();
    expect(f.opmerking).toBe('');
  });

  it('onthoudt voor welke maand hij is', () => {
    const f = factuurUit(basis);
    expect(f.dienstmaand).toBe(9);
    expect(f.dienstjaar).toBe(2026);
  });

  it('bewaart het overzicht van de extra lessen mee', () => {
    const f = factuurUit({
      ...basis,
      extraLessen: [{ datum: '2026-09-07', naam: 'Stan', type: 'sponsor', uren: 1 }],
    });
    expect(f.extra_lessen).toEqual([
      { datum: '2026-09-07', naam: 'Stan', type: 'sponsor', uren: 1 },
    ]);
  });

  it('bewaart een kopie, zodat een latere wijziging de factuur niet raakt', () => {
    const lijst = [{ datum: '2026-09-07', naam: 'Stan', type: 'sponsor', uren: 1 }];
    const f = factuurUit({ ...basis, extraLessen: lijst });
    lijst.push({ datum: '2026-09-14', naam: 'Veerle', type: 'sponsor', uren: 1 });
    expect(f.extra_lessen).toHaveLength(1);
  });

  it('geeft de bedragen die Koen deze maanden echt verwacht', () => {
    // De twee getallen waar dit hele onderdeel om draait: 35 uur bij Gantoise in september
    // (hetzelfde getal dat in facturen.xlsx met de hand in F24 stond) en 9 uur bij Racso in
    // oktober. Staan die hier verkeerd, dan klopt er niets van.
    const [gantoise, racso] = standaardKlanten(['k-1', 'k-2']);
    expect(factuurUit({ ...basis, klant: gantoise, uren: 35 }).totaal).toBe(1155);
    expect(factuurUit({ ...basis, klant: racso, uren: 9, maand: 10 }).totaal).toBe(279);
  });
});

describe('standaardLeverancier en standaardKlanten', () => {
  it('geeft Sport4fun als leverancier', () => {
    const l = standaardLeverancier('lev-1');
    expect(l.naam).toBe('Sport4fun');
    expect(l.btw).toBe('BE0647703840');
    expect(l.iban).toBe('BE90143103210832');
    expect(l.bic).toBe('GEBA BE BB');
    expect(l.adres).toBe('Broekstraat 51 9290 Overmere');
  });

  it('geeft Gantoise op de app en Racso op de geplakte lijst', () => {
    const [gantoise, racso] = standaardKlanten(['k-1', 'k-2']);
    expect(gantoise).toMatchObject({
      klantnaam: 'VZW Gantoise',
      adres: 'Noorderlaan 25',
      postcode_gemeente: '9000 Gent',
      btw_nummer: 'BE0409025343',
      uurtarief: 33,
      naam_in_lijst: 'GANTOISE',
      bron_voorkeur: 'app',
      volgorde: 1,
    });
    expect(racso).toMatchObject({
      klantnaam: 'VZW Racso',
      btw_nummer: 'BE0418482744',
      uurtarief: 31,
      naam_in_lijst: 'T.C. RACSO',
      bron_voorkeur: 'geplakt',
      volgorde: 2,
    });
  });

  it('telt de uren van het voorbeeldbestand met de standaardklanten', () => {
    const uit = urenPerClub(voorbeeldLessen(), standaardKlanten(['a', 'b']), 10, 2026);
    expect(uit.map((r) => r.urenGeplakt)).toEqual([25, 9]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest lib/facturatie.test.ts`
Expected: FAIL — `factuurUit is not a function`.

- [ ] **Step 3: Write the implementation**

Zoek eerst in `lib/facturatie.ts` het blok waar `VrijeLijn` staat en zet het nieuwe type
ernaast:

```ts
/**
 * Eén extra les op het overzicht dat met de factuur meegaat.
 *
 * Een eigen, smal type en niet `Factuurles`: wat Racso wil zien is wie, wanneer, wat en
 * hoe lang. De groep, de status en de sleutel van een geplakte les hebben daar niets te
 * zoeken, en ze zouden wél mee in de databank belanden.
 */
export interface ExtraLes {
  datum: string;
  naam: string;
  type: string;
  uren: number;
}
```

Zet in `interface Factuur`, direct onder `vrije_lijnen: VrijeLijn[];`, het veld erbij:

```ts
  /**
   * Het overzicht dat Racso elke maand vraagt, zoals het bij het maken van de factuur was.
   *
   * Een kopie en geen verwijzing, om dezelfde reden als de klantgegevens hierboven: wordt
   * er volgende maand een les geschrapt, dan mag een verstuurde factuur niet meeveranderen.
   */
  extra_lessen: ExtraLes[];
```

Zet daarna onderaan `lib/facturatie.ts` erbij:

```ts
/**
 * De extra lessen van één klant in één maand, oudste eerst.
 *
 * Dit is hetzelfde rijtje dat `urenPerClub` als `urenPrive` optelt, maar dan uitgeschreven:
 * Racso wil niet alleen het getal maar ook waar het vandaan komt.
 *
 * "Hetzelfde rijtje" is hier geen manier van spreken maar een eis: het bedrag op blad 1 en
 * het overzicht op blad 2 van dezelfde factuur moeten over dezelfde lessen gaan. Daarom
 * staat hier dezelfde regel over een lege naam als in `urenPerClub` — zonder die regel zou
 * een club die nog niet ingevuld is, op blad 2 lessen tonen die in het bedrag niet
 * meegeteld zijn. Er staat een test op dat de twee hetzelfde zeggen.
 */
export function extraLessenUit(
  lessen: readonly Factuurles[],
  klant: Klant,
  maand: number,
  jaar: number,
): ExtraLes[] {
  const korteNaam = schoon(klant.korte_naam);
  if (korteNaam === '') return [];

  return lessen
    .filter((l) => l.bron === 'prive' && l.actief
      && schoon(l.club_tekst) === korteNaam && inMaand(l.datum, maand, jaar))
    .sort((a, b) => a.datum.localeCompare(b.datum))
    .map((l) => ({
      datum: l.datum,
      naam: l.naam_prive,
      type: l.type_prive,
      uren: urenVan(l),
    }));
}

// ---------------------------------------------------------------------------
// Een factuur samenstellen
// ---------------------------------------------------------------------------

export interface FactuurOpties {
  id: string;
  klant: Klant;
  /** Het totaal van de gekozen bron plus de privélessen. */
  uren: number;
  vrijeLijnen: readonly VrijeLijn[];
  /** Het overzicht dat als tweede tabblad meegaat. Leeg mag. */
  extraLessen: readonly ExtraLes[];
  factuurnr: string;
  /** `2026-10-01`. */
  factuurdatum: string;
  omschrijving: string;
  maand: number;
  jaar: number;
  /** Wanneer hij gemaakt is, als ISO-tijdstip. Meegegeven zodat de test niet van de klok afhangt. */
  aangemaakt: string;
}

/** Hoeveel dagen een factuur de tijd krijgt. Staat ook in de voettekst van het blad. */
const BETAALTERMIJN_DAGEN = 15;

/**
 * De cijfers van een factuur, klaar om te bewaren en om er een blad van te maken.
 *
 * Elke lijn wordt apart afgerond en daarna opgeteld, niet omgekeerd. Zo staat op de factuur
 * precies de som van de bedragen die erop te lezen zijn — anders klopt de optelling van wie
 * het natelt een cent niet, en dat is precies waar een boekhouder op terugkomt.
 *
 * Wat hier binnenkomt wordt niet gekeurd: een negatief aantal of een onzinnig tarief op een
 * vrije lijn komt gewoon op de factuur. Dat is met opzet — `parseEuro` in lib/money keurt
 * aan het invulveld, en een tweede keuring hier zou een creditlijn onmogelijk maken zonder
 * dat iemand dat besloten heeft.
 */
export function factuurUit(opties: FactuurOpties): Factuur {
  const { klant, uren, vrijeLijnen } = opties;

  // Met de áfgedrukte uren rekenen, niet met het ruwe getal. Staat er 8,01 u op de factuur
  // en rekent het bedrag met 8,005, dan telt de regel niet op tot het nettobedrag eronder —
  // en dan heeft wie het natelt gelijk en de factuur ongelijk.
  const aantalUren = rond2(uren);
  const urenBedrag = rond2(aantalUren * klant.uurtarief);
  const vrijBedrag = vrijeLijnen.reduce((som, l) => som + rond2(l.aantal * l.tarief), 0);
  const netto = rond2(urenBedrag + vrijBedrag);
  const btw_bedrag = rond2((netto * klant.btw_percentage) / 100);

  return {
    id: opties.id,
    factuurnr: opties.factuurnr,
    klant_naam: klant.klantnaam,
    klant_adres: klant.adres,
    klant_postcode_gemeente: klant.postcode_gemeente,
    klant_btw: klant.btw_nummer,
    factuurdatum: opties.factuurdatum,
    vervaldatum: plusDagen(opties.factuurdatum, BETAALTERMIJN_DAGEN),
    omschrijving: opties.omschrijving,
    dienstmaand: opties.maand,
    dienstjaar: opties.jaar,
    aantal_uren: aantalUren,
    uurtarief: klant.uurtarief,
    netto,
    btw_percentage: klant.btw_percentage,
    btw_bedrag,
    totaal: rond2(netto + btw_bedrag),
    vrije_lijnen: [...vrijeLijnen],
    extra_lessen: [...opties.extraLessen],
    betaald: false,
    betaald_op: null,
    opmerking: '',
    aangemaakt: opties.aangemaakt,
  };
}

// ---------------------------------------------------------------------------
// Waarmee het begint
// ---------------------------------------------------------------------------

/**
 * Mijn gegevens zoals ze op elke factuur komen.
 *
 * Eén leverancier voor beide clubs. De Gantoise-factuur ging vroeger uit op naam van AI4U;
 * dat is op 4 oktober 2026 afgeschaft en komt hier bewust niet in terug.
 */
export function standaardLeverancier(id: string): Leverancier {
  return {
    id,
    naam: 'Sport4fun',
    adres: 'Broekstraat 51 9290 Overmere',
    btw: 'BE0647703840',
    iban: 'BE90143103210832',
    bic: 'GEBA BE BB',
  };
}

/**
 * De twee clubs, met de gegevens van 4 oktober 2026.
 *
 * `naam_in_lijst` van Racso is `T.C. RACSO` en niet `RACSO`: zo staat hij in de geplakte
 * lijst. In `facturen.xlsx` stond `RACSO`, en daardoor telde die werkmap Racso op nul uur.
 *
 * De twee id's komen binnen als een paar en niet als een lijst, zodat een aanroep met één
 * id niet compileert. Met `readonly string[]` zou dat wél mogen, en dan kreeg Racso
 * `id: undefined` — als primaire sleutel, in de databank.
 */
export function standaardKlanten([idGantoise, idRacso]: readonly [string, string]): Klant[] {
  return [
    {
      id: idGantoise,
      klantnaam: 'VZW Gantoise',
      adres: 'Noorderlaan 25',
      postcode_gemeente: '9000 Gent',
      btw_nummer: 'BE0409025343',
      uurtarief: 33,
      korte_naam: 'Gantoise',
      naam_in_lijst: 'GANTOISE',
      btw_percentage: 0,
      bron_voorkeur: 'app',
      volgorde: 1,
    },
    {
      id: idRacso,
      klantnaam: 'VZW Racso',
      adres: 'Graaf Wickmanstraat 16',
      postcode_gemeente: '9070 Destelbergen',
      btw_nummer: 'BE0418482744',
      uurtarief: 31,
      korte_naam: 'Racso',
      naam_in_lijst: 'T.C. RACSO',
      btw_percentage: 0,
      bron_voorkeur: 'geplakt',
      volgorde: 2,
    },
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest lib/facturatie.test.ts`
Expected: PASS — 69 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/facturatie.ts lib/facturatie.test.ts
git commit -m "feat(facturatie): een factuur samenstellen, met het overzicht van de extra lessen"
```

---

## Task 5: Een vrij blad in de xlsx-schrijver

`lib/xlsx.ts` kent nu één vorm: een koprij met rijen eronder. Een factuur is geen tabel. Hier komt een tweede vorm bij, naast de bestaande — die blijft onaangeroerd, want de rapporten hangen eraan.

**Files:**
- Modify: `lib/xlsx.ts`
- Modify: `lib/xlsx.test.ts`

- [ ] **Step 1: Write the failing test**

Vul de import bovenaan `lib/xlsx.test.ts` aan:

```ts
import {
  buildXlsx, buildWorkbook, buildVrijWorkbook, bladXml, vrijBladXml,
  refOntleden, bladnaam, crc32, datumNaarSerie, kolomLetter, zip,
  type XlsxCel, type XlsxVrijBlad,
} from './xlsx';
```

En zet onderaan `lib/xlsx.test.ts` erbij:

```ts
// ---------------------------------------------------------------------------
// Een blad met cellen op hun plaats, in plaats van een tabel. Voor de factuur.
// ---------------------------------------------------------------------------

function vrij(velden: Partial<XlsxVrijBlad> = {}): XlsxVrijBlad {
  return {
    naam: 'Factuur',
    cellen: [{ ref: 'A1', cel: { soort: 'tekst', waarde: 'hallo' } }],
    ...velden,
  };
}

describe('refOntleden', () => {
  it('leest een gewone verwijzing', () => {
    expect(refOntleden('A1')).toEqual({ rij: 1, kolom: 0 });
    expect(refOntleden('H7')).toEqual({ rij: 7, kolom: 7 });
    expect(refOntleden('I43')).toEqual({ rij: 43, kolom: 8 });
  });

  it('leest een verwijzing met twee letters', () => {
    expect(refOntleden('AA3')).toEqual({ rij: 3, kolom: 26 });
  });

  it('weigert iets wat geen verwijzing is', () => {
    expect(() => refOntleden('zomaar')).toThrow();
    expect(() => refOntleden('A0')).toThrow();
  });

  it('leest een verwijzing met kleine letters en spaties eromheen', () => {
    expect(refOntleden(' h7 ')).toEqual({ rij: 7, kolom: 7 });
  });

  it('is het omgekeerde van kolomLetter, ook voorbij Z', () => {
    // A, Z, AA, AZ, BA, ZZ — de plekken waar een kolomteller het laat afweten.
    for (const kolom of [0, 25, 26, 51, 52, 701]) {
      expect(refOntleden(`${kolomLetter(kolom)}3`)).toEqual({ rij: 3, kolom });
    }
  });
});

describe('vrijBladXml', () => {
  it('zet een cel op de plaats die de verwijzing noemt', () => {
    const xml = vrijBladXml(vrij({
      cellen: [{ ref: 'H7', cel: { soort: 'tekst', waarde: 'Datum' } }],
    }));
    expect(xml).toContain('<row r="7">');
    expect(xml).toContain('<c r="H7" t="inlineStr"><is><t xml:space="preserve">Datum</t></is></c>');
  });

  it('zet de rijen oplopend, ook als de cellen door elkaar binnenkomen', () => {
    const xml = vrijBladXml(vrij({
      cellen: [
        { ref: 'A9', cel: { soort: 'tekst', waarde: 'negen' } },
        { ref: 'A2', cel: { soort: 'tekst', waarde: 'twee' } },
      ],
    }));
    expect(xml.indexOf('<row r="2">')).toBeLessThan(xml.indexOf('<row r="9">'));
  });

  it('zet de cellen binnen een rij op kolomvolgorde', () => {
    const xml = vrijBladXml(vrij({
      cellen: [
        { ref: 'I3', cel: { soort: 'tekst', waarde: 'negen' } },
        { ref: 'B3', cel: { soort: 'tekst', waarde: 'twee' } },
      ],
    }));
    expect(xml.indexOf('r="B3"')).toBeLessThan(xml.indexOf('r="I3"'));
  });

  it('maakt een tekstcel vet als dat gevraagd wordt', () => {
    const xml = vrijBladXml(vrij({
      cellen: [{ ref: 'A5', cel: { soort: 'tekst', waarde: 'Mijn gegevens' }, vet: true }],
    }));
    expect(xml).toContain('<c r="A5" t="inlineStr" s="1">');
  });

  it('houdt de stijl van een bedrag en van een datum aan', () => {
    const xml = vrijBladXml(vrij({
      cellen: [
        { ref: 'I24', cel: { soort: 'geld', waarde: 248 } },
        { ref: 'H7', cel: { soort: 'datum', waarde: new Date(2026, 9, 1) } },
      ],
    }));
    expect(xml).toContain('<c r="I24" s="2"><v>248</v></c>');
    expect(xml).toContain(`<c r="H7" s="3"><v>${datumNaarSerie(new Date(2026, 9, 1))}</v></c>`);
  });

  it('schrijft de samengevoegde bereiken weg, ná de gegevens', () => {
    const xml = vrijBladXml(vrij({ samengevoegd: ['A23:E23', 'A30:F30'] }));
    expect(xml).toContain('<mergeCells count="2"><mergeCell ref="A23:E23"/><mergeCell ref="A30:F30"/></mergeCells>');
    expect(xml.indexOf('</sheetData>')).toBeLessThan(xml.indexOf('<mergeCells'));
  });

  it('laat mergeCells weg als er niets samengevoegd is', () => {
    expect(vrijBladXml(vrij())).not.toContain('mergeCells');
  });

  it('laat de afmeting tot aan de verste cel lopen', () => {
    const xml = vrijBladXml(vrij({
      cellen: [
        { ref: 'A1', cel: { soort: 'tekst', waarde: 'x' } },
        { ref: 'I43', cel: { soort: 'tekst', waarde: 'y' } },
      ],
    }));
    expect(xml).toContain('<dimension ref="A1:I43"/>');
  });

  it('bevriest niets en filtert niets — een factuur is geen lijst', () => {
    const xml = vrijBladXml(vrij());
    expect(xml).not.toContain('autoFilter');
    expect(xml).not.toContain('frozen');
  });

  it('schrijft de kolombreedtes weg', () => {
    const xml = vrijBladXml(vrij({ breedtes: [38, 10] }));
    expect(xml).toContain('<col min="1" max="1" width="38" customWidth="1"/>');
  });

  it('weigert twee cellen op dezelfde plaats', () => {
    // Excel zou zo'n blad alleen openen na een "herstel"-melding. Een factuur met zo'n
    // melding ervoor is erger dan geen factuur, dus dit valt hier om.
    expect(() => vrijBladXml(vrij({
      cellen: [
        { ref: 'A1', cel: { soort: 'tekst', waarde: 'eerste' } },
        { ref: 'a1', cel: { soort: 'tekst', waarde: 'tweede' } },
      ],
    }))).toThrow(/A1/);
  });

  it('ontsnapt tekens die XML anders stukmaken', () => {
    const xml = vrijBladXml(vrij({
      cellen: [{ ref: 'A1', cel: { soort: 'tekst', waarde: 'Jan & Piet <"lang">' } }],
    }));
    expect(xml).toContain('Jan &amp; Piet &lt;&quot;lang&quot;&gt;');
  });
});

describe('buildVrijWorkbook', () => {
  it('draagt twee vrije tabbladen, elk met hun eigen naam en inhoud', () => {
    const bytes = buildVrijWorkbook([
      vrij({ naam: 'Factuur', cellen: [{ ref: 'H8', cel: { soort: 'tekst', waarde: 'NG-0007' } }] }),
      vrij({ naam: 'Extra lessen', cellen: [{ ref: 'A1', cel: { soort: 'tekst', waarde: 'EXTRA LESSEN' } }] }),
    ]);
    const ingangen = leesZip(bytes);

    const werkmap = tekst(ingangen.find((i) => i.naam === 'xl/workbook.xml')!.inhoud);
    expect(werkmap).toContain('name="Factuur"');
    expect(werkmap).toContain('name="Extra lessen"');

    expect(tekst(ingangen.find((i) => i.naam === 'xl/worksheets/sheet1.xml')!.inhoud))
      .toContain('NG-0007');
    expect(tekst(ingangen.find((i) => i.naam === 'xl/worksheets/sheet2.xml')!.inhoud))
      .toContain('EXTRA LESSEN');
  });

  it('houdt de volgorde aan waarin de bladen binnenkomen', () => {
    const werkmap = tekst(leesZip(buildVrijWorkbook([
      vrij({ naam: 'Eerste' }), vrij({ naam: 'Tweede' }),
    ])).find((i) => i.naam === 'xl/workbook.xml')!.inhoud);
    expect(werkmap.indexOf('name="Eerste"')).toBeLessThan(werkmap.indexOf('name="Tweede"'));
  });

  it('geeft twee bladen met dezelfde naam een eigen naam — Excel weigert dubbels', () => {
    const werkmap = tekst(leesZip(buildVrijWorkbook([
      vrij({ naam: 'Factuur' }), vrij({ naam: 'Factuur' }),
    ])).find((i) => i.naam === 'xl/workbook.xml')!.inhoud);
    expect(werkmap).toContain('name="Factuur"');
    expect(werkmap).toContain('name="Factuur (2)"');
  });

  it('deelt één opmaaktabel, zodat een bedrag ook op blad twee een getal blijft', () => {
    const ingangen = leesZip(buildVrijWorkbook([vrij({ naam: 'A' }), vrij({ naam: 'B' })]));
    expect(ingangen.filter((i) => i.naam === 'xl/styles.xml')).toHaveLength(1);
  });

  it('weigert een werkmap zonder bladen — Excel kan die niet openen', () => {
    expect(() => buildVrijWorkbook([])).toThrow();
  });
});

```

> **Let op:** `leesZip` en `tekst` zijn de helpers die al bovenaan `lib/xlsx.test.ts` staan. Gebruik ze; schrijf geen tweede zip-lezer.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest lib/xlsx.test.ts`
Expected: FAIL — `vrijBladXml is not a function`.

- [ ] **Step 3: Write the implementation**

Zet in `lib/xlsx.ts`, direct ná `export interface XlsxBlad { ... }`, de nieuwe vorm erbij:

```ts
/**
 * Eén cel van een vrij blad, op de plaats die `ref` noemt ("H7").
 *
 * `vet` geldt alleen voor tekst. Een bedrag en een datum dragen hun eigen stijl — die bepaalt
 * hoe Excel het getal toont, en dat is belangrijker dan of het dik staat. Een vierde stijl
 * "vet bedrag" erbij zetten zou de stijlentabel verdubbelen voor iets wat een factuur niet
 * nodig heeft.
 */
export interface XlsxVrijeCel {
  ref: string;
  cel: XlsxCel;
  vet?: boolean;
}

/**
 * Een blad zonder koprij, waarin elke cel zelf zegt waar hij staat.
 *
 * Waarom dit naast `XlsxBlad` bestaat en niet in de plaats ervan: een lijst lessen ís een
 * tabel, met een koprij die blijft staan en een filter erop, en die moet dat blijven. Een
 * factuur is geen tabel — de opschriften staan links, de bedragen rechts, en er zit lucht
 * tussen de blokken.
 */
export interface XlsxVrijBlad {
  naam: string;
  cellen: readonly XlsxVrijeCel[];
  breedtes?: readonly number[];
  /** Bereiken als "A23:E23". Nodig voor de lange regels, die anders achter de bedragen lopen. */
  samengevoegd?: readonly string[];
}
```

Zet daarna, vlak vóór `export function bladXml`, de ontleder erbij:

```ts
/** "H7" → rij 7, kolom 7 (A is 0). Het omgekeerde van `kolomLetter`. */
export function refOntleden(ref: string): { rij: number; kolom: number } {
  const m = /^([A-Z]+)([1-9]\d*)$/.exec(ref.trim().toUpperCase());
  if (!m) throw new Error(`Geen geldige celverwijzing: ${ref}`);
  let kolom = 0;
  for (const letter of m[1]) kolom = kolom * 26 + (letter.charCodeAt(0) - 64);
  return { rij: Number(m[2]), kolom: kolom - 1 };
}
```

En zet ná `bladXml` de tweede schrijver erbij:

```ts
/** Dezelfde cel-XML als een tabel schrijft, met één verschil: tekst mag vet. */
function vrijeCelXml(vrij: XlsxVrijeCel): string {
  if (vrij.vet && vrij.cel.soort === 'tekst') {
    return `<c r="${vrij.ref}" t="inlineStr" s="${STIJL_VET}">`
      + `<is><t xml:space="preserve">${xml(vrij.cel.waarde)}</t></is></c>`;
  }
  return celXml(vrij.cel, vrij.ref);
}

export function vrijBladXml(blad: XlsxVrijBlad): string {
  const gelegd = blad.cellen.map((c) => ({ ...c, ...refOntleden(c.ref) }));

  // Twee cellen op dezelfde plaats levert een blad op dat Excel weigert te openen zonder
  // eerst te "herstellen" — en dan opent de ontvanger een factuur met een foutmelding
  // ervoor. Het is precies de vergissing die je maakt bij het uitrekenen van een rijnummer,
  // dus hij wordt hier gevonden en niet daar.
  const gezien = new Set<string>();
  for (const cel of gelegd) {
    const plaats = `${kolomLetter(cel.kolom)}${cel.rij}`;
    if (gezien.has(plaats)) {
      throw new Error(`Twee cellen op ${plaats} in blad "${blad.naam}"`);
    }
    gezien.add(plaats);
  }

  const laatsteRij = gelegd.reduce((max, c) => Math.max(max, c.rij), 1);
  const laatsteKolom = kolomLetter(gelegd.reduce((max, c) => Math.max(max, c.kolom), 0));

  const perRij = new Map<number, typeof gelegd>();
  for (const cel of gelegd) {
    const rij = perRij.get(cel.rij);
    if (rij) rij.push(cel);
    else perRij.set(cel.rij, [cel]);
  }

  // Oplopend, en binnen een rij op kolom: Excel leest een blad waarin de rijen door elkaar
  // staan wel, maar sommige lezers niet — en een bestand dat alleen in Excel opengaat is
  // precies wat deze schrijver niet wil zijn.
  const rijen = [...perRij.keys()].sort((a, b) => a - b)
    .map((nummer) => {
      const cellen = perRij.get(nummer)!
        .sort((a, b) => a.kolom - b.kolom)
        .map(vrijeCelXml)
        .join('');
      return `<row r="${nummer}">${cellen}</row>`;
    })
    .join('');

  const breedtes = blad.breedtes && blad.breedtes.length > 0
    ? `<cols>${blad.breedtes
      .map((b, i) => `<col min="${i + 1}" max="${i + 1}" width="${b}" customWidth="1"/>`)
      .join('')}</cols>`
    : '';

  const samengevoegd = blad.samengevoegd && blad.samengevoegd.length > 0
    ? `<mergeCells count="${blad.samengevoegd.length}">`
      + blad.samengevoegd.map((r) => `<mergeCell ref="${xml(r)}"/>`).join('')
      + '</mergeCells>'
    : '';

  // Geen bevroren koprij en geen filter, anders dan bij een tabel: een factuur heeft geen
  // koprij om te bevriezen en geen kolommen om op te filteren. De volgorde van de
  // onderdelen ligt vast in het formaat — afmeting, kolommen, gegevens, samengevoegd.
  return `${KOP}<worksheet xmlns="${HOOFD_NS}">`
    + `<dimension ref="A1:${laatsteKolom}${laatsteRij}"/>`
    + breedtes
    + `<sheetData>${rijen}</sheetData>`
    + samengevoegd
    + '</worksheet>';
}
```

Zet daarna `buildVrijWorkbook` onderaan `lib/xlsx.ts` erbij:

```ts
/**
 * Meer dan één vrij blad in één werkmap.
 *
 * Dit is wat de factuur nodig heeft: blad 1 de factuur, blad 2 het overzicht van de extra
 * lessen dat Racso elke maand vraagt. `buildWorkbook` kan ook meer dan één tabblad, maar
 * alleen als tabel met een koprij — en een factuur is geen tabel.
 *
 * Er is bewust géén variant voor één vrij blad. Die zou nergens aangeroepen worden: de
 * factuur heeft er altijd twee, ook als het tweede leeg is.
 *
 * De opmaak wordt één keer geschreven en door alle bladen gedeeld, net als bij
 * `buildWorkbook`: een bedrag blijft dus ook op blad twee een getal en een datum een datum.
 */
export function buildVrijWorkbook(bladen: readonly XlsxVrijBlad[]): Uint8Array {
  const namen = uniekeBladnamen(bladen.map((b) => b.naam));
  return meerBladenPakket(
    namen,
    bladen.map((blad, i) => vrijBladXml({ ...blad, naam: namen[i] })),
  );
}
```

`buildXlsx` blijft letterlijk zoals hij is — `lib/csv.ts` en het historiekscherm hangen
eraan, en er is geen reden om hem aan te raken.

Pas ten slotte `uniekeBladnamen` en `buildWorkbook` aan zodat ze met `buildVrijWorkbook`
hetzelfde pakwerk delen. Verander de signatuur van `uniekeBladnamen` van
`(bladen: readonly XlsxBlad[])` naar `(voorstellen: readonly string[])`, en vervang
`blad.naam` in het lijf door de binnengekomen string:

```ts
function uniekeBladnamen(voorstellen: readonly string[]): string[] {
  const gezien = new Set<string>();
  return voorstellen.map((voorstel) => {
    const schoon = bladnaam(voorstel);
    let naam = schoon;
    let volgnummer = 2;
    while (gezien.has(naam.toLowerCase())) {
      const achtervoegsel = ` (${volgnummer})`;
      naam = schoon.slice(0, 31 - achtervoegsel.length) + achtervoegsel;
      volgnummer++;
    }
    gezien.add(naam.toLowerCase());
    return naam;
  });
}
```

Knip daarna uit `buildWorkbook` alles wat niet over `XlsxBlad` gaat en zet het in een
helper ernaast. Het lijf van `buildWorkbook` wordt:

```ts
export function buildWorkbook(bladen: readonly XlsxBlad[]): Uint8Array {
  const namen = uniekeBladnamen(bladen.map((b) => b.naam));
  return meerBladenPakket(
    namen,
    bladen.map((blad, i) => bladXml({ ...blad, naam: namen[i] })),
  );
}
```

en `meerBladenPakket` krijgt wat eruit kwam — de drie lussen over `[Content_Types].xml`,
`xl/workbook.xml` en `xl/_rels/workbook.xml.rels`, met de bladinhoud als binnenkomende
tekst in plaats van als `XlsxBlad`:

```ts
/**
 * De verpakking rond meer dan één blad.
 *
 * Wat in `buildXlsx` drie vaste strings zijn, zijn hier drie lussen. De volgorde van
 * `namen` is de volgorde van de tabs onderin Excel. Het soort blad doet er niet toe: de
 * inhoud komt als tekst binnen, en of die van een tabel of van een vrij blad komt, weet
 * alleen de aanroeper.
 */
function meerBladenPakket(
  namen: readonly string[],
  inhouden: readonly string[],
): Uint8Array {
  // Excel weigert een werkmap zonder bladen. Hem toch wegschrijven levert een bestand op
  // dat pas bij de ontvanger stukloopt, en dat is de slechtste plek om het te merken.
  if (namen.length === 0) throw new Error('Een werkmap zonder bladen bestaat niet.');

  const bladPad = (index: number) => `worksheets/sheet${index + 1}.xml`;

  const contentTypes = `${KOP}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    + namen
      .map((_, i) => `<Override PartName="/xl/${bladPad(i)}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
      .join('')
    + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    + '</Types>';

  const rels = `${KOP}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
    + `<Relationship Id="rId1" Type="${REL_NS}/officeDocument" Target="xl/workbook.xml"/>`
    + '</Relationships>';

  const workbook = `${KOP}<workbook xmlns="${HOOFD_NS}" xmlns:r="${REL_NS}">`
    + `<sheets>${namen.map((naam, i) => `<sheet name="${xml(naam)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>`
    + '</workbook>';

  const workbookRels = `${KOP}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
    + namen
      .map((_, i) => `<Relationship Id="rId${i + 1}" Type="${REL_NS}/worksheet" Target="${bladPad(i)}"/>`)
      .join('')
    + `<Relationship Id="rId${namen.length + 1}" Type="${REL_NS}/styles" Target="styles.xml"/>`
    + '</Relationships>';

  return zip([
    { naam: '[Content_Types].xml', inhoud: utf8(contentTypes) },
    { naam: '_rels/.rels', inhoud: utf8(rels) },
    { naam: 'xl/workbook.xml', inhoud: utf8(workbook) },
    { naam: 'xl/_rels/workbook.xml.rels', inhoud: utf8(workbookRels) },
    { naam: 'xl/styles.xml', inhoud: utf8(stijlenXml()) },
    ...inhouden.map((inhoud, i) => ({ naam: `xl/${bladPad(i)}`, inhoud: utf8(inhoud) })),
  ]);
}
```

> **Let op:** vergelijk je `meerBladenPakket` regel voor regel met het oude lijf van
> `buildWorkbook` voor je iets weggooit. De bestaande tests op `buildWorkbook` moeten groen
> blijven; worden ze rood, dan is er iets uit de verpakking gevallen.

- [ ] **Step 4: Run the whole xlsx suite**

Run: `npx jest lib/xlsx.test.ts`
Expected: PASS — de nieuwe tests én alle bestaande. Valt een bestaande test om, dan is de herschikking van `buildXlsx` of `buildWorkbook` fout; vergelijk met `git diff`.

- [ ] **Step 5: Run everything that leest of schrijft via xlsx**

Run: `npx jest lib/xlsx lib/csv lib/export-trainingen lib/reports`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/xlsx.ts lib/xlsx.test.ts
git commit -m "feat(xlsx): een blad met cellen op hun plaats, en een werkmap van twee"
```

---

## Task 6: Van factuur naar blad

**Files:**
- Create: `lib/facturatie-xlsx.ts`
- Test: `lib/facturatie-xlsx.test.ts`

- [ ] **Step 1: Write the failing test**

Maak `lib/facturatie-xlsx.test.ts`:

```ts
import { factuurBlad, extraLessenBlad, factuurWerkmap, factuurBestandsnaam } from './facturatie-xlsx';
import { factuurUit, standaardKlanten, standaardLeverancier, type Factuur } from './facturatie';
import { type XlsxVrijeCel } from './xlsx';

const LEVERANCIER = standaardLeverancier('lev-1');
const [, RACSO] = standaardKlanten(['k-1', 'k-2']);

function factuur(extra: Partial<Factuur> = {}): Factuur {
  return {
    ...factuurUit({
      id: 'f1',
      klant: RACSO,
      uren: 8,
      vrijeLijnen: [],
      extraLessen: [],
      factuurnr: 'NG-0007',
      factuurdatum: '2026-10-01',
      omschrijving: 'Tennislessen September 2026',
      maand: 9,
      jaar: 2026,
      aangemaakt: '2026-10-01T09:00:00.000Z',
    }),
    ...extra,
  };
}

/** De twee extra lessen die Racso op dit moment heeft. */
const EXTRA = [
  { datum: '2026-09-07', naam: 'Stan', type: 'sponsor', uren: 1 },
  { datum: '2026-09-14', naam: 'Veerle', type: 'sponsor', uren: 1 },
];

/** De cel op die plaats, of undefined. */
function cel(cellen: readonly XlsxVrijeCel[], ref: string): XlsxVrijeCel | undefined {
  return cellen.find((c) => c.ref === ref);
}

describe('factuurBlad', () => {
  it('zet mijn gegevens linksboven', () => {
    const { cellen } = factuurBlad(factuur(), LEVERANCIER);
    expect(cel(cellen, 'B6')?.cel).toEqual({ soort: 'tekst', waarde: 'Sport4fun' });
    expect(cel(cellen, 'B8')?.cel).toEqual({ soort: 'tekst', waarde: 'BE0647703840' });
    expect(cel(cellen, 'B9')?.cel).toEqual({ soort: 'tekst', waarde: 'BE90143103210832' });
    expect(cel(cellen, 'B10')?.cel).toEqual({ soort: 'tekst', waarde: 'GEBA BE BB' });
  });

  it('zet het factuurnummer en de twee datums rechtsboven', () => {
    const { cellen } = factuurBlad(factuur(), LEVERANCIER);
    expect(cel(cellen, 'H8')?.cel).toEqual({ soort: 'tekst', waarde: 'NG-0007' });
    expect(cel(cellen, 'H7')?.cel).toEqual({ soort: 'datum', waarde: new Date(2026, 9, 1) });
    expect(cel(cellen, 'H9')?.cel).toEqual({ soort: 'datum', waarde: new Date(2026, 9, 16) });
  });

  it('zet de klant eronder, met het opschrift bij het BTW-nummer', () => {
    const { cellen } = factuurBlad(factuur(), LEVERANCIER);
    expect(cel(cellen, 'A17')?.cel).toEqual({ soort: 'tekst', waarde: 'VZW Racso' });
    expect(cel(cellen, 'A18')?.cel).toEqual({ soort: 'tekst', waarde: 'Graaf Wickmanstraat 16' });
    expect(cel(cellen, 'A19')?.cel).toEqual({ soort: 'tekst', waarde: '9070 Destelbergen' });
    expect(cel(cellen, 'A20')?.cel).toEqual({ soort: 'tekst', waarde: 'BTW nummer: BE0418482744' });
  });

  it('laat de regel met het BTW-nummer leeg als de klant er geen heeft', () => {
    const { cellen } = factuurBlad(factuur({ klant_btw: '' }), LEVERANCIER);
    expect(cel(cellen, 'A20')?.cel).toEqual({ soort: 'tekst', waarde: '' });
  });

  it('zet de urenlijn op rij 24, met de bedragen als getal', () => {
    const { cellen } = factuurBlad(factuur(), LEVERANCIER);
    expect(cel(cellen, 'A23')?.cel).toEqual({ soort: 'tekst', waarde: 'Tennislessen September 2026' });
    expect(cel(cellen, 'F24')?.cel).toEqual({ soort: 'getal', waarde: 8 });
    expect(cel(cellen, 'G24')?.cel).toEqual({ soort: 'tekst', waarde: 'uren' });
    expect(cel(cellen, 'H24')?.cel).toEqual({ soort: 'geld', waarde: 31 });
    expect(cel(cellen, 'I24')?.cel).toEqual({ soort: 'geld', waarde: 248 });
  });

  it('zet de totalen onder de laatste lijn', () => {
    const { cellen } = factuurBlad(factuur(), LEVERANCIER);
    expect(cel(cellen, 'G25')?.cel).toEqual({ soort: 'tekst', waarde: 'netto:' });
    expect(cel(cellen, 'I25')?.cel).toEqual({ soort: 'geld', waarde: 248 });
    expect(cel(cellen, 'I26')?.cel).toEqual({ soort: 'getal', waarde: 0 });
    expect(cel(cellen, 'I27')?.cel).toEqual({ soort: 'geld', waarde: 0 });
    expect(cel(cellen, 'H30')?.cel).toEqual({ soort: 'tekst', waarde: 'Te Betalen:' });
    expect(cel(cellen, 'I30')?.cel).toEqual({ soort: 'geld', waarde: 248 });
  });

  it('schuift de totalen op als er vrije lijnen zijn', () => {
    const met = factuur({
      vrije_lijnen: [
        { omschrijving: 'Verplaatsing', aantal: 2, eenheid: 'stuk', tarief: 12.5 },
        { omschrijving: 'Materiaal', aantal: 1, eenheid: 'stuk', tarief: 40 },
      ],
      netto: 313,
      totaal: 313,
    });
    const { cellen } = factuurBlad(met, LEVERANCIER);
    expect(cel(cellen, 'A25')?.cel).toEqual({ soort: 'tekst', waarde: 'Verplaatsing' });
    expect(cel(cellen, 'I25')?.cel).toEqual({ soort: 'geld', waarde: 25 });
    expect(cel(cellen, 'A26')?.cel).toEqual({ soort: 'tekst', waarde: 'Materiaal' });
    expect(cel(cellen, 'G27')?.cel).toEqual({ soort: 'tekst', waarde: 'netto:' });
    expect(cel(cellen, 'I27')?.cel).toEqual({ soort: 'geld', waarde: 313 });
  });

  it('zet de twee BTW-voetnoten en de twee opmerkingen erbij', () => {
    const { cellen } = factuurBlad(factuur(), LEVERANCIER);
    expect(cel(cellen, 'A26')?.cel).toEqual({
      soort: 'tekst',
      waarde: 'Artikel 44.2.3 vrijstelling btw exploitatie lichamelijke ontwikkeling',
    });
    expect(cel(cellen, 'A27')?.cel).toEqual({ soort: 'tekst', waarde: 'kleine onderneming' });
    expect(cel(cellen, 'A29')?.cel).toEqual({ soort: 'tekst', waarde: 'AANVULLENDE OPMERKINGEN' });
    expect((cel(cellen, 'A30')?.cel as { waarde: string }).waarde)
      .toContain('te storten op rekening: BE90143103210832');
    expect(cel(cellen, 'A32')?.cel).toEqual({
      soort: 'tekst',
      waarde: '2. Gelieve het factuur# te vermelden als mededeling',
    });
  });

  it('voegt de lange regels samen zodat ze niet achter de bedragen lopen', () => {
    const blad = factuurBlad(factuur(), LEVERANCIER);
    expect(blad.samengevoegd).toContain('A23:E23');
    expect(blad.samengevoegd).toContain('A30:F30');
  });

  it('bevat geen enkele formule — een bewaarde factuur hoort niet te herrekenen', () => {
    const blad = factuurBlad(factuur(), LEVERANCIER);
    const teksten = blad.cellen
      .map((c) => (c.cel.soort === 'tekst' ? c.cel.waarde : ''))
      .join(' ');
    expect(teksten).not.toContain('=');
  });

});

describe('extraLessenBlad', () => {
  it('heet "Extra lessen"', () => {
    expect(extraLessenBlad(factuur({ extra_lessen: EXTRA })).naam).toBe('Extra lessen');
  });

  it('zet de kop en de regel met klant, maand en factuurnummer bovenaan', () => {
    const { cellen } = extraLessenBlad(factuur({ extra_lessen: EXTRA }));
    expect(cel(cellen, 'A1')?.cel).toEqual({ soort: 'tekst', waarde: 'EXTRA LESSEN' });
    expect(cel(cellen, 'A2')?.cel).toEqual({
      soort: 'tekst',
      waarde: 'VZW Racso · September 2026 · factuur NG-0007',
    });
  });

  it('zet de kolomkoppen op rij 4 en de eerste les op rij 5', () => {
    const { cellen } = extraLessenBlad(factuur({ extra_lessen: EXTRA }));
    expect(cel(cellen, 'A4')?.cel).toEqual({ soort: 'tekst', waarde: 'Datum' });
    expect(cel(cellen, 'B4')?.cel).toEqual({ soort: 'tekst', waarde: 'Naam' });
    expect(cel(cellen, 'C4')?.cel).toEqual({ soort: 'tekst', waarde: 'Type' });
    expect(cel(cellen, 'D4')?.cel).toEqual({ soort: 'tekst', waarde: 'Uren' });
    expect(cel(cellen, 'A5')?.cel).toEqual({ soort: 'datum', waarde: new Date(2026, 8, 7) });
    expect(cel(cellen, 'B5')?.cel).toEqual({ soort: 'tekst', waarde: 'Stan' });
    expect(cel(cellen, 'C5')?.cel).toEqual({ soort: 'tekst', waarde: 'sponsor' });
    expect(cel(cellen, 'D5')?.cel).toEqual({ soort: 'getal', waarde: 1 });
  });

  it('zet de lessen op datum, oudste eerst', () => {
    const omgekeerd = [EXTRA[1], EXTRA[0]];
    const { cellen } = extraLessenBlad(factuur({ extra_lessen: omgekeerd }));
    expect(cel(cellen, 'B5')?.cel).toEqual({ soort: 'tekst', waarde: 'Stan' });
    expect(cel(cellen, 'B6')?.cel).toEqual({ soort: 'tekst', waarde: 'Veerle' });
  });

  it('sluit af met een totaalrij die optelt', () => {
    const { cellen } = extraLessenBlad(factuur({ extra_lessen: EXTRA }));
    expect(cel(cellen, 'C7')?.cel).toEqual({ soort: 'tekst', waarde: 'Totaal' });
    expect(cel(cellen, 'D7')?.cel).toEqual({ soort: 'getal', waarde: 2 });
  });

  it('bestaat ook als er geen extra lessen zijn, met een zin in plaats van een tabel', () => {
    const { cellen } = extraLessenBlad(factuur({ extra_lessen: [] }));
    expect(cel(cellen, 'A4')?.cel).toEqual({
      soort: 'tekst',
      waarde: 'Geen extra lessen in deze maand.',
    });
    expect(cel(cellen, 'D4')).toBeUndefined();
  });
});

describe('factuurWerkmap', () => {
  it('levert een leesbare werkmap met twee tabbladen', () => {
    const bytes = factuurWerkmap(factuur({ extra_lessen: EXTRA }), LEVERANCIER);
    expect(bytes.length).toBeGreaterThan(500);
    // "PK" — de handtekening van een zip.
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
  });

  it('botst nooit op zichzelf, hoeveel vrije lijnen er ook bij komen', () => {
    // `vrijBladXml` gooit als twee cellen op dezelfde plaats landen. Het totalenblok
    // schuift op met het aantal vrije lijnen, dus dat is precies waar een rijnummer één
    // te ver kan tellen. Deze test laat het blad écht schrijven in plaats van losse
    // celverwijzingen na te kijken.
    for (const aantal of [0, 1, 2, 5, 12]) {
      const lijnen = Array.from({ length: aantal }, (_, i) => ({
        omschrijving: `Lijn ${i + 1}`, aantal: 1, eenheid: 'stuk', tarief: 10,
      }));
      expect(() => factuurWerkmap(factuur({ vrije_lijnen: lijnen }), LEVERANCIER)).not.toThrow();
    }
  });
});

describe('factuurBestandsnaam', () => {
  it('neemt het nummer over', () => {
    expect(factuurBestandsnaam('NG-0007')).toBe('factuur-NG-0007.xlsx');
    expect(factuurBestandsnaam('AI4UT_2026-001')).toBe('factuur-AI4UT_2026-001.xlsx');
  });

  it('vervangt wat niet in een bestandsnaam hoort', () => {
    expect(factuurBestandsnaam('N/G 7')).toBe('factuur-N-G-7.xlsx');
  });

  it('valt terug op "factuur.xlsx" als het nummer leeg is', () => {
    expect(factuurBestandsnaam('   ')).toBe('factuur.xlsx');
  });

  it('haalt streepjes aan de randen weg', () => {
    expect(factuurBestandsnaam('-NG-0007-')).toBe('factuur-NG-0007.xlsx');
  });

  it('topt een onwaarschijnlijk lang nummer af', () => {
    const lang = 'A'.repeat(300);
    expect(factuurBestandsnaam(lang).length).toBeLessThanOrEqual(113);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest lib/facturatie-xlsx.test.ts`
Expected: FAIL — "Cannot find module './facturatie-xlsx'".

- [ ] **Step 3: Write the implementation**

Maak `lib/facturatie-xlsx.ts`:

```ts
// Een factuur als Excel-blad.
//
// De indeling volgt het blad uit `facturen.xlsx` rij voor rij, zodat het bestand dat de app
// aflevert er hetzelfde uitziet als het bestand dat de club al jaren krijgt. Alleen het
// urenblok groeit mee met het aantal vrije lijnen; de rest schuift dan op.
//
// Het bestand heeft twee tabbladen: de factuur, en het overzicht van de extra lessen dat
// Racso elke maand vraagt. Dat tweede blad is er altijd, ook leeg — een tabblad dat er soms
// wel en soms niet is, is een tabblad waarvan iemand denkt dat het vergeten werd.
//
// WAT HIER NIET IN STAAT: formules. Het blad uit Excel rekent zichzelf uit, en dat is handig
// zolang je ermee bezig bent. Een bewaarde factuur hoort juist niet meer te kunnen
// veranderen omdat iemand per ongeluk een cel aanraakt. Wat hier staat is uitgerekend.

import { MAANDNAMEN, rond2, type Factuur, type Leverancier } from './facturatie';
import { buildVrijWorkbook, type XlsxVrijBlad, type XlsxVrijeCel } from './xlsx';

/** Kolom A draagt de omschrijvingen en is daarom breed; G tot I dragen de bedragen. */
const BREEDTES = [38, 10, 10, 10, 10, 10, 14, 16, 14];

/** `2026-10-01` als dag op de kalender. Niet via `new Date(tekst)`: dat leest UTC. */
function alsDatum(iso: string): Date {
  const [j, m, d] = iso.split('-').map(Number);
  return new Date(j, m - 1, d);
}

export function factuurBlad(factuur: Factuur, leverancier: Leverancier): XlsxVrijBlad {
  const cellen: XlsxVrijeCel[] = [];
  const samengevoegd: string[] = [];

  const tekst = (ref: string, waarde: string, vet = false) =>
    cellen.push({ ref, cel: { soort: 'tekst', waarde }, vet });
  const getal = (ref: string, waarde: number) =>
    cellen.push({ ref, cel: { soort: 'getal', waarde } });
  const geld = (ref: string, waarde: number) =>
    cellen.push({ ref, cel: { soort: 'geld', waarde } });
  const datum = (ref: string, iso: string) =>
    cellen.push({ ref, cel: { soort: 'datum', waarde: alsDatum(iso) } });

  // Mijn gegevens, linksboven.
  tekst('A5', 'Mijn gegevens', true);
  tekst('A6', 'Naam'); tekst('B6', leverancier.naam);
  tekst('A7', 'Adres'); tekst('B7', leverancier.adres);
  tekst('A8', 'BTW:'); tekst('B8', leverancier.btw);
  tekst('A9', 'IBAN:'); tekst('B9', leverancier.iban);
  tekst('A10', 'BIC:'); tekst('B10', leverancier.bic);

  // Het nummer en de datums, rechtsboven.
  tekst('G6', 'Factuur', true);
  tekst('G7', 'Datum'); datum('H7', factuur.factuurdatum);
  tekst('G8', 'Factuurnr'); tekst('H8', factuur.factuurnr);
  tekst('G9', 'Vervaldatum'); datum('H9', factuur.vervaldatum);

  // De klant. Uitgeschreven zoals hij bij het maken van de factuur was — zie `Factuur`.
  tekst('A16', 'Factuur voor:', true);
  tekst('A17', factuur.klant_naam);
  tekst('A18', factuur.klant_adres);
  tekst('A19', factuur.klant_postcode_gemeente);
  tekst('A20', factuur.klant_btw === '' ? '' : `BTW nummer: ${factuur.klant_btw}`);

  tekst('H21', 'valuta:'); tekst('I21', 'euro');

  tekst('A22', 'BESCHRIJVING:', true);
  tekst('F22', 'Aantal', true);
  tekst('G22', 'Eenheid', true);
  tekst('H22', 'Tarief', true);
  tekst('I22', 'Bedrag', true);

  tekst('A23', factuur.omschrijving);
  samengevoegd.push('A23:E23');

  getal('F24', factuur.aantal_uren);
  tekst('G24', 'uren');
  geld('H24', factuur.uurtarief);
  geld('I24', rond2(factuur.aantal_uren * factuur.uurtarief));

  let rij = 24;
  for (const lijn of factuur.vrije_lijnen) {
    rij++;
    tekst(`A${rij}`, lijn.omschrijving);
    getal(`F${rij}`, lijn.aantal);
    tekst(`G${rij}`, lijn.eenheid);
    geld(`H${rij}`, lijn.tarief);
    geld(`I${rij}`, rond2(lijn.aantal * lijn.tarief));
    samengevoegd.push(`A${rij}:E${rij}`);
  }

  const netto = rij + 1;
  tekst(`G${netto}`, 'netto:'); geld(`I${netto}`, factuur.netto);
  tekst(`G${netto + 1}`, 'BTW %'); getal(`I${netto + 1}`, factuur.btw_percentage);
  tekst(`G${netto + 2}`, 'BTW-Bedrag'); geld(`I${netto + 2}`, factuur.btw_bedrag);

  // De twee voetnoten die de nul-BTW verklaren. Ze staan links, naast de bedragen.
  tekst(`A${netto + 1}`, 'Artikel 44.2.3 vrijstelling btw exploitatie lichamelijke ontwikkeling');
  tekst(`A${netto + 2}`, 'kleine onderneming');
  samengevoegd.push(`A${netto + 1}:E${netto + 1}`, `A${netto + 2}:E${netto + 2}`);

  tekst(`A${netto + 4}`, 'AANVULLENDE OPMERKINGEN', true);
  tekst(
    `A${netto + 5}`,
    `1. Gelieve het verschuldigde bedrag binnen de 15 dagen te storten op rekening: ${leverancier.iban}`,
  );
  tekst(`H${netto + 5}`, 'Te Betalen:', true);
  geld(`I${netto + 5}`, factuur.totaal);
  tekst(`A${netto + 7}`, '2. Gelieve het factuur# te vermelden als mededeling');
  samengevoegd.push(`A${netto + 5}:F${netto + 5}`, `A${netto + 7}:F${netto + 7}`);

  return { naam: 'Factuur', cellen, breedtes: BREEDTES, samengevoegd };
}

/**
 * Blad 2: het overzicht van de extra lessen.
 *
 * Racso vraagt dit elke maand. Het leest uit `factuur.extra_lessen` en niet uit de
 * lessenlijst: wat op een verstuurde factuur stond, mag niet veranderen omdat er later een
 * les geschrapt wordt.
 */
export function extraLessenBlad(factuur: Factuur): XlsxVrijBlad {
  const cellen: XlsxVrijeCel[] = [];
  const tekst = (ref: string, waarde: string, vet = false) =>
    cellen.push({ ref, cel: { soort: 'tekst', waarde }, vet });

  tekst('A1', 'EXTRA LESSEN', true);
  tekst(
    'A2',
    `${factuur.klant_naam} · ${MAANDNAMEN[factuur.dienstmaand - 1]} ${factuur.dienstjaar}`
    + ` · factuur ${factuur.factuurnr}`,
  );

  if (factuur.extra_lessen.length === 0) {
    tekst('A4', 'Geen extra lessen in deze maand.');
    return { naam: 'Extra lessen', cellen, breedtes: [14, 22, 18, 10] };
  }

  tekst('A4', 'Datum', true);
  tekst('B4', 'Naam', true);
  tekst('C4', 'Type', true);
  tekst('D4', 'Uren', true);

  // Op datum en niet in de volgorde waarin ze ingetikt zijn: wie het overzicht naast zijn
  // eigen agenda legt, leest van boven naar beneden door de maand.
  const opDatum = [...factuur.extra_lessen].sort((a, b) => a.datum.localeCompare(b.datum));

  let rij = 4;
  for (const les of opDatum) {
    rij++;
    cellen.push({ ref: `A${rij}`, cel: { soort: 'datum', waarde: alsDatum(les.datum) } });
    tekst(`B${rij}`, les.naam);
    tekst(`C${rij}`, les.type);
    cellen.push({ ref: `D${rij}`, cel: { soort: 'getal', waarde: les.uren } });
  }

  const totaal = rond2(opDatum.reduce((som, les) => som + les.uren, 0));
  tekst(`C${rij + 1}`, 'Totaal', true);
  cellen.push({ ref: `D${rij + 1}`, cel: { soort: 'getal', waarde: totaal } });

  return { naam: 'Extra lessen', cellen, breedtes: [14, 22, 18, 10] };
}

/** Het bestand zoals het gedownload wordt: de factuur, en het overzicht erachter. */
export function factuurWerkmap(factuur: Factuur, leverancier: Leverancier): Uint8Array {
  return buildVrijWorkbook([factuurBlad(factuur, leverancier), extraLessenBlad(factuur)]);
}

/**
 * De naam van het bestand dat gedownload wordt.
 *
 * Alles wat geen letter, cijfer, streepje of liggend streepje is, wordt een streepje: een
 * factuurnummer mag een schuine streep bevatten en een bestandsnaam niet, en dan mislukt de
 * download zonder uitleg.
 */
export function factuurBestandsnaam(factuurnr: string): string {
  const net = factuurnr.trim()
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    // Een bestandsnaam langer dan ongeveer 255 tekens weigeren sommige schijven en
    // browsers zonder uitleg. Honderd is ruim voor een factuurnummer.
    .slice(0, 100);
  return net === '' ? 'factuur.xlsx' : `factuur-${net}.xlsx`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest lib/facturatie-xlsx.test.ts`
Expected: PASS — 23 tests.

- [ ] **Step 5: Run the whole suite and the typechecker**

Run: `npm test && npx tsc --noEmit`
Expected: PASS, geen typefouten.

- [ ] **Step 6: Commit**

```bash
git add lib/facturatie-xlsx.ts lib/facturatie-xlsx.test.ts
git commit -m "feat(facturatie): de factuur als Excel-bestand, met het overzicht erachter"
```

---

## Task 7: De tabellen in de databank

**Files:**
- Create: `FACTURATIE.sql`

Dit bestand wordt door Koen zelf gedraaid in de SQL-editor van Supabase. Het wordt **niet** door de app uitgevoerd.

- [ ] **Step 1: Write the SQL**

Maak `FACTURATIE.sql`:

```sql
-- Facturatie — de vier tabellen achter Beheer → Facturatie.
--
-- Draai dit in de SQL-editor van Supabase (Database → SQL editor → New query, alles plakken,
-- Run). Het script is idempotent: je mag het opnieuw draaien na een wijziging. Herlaad daarna
-- de app hard — ze leest de databank bij het opstarten.
--
-- Dit is de boekhouding van één persoon en geen voorziening van de club. Elke rij draagt
-- daarom een eigenaar, en elke policy hieronder kijkt naar `auth.uid()` en naar niets anders:
-- geen rol, geen uitzondering voor de beheerder. Wie de club beheert, heeft hier niets te
-- zoeken.
--
-- Sleutels zijn `text` en komen van de app, zoals overal in dit schema. Zie de kop van
-- supabase-schema.sql voor het waarom.
--
-- LET OP bij het met de hand invoegen van een rij vanuit de SQL-editor: `auth.uid()` is
-- daar leeg, en `eigenaar` is `not null`. Zo'n insert wordt dus geweigerd tenzij je zelf
-- je uuid meegeeft. De app heeft daar geen last van — die schrijft altijd ingelogd.

-- ---------------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------------

-- Mijn eigen gegevens, zoals ze bovenaan de factuur komen. Eén rij per eigenaar.
create table if not exists facturatie_leverancier (
  id text primary key,
  eigenaar uuid not null default auth.uid(),
  naam text not null default '',
  adres text not null default '',
  btw text not null default '',
  iban text not null default '',
  bic text not null default '',
  unique (eigenaar)
);

-- De clubs waaraan gefactureerd wordt.
create table if not exists facturatie_klanten (
  id text primary key,
  eigenaar uuid not null default auth.uid(),
  klantnaam text not null default '',
  adres text not null default '',
  postcode_gemeente text not null default '',
  btw_nummer text not null default '',
  uurtarief numeric(10,2) not null default 0,
  korte_naam text not null default '',
  -- Onder welke naam deze club in de geplakte lijst staat: "T.C. RACSO", niet "RACSO".
  -- In facturen.xlsx stond hier "RACSO" en vergeleek de SUMIFS exact; die werkmap telde
  -- Racso daardoor op nul uur. Daarom is dit een eigen, zichtbaar veld.
  naam_in_lijst text not null default '',
  btw_percentage numeric(5,2) not null default 0,
  -- 'geplakt' of 'app': waar de uren van deze klant vandaan komen. Zie "Twee bronnen" in
  -- docs/superpowers/specs/2026-10-04-facturatie-design.md.
  bron_voorkeur text not null default 'geplakt'
    check (bron_voorkeur in ('geplakt', 'app')),
  volgorde int not null default 0
);

-- De lessen: geplakt uit het clubsysteem, of met de hand bijgetikt als privéles.
create table if not exists facturatie_lessen (
  id text primary key,
  eigenaar uuid not null default auth.uid(),
  bron text not null default 'geplakt' check (bron in ('geplakt', 'prive')),
  club_tekst text not null default '',
  aanbod text not null default '',
  doelgroep text not null default '',
  groep text not null default '',
  dag_uur text not null default '',
  trainer text not null default '',
  status text not null default '',
  datum date not null,
  uren numeric(6,2) not null default 0,
  -- Met de hand gezet; gaat voor op `uren`. Leeg betekent "niets aangepast", en dat is iets
  -- anders dan nul uur.
  uren_handmatig numeric(6,2),
  -- Geschrapt is false. De rij blijft bestaan: wist je hem, dan komt hij bij de volgende
  -- plakbeurt gewoon terug en telt hij weer mee.
  actief boolean not null default true,
  naam_prive text not null default '',
  type_prive text not null default '',
  -- club + groep + dag/uur, opgeschoond. Houdt een tweede plakbeurt tegen.
  sleutel text not null,
  aangemaakt timestamptz not null default now()
);

-- Een unieke index en niet alleen een controle in de app: twee plakbeurten die tegelijk
-- binnenkomen zouden anders allebei "dit ken ik nog niet" zien en allebei schrijven.
create unique index if not exists facturatie_lessen_sleutel
  on facturatie_lessen (eigenaar, sleutel);

create index if not exists facturatie_lessen_datum
  on facturatie_lessen (eigenaar, datum);

-- De gemaakte facturen. Dit is het archief uit het tabblad Facturenregister.
create table if not exists facturatie_facturen (
  id text primary key,
  eigenaar uuid not null default auth.uid(),
  factuurnr text not null default '',
  -- De klantgegevens staan hier uitgeschreven en niet als verwijzing: verhuist een club
  -- volgend jaar, dan mag een factuur van vorig jaar niet van adres veranderen.
  klant_naam text not null default '',
  klant_adres text not null default '',
  klant_postcode_gemeente text not null default '',
  klant_btw text not null default '',
  factuurdatum date not null,
  vervaldatum date not null,
  omschrijving text not null default '',
  dienstmaand int not null check (dienstmaand between 1 and 12),
  dienstjaar int not null,
  aantal_uren numeric(8,2) not null default 0,
  uurtarief numeric(10,2) not null default 0,
  netto numeric(12,2) not null default 0,
  btw_percentage numeric(5,2) not null default 0,
  btw_bedrag numeric(12,2) not null default 0,
  totaal numeric(12,2) not null default 0,
  -- De vrije lijnen hebben alleen betekenis samen met hun factuur en worden nooit los
  -- opgevraagd. Dezelfde keuze als voor de beurten van een kaart; zie supabase-schema.sql.
  vrije_lijnen jsonb not null default '[]'::jsonb,
  -- Het overzicht dat Racso elke maand vraagt, zoals het bij het maken van de factuur was.
  -- Een kopie en geen verwijzing naar facturatie_lessen: wordt er volgende maand een les
  -- geschrapt, dan mag een verstuurde factuur niet meeveranderen.
  extra_lessen jsonb not null default '[]'::jsonb,
  betaald boolean not null default false,
  betaald_op date,
  opmerking text not null default '',
  aangemaakt timestamptz not null default now()
);

create index if not exists facturatie_facturen_datum
  on facturatie_facturen (eigenaar, factuurdatum desc);

-- Geen unieke index op het factuurnummer: een nummer dat al bestaat is een waarschuwing en
-- geen verbod. Koen weet beter dan de databank wanneer hij een factuur toch zo wil nummeren
-- — bijvoorbeeld als hij er een opnieuw maakt nadat hij hem uit het register haalde.

-- ---------------------------------------------------------------------------
-- Rechten
-- ---------------------------------------------------------------------------

alter table facturatie_leverancier enable row level security;
alter table facturatie_klanten enable row level security;
alter table facturatie_lessen enable row level security;
alter table facturatie_facturen enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'facturatie_leverancier', 'facturatie_klanten', 'facturatie_lessen', 'facturatie_facturen'
  ] loop
    execute format('drop policy if exists %1$s_select on %1$s', t);
    execute format('drop policy if exists %1$s_insert on %1$s', t);
    execute format('drop policy if exists %1$s_update on %1$s', t);
    execute format('drop policy if exists %1$s_delete on %1$s', t);

    -- `%s` en niet `%I` voor de tabelnaam: wat hier binnenkomt is de vaste lijst hierboven
    -- en nooit iets van buiten. Zou dat ooit veranderen, dan moet dit `%I` worden.
    --
    -- `to authenticated` zoals overal in supabase-schema.sql. Strikt genomen overbodig —
    -- voor de anon-rol is `auth.uid()` leeg en matcht `eigenaar = null` nooit — maar een
    -- policy die alleen klopt omdat een vergelijking toevallig onwaar is, is er een die
    -- niemand durft te wijzigen.
    execute format(
      'create policy %1$s_select on %1$s for select '
      || 'to authenticated using (eigenaar = auth.uid())', t);
    -- Ook `with check` op insert: anders kan iemand een rij op naam van een ander wegschrijven
    -- door de kolom zelf mee te sturen, en de default `auth.uid()` komt daar niet aan te pas.
    execute format(
      'create policy %1$s_insert on %1$s for insert '
      || 'to authenticated with check (eigenaar = auth.uid())', t);
    -- `with check` op update houdt tegen dat je je eigen rij op naam van iemand anders zet.
    execute format(
      'create policy %1$s_update on %1$s for update '
      || 'to authenticated using (eigenaar = auth.uid()) '
      || 'with check (eigenaar = auth.uid())', t);
    execute format(
      'create policy %1$s_delete on %1$s for delete '
      || 'to authenticated using (eigenaar = auth.uid())', t);
  end loop;
end
$$;
```

- [ ] **Step 2: Check the SQL parses**

Er is geen lokale Postgres in dit project. Lees het bestand na op de drie dingen die hier fout gaan: elke tabel heeft `eigenaar`, elke tabel heeft `enable row level security`, en de lus noemt alle vier de tabellen.

Run: `grep -c "eigenaar uuid not null default auth.uid()" FACTURATIE.sql`
Expected: `4`

Run: `grep -c "enable row level security" FACTURATIE.sql`
Expected: `4`

- [ ] **Step 3: Commit**

```bash
git add FACTURATIE.sql
git commit -m "feat(facturatie): de vier tabellen, met RLS op de eigenaar"
```

> **Nog niet draaien.** De gebruiker draait dit bestand zelf op de databank van de club. Zeg het hem na taak 8, niet eerder: tot dan heeft de app er niets aan.

---

## Task 8: Laden en bewaren

De facturatie gaat **niet** door `SimpleDataProvider`: die leest bij het opstarten alles op wat je mag zien, en deze lessenlijst groeit elk jaar en gaat niemand anders aan. Dit volgt het pad dat `bezetteUren` al bewandelt — een eigen leesweg op `Backend`, met een Supabase-kant en een lokale kant.

**Files:**
- Create: `providers/facturatieStore.ts`
- Create: `providers/facturatieLokaal.ts`
- Modify: `providers/backend.ts`

- [ ] **Step 1: Write the Supabase side**

Maak `providers/facturatieStore.ts`:

```ts
// De Supabase-kant van de facturatie.
//
// Apart van providers/supabaseStore.ts, omdat het niets met de rest deelt: andere tabellen,
// een andere eigenaar-regel, en het komt niet mee in de lading die bij het opstarten
// opgehaald wordt.
//
// `laden` geeft `null` als de tabellen er nog niet zijn. Dat is iets anders dan een lege
// boekhouding, en het scherm zegt dat ook anders — dezelfde afspraak als bij `bezetteUren`.

import { alleRijen } from '../lib/paginering';
import { supabase } from '../lib/supabase';
import type {
  Factuur, Factuurles, FacturatieData, Klant, Leverancier,
} from '../lib/facturatie';

/** Kent deze databank die tabel (nog) niet? Zelfde drie signalen als in supabaseStore. */
function tabelBestaatNiet(error: { code?: string; message?: string }): boolean {
  if (error.code === '42P01' || error.code === 'PGRST205') return true;
  return /schema cache/i.test(error.message ?? '');
}

/**
 * De kolommen die de app niet kent, eraf halen.
 *
 * Welke dat zijn verschilt per tabel, en dat is geen slordigheid. `eigenaar` is overal
 * huishouding. `aangemaakt` is dat bij een les — de databank zet hem en niemand leest hem —
 * maar bij een factuur is het een veld van de app zelf: `factuurUit` zet erin wanneer de
 * factuur gemaakt is, en het register toont dat. Knip je hem daar ook weg, dan is dat veld
 * na een herlaadbeurt leeg terwijl het type belooft dat er een datum in staat.
 */
function zonderKolommen<T>(rij: Record<string, unknown>, weg: readonly string[]): T {
  const uit = { ...rij };
  for (const kolom of weg) delete uit[kolom];
  return uit as T;
}

/** Overal huishouding. */
const EIGENAAR = ['eigenaar'] as const;
/** Bij een les zet de databank `aangemaakt` en leest de app hem nooit. */
const EIGENAAR_EN_AANGEMAAKT = ['eigenaar', 'aangemaakt'] as const;

/**
 * Eén tabel volledig ophalen, in stukken.
 *
 * NIET `select('*')` zonder meer. PostgREST geeft nooit meer dan duizend rijen per verzoek
 * terug, zonder foutmelding en zonder waarschuwing — zie de kop van lib/paginering, waar
 * staat wat dat op 6 september 2026 kostte: een trainer zag zijn agenda leeg staan omdat de
 * club over die grens heen gegroeid was. Een lessenlijst groeit hier met een paar honderd
 * rijen per jaar, dus die grens komt vanzelf, en hij komt stil.
 *
 * Geeft `null` als de tabel er nog niet is. Elke andere fout gooit, en die gooi wint: hij
 * komt uit de `Promise.all` hieronder naar boven ook als een andere tabel tegelijk "bestaat
 * niet" zegt. Anders zou een echte fout verdwijnen achter een melding over een SQL-bestand
 * dat allang gedraaid is.
 */
async function haalAlles(
  tabel: string,
  sorteer: string,
  oplopend = true,
): Promise<Array<Record<string, unknown>> | null> {
  let ontbreekt = false;

  const rijen = await alleRijen<Record<string, unknown>>(async (van, tot) => {
    const { data, error } = await supabase
      .from(tabel)
      .select('*')
      .order(sorteer, { ascending: oplopend })
      .range(van, tot);
    if (error) {
      if (tabelBestaatNiet(error)) {
        ontbreekt = true;
        return [];
      }
      throw new Error(`${tabel}: ${error.message}`);
    }
    return (data ?? []) as Array<Record<string, unknown>>;
  });

  return ontbreekt ? null : rijen;
}

export async function laden(): Promise<FacturatieData | null> {
  // Alle vier tegelijk: ze hangen niet van elkaar af, en na elkaar is vier keer wachten.
  const [lev, kla, les, fac] = await Promise.all([
    haalAlles('facturatie_leverancier', 'id'),
    haalAlles('facturatie_klanten', 'volgorde'),
    haalAlles('facturatie_lessen', 'datum'),
    haalAlles('facturatie_facturen', 'factuurdatum', false),
  ]);

  // Staat er één tabel niet, dan staat het SQL-bestand nog te wachten. Een echte fout is
  // hierboven al gegooid, dus er kan er geen één achter deze melding verdwijnen.
  if (lev === null || kla === null || les === null || fac === null) return null;

  const leveranciers = lev.map((r) => zonderKolommen<Leverancier>(r, EIGENAAR));

  return {
    // Er is er hoogstens één; staat er nog geen, dan maakt het scherm hem bij de eerste keer.
    leverancier: leveranciers[0] ?? { id: '', naam: '', adres: '', btw: '', iban: '', bic: '' },
    klanten: kla.map((r) => zonderKolommen<Klant>(r, EIGENAAR)),
    lessen: les.map((r) => zonderKolommen<Factuurles>(r, EIGENAAR_EN_AANGEMAAKT)),
    facturen: fac.map((r) => zonderKolommen<Factuur>(r, EIGENAAR)),
  };
}

/** Eén rij wegschrijven of bijwerken. `upsert` omdat het scherm niet bijhoudt wat nieuw is. */
async function bewaarRij(tabel: string, rij: object): Promise<void> {
  const { error } = await supabase.from(tabel).upsert(rij);
  if (error) throw new Error(`${tabel}: ${error.message}`);
}

async function verwijderRij(tabel: string, id: string): Promise<void> {
  const { error } = await supabase.from(tabel).delete().eq('id', id);
  if (error) throw new Error(`${tabel}: ${error.message}`);
}

export const facturatieSupabase = {
  laden,
  leverancierBewaren: (l: Leverancier) => bewaarRij('facturatie_leverancier', l),
  klantBewaren: (k: Klant) => bewaarRij('facturatie_klanten', k),
  klantVerwijderen: (id: string) => verwijderRij('facturatie_klanten', id),
  lessenToevoegen: async (lessen: readonly Factuurles[]): Promise<void> => {
    if (lessen.length === 0) return;
    // `ignoreDuplicates`: botst een sleutel met wat er al staat, dan is die les al gekend en
    // is overslaan precies goed. Zonder dit zou één dubbel de hele plakbeurt laten mislukken.
    const { error } = await supabase
      .from('facturatie_lessen')
      .upsert([...lessen], { onConflict: 'eigenaar,sleutel', ignoreDuplicates: true });
    if (error) throw new Error(`facturatie_lessen: ${error.message}`);
  },
  lesBewaren: (les: Factuurles) => bewaarRij('facturatie_lessen', les),
  lesVerwijderen: (id: string) => verwijderRij('facturatie_lessen', id),
  factuurBewaren: (f: Factuur) => bewaarRij('facturatie_facturen', f),
  factuurVerwijderen: (id: string) => verwijderRij('facturatie_facturen', id),
};
```

- [ ] **Step 2: Write the local side**

Maak `providers/facturatieLokaal.ts`:

```ts
// Dezelfde vorm als de Supabase-kant, op de opslag van dit toestel.
//
// Niet om echt te factureren — zonder .env is er geen login en dus geen eigenaar — maar zodat
// het scherm te openen is tijdens het werken eraan, en zodat de app niet omvalt op een
// backend die deze vraag niet kent.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Factuur, Factuurles, FacturatieData, Klant, Leverancier,
} from '../lib/facturatie';

const SLEUTEL = 'tennis.facturatie.v1';

const LEEG: FacturatieData = {
  leverancier: { id: '', naam: '', adres: '', btw: '', iban: '', bic: '' },
  klanten: [],
  lessen: [],
  facturen: [],
};

async function lees(): Promise<FacturatieData> {
  try {
    const ruw = await AsyncStorage.getItem(SLEUTEL);
    return ruw ? (JSON.parse(ruw) as FacturatieData) : LEEG;
  } catch {
    return LEEG;
  }
}

async function schrijf(data: FacturatieData): Promise<void> {
  try {
    await AsyncStorage.setItem(SLEUTEL, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

/** Een rij op zijn id vervangen, of achteraan toevoegen als hij er nog niet is. */
function metRij<T extends { id: string }>(rijen: T[], rij: T): T[] {
  const i = rijen.findIndex((r) => r.id === rij.id);
  if (i === -1) return [...rijen, rij];
  const uit = [...rijen];
  uit[i] = rij;
  return uit;
}

export const facturatieLokaal = {
  laden: async (): Promise<FacturatieData | null> => lees(),

  leverancierBewaren: async (l: Leverancier) => schrijf({ ...(await lees()), leverancier: l }),

  klantBewaren: async (k: Klant) => {
    const data = await lees();
    await schrijf({ ...data, klanten: metRij(data.klanten, k) });
  },

  klantVerwijderen: async (id: string) => {
    const data = await lees();
    await schrijf({ ...data, klanten: data.klanten.filter((k) => k.id !== id) });
  },

  lessenToevoegen: async (lessen: readonly Factuurles[]) => {
    const data = await lees();
    const gekend = new Set(data.lessen.map((l) => l.sleutel));
    const nieuw: Factuurles[] = [];
    for (const les of lessen) {
      // Ook binnen één plakbeurt: twee regels met dezelfde sleutel zijn dezelfde les. Aan
      // de kant van de databank houdt de unieke index dat tegen; hier moet het met de hand,
      // anders doen de twee kanten iets anders en merk je dat pas op een toestel zonder
      // .env.
      if (gekend.has(les.sleutel)) continue;
      gekend.add(les.sleutel);
      nieuw.push(les);
    }
    await schrijf({ ...data, lessen: [...data.lessen, ...nieuw] });
  },

  lesBewaren: async (les: Factuurles) => {
    const data = await lees();
    await schrijf({ ...data, lessen: metRij(data.lessen, les) });
  },

  lesVerwijderen: async (id: string) => {
    const data = await lees();
    await schrijf({ ...data, lessen: data.lessen.filter((l) => l.id !== id) });
  },

  factuurBewaren: async (f: Factuur) => {
    const data = await lees();
    await schrijf({ ...data, facturen: metRij(data.facturen, f) });
  },

  factuurVerwijderen: async (id: string) => {
    const data = await lees();
    await schrijf({ ...data, facturen: data.facturen.filter((f) => f.id !== id) });
  },
};
```

- [ ] **Step 3: Hang it on the backend**

In `providers/backend.ts`:

1. Zet bij de imports erbij:

```ts
import { facturatieLokaal } from './facturatieLokaal';
import { facturatieSupabase } from './facturatieStore';
import type { Factuur, Factuurles, FacturatieData, Klant, Leverancier } from '../lib/facturatie';
```

2. Zet vóór `export interface Backend` de vorm erbij:

```ts
/**
 * De facturatie, los van de rest.
 *
 * Waarom dit niet in `load`/`save` zit: die halen bij het opstarten alles op wat je mag zien,
 * voor iedereen. Deze gegevens gaan één persoon aan, groeien elk jaar, en worden pas gelezen
 * als hij het scherm opent. Hetzelfde argument als bij `bezetteUren` hieronder.
 */
export interface FacturatieBackend {
  /** `null` betekent "de tabellen staan er nog niet", niet "er is niets". */
  laden: () => Promise<FacturatieData | null>;
  leverancierBewaren: (l: Leverancier) => Promise<void>;
  klantBewaren: (k: Klant) => Promise<void>;
  klantVerwijderen: (id: string) => Promise<void>;
  lessenToevoegen: (lessen: readonly Factuurles[]) => Promise<void>;
  lesBewaren: (les: Factuurles) => Promise<void>;
  lesVerwijderen: (id: string) => Promise<void>;
  factuurBewaren: (f: Factuur) => Promise<void>;
  factuurVerwijderen: (id: string) => Promise<void>;
}
```

3. Zet `facturatie: FacturatieBackend;` onderaan in `interface Backend`, ná `bezetteUren`.

4. Zet in `localBackend` erbij, ná `bezetteUren: bezetteUrenLokaal,`:

```ts
  facturatie: facturatieLokaal,
```

5. Zet in `supabaseBackend` erbij, ná `bezetteUren: bezetteUrenUitSupabase,`:

```ts
  facturatie: facturatieSupabase,
```

- [ ] **Step 4: Check types and run the suite**

Run: `npx tsc --noEmit && npm test`
Expected: geen typefouten, alle tests groen.

- [ ] **Step 5: Commit**

```bash
git add providers/facturatieStore.ts providers/facturatieLokaal.ts providers/backend.ts
git commit -m "feat(facturatie): laden en bewaren, naast de gewone lading"
```

- [ ] **Step 6: Tell the user to run the SQL**

Zeg tegen de gebruiker: *"`FACTURATIE.sql` staat klaar. Draai hem in de SQL-editor van Supabase en herlaad daarna de app hard — ze leest de databank bij het opstarten."* Ga verder met taak 9 terwijl hij dat doet; het scherm werkt ook zonder de tabellen, het zegt dan alleen dat ze ontbreken.

---

## Task 9: De schil van het scherm, en de weg ernaartoe

**Files:**
- Modify: `lib/facturatie.ts` (één helper erbij)
- Modify: `lib/facturatie.test.ts` (tests erbij)
- Create: `app/admin/facturatie.tsx`
- Modify: `app/admin/index.tsx`

- [ ] **Step 1: Write the failing test for the id helper**

Vul de import in `lib/facturatie.test.ts` aan met `nieuwId` en zet onderaan erbij:

```ts
describe('nieuwId', () => {
  it('begint met het voorvoegsel', () => {
    expect(nieuwId('les')).toMatch(/^les-/);
  });

  it('geeft twee keer na elkaar niet hetzelfde', () => {
    const veel = new Set(Array.from({ length: 500 }, () => nieuwId('les')));
    expect(veel.size).toBe(500);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest lib/facturatie.test.ts -t nieuwId`
Expected: FAIL — `nieuwId is not a function`.

- [ ] **Step 3: Add the helper**

Zet in `lib/facturatie.ts`, onder `MAANDNAMEN`, erbij:

```ts
/**
 * Een id voor een nieuwe rij. Dezelfde vorm als `newId` in providers/mockStore, maar hier,
 * zodat een scherm dat een les bijmaakt niets uit de lokale opslag hoeft te importeren.
 */
export function nieuwId(voorvoegsel: string): string {
  const willekeur = Math.random().toString(36).slice(2, 9);
  return `${voorvoegsel}-${Date.now().toString(36)}-${willekeur}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest lib/facturatie.test.ts -t nieuwId`
Expected: PASS.

- [ ] **Step 5: Write the screen shell**

Maak `app/admin/facturatie.tsx`:

```tsx
// Beheer → Facturatie. De uren van Koen omzetten in een factuur aan Gantoise en Racso.
//
// Dit scherm is van één persoon: `magFactureren` laat één e-mailadres door, en de RLS in
// FACTURATIE.sql houdt de rest tegen. Het staat onder Beheer omdat daar de andere schermen
// over geld staan, niet omdat de club er iets mee te maken heeft.
//
// Anders dan de rest van Beheer haalt dit scherm zijn eigen gegevens op. Ze komen niet mee
// in de lading bij het opstarten — zie `facturatie` op Backend in providers/backend.ts.

import { useCallback, useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { LessenBlad } from '../../components/facturatie/LessenBlad';
import { FactuurBlad } from '../../components/facturatie/FactuurBlad';
import { RegisterBlad } from '../../components/facturatie/RegisterBlad';
import { InstellingenBlad } from '../../components/facturatie/InstellingenBlad';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { backend } from '../../providers/backend';
import {
  magFactureren, nieuwId, standaardKlanten, standaardLeverancier, type FacturatieData,
} from '../../lib/facturatie';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography } from '../../constants/theme';

type Blad = 'lessen' | 'factuur' | 'register' | 'instellingen';

const BLADEN: Array<{ sleutel: Blad; label: string }> = [
  { sleutel: 'lessen', label: 'Lessen' },
  { sleutel: 'factuur', label: 'Factuur maken' },
  { sleutel: 'register', label: 'Register' },
  { sleutel: 'instellingen', label: 'Instellingen' },
];

/** Wat er op het scherm staat terwijl of nadat er geladen is. */
type Stand =
  | { soort: 'laden' }
  | { soort: 'geen-tabellen' }
  | { soort: 'fout'; bericht: string }
  | { soort: 'klaar'; data: FacturatieData };

export default function Facturatie() {
  const { currentUser, bookings } = useSimpleData();
  const [blad, setBlad] = useState<Blad>('factuur');
  const [stand, setStand] = useState<Stand>({ soort: 'laden' });

  const laden = useCallback(async () => {
    try {
      const data = await backend.facturatie.laden();
      if (data === null) {
        setStand({ soort: 'geen-tabellen' });
        return;
      }

      // De eerste keer: mijn gegevens en de twee clubs klaarzetten. Dat gebeurt hier en niet
      // in FACTURATIE.sql, want daar is nog niet bekend wie de eigenaar is — de SQL-editor
      // draait zonder ingelogde gebruiker.
      let klaar = data;
      if (klaar.leverancier.id === '') {
        const leverancier = standaardLeverancier(nieuwId('lev'));
        await backend.facturatie.leverancierBewaren(leverancier);
        klaar = { ...klaar, leverancier };
      }
      if (klaar.klanten.length === 0) {
        const klanten = standaardKlanten([nieuwId('kl'), nieuwId('kl')]);
        for (const klant of klanten) await backend.facturatie.klantBewaren(klant);
        klaar = { ...klaar, klanten };
      }

      setStand({ soort: 'klaar', data: klaar });
    } catch (e) {
      setStand({ soort: 'fout', bericht: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  useEffect(() => {
    void laden();
  }, [laden]);

  if (!magFactureren(currentUser?.email)) {
    return (
      <Screen scroll={false}>
        <Text style={styles.muted}>Facturatie is persoonlijk en staat niet open.</Text>
      </Screen>
    );
  }

  if (stand.soort === 'laden') {
    return (
      <Screen scroll={false}>
        <ActivityIndicator color={tennisColors.primary} />
      </Screen>
    );
  }

  if (stand.soort === 'geen-tabellen') {
    return (
      <Screen>
        <Card>
          <Text style={styles.kop}>De tabellen staan er nog niet</Text>
          <Text style={styles.uitleg}>
            Draai `FACTURATIE.sql` in de SQL-editor van Supabase en herlaad daarna deze pagina
            hard. De app leest de databank bij het opstarten.
          </Text>
        </Card>
      </Screen>
    );
  }

  if (stand.soort === 'fout') {
    return (
      <Screen>
        <Card>
          <Text style={styles.kop}>Het laden liep mis</Text>
          <Text style={styles.uitleg}>{stand.bericht}</Text>
        </Card>
      </Screen>
    );
  }

  const { data } = stand;

  return (
    <Screen>
      <Text style={styles.titel}>Facturatie</Text>

      <View style={styles.tabs}>
        {BLADEN.map((b) => (
          <Chip
            key={b.sleutel}
            label={b.label}
            selected={blad === b.sleutel}
            onPress={() => setBlad(b.sleutel)}
          />
        ))}
      </View>

      {blad === 'lessen' && <LessenBlad data={data} opnieuwLaden={laden} />}
      {blad === 'factuur' && (
        <FactuurBlad data={data} bookings={bookings} trainerId={currentUser?.id ?? ''} opnieuwLaden={laden} />
      )}
      {blad === 'register' && <RegisterBlad data={data} opnieuwLaden={laden} />}
      {blad === 'instellingen' && <InstellingenBlad data={data} opnieuwLaden={laden} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  titel: { ...typography.h1, color: tennisColors.text, marginBottom: spacing.md },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  kop: { ...typography.h2, color: tennisColors.text, marginBottom: spacing.sm },
  uitleg: { ...typography.body, color: tennisColors.textMuted },
  muted: { ...typography.body, color: tennisColors.textMuted },
});
```

- [ ] **Step 6: Add the tile in Beheer**

In `app/admin/index.tsx`:

1. Zet `Receipt` bij de iconen uit `lucide-react-native`.
2. Zet bij de imports erbij: `import { magFactureren } from '../../lib/facturatie';`
3. Zet in de groep `geld`, ná de tegel `rep`, erbij:

```tsx
        ...(magFactureren(currentUser?.email)
          ? [{ key: 'fact', title: t('Facturatie'), subtitle: t('Mijn uren aan de clubs'), icon: Receipt, onPress: () => router.push('/admin/facturatie') } as Tile]
          : []),
```

Dezelfde vorm als de tegels `tennisschool`, `courts` en `leden` daar al gebruiken.

- [ ] **Step 7: Check types**

Run: `npx tsc --noEmit`
Expected: vier fouten, allemaal "Cannot find module '../../components/facturatie/...'" — die bestanden komen in taak 10 tot 13. Alle andere fouten zijn echt en moeten nu opgelost worden.

- [ ] **Step 8: Commit**

```bash
git add lib/facturatie.ts lib/facturatie.test.ts app/admin/facturatie.tsx app/admin/index.tsx
git commit -m "feat(facturatie): het scherm en de tegel ernaartoe"
```

> Dit is de enige taak die met een rode typechecker eindigt. Taak 10 tot 13 maken de vier ontbrekende bestanden; na taak 13 hoort `npx tsc --noEmit` weer stil te zijn.

---

## Task 10: Blad 1 — Lessen

**Files:**
- Create: `components/facturatie/LessenBlad.tsx`

- [ ] **Step 1: Write the component**

Maak `components/facturatie/LessenBlad.tsx`:

```tsx
// Facturatie, blad 1: de lessen.
//
// Hier komt de lijst binnen die uit het clubsysteem gekopieerd wordt, en hier staat wat er
// met de hand bij moet. Eén regel: wat niet gelezen kan worden, komt op het scherm. Een
// factuur die twee uur te weinig telt omdat één regel stil overgeslagen werd, merkt niemand.

import { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Plus, RotateCcw, Trash2 } from 'lucide-react-native';

import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { backend } from '../../providers/backend';
import { leesPlaktekst, verwerkPlak, type OvergeslagenRegel } from '../../lib/facturatie-plak';
import {
  MAANDNAMEN, nieuwId, sleutelVan, urenVan,
  type FacturatieData, type Factuurles,
} from '../../lib/facturatie';
import { formatEuro } from '../../lib/money';
import { parseDayInput, formatDayInput } from '../../lib/period';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, radius, typography, webCursor, minTapTarget } from '../../constants/theme';

/** Wat er na een plakbeurt op het scherm komt. */
interface Uitkomst {
  nieuw: number;
  bekend: number;
  overgeslagen: OvergeslagenRegel[];
}

/**
 * De extra lessen die er op dit moment bij kunnen komen: twee, allebei bij Racso en allebei
 * sponsor.
 *
 * Een lijst bovenaan en geen twee knoppen verderop in de opmaak, zodat er een regel bij kan
 * komen zonder dat iemand door het scherm moet. Het volle formulier eronder blijft bestaan: deze
 * twee zijn de stand van zaken van 4 oktober 2026, geen wet.
 */
const SNELLE_EXTRA_LESSEN = [
  { naam: 'Stan', type: 'sponsor', club: 'Racso', van: '09:00', tot: '10:00', uren: 1 },
  { naam: 'Veerle', type: 'sponsor', club: 'Racso', van: '10:00', tot: '11:00', uren: 1 },
] as const;

export function LessenBlad({ data, opnieuwLaden }: {
  data: FacturatieData;
  opnieuwLaden: () => Promise<void>;
}) {
  const [tekst, setTekst] = useState('');
  const [bezig, setBezig] = useState(false);
  const [uitkomst, setUitkomst] = useState<Uitkomst | null>(null);
  const [fout, setFout] = useState('');
  const [filterClub, setFilterClub] = useState('');
  const [filterMaand, setFilterMaand] = useState('');
  const [prive, setPrive] = useState(false);

  async function verwerken() {
    setBezig(true);
    setFout('');
    try {
      const gelezen = leesPlaktekst(tekst);
      const { nieuw, bekend } = verwerkPlak(data.lessen, gelezen.lessen);

      await backend.facturatie.lessenToevoegen(nieuw.map((l) => ({
        ...l,
        id: nieuwId('les'),
        uren_handmatig: null,
        actief: true,
        naam_prive: '',
        type_prive: '',
      })));

      setUitkomst({ nieuw: nieuw.length, bekend, overgeslagen: gelezen.overgeslagen });
      setTekst('');
      await opnieuwLaden();
    } catch (e) {
      setFout(e instanceof Error ? e.message : String(e));
    } finally {
      setBezig(false);
    }
  }

  async function bewaarLes(les: Factuurles) {
    setFout('');
    try {
      await backend.facturatie.lesBewaren(les);
      await opnieuwLaden();
    } catch (e) {
      setFout(e instanceof Error ? e.message : String(e));
    }
  }

  const clubs = useMemo(
    () => [...new Set(data.lessen.map((l) => l.club_tekst))].sort(),
    [data.lessen],
  );

  // De maanden waarin er iets staat, nieuwste eerst: `2026-09`.
  const maanden = useMemo(
    () => [...new Set(data.lessen.map((l) => l.datum.slice(0, 7)))].sort().reverse(),
    [data.lessen],
  );

  // Nieuwste eerst: de maand waar je mee bezig bent, staat bovenaan.
  const zichtbaar = useMemo(() => {
    const gefilterd = data.lessen.filter((l) =>
      (filterClub === '' || l.club_tekst === filterClub)
      && (filterMaand === '' || l.datum.startsWith(filterMaand)));
    return [...gefilterd].sort((a, b) => b.datum.localeCompare(a.datum));
  }, [data.lessen, filterClub, filterMaand]);

  /** `2026-09` → `September 2026`. */
  function maandLabel(sleutel: string): string {
    const [jaar, maand] = sleutel.split('-');
    return `${MAANDNAMEN[Number(maand) - 1]} ${jaar}`;
  }

  return (
    <View style={styles.blad}>
      <Card>
        <Text style={styles.kop}>Lijst plakken</Text>
        <Text style={styles.uitleg}>
          Kopieer het overzicht uit het clubsysteem en plak het hier. De koprij mag mee. Lessen
          die al gekend zijn, komen er geen tweede keer bij.
        </Text>
        <TextInput
          value={tekst}
          onChangeText={setTekst}
          multiline
          numberOfLines={8}
          placeholder="GANTOISE&#9;Tennis - Jaarcyclus…"
          placeholderTextColor={tennisColors.textMuted}
          style={styles.plakvlak}
        />
        <Button
          label={bezig ? 'Bezig…' : 'Verwerken'}
          onPress={() => void verwerken()}
          disabled={bezig || tekst.trim() === ''}
        />

        {uitkomst && (
          <View style={styles.melding}>
            <Text style={styles.meldingTekst}>
              {uitkomst.nieuw} nieuw, {uitkomst.bekend} waren al gekend,{' '}
              {uitkomst.overgeslagen.length} overgeslagen.
            </Text>
            {uitkomst.overgeslagen.map((r, i) => (
              <Text key={i} style={styles.overgeslagen} numberOfLines={2}>
                {r.reden}: {r.regel}
              </Text>
            ))}
          </View>
        )}
      </Card>

      <SnelleExtraLes onBewaar={bewaarLes} />

      <PriveFormulier
        open={prive}
        onOpen={() => setPrive(true)}
        onSluit={() => setPrive(false)}
        onBewaar={async (les) => {
          await bewaarLes(les);
          setPrive(false);
        }}
      />

      <Card>
        <Text style={styles.kop}>
          {zichtbaar.length} van {data.lessen.length} lessen ·{' '}
          {formatEuro(zichtbaar.filter((l) => l.actief).reduce((som, l) => som + urenVan(l), 0))} u
        </Text>
        <View style={styles.filters}>
          <Chip label="Alle clubs" selected={filterClub === ''} onPress={() => setFilterClub('')} />
          {clubs.map((c) => (
            <Chip key={c} label={c} selected={filterClub === c} onPress={() => setFilterClub(c)} />
          ))}
        </View>
        <View style={styles.filters}>
          <Chip label="Alle maanden" selected={filterMaand === ''} onPress={() => setFilterMaand('')} />
          {maanden.map((m) => (
            <Chip key={m} label={maandLabel(m)} selected={filterMaand === m} onPress={() => setFilterMaand(m)} />
          ))}
        </View>

        {zichtbaar.length === 0 && <Text style={styles.uitleg}>Niets om te tonen.</Text>}

        {zichtbaar.map((les) => (
          <Lesregel key={les.id} les={les} onBewaar={bewaarLes} />
        ))}
      </Card>

      {fout !== '' && <Text style={styles.fout}>{fout}</Text>}
    </View>
  );
}

/** Eén les in de lijst: wat hij is, hoeveel uur hij telt, en of hij meetelt. */
function Lesregel({ les, onBewaar }: {
  les: Factuurles;
  onBewaar: (les: Factuurles) => Promise<void>;
}) {
  const [urenTekst, setUrenTekst] = useState(String(urenVan(les)));

  function zetUren() {
    const getal = Number(urenTekst.replace(',', '.'));
    // Een leeg veld is géén nul uur. `Number('')` is 0, en dat is finiet en niet negatief,
    // dus zonder deze regel schrijft wegvegen-en-wegklikken stilletjes nul uur weg en telt
    // de factuur een les te weinig. Onzin en hetzelfde getal vallen hier ook af: een
    // databankronde per toetsaanslag is precies wat dit scherm traag zou maken.
    if (urenTekst.trim() === '' || !Number.isFinite(getal) || getal < 0
      || getal === urenVan(les)) {
      setUrenTekst(String(urenVan(les)));
      return;
    }
    void onBewaar({ ...les, uren_handmatig: getal });
  }

  const aangepast = les.uren_handmatig !== null;

  return (
    <View style={[styles.regel, !les.actief && styles.regelGeschrapt]}>
      <View style={styles.regelTekst}>
        <Text style={[styles.regelKop, !les.actief && styles.doorstreept]} numberOfLines={1}>
          {les.bron === 'prive' ? `${les.naam_prive} · ${les.type_prive}` : les.groep}
        </Text>
        <Text style={styles.regelSub} numberOfLines={1}>
          {les.club_tekst} · {les.bron === 'prive' ? les.datum : les.dag_uur}
          {aangepast ? ` · gerekend: ${les.uren}` : ''}
        </Text>
      </View>

      <TextInput
        value={urenTekst}
        onChangeText={setUrenTekst}
        onBlur={zetUren}
        keyboardType="decimal-pad"
        style={styles.urenVeld}
        accessibilityLabel="Uren"
      />

      <Pressable
        onPress={() => void onBewaar({ ...les, actief: !les.actief })}
        accessibilityRole="button"
        accessibilityLabel={les.actief ? 'Schrappen' : 'Terugzetten'}
        style={[styles.knopje, webCursor]}
      >
        {les.actief
          ? <Trash2 size={18} color={tennisColors.danger} />
          : <RotateCcw size={18} color={tennisColors.primary} />}
      </Pressable>
    </View>
  );
}

/**
 * De twee vaste extra lessen bij Racso, met één tik.
 *
 * Alles staat al ingevuld behalve de datum, want dat is het enige wat per keer verschilt.
 * Zo is een maand bijtikken acht tikken in plaats van acht formulieren.
 */
function SnelleExtraLes({ onBewaar }: { onBewaar: (les: Factuurles) => Promise<void> }) {
  const [datum, setDatum] = useState(formatDayInput(new Date()));
  const dag = parseDayInput(datum);

  return (
    <Card>
      <Text style={styles.kop}>Extra les</Text>
      <Text style={styles.uitleg}>
        Kies de datum en tik op wie er les had. Staat er iemand anders op de baan, gebruik dan
        het formulier eronder.
      </Text>
      <Veld label="Datum (dd/mm/jjjj)" waarde={datum} onChange={setDatum} />
      <View style={styles.knoppen}>
        {SNELLE_EXTRA_LESSEN.map((sjabloon) => (
          <Button
            key={sjabloon.naam}
            label={`${sjabloon.naam} ${sjabloon.van}-${sjabloon.tot}`}
            variant="secondary"
            fullWidth={false}
            disabled={dag === null}
            onPress={() => {
              if (dag === null) return;
              void onBewaar(priveLes({
                naam: sjabloon.naam,
                type: sjabloon.type,
                club: sjabloon.club,
                dag,
                uren: sjabloon.uren,
                dagUur: `${sjabloon.van} - ${sjabloon.tot}`,
              }));
            }}
          />
        ))}
      </View>
    </Card>
  );
}

/**
 * Eén privéles, klaar om weg te schrijven.
 *
 * Staat apart omdat de snelknoppen en het volle formulier allebei precies dezelfde rij
 * moeten maken — zou dat op twee plekken staan, dan loopt er ooit één achter.
 */
function priveLes({ naam, type, club, dag, uren, dagUur }: {
  naam: string;
  type: string;
  club: string;
  dag: Date;
  uren: number;
  dagUur: string;
}): Factuurles {
  const iso = `${dag.getFullYear()}-${String(dag.getMonth() + 1).padStart(2, '0')}-${String(dag.getDate()).padStart(2, '0')}`;
  const id = nieuwId('priv');
  return {
    id,
    bron: 'prive',
    // De korte naam van de klant: zo telt `urenPerClub` een privéles mee. Een geplakte les
    // hangt aan `naam_in_lijst`, en dat is een andere naam voor dezelfde club.
    club_tekst: club.trim(),
    aanbod: '',
    doelgroep: '',
    groep: '',
    dag_uur: dagUur,
    trainer: '',
    status: '',
    datum: iso,
    uren,
    uren_handmatig: null,
    actief: true,
    naam_prive: naam.trim(),
    type_prive: type.trim(),
    // Een eigen sleutel met het id erin: twee identieke privélessen op dezelfde dag zijn
    // twee lessen, en mogen elkaar niet uitsluiten op de unieke index.
    sleutel: `${sleutelVan(club, naam, iso)}|${id}`,
  };
}

/** Een privéles bijtikken: het blokje M–Q uit Sheet3 van facturen.xlsx. */
function PriveFormulier({ open, onOpen, onSluit, onBewaar }: {
  open: boolean;
  onOpen: () => void;
  onSluit: () => void;
  onBewaar: (les: Factuurles) => Promise<void>;
}) {
  const [naam, setNaam] = useState('');
  const [type, setType] = useState('');
  const [club, setClub] = useState('');
  const [datum, setDatum] = useState(formatDayInput(new Date()));
  const [uren, setUren] = useState('1');

  const dag = parseDayInput(datum);
  const urenGetal = Number(uren.replace(',', '.'));
  const mag = naam.trim() !== '' && club.trim() !== '' && dag !== null
    && Number.isFinite(urenGetal) && urenGetal > 0;

  if (!open) {
    return (
      <Button
        label="Privéles toevoegen"
        variant="secondary"
        icon={<Plus size={18} color={tennisColors.primary} />}
        onPress={onOpen}
      />
    );
  }

  function bewaar() {
    if (!mag || dag === null) return;
    void onBewaar(priveLes({
      naam, type, club, dag, uren: urenGetal, dagUur: '',
    }));
    setNaam('');
    setType('');
  }

  return (
    <Card>
      <Text style={styles.kop}>Privéles</Text>
      <Veld label="Naam" waarde={naam} onChange={setNaam} />
      <Veld label="Type" waarde={type} onChange={setType} />
      <Veld label="Club (korte naam, bv. Racso)" waarde={club} onChange={setClub} />
      <Veld label="Datum (dd/mm/jjjj)" waarde={datum} onChange={setDatum} />
      <Veld label="Uren" waarde={uren} onChange={setUren} />
      <View style={styles.knoppen}>
        <Button label="Bewaren" onPress={bewaar} disabled={!mag} fullWidth={false} />
        <Button label="Annuleren" variant="secondary" onPress={onSluit} fullWidth={false} />
      </View>
    </Card>
  );
}

/** Eén invulveld met zijn opschrift. Staat hier omdat vier bladen hem anders viermaal typen. */
export function Veld({ label, waarde, onChange, placeholder }: {
  label: string;
  waarde: string;
  onChange: (tekst: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={styles.veld}>
      <Text style={styles.veldLabel}>{label}</Text>
      <TextInput
        value={waarde}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={tennisColors.textMuted}
        style={styles.invoer}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  blad: { gap: spacing.lg },
  kop: { ...typography.h3, color: tennisColors.text, marginBottom: spacing.xs },
  uitleg: { ...typography.caption, color: tennisColors.textMuted, marginBottom: spacing.sm },
  plakvlak: {
    minHeight: 140,
    borderWidth: 1,
    borderColor: tennisColors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    color: tennisColors.text,
    backgroundColor: tennisColors.surfaceAlt,
    marginBottom: spacing.sm,
    textAlignVertical: 'top',
  },
  melding: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: tennisColors.primaryTint,
    gap: spacing.xs,
  },
  meldingTekst: { ...typography.label, color: tennisColors.text },
  overgeslagen: { ...typography.caption, color: tennisColors.warning },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  regel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: tennisColors.border,
  },
  regelGeschrapt: { opacity: 0.5 },
  regelTekst: { flex: 1 },
  regelKop: { ...typography.label, color: tennisColors.text },
  regelSub: { ...typography.caption, color: tennisColors.textMuted },
  doorstreept: { textDecorationLine: 'line-through' },
  urenVeld: {
    width: 64,
    textAlign: 'right',
    borderWidth: 1,
    borderColor: tennisColors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    color: tennisColors.text,
  },
  knopje: {
    minWidth: minTapTarget,
    minHeight: minTapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  veld: { marginBottom: spacing.sm },
  veldLabel: { ...typography.caption, color: tennisColors.textMuted, marginBottom: 2 },
  invoer: {
    borderWidth: 1,
    borderColor: tennisColors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    color: tennisColors.text,
    backgroundColor: tennisColors.surface,
  },
  knoppen: { flexDirection: 'row', gap: spacing.sm },
  fout: { ...typography.body, color: tennisColors.danger },
});
```

- [ ] **Step 2: Commit**

```bash
git add components/facturatie/LessenBlad.tsx
git commit -m "feat(facturatie): het blad met de lessen en het plakvlak"
```

---

## Task 11: Blad 4 — Instellingen

Eerst dit blad en dan pas het factuurblad: zonder klantgegevens valt er niets te factureren, en met dit blad af is het factuurblad met de hand te controleren.

**Files:**
- Create: `components/facturatie/InstellingenBlad.tsx`

- [ ] **Step 1: Write the component**

Maak `components/facturatie/InstellingenBlad.tsx`:

```tsx
// Facturatie, blad 4: mijn gegevens en de klanten.
//
// Het veld dat hier het meest toe doet is `naam_in_lijst`: onder welke naam een club in de
// geplakte tekst staat. In facturen.xlsx stond daar "RACSO" terwijl de lijst "T.C. RACSO"
// zegt, en die werkmap telde Racso daardoor op nul uur zonder dat er iets misliep. Daarom
// staat het hier als een gewoon, zichtbaar veld en niet verstopt in de code.

import { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Plus } from 'lucide-react-native';

import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { Veld } from './LessenBlad';
import { backend } from '../../providers/backend';
import { nieuwId, type Bron, type FacturatieData, type Klant, type Leverancier } from '../../lib/facturatie';
import { formatEuro, parseEuro } from '../../lib/money';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography } from '../../constants/theme';

export function InstellingenBlad({ data, opnieuwLaden }: {
  data: FacturatieData;
  opnieuwLaden: () => Promise<void>;
}) {
  const [fout, setFout] = useState('');

  async function doe(actie: () => Promise<void>) {
    setFout('');
    try {
      await actie();
      await opnieuwLaden();
    } catch (e) {
      setFout(e instanceof Error ? e.message : String(e));
    }
  }

  // `urenPerClub` gaat ervan uit dat elke naam bij één club hoort en houdt een dubbel niet
  // tegen — daar weet het rekenwerk niet of het een vergissing is. Hier wel: dit is de
  // enige plek waar iemand die naam intikt.
  const dubbeleNamen = useMemo(() => {
    const geteld = new Map<string, number>();
    for (const k of data.klanten) {
      const naam = k.naam_in_lijst.trim();
      if (naam !== '') geteld.set(naam, (geteld.get(naam) ?? 0) + 1);
    }
    return [...geteld.entries()].filter(([, n]) => n > 1).map(([naam]) => naam);
  }, [data.klanten]);

  return (
    <View style={styles.blad}>
      <LeverancierKaart
        leverancier={data.leverancier}
        onBewaar={(l) => doe(() => backend.facturatie.leverancierBewaren(l))}
      />

      {dubbeleNamen.length > 0 && (
        <Text style={styles.waarschuwing}>
          Twee clubs met dezelfde naam in de lijst: {dubbeleNamen.join(', ')}. Ze tellen
          allebei dezelfde lessen, en dan factureer je die twee keer.
        </Text>
      )}

      {data.klanten.map((klant) => (
        <KlantKaart
          key={klant.id}
          klant={klant}
          onBewaar={(k) => doe(() => backend.facturatie.klantBewaren(k))}
          onVerwijder={() => doe(() => backend.facturatie.klantVerwijderen(klant.id))}
        />
      ))}

      <Button
        label="Club toevoegen"
        variant="secondary"
        icon={<Plus size={18} color={tennisColors.primary} />}
        onPress={() => void doe(() => backend.facturatie.klantBewaren({
          id: nieuwId('kl'),
          klantnaam: 'Nieuwe club',
          adres: '',
          postcode_gemeente: '',
          btw_nummer: '',
          uurtarief: 0,
          korte_naam: '',
          naam_in_lijst: '',
          btw_percentage: 0,
          bron_voorkeur: 'geplakt',
          volgorde: data.klanten.length + 1,
        }))}
      />

      {fout !== '' && <Text style={styles.fout}>{fout}</Text>}
    </View>
  );
}

function LeverancierKaart({ leverancier, onBewaar }: {
  leverancier: Leverancier;
  onBewaar: (l: Leverancier) => Promise<void>;
}) {
  const [concept, setConcept] = useState(leverancier);
  const gewijzigd = JSON.stringify(concept) !== JSON.stringify(leverancier);

  return (
    <Card>
      <Text style={styles.kop}>Mijn gegevens</Text>
      <Text style={styles.uitleg}>Deze staan bovenaan elke factuur, aan beide clubs.</Text>
      <Veld label="Naam" waarde={concept.naam} onChange={(naam) => setConcept({ ...concept, naam })} />
      <Veld label="Adres" waarde={concept.adres} onChange={(adres) => setConcept({ ...concept, adres })} />
      <Veld label="BTW-nummer" waarde={concept.btw} onChange={(btw) => setConcept({ ...concept, btw })} />
      <Veld label="IBAN" waarde={concept.iban} onChange={(iban) => setConcept({ ...concept, iban })} />
      <Veld label="BIC" waarde={concept.bic} onChange={(bic) => setConcept({ ...concept, bic })} />
      <Button label="Bewaren" onPress={() => void onBewaar(concept)} disabled={!gewijzigd} />
    </Card>
  );
}

function KlantKaart({ klant, onBewaar, onVerwijder }: {
  klant: Klant;
  onBewaar: (k: Klant) => Promise<void>;
  onVerwijder: () => Promise<void>;
}) {
  const [concept, setConcept] = useState(klant);
  const [tariefTekst, setTariefTekst] = useState(formatEuro(klant.uurtarief));
  const [bevestig, setBevestig] = useState(false);

  const tarief = parseEuro(tariefTekst);
  const gewijzigd = JSON.stringify(concept) !== JSON.stringify(klant)
    || (tarief !== undefined && tarief !== klant.uurtarief);

  const onvolledig = concept.adres.trim() === '' || concept.btw_nummer.trim() === '';

  function zetBron(bron_voorkeur: Bron) {
    setConcept({ ...concept, bron_voorkeur });
  }

  return (
    <Card>
      <Text style={styles.kop}>{klant.klantnaam}</Text>

      {onvolledig && (
        <Text style={styles.waarschuwing}>
          Zonder adres en BTW-nummer van de klant is een factuur niet in orde.
        </Text>
      )}

      <Veld label="Klantnaam" waarde={concept.klantnaam} onChange={(klantnaam) => setConcept({ ...concept, klantnaam })} />
      <Veld label="Adres" waarde={concept.adres} onChange={(adres) => setConcept({ ...concept, adres })} />
      <Veld label="Postcode + gemeente" waarde={concept.postcode_gemeente} onChange={(postcode_gemeente) => setConcept({ ...concept, postcode_gemeente })} />
      <Veld label="BTW-nummer" waarde={concept.btw_nummer} onChange={(btw_nummer) => setConcept({ ...concept, btw_nummer })} />
      <Veld label="Uurtarief (€)" waarde={tariefTekst} onChange={setTariefTekst} />
      <Veld label="Korte naam — hier hangen de privélessen aan" waarde={concept.korte_naam} onChange={(korte_naam) => setConcept({ ...concept, korte_naam })} />
      <Veld
        label="Naam in de geplakte lijst — exact, bv. T.C. RACSO"
        waarde={concept.naam_in_lijst}
        onChange={(naam_in_lijst) => setConcept({ ...concept, naam_in_lijst })}
      />

      <Text style={styles.veldLabel}>Waar komen de uren vandaan?</Text>
      <View style={styles.bronnen}>
        <Chip label="De geplakte lijst" selected={concept.bron_voorkeur === 'geplakt'} onPress={() => zetBron('geplakt')} />
        <Chip label="De app" selected={concept.bron_voorkeur === 'app'} onPress={() => zetBron('app')} />
      </View>

      <Button
        label="Bewaren"
        onPress={() => void onBewaar({ ...concept, uurtarief: tarief ?? klant.uurtarief })}
        disabled={!gewijzigd}
      />

      {bevestig ? (
        <View style={styles.knoppen}>
          <Button label="Ja, verwijderen" variant="danger" onPress={() => void onVerwijder()} fullWidth={false} />
          <Button label="Nee" variant="secondary" onPress={() => setBevestig(false)} fullWidth={false} />
        </View>
      ) : (
        <Button label="Club verwijderen" variant="secondary" onPress={() => setBevestig(true)} />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  blad: { gap: spacing.lg },
  kop: { ...typography.h3, color: tennisColors.text, marginBottom: spacing.xs },
  uitleg: { ...typography.caption, color: tennisColors.textMuted, marginBottom: spacing.sm },
  waarschuwing: { ...typography.caption, color: tennisColors.warning, marginBottom: spacing.sm },
  veldLabel: { ...typography.caption, color: tennisColors.textMuted, marginBottom: 2 },
  bronnen: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md },
  knoppen: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  fout: { ...typography.body, color: tennisColors.danger },
});
```

- [ ] **Step 2: Commit**

```bash
git add components/facturatie/InstellingenBlad.tsx
git commit -m "feat(facturatie): mijn gegevens en de klanten beheren"
```

---

## Task 12: Blad 2 — Factuur maken

Het hart van het scherm: de maand, de twee bronnen naast elkaar, en de knop die het bestand aflevert.

**Files:**
- Create: `components/facturatie/FactuurBlad.tsx`

- [ ] **Step 1: Write the component**

Maak `components/facturatie/FactuurBlad.tsx`:

```tsx
// Facturatie, blad 2: de factuur maken.
//
// Per klant staan de twee bronnen naast elkaar — wat de app zegt en wat de geplakte lijst
// zegt — en je kiest er één. Optellen kan niet: ze beschrijven dezelfde lessen. Verschillen
// de twee, dan staat dat er met zoveel woorden bij; dat is de controle die in facturen.xlsx
// niemand deed.
//
// De zeven controleformules uit K9:L18 van het oude blad staan hier als meldingen. Alleen een
// leeg factuurnummer en een totaal van nul houden de knop tegen. De rest zijn waarschuwingen:
// Koen weet beter dan de app wanneer een factuur toch mag.

import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Plus, Trash2 } from 'lucide-react-native';

import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { Veld } from './LessenBlad';
import { backend } from '../../providers/backend';
import { factuurBestandsnaam, factuurWerkmap } from '../../lib/facturatie-xlsx';
import { shareXlsx, xlsxWordtOndersteund } from '../../lib/share';
import {
  MAANDNAMEN, extraLessenUit, factuurUit, nieuwId, onbekendeClubs, rond2, urenPerClub,
  urenUitApp,
  type AppBoeking, type Bron, type ExtraLes, type FacturatieData, type Klant,
  type VrijeLijn,
} from '../../lib/facturatie';
import { formatEuro, parseEuro } from '../../lib/money';
import { formatDayInput, parseDayInput } from '../../lib/period';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, radius, typography, webCursor, minTapTarget } from '../../constants/theme';

/**
 * Een vrije lijn zoals het scherm hem vasthoudt, met een eigen sleutel erbij.
 *
 * Die sleutel staat er voor React en gaat niet mee de databank in. Zonder hem zou een lijst
 * op volgnummer gesleuteld worden, en dan hergebruikt React de rij die op die plek stond
 * zodra je er eentje wegneemt — met het aantal en het tarief van de verwijderde lijn nog in
 * beeld, want die velden houden hun eigen tekst vast terwijl je typt.
 */
interface LijnInBewerking extends VrijeLijn {
  sleutel: string;
}

/** Wat ervan op de factuur komt: zonder de sleutel, die alleen het scherm nodig had. */
function zonderSleutel(lijn: LijnInBewerking): VrijeLijn {
  return {
    omschrijving: lijn.omschrijving,
    aantal: lijn.aantal,
    eenheid: lijn.eenheid,
    tarief: lijn.tarief,
  };
}

/**
 * Valt deze factuurdatum redelijk bij deze dienstmaand?
 *
 * Redelijk is: vanaf de eerste van de dienstmaand tot en met het einde van de maand erna.
 * Dat is dezelfde marge als de controle in L16 van het oude blad (`EOMONTH(...;1)`), en ze
 * vangt het echte geval: je maakt de factuur van september begin oktober.
 */
function datumPastBijMaand(dag: Date, maand: number, jaar: number): boolean {
  const begin = new Date(jaar, maand - 1, 1);
  // Dag 0 van twee maanden verder is de laatste dag van de maand erna; de maandgrens en de
  // jaargrens rolt `Date` zelf om.
  const eind = new Date(jaar, maand + 1, 0, 23, 59, 59);
  return dag >= begin && dag <= eind;
}

/** De vorige maand. Een factuur maak je achteraf, niet voor de maand waar je in zit. */
function vorigeMaand(nu: Date): { maand: number; jaar: number } {
  const maand = nu.getMonth(); // 0-gebaseerd = de vorige maand, 1-gebaseerd
  return maand === 0
    ? { maand: 12, jaar: nu.getFullYear() - 1 }
    : { maand, jaar: nu.getFullYear() };
}

export function FactuurBlad({ data, bookings, trainerId, opnieuwLaden }: {
  data: FacturatieData;
  bookings: readonly AppBoeking[];
  trainerId: string;
  opnieuwLaden: () => Promise<void>;
}) {
  const start = useMemo(() => vorigeMaand(new Date()), []);
  const [maand, setMaand] = useState(start.maand);
  const [jaar, setJaar] = useState(start.jaar);

  const perClub = useMemo(
    () => urenPerClub(data.lessen, data.klanten, maand, jaar),
    [data.lessen, data.klanten, maand, jaar],
  );
  const uitApp = useMemo(
    () => urenUitApp(bookings, trainerId, maand, jaar),
    [bookings, trainerId, maand, jaar],
  );
  const onbekend = useMemo(
    () => onbekendeClubs(data.lessen, data.klanten, maand, jaar),
    [data.lessen, data.klanten, maand, jaar],
  );

  const opApp = data.klanten.filter((k) => k.bron_voorkeur === 'app').length;

  return (
    <View style={styles.blad}>
      <Card>
        <Text style={styles.kop}>Welke maand?</Text>
        <View style={styles.maanden}>
          {MAANDNAMEN.map((naam, i) => (
            <Chip key={naam} label={naam.slice(0, 3)} selected={maand === i + 1} onPress={() => setMaand(i + 1)} />
          ))}
        </View>
        <View style={styles.maanden}>
          {[jaar - 1, jaar, jaar + 1].map((j) => (
            <Chip key={j} label={String(j)} selected={jaar === j} onPress={() => setJaar(j)} />
          ))}
        </View>
      </Card>

      {onbekend.map((club) => (
        <Text key={club.naam} style={styles.waarschuwing}>
          {club.aantal} {club.aantal === 1 ? 'les' : 'lessen'} bij een club die ik niet ken:{' '}
          {club.naam}. Voeg hem toe bij Instellingen, met die naam in het veld
          &quot;naam in de geplakte lijst&quot;.
        </Text>
      ))}

      {opApp > 1 && (
        <Text style={styles.waarschuwing}>
          {opApp} clubs staan op de bron &quot;de app&quot;. De app weet niet bij welke club een
          les hoort, dus die tellen allebei dezelfde uren.
        </Text>
      )}

      {perClub.map((rij) => (
        <KlantFactuur
          // De maand hoort in de sleutel. Een factuurkaart draagt een nummer, een datum,
          // een omschrijving en vrije lijnen die bij één maand horen; blijft dezelfde kaart
          // staan als je van maand wisselt, dan houdt ze "Tennislessen September" en die
          // ene extra lijn vast terwijl de uren al die van augustus zijn. Een andere
          // sleutel geeft een schone kaart, en dat is precies wat een andere maand is.
          key={`${rij.klant.id}-${jaar}-${maand}`}
          klant={rij.klant}
          urenGeplakt={rij.urenGeplakt}
          urenPrive={rij.urenPrive}
          urenApp={uitApp}
          extraLessen={extraLessenUit(data.lessen, rij.klant, maand, jaar)}
          maand={maand}
          jaar={jaar}
          data={data}
          opnieuwLaden={opnieuwLaden}
        />
      ))}
    </View>
  );
}

function KlantFactuur({
  klant, urenGeplakt, urenPrive, urenApp, extraLessen, maand, jaar, data, opnieuwLaden,
}: {
  klant: Klant;
  urenGeplakt: number;
  urenPrive: number;
  urenApp: number;
  extraLessen: readonly ExtraLes[];
  maand: number;
  jaar: number;
  data: FacturatieData;
  opnieuwLaden: () => Promise<void>;
}) {
  const [bron, setBron] = useState<Bron>(klant.bron_voorkeur);
  const [nummer, setNummer] = useState('');
  const [datum, setDatum] = useState(formatDayInput(new Date()));
  const [omschrijving, setOmschrijving] = useState(
    `Tennislessen ${MAANDNAMEN[maand - 1]} ${jaar}`,
  );
  const [lijnen, setLijnen] = useState<LijnInBewerking[]>([]);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState('');
  const [klaar, setKlaar] = useState('');

  const urenBron = bron === 'app' ? urenApp : urenGeplakt;
  const uren = rond2(urenBron + urenPrive);
  // Met de áfgedrukte uren rekenen, niet met het ruwe getal. Staat er 8,01 u op de factuur
  // en rekent het bedrag met 8,005, dan telt de regel niet op tot het nettobedrag eronder —
  // en dan heeft wie het natelt gelijk en de factuur ongelijk.
  const aantalUren = rond2(uren);
  const urenBedrag = rond2(aantalUren * klant.uurtarief);
  const vrijBedrag = lijnen.reduce((som, l) => som + rond2(l.aantal * l.tarief), 0);
  const netto = rond2(urenBedrag + vrijBedrag);
  const btw = rond2((netto * klant.btw_percentage) / 100);
  const totaal = rond2(netto + btw);

  const dag = parseDayInput(datum);
  const dagIso = dag === null
    ? ''
    : `${dag.getFullYear()}-${String(dag.getMonth() + 1).padStart(2, '0')}-${String(dag.getDate()).padStart(2, '0')}`;

  const nummerBestaat = data.facturen.some((f) => f.factuurnr.trim() === nummer.trim());
  const alGefactureerd = data.facturen.some(
    (f) => f.klant_naam === klant.klantnaam && f.dienstmaand === maand && f.dienstjaar === jaar,
  );
  const datumBuitenMaand = dag !== null && !datumPastBijMaand(dag, maand, jaar);
  const bronnenVerschillen = urenApp !== urenGeplakt;

  const mag = nummer.trim() !== '' && uren > 0 && dag !== null && !bezig;

  async function kiesBron(nieuw: Bron) {
    setBron(nieuw);
    // Meteen bewaren: de keuze hoort bij de klant en niet bij dit scherm, zodat Gantoise
    // volgende maand weer op de app staat zonder dat iemand eraan denkt.
    try {
      await backend.facturatie.klantBewaren({ ...klant, bron_voorkeur: nieuw });
      await opnieuwLaden();
    } catch (e) {
      setFout(e instanceof Error ? e.message : String(e));
    }
  }

  async function maak() {
    if (!mag) return;
    setBezig(true);
    setFout('');
    setKlaar('');
    try {
      const factuur = factuurUit({
        id: nieuwId('fac'),
        klant,
        uren,
        vrijeLijnen: lijnen.map(zonderSleutel),
        extraLessen,
        factuurnr: nummer.trim(),
        factuurdatum: dagIso,
        omschrijving,
        maand,
        jaar,
        aangemaakt: new Date().toISOString(),
      });

      const bytes = factuurWerkmap(factuur, data.leverancier);
      await shareXlsx(factuurBestandsnaam(factuur.factuurnr), bytes);
      // Pas registreren nadat het bestand er is: mislukt de download, dan staat er geen
      // factuur in het register die nooit verstuurd is.
      await backend.facturatie.factuurBewaren(factuur);
      await opnieuwLaden();
      setKlaar(`${factuur.factuurnr} staat in het register.`);
      setNummer('');
      setLijnen([]);
    } catch (e) {
      setFout(e instanceof Error ? e.message : String(e));
    } finally {
      setBezig(false);
    }
  }

  return (
    <Card>
      <Text style={styles.kop}>{klant.klantnaam}</Text>

      <BronRegel label="Uit de app" uren={urenApp} gekozen={bron === 'app'} onKies={() => void kiesBron('app')} />
      <BronRegel label="Uit de geplakte lijst" uren={urenGeplakt} gekozen={bron === 'geplakt'} onKies={() => void kiesBron('geplakt')} />
      <View style={styles.regel}>
        <Text style={styles.regelLabel}>
          Extra lessen{extraLessen.length > 0 ? ` (${extraLessen.length})` : ''}
        </Text>
        <Text style={styles.regelUren}>{formatEuro(urenPrive)} u</Text>
      </View>

      {extraLessen.length > 0 && (
        <Text style={styles.uitleg}>
          Gaan als tweede tabblad mee in het bestand:{' '}
          {extraLessen.map((l) => l.naam).join(', ')}.
        </Text>
      )}

      <View style={styles.totaalBlok}>
        <Text style={styles.totaalRegel}>
          {formatEuro(uren)} u × € {formatEuro(klant.uurtarief)} = € {formatEuro(urenBedrag)}
        </Text>
        {lijnen.length > 0 && (
          <Text style={styles.totaalRegel}>Vrije lijnen: € {formatEuro(vrijBedrag)}</Text>
        )}
        <Text style={styles.totaalRegel}>
          BTW {formatEuro(klant.btw_percentage)} %: € {formatEuro(btw)}
        </Text>
        <Text style={styles.teBetalen}>Te betalen: € {formatEuro(totaal)}</Text>
      </View>

      {bronnenVerschillen && (
        <Text style={styles.waarschuwing}>
          De app zegt {formatEuro(urenApp)} u, de geplakte lijst {formatEuro(urenGeplakt)} u.
        </Text>
      )}
      {nummerBestaat && nummer.trim() !== '' && (
        <Text style={styles.waarschuwing}>Dit nummer staat al in het register.</Text>
      )}
      {alGefactureerd && (
        <Text style={styles.waarschuwing}>
          Deze club is deze maand al gefactureerd.
        </Text>
      )}
      {datumBuitenMaand && (
        <Text style={styles.waarschuwing}>De factuurdatum valt buiten de dienstmaand.</Text>
      )}
      {uren === 0 && <Text style={styles.waarschuwing}>Er zijn geen uren voor deze maand.</Text>}

      <Veld label="Factuurnummer" waarde={nummer} onChange={setNummer} placeholder="NG-0007" />
      <Veld label="Factuurdatum (dd/mm/jjjj)" waarde={datum} onChange={setDatum} />
      <Text style={styles.uitleg}>
        Vervaldatum: {dag === null ? '—' : formatDayInput(new Date(dag.getTime() + 15 * 86_400_000))}
      </Text>
      <Veld label="Omschrijving" waarde={omschrijving} onChange={setOmschrijving} />

      {lijnen.map((lijn) => (
        <VrijeLijnRegel
          key={lijn.sleutel}
          lijn={lijn}
          onWijzig={(nieuw) => setLijnen(lijnen.map(
            (l) => (l.sleutel === lijn.sleutel ? { ...nieuw, sleutel: l.sleutel } : l),
          ))}
          onWeg={() => setLijnen(lijnen.filter((l) => l.sleutel !== lijn.sleutel))}
        />
      ))}

      <Button
        label="Vrije lijn toevoegen"
        variant="secondary"
        icon={<Plus size={18} color={tennisColors.primary} />}
        onPress={() => setLijnen([...lijnen, {
          sleutel: nieuwId('lijn'), omschrijving: '', aantal: 1, eenheid: 'stuk', tarief: 0,
        }])}
      />

      {/*
        Downloaden kan alleen op het web — `shareXlsx` zegt dat zelf ook. De knop hier laten
        staan en hem daar laten omvallen is wat de andere exportschermen bewust níét doen;
        zie app/admin/export en app/admin/reports.
      */}
      {xlsxWordtOndersteund ? (
        <Button
          label={bezig ? 'Bezig…' : 'Factuur downloaden'}
          onPress={() => void maak()}
          disabled={!mag}
        />
      ) : (
        <Text style={styles.uitleg}>
          Een factuur maken kan alleen op de website, niet op een telefoon.
        </Text>
      )}

      {klaar !== '' && <Text style={styles.klaar}>{klaar}</Text>}
      {fout !== '' && <Text style={styles.fout}>{fout}</Text>}
    </Card>
  );
}

function BronRegel({ label, uren, gekozen, onKies }: {
  label: string;
  uren: number;
  gekozen: boolean;
  onKies: () => void;
}) {
  return (
    <Pressable
      onPress={onKies}
      accessibilityRole="radio"
      accessibilityState={{ selected: gekozen }}
      accessibilityLabel={`${label}: ${formatEuro(uren)} uur`}
      style={[styles.regel, gekozen && styles.regelGekozen, webCursor]}
    >
      <Text style={[styles.regelLabel, gekozen && styles.regelLabelGekozen]}>{label}</Text>
      <Text style={[styles.regelUren, gekozen && styles.regelLabelGekozen]}>{formatEuro(uren)} u</Text>
    </Pressable>
  );
}

function VrijeLijnRegel({ lijn, onWijzig, onWeg }: {
  lijn: VrijeLijn;
  onWijzig: (lijn: VrijeLijn) => void;
  onWeg: () => void;
}) {
  const [aantal, setAantal] = useState(String(lijn.aantal));
  const [tarief, setTarief] = useState(formatEuro(lijn.tarief));

  return (
    <View style={styles.vrijeLijn}>
      <Veld label="Omschrijving" waarde={lijn.omschrijving} onChange={(omschrijving) => onWijzig({ ...lijn, omschrijving })} />
      <Veld label="Eenheid" waarde={lijn.eenheid} onChange={(eenheid) => onWijzig({ ...lijn, eenheid })} />
      <Veld
        label="Aantal"
        waarde={aantal}
        onChange={(tekst) => {
          setAantal(tekst);
          const getal = Number(tekst.replace(',', '.'));
          if (Number.isFinite(getal) && getal >= 0) onWijzig({ ...lijn, aantal: getal });
        }}
      />
      <Veld
        label="Tarief (€)"
        waarde={tarief}
        onChange={(tekst) => {
          setTarief(tekst);
          const bedrag = parseEuro(tekst);
          if (bedrag !== undefined) onWijzig({ ...lijn, tarief: bedrag });
        }}
      />
      <Pressable onPress={onWeg} accessibilityRole="button" accessibilityLabel="Lijn weghalen" style={[styles.knopje, webCursor]}>
        <Trash2 size={18} color={tennisColors.danger} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  blad: { gap: spacing.lg },
  kop: { ...typography.h3, color: tennisColors.text, marginBottom: spacing.sm },
  uitleg: { ...typography.caption, color: tennisColors.textMuted, marginBottom: spacing.sm },
  maanden: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  regel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    minHeight: minTapTarget,
  },
  regelGekozen: { backgroundColor: tennisColors.primaryTint },
  regelLabel: { ...typography.body, color: tennisColors.textMuted },
  regelLabelGekozen: { color: tennisColors.text, fontWeight: '700' },
  regelUren: { ...typography.body, color: tennisColors.textMuted },
  totaalBlok: {
    borderTopWidth: 1,
    borderTopColor: tennisColors.border,
    paddingTop: spacing.sm,
    marginBottom: spacing.sm,
    gap: 2,
  },
  totaalRegel: { ...typography.caption, color: tennisColors.textMuted },
  teBetalen: { ...typography.h3, color: tennisColors.court, marginTop: spacing.xs },
  waarschuwing: { ...typography.caption, color: tennisColors.warning, marginBottom: spacing.sm },
  vrijeLijn: {
    borderWidth: 1,
    borderColor: tennisColors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  knopje: {
    minWidth: minTapTarget,
    minHeight: minTapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  klaar: { ...typography.body, color: tennisColors.success, marginTop: spacing.sm },
  fout: { ...typography.body, color: tennisColors.danger, marginTop: spacing.sm },
});
```

- [ ] **Step 2: Commit**

```bash
git add components/facturatie/FactuurBlad.tsx
git commit -m "feat(facturatie): de factuur maken, met de twee bronnen naast elkaar"
```

---

## Task 13: Blad 3 — Register

**Files:**
- Create: `components/facturatie/RegisterBlad.tsx`

- [ ] **Step 1: Write the component**

Maak `components/facturatie/RegisterBlad.tsx`:

```tsx
// Facturatie, blad 3: de gemaakte facturen.
//
// Dit is het archief uit het tabblad Facturenregister. Wat hier staat zijn de cijfers, niet
// het bestand: een factuur opnieuw downloaden kan niet, je maakt hem opnieuw met hetzelfde
// nummer. Een bestand bewaren zou betekenen dat de app megabytes aan zips draagt voor iets
// wat in twee tikken opnieuw gemaakt is.

import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';

import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { Veld } from './LessenBlad';
import { backend } from '../../providers/backend';
import { MAANDNAMEN, type Factuur, type FacturatieData } from '../../lib/facturatie';
import { formatEuro } from '../../lib/money';
import { formatDayInput, parseDayInput } from '../../lib/period';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography, webCursor, minTapTarget } from '../../constants/theme';

/** `2026-10-16` als dag op de kalender. Niet via `new Date(tekst)`: dat leest UTC. */
function alsDag(iso: string): Date {
  const [j, m, d] = iso.split('-').map(Number);
  return new Date(j, m - 1, d);
}

export function RegisterBlad({ data, opnieuwLaden }: {
  data: FacturatieData;
  opnieuwLaden: () => Promise<void>;
}) {
  const [fout, setFout] = useState('');

  async function doe(actie: () => Promise<void>) {
    setFout('');
    try {
      await actie();
      await opnieuwLaden();
    } catch (e) {
      setFout(e instanceof Error ? e.message : String(e));
    }
  }

  if (data.facturen.length === 0) {
    return (
      <Card>
        <Text style={styles.uitleg}>Er staat nog geen factuur in het register.</Text>
      </Card>
    );
  }

  const openstaand = data.facturen.filter((f) => !f.betaald);
  const openBedrag = openstaand.reduce((som, f) => som + f.totaal, 0);

  return (
    <View style={styles.blad}>
      <Card>
        <Text style={styles.kop}>
          {data.facturen.length} facturen, waarvan {openstaand.length} open
        </Text>
        <Text style={styles.uitleg}>Nog te ontvangen: € {formatEuro(openBedrag)}</Text>
      </Card>

      {data.facturen.map((factuur) => (
        <FactuurRij
          key={factuur.id}
          factuur={factuur}
          onBewaar={(f) => doe(() => backend.facturatie.factuurBewaren(f))}
          onVerwijder={() => doe(() => backend.facturatie.factuurVerwijderen(factuur.id))}
        />
      ))}

      {fout !== '' && <Text style={styles.fout}>{fout}</Text>}
    </View>
  );
}

function FactuurRij({ factuur, onBewaar, onVerwijder }: {
  factuur: Factuur;
  onBewaar: (f: Factuur) => Promise<void>;
  onVerwijder: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [bevestig, setBevestig] = useState(false);
  const [betaaldOp, setBetaaldOp] = useState(
    // Niet `new Date('2026-10-16')`: dat leest UTC, en op een toestel westelijk van Greenwich
    // staat er dan 15 oktober in het veld.
    factuur.betaald_op === null ? '' : formatDayInput(alsDag(factuur.betaald_op)),
  );
  const [opmerking, setOpmerking] = useState(factuur.opmerking);

  function zetBetaald(betaald: boolean) {
    void onBewaar({
      ...factuur,
      betaald,
      // Afvinken zet de dag van vandaag; afzetten haalt hem weg. Een betaaldatum zonder
      // betaling is een gegeven dat niemand meer vertrouwt.
      betaald_op: betaald ? new Date().toISOString().slice(0, 10) : null,
    });
  }

  function bewaarDetails() {
    const dag = parseDayInput(betaaldOp);
    void onBewaar({
      ...factuur,
      opmerking,
      betaald_op: dag === null
        ? null
        : `${dag.getFullYear()}-${String(dag.getMonth() + 1).padStart(2, '0')}-${String(dag.getDate()).padStart(2, '0')}`,
    });
  }

  // De kaart zelf is niet aanklikbaar: er staan knoppen en invulvelden in, en een tik daarop
  // zou de kaart er meteen weer bij dichtklappen. Uitklappen gebeurt met de pijl.
  return (
    <Card>
      <View style={styles.rij}>
        <Pressable
          onPress={() => setOpen(!open)}
          accessibilityRole="button"
          accessibilityLabel={`Factuur ${factuur.factuurnr}`}
          accessibilityState={{ expanded: open }}
          style={[styles.rijTekst, webCursor]}
        >
          <Text style={styles.rijKop}>{factuur.factuurnr} · {factuur.klant_naam}</Text>
          <Text style={styles.rijSub}>
            {MAANDNAMEN[factuur.dienstmaand - 1]} {factuur.dienstjaar} ·{' '}
            {formatEuro(factuur.aantal_uren)} u · € {formatEuro(factuur.totaal)}
          </Text>
        </Pressable>
        <Chip
          label={factuur.betaald ? 'Betaald' : 'Open'}
          selected={factuur.betaald}
          onPress={() => zetBetaald(!factuur.betaald)}
        />
        <Pressable
          onPress={() => setOpen(!open)}
          accessibilityRole="button"
          accessibilityLabel={open ? 'Dichtklappen' : 'Openklappen'}
          style={[styles.pijl, webCursor]}
        >
          {open
            ? <ChevronUp size={18} color={tennisColors.textMuted} />
            : <ChevronDown size={18} color={tennisColors.textMuted} />}
        </Pressable>
      </View>

      {open && (
        <View style={styles.details}>
          <Text style={styles.rijSub}>Factuurdatum {factuur.factuurdatum}</Text>
          <Text style={styles.rijSub}>Vervaldatum {factuur.vervaldatum}</Text>
          <Text style={styles.rijSub}>{factuur.omschrijving}</Text>
          <Text style={styles.rijSub}>
            Netto € {formatEuro(factuur.netto)} · BTW € {formatEuro(factuur.btw_bedrag)}
          </Text>

          <Veld label="Betaald op (dd/mm/jjjj)" waarde={betaaldOp} onChange={setBetaaldOp} />
          <Veld label="Opmerking" waarde={opmerking} onChange={setOpmerking} />
          <Button label="Bewaren" onPress={bewaarDetails} />

          {bevestig ? (
            <View style={styles.knoppen}>
              <Button label="Ja, uit het register halen" variant="danger" onPress={() => void onVerwijder()} fullWidth={false} />
              <Button label="Nee" variant="secondary" onPress={() => setBevestig(false)} fullWidth={false} />
            </View>
          ) : (
            <Button label="Uit het register halen" variant="secondary" onPress={() => setBevestig(true)} />
          )}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  blad: { gap: spacing.md },
  kop: { ...typography.h3, color: tennisColors.text },
  uitleg: { ...typography.caption, color: tennisColors.textMuted },
  rij: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rijTekst: { flex: 1, paddingVertical: spacing.xs },
  pijl: {
    minWidth: minTapTarget,
    minHeight: minTapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rijKop: { ...typography.label, color: tennisColors.text },
  rijSub: { ...typography.caption, color: tennisColors.textMuted },
  details: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: tennisColors.border,
    gap: spacing.xs,
  },
  knoppen: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  fout: { ...typography.body, color: tennisColors.danger },
});
```

- [ ] **Step 2: Check types — now everything must compile**

Run: `npx tsc --noEmit`
Expected: geen uitvoer. Zijn er nog fouten over de vier bladen, dan ontbreekt er een export; kijk of `Veld` uit `LessenBlad.tsx` geëxporteerd is.

- [ ] **Step 3: Commit**

```bash
git add components/facturatie/RegisterBlad.tsx
git commit -m "feat(facturatie): het register van gemaakte facturen"
```

---

## Task 14: Oplevering

**Files:**
- Modify: `OPENSTAAND.md`

- [ ] **Step 1: Run the whole suite**

Run: `npx tsc --noEmit && npm test`
Expected: geen typefouten; alle tests groen, met ongeveer 75 tests meer dan de 1935 van ervoor.

- [ ] **Step 2: Build for the web**

Run: `npx expo export -p web`
Expected: de bouw slaagt. Mislukt hij op een import die alleen op een telefoon bestaat, kijk dan naar `lib/share.ts` — `shareXlsx` werkt bewust alleen op web en gooit elders een leesbare fout.

- [ ] **Step 3: Try it by hand**

Start de app (`npm run web`), log in als `leemanskoen@telenet.be` en loop dit af:

1. **Beheer → Facturatie** staat er; met een ander account staat de tegel er niet.
2. **Instellingen**: Sport4fun staat ingevuld, en de twee clubs ook. Gantoise staat op de bron "de app", Racso op "de geplakte lijst".
3. **Lessen**: plak de lijst uit `lib/__fixtures__/facturatie-plaktekst.txt`. Verwacht: *69 nieuw, 0 waren al gekend, 0 overgeslagen.* Plak hem nog eens: *0 nieuw, 69 waren al gekend.*
4. **Factuur maken**, september 2026: Gantoise toont 35,00 u uit de geplakte lijst. Staat de app op een ander getal, dan zegt de kaart dat erbij — dat is de bedoeling, niet een fout.
5. Oktober 2026: Racso toont 9,00 u, Gantoise 25,00 u.
6. Typ een nummer, download de factuur, open hem in Excel: de indeling hoort op `facturen.xlsx` te lijken, bedragen zijn getallen en datums zijn datums.
7. **Extra lessen**: zet op het Lessen-blad met de knop *Stan 09:00-10:00* twee lessen in
   september en met *Veerle 10:00-11:00* één. De factuurkaart van Racso hoort dan
   *Extra lessen (3)* te tonen en 3,00 u, en de namen eronder. Download de factuur en kijk
   op **tabblad 2**: de drie lessen op datum, met een totaalrij van 3,00. Maak daarna een
   factuur voor Gantoise: tabblad 2 hoort er ook te zijn, met "Geen extra lessen in deze
   maand."
8. **Register**: de factuur staat er. Vink hem betaald en terug.
9. Maak een tweede factuur met hetzelfde nummer: er hoort een waarschuwing te staan en de knop blijft werken.

- [ ] **Step 4: Update OPENSTAAND.md**

Zet onder "Waar staat het nu" een kopje erbij:

```markdown
### Facturatie — Koen factureert vanuit de app

`facturen.xlsx` is vervangen door **Beheer → Facturatie**, zichtbaar voor één e-mailadres
(`leemanskoen@telenet.be`). Het ontwerp staat in
`docs/superpowers/specs/2026-10-04-facturatie-design.md`, het plan in
`docs/superpowers/plans/2026-10-04-facturatie.md`.

Vier bladen: de lessen plakken en aanvullen, de factuur maken, het register, en de
instellingen (mijn gegevens en de twee clubs). De uitvoer is een `.xlsx` die het oude
factuurblad nabootst, zonder formules.

**`FACTURATIE.sql` moet gedraaid zijn** op de databank van de club. Vier tabellen met RLS op
`auth.uid()`: niemand anders ziet deze gegevens, ook de beheerder niet.

Twee dingen om te onthouden:

- **Er zijn twee bronnen van uren** en per club staat welke telt. Gantoise staat op "de app"
  (zijn lessen staan er toch al in), Racso op "de geplakte lijst". Optellen kan niet; de
  kaart zet de twee naast elkaar zodat een verschil opvalt.
- **Racso krijgt een overzicht van de extra lessen** als tweede tabblad in hetzelfde
  bestand. Dat tabblad is er altijd, ook leeg. De twee vaste extra lessen (Stan 9-10u en
  Veerle 10-11u, allebei sponsor) staan als snelknoppen in `SNELLE_EXTRA_LESSEN` bovenaan
  `components/facturatie/LessenBlad.tsx`; daar kan een regel bij.
- **De clubnaam in de plaktekst is een eigen veld.** `T.C. RACSO` is niet `RACSO`. In
  `facturen.xlsx` stond het verkeerd en telde die werkmap Racso op nul uur.

`facturen.xlsx` blijft voorlopig op de schijf staan als naslag. Hij wordt niet meer
bijgewerkt.
```

- [ ] **Step 5: Commit**

```bash
git add OPENSTAAND.md
git commit -m "docs(openstaand): de facturatie staat in de app"
```

- [ ] **Step 6: Ask before pushing**

Vraag de gebruiker of dit naar `main` mag. Elke push naar `main` bouwt en zet de site online.
