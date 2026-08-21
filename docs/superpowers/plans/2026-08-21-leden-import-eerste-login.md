# Leden importeren uit Excel, en de eerste keer inloggen — implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Een trainer importeert leerlingen en trainers uit een CSV-bestand, en wie zo geïmporteerd is stelt bij zijn eerste bezoek zelf een wachtwoord in.

**Architecture:** Alle regelgeving zit in pure functies in `lib/` (lezen, plannen, controleren) en is daar getest; de schermen doen niets anders dan die functies aanroepen en het resultaat tonen. Er verandert **niets** aan `supabase-schema.sql`: de bestaande trigger `link_auth_user` koppelt een nieuwe login al op e-mailadres aan een bestaande rij in `users`.

**Tech Stack:** Expo (React Native + react-native-web), TypeScript, expo-router, Supabase, Jest (`jest-expo`).

**Spec:** `docs/superpowers/specs/2026-08-21-leden-import-eerste-login-design.md`

---

## Wat je moet weten over dit project

- **Nederlands** in de UI en in commentaar. Commentaar legt het *waarom* uit, niet het *wat*.
- **Vertalen**: de sleutel van een vertaling is de Nederlandse zin zelf. In een scherm staat `t('Leden importeren')`; de Engelse kant komt in `lib/i18n-en.ts`. Staat een zin daar niet, dan blijft het Nederlands staan — een zichtbaar gat, geen stille fout.
- **Alle tests staan in `lib/`**, naast het bestand dat ze toetsen (`lib/students.ts` → `lib/students.test.ts`). Schermen worden met de hand nagelopen op web.
- **Testen draaien**: `npm test` voor alles, `npx jest lib/csv.test.ts` voor één bestand.
- **De app werkt met én zonder Supabase.** Zonder sleutels in `.env` staat alles in de lokale opslag en kies je een profiel; mét sleutels is er een echte login. `providers/backend.ts` maakt die keuze op één plek. Alles in dit plan werkt in beide standen, behalve het wachtwoordscherm — dat hoort bij de Supabase-stand en is er in de profielstand niet.
- **⚠️ De dev-server praat met de échte Supabase van de club.** Testen op localhost wijzigt productiedata. Doe de handmatige controles met verzonnen e-mailadressen die je daarna weer weghaalt, of haal de sleutels tijdelijk uit `.env` zodat je op de lokale opslag draait.

## Bestandsindeling

| Bestand | Verantwoordelijkheid |
| --- | --- |
| `lib/csv.ts` (wijzigen) | Krijgt er een **lezer** bij (`parseCsv`). Wist tot nu toe alleen hoe je CSV schríjft. Weet niets van leden. |
| `lib/import-leden.ts` (nieuw) | Rijen tekst + huidige ledenlijst → een plan (`nieuw`, `bijgewerkt`, `fouten`). Alle regelgeving van de import. Geen databank, geen scherm. |
| `lib/import-leden.test.ts` (nieuw) | Tests daarvan. |
| `lib/bestand.ts` (nieuw) | Eén platformafhankelijk stukje: een tekstbestand van de gebruiker inlezen. De tegenhanger van `lib/share.ts`, dat een bestand wégschrijft. |
| `lib/wachtwoord.ts` (nieuw) | De controles van het wachtwoordscherm, los van het scherm zodat ze te testen zijn. |
| `lib/wachtwoord.test.ts` (nieuw) | Tests daarvan. |
| `app/admin/leden-import.tsx` (nieuw) | Het scherm: bestand kiezen of plakken → plan tonen → importeren. |
| `app/admin/index.tsx` (wijzigen) | Eén tegel erbij onder "Club". |
| `app/login.tsx` (wijzigen) | Een derde stand: "Eerste keer hier? Stel je wachtwoord in." |
| `providers/supabaseStore.ts` (wijzigen) | `signUp` stuurt geen lége naam mee als metadata. |
| `lib/i18n-en.ts` (wijzigen) | De Engelse kant van de nieuwe zinnen. |
| `README.md` (wijzigen) | Eén alinea: zet *Confirm email* aan in Supabase. |

---

### Task 1: Een CSV lezen

`lib/csv.ts` kan een boekingenoverzicht schrijven maar niets teruglezen. Hier komt de lezer bij. Drie dingen die Excel doet en waar een naïeve `split(',')` op stukloopt: Nederlandse Excel scheidt met een **puntkomma**, het zet een **BOM** vooraan, en een cel met een scheidingsteken erin staat tussen **aanhalingstekens**. Kopiëren-en-plakken uit Excel geeft bovendien **tabs**.

**Files:**
- Modify: `lib/csv.ts` (onderaan toevoegen)
- Test: `lib/csv.test.ts` (onderaan toevoegen)

- [ ] **Step 1: Schrijf de falende tests**

Voeg onderaan `lib/csv.test.ts` toe (en zet `parseCsv` bij de import bovenaan dat bestand):

```ts
describe('parseCsv', () => {
  it('leest de puntkomma van Nederlandse Excel', () => {
    expect(parseCsv('naam;email\nJonas;jonas@club.be')).toEqual([
      ['naam', 'email'],
      ['Jonas', 'jonas@club.be'],
    ]);
  });

  it('leest ook een komma als dat het scheidingsteken is', () => {
    expect(parseCsv('naam,email\nJonas,jonas@club.be')).toEqual([
      ['naam', 'email'],
      ['Jonas', 'jonas@club.be'],
    ]);
  });

  it('leest een tab, want zo plakt Excel', () => {
    expect(parseCsv('naam\temail\nJonas\tjonas@club.be')).toEqual([
      ['naam', 'email'],
      ['Jonas', 'jonas@club.be'],
    ]);
  });

  it('haalt de BOM weg die Excel vooraan zet', () => {
    expect(parseCsv(`${'\uFEFF'}naam;email`)).toEqual([['naam', 'email']]);
  });

  it('houdt een scheidingsteken binnen aanhalingstekens bij elkaar', () => {
    expect(parseCsv('naam;bio\n"De Vries; Jan";"hij zei ""hallo"""')).toEqual([
      ['naam', 'bio'],
      ['De Vries; Jan', 'hij zei "hallo"'],
    ]);
  });

  it('leest regeleindes in Windows-stijl', () => {
    expect(parseCsv('a;b\r\nc;d')).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it('laat lege regels weg, ook de lege regel onderaan het bestand', () => {
    expect(parseCsv('a;b\n\nc;d\n')).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it('houdt lege cellen staan, want die dragen betekenis', () => {
    expect(parseCsv('a;;c')).toEqual([['a', '', 'c']]);
  });

  it('geeft niets terug bij een leeg bestand', () => {
    expect(parseCsv('')).toEqual([]);
    expect(parseCsv('   \n  ')).toEqual([]);
  });
});
```

- [ ] **Step 2: Draai de tests en zie ze falen**

Run: `npx jest lib/csv.test.ts -t parseCsv`
Expected: FAIL — `parseCsv is not a function` / TypeScript klaagt over de import.

- [ ] **Step 3: Schrijf de lezer**

Onderaan `lib/csv.ts`:

```ts
// ---------------------------------------------------------------------------
// Een CSV lezen
//
// De schrijfkant hierboven bepaalt zelf hoe zijn bestand eruitziet; de leeskant krijgt wat
// een trainer aanlevert en moet dus raden. Drie dingen doet Excel die een `split(';')`
// meteen laten omvallen: Nederlandse Excel scheidt met een puntkomma en Engelse met een
// komma, het zet een BOM vooraan, en een cel met een scheidingsteken erin komt tussen
// aanhalingstekens te staan. Kopiëren-en-plakken uit een blad geeft nog een vierde vorm:
// tabs. Alle vier worden ze hier herkend.
// ---------------------------------------------------------------------------

type Scheidingsteken = ';' | ',' | '\t';

/**
 * Welk scheidingsteken gebruikt dit bestand? Bepaald op de kopregel: die heeft van elke
 * kolom er precies één, dus het teken dat daar het vaakst staat is het scheidingsteken.
 * Wat tussen aanhalingstekens staat telt niet mee — een naam als "De Vries, Jan" hoort de
 * telling niet te kunnen kantelen.
 */
function scheidingstekenVan(text: string): Scheidingsteken {
  const eerste = text.split(/\r?\n/, 1)[0] ?? '';
  const tellingen: Record<Scheidingsteken, number> = { ';': 0, ',': 0, '\t': 0 };
  let inAanhaling = false;
  for (const teken of eerste) {
    if (teken === '"') {
      inAanhaling = !inAanhaling;
    } else if (!inAanhaling && (teken === ';' || teken === ',' || teken === '\t')) {
      tellingen[teken]++;
    }
  }
  // Gelijkspel (of niets gevonden) gaat naar de puntkomma: dat is wat de club aanlevert.
  if (tellingen['\t'] > tellingen[';'] && tellingen['\t'] > tellingen[',']) return '\t';
  if (tellingen[','] > tellingen[';']) return ',';
  return ';';
}

/**
 * Een CSV-tekst als rijen cellen. Lege regels vallen weg — een lege cel niet, want die
 * betekent "hier staat niets ingevuld" en dat is iets anders dan een kolom die er niet is.
 */
export function parseCsv(text: string): string[][] {
  // De BOM als escape geschreven, net als in lib/share.ts: zo blijft het in elke
  // editor één zichtbaar teken in plaats van een onzichtbaar teken in een regex.
  const schoon = text.replace(/^\uFEFF/, '');
  const scheiding = scheidingstekenVan(schoon);
  const rijen: string[][] = [];
  let rij: string[] = [];
  let cel = '';
  let inAanhaling = false;

  for (let i = 0; i < schoon.length; i++) {
    const teken = schoon[i];
    if (inAanhaling) {
      if (teken !== '"') {
        cel += teken;
      } else if (schoon[i + 1] === '"') {
        // Twee aanhalingstekens op rij zijn er samen één, letterlijk in de cel.
        cel += '"';
        i++;
      } else {
        inAanhaling = false;
      }
      continue;
    }
    if (teken === '"') { inAanhaling = true; continue; }
    if (teken === scheiding) { rij.push(cel); cel = ''; continue; }
    if (teken === '\r') continue;
    if (teken === '\n') { rij.push(cel); rijen.push(rij); rij = []; cel = ''; continue; }
    cel += teken;
  }
  rij.push(cel);
  rijen.push(rij);

  return rijen
    .map((r) => r.map((c) => c.trim()))
    .filter((r) => r.some((c) => c.length > 0));
}
```

- [ ] **Step 4: Draai de tests en zie ze slagen**

Run: `npx jest lib/csv.test.ts`
Expected: PASS — de nieuwe tests én de bestaande van dit bestand.

- [ ] **Step 5: Commit**

```bash
git add lib/csv.ts lib/csv.test.ts
git commit -m "feat(csv): een CSV lezen, met puntkomma, tab, BOM en aanhalingstekens"
```

---

### Task 2: De kolommen en de rollen lezen

De vertaalslag van "wat er in het bestand staat" naar "wat de app kent". De rolnamen zijn in het bestand Nederlands en in de databank Engels; die vertaling staat hier op één plek, want een trainer hoort niet te weten dat zijn rol intern `coach` heet.

**Files:**
- Create: `lib/import-leden.ts`
- Test: `lib/import-leden.test.ts`

- [ ] **Step 1: Schrijf de falende tests**

`lib/import-leden.test.ts`:

```ts
import { leesRol, leesUurtarief, kolomIndexen, LEDEN_KOPPEN } from './import-leden';

describe('leesRol', () => {
  it('vertaalt de Nederlandse rolnamen naar wat de databank kent', () => {
    expect(leesRol('speler')).toBe('player');
    expect(leesRol('trainer')).toBe('coach');
    expect(leesRol('ouder')).toBe('parent');
  });

  it('trekt zich niets aan van hoofdletters en spaties', () => {
    expect(leesRol('  Trainer ')).toBe('coach');
  });

  it('neemt de Engelse namen ook aan, want zo staat het in een export', () => {
    expect(leesRol('coach')).toBe('coach');
  });

  it('maakt van een lege cel een speler — dat is verreweg het vaakst waar', () => {
    expect(leesRol('')).toBe('player');
    expect(leesRol('   ')).toBe('player');
  });

  it('weigert een rol die niet bestaat, in plaats van er speler van te maken', () => {
    expect(leesRol('hoofdtrainer')).toBeNull();
  });
});

describe('leesUurtarief', () => {
  it('leest een bedrag met een komma, want zo schrijft Excel het hier', () => {
    expect(leesUurtarief('45,50')).toBe(45.5);
  });

  it('leest een bedrag met een punt ook', () => {
    expect(leesUurtarief('45.50')).toBe(45.5);
  });

  it('laat een euroteken en spaties weg', () => {
    expect(leesUurtarief(' € 45 ')).toBe(45);
  });

  it('geeft undefined bij een lege cel — geen tarief is iets anders dan nul', () => {
    expect(leesUurtarief('')).toBeUndefined();
  });

  it('weigert wat geen getal is', () => {
    expect(leesUurtarief('veel')).toBeNull();
  });
});

describe('kolomIndexen', () => {
  it('vindt de kolommen ongeacht volgorde en hoofdletters', () => {
    expect(kolomIndexen(['Email', 'NAAM'])).toEqual({ naam: 1, email: 0 });
  });

  it('neemt de gangbare andere schrijfwijzen aan', () => {
    expect(kolomIndexen(['naam', 'e-mail', 'gsm'])).toEqual({ naam: 0, email: 1, telefoon: 2 });
  });

  it('geeft null als een verplichte kolom ontbreekt', () => {
    expect(kolomIndexen(['naam', 'telefoon'])).toBeNull();
    expect(kolomIndexen(['email'])).toBeNull();
  });

  it('kent de koppen van het voorbeeldbestand allemaal', () => {
    expect(kolomIndexen([...LEDEN_KOPPEN])).toEqual({
      naam: 0, email: 1, rol: 2, telefoon: 3, uurtarief: 4,
    });
  });
});
```

- [ ] **Step 2: Draai de tests en zie ze falen**

Run: `npx jest lib/import-leden.test.ts`
Expected: FAIL — `Cannot find module './import-leden'`.

- [ ] **Step 3: Schrijf het bestand**

`lib/import-leden.ts`:

```ts
// Een ledenlijst uit Excel omzetten naar leden van de club.
//
// Wat hier staat is alle regelgeving van de import en niets anders: geen databank, geen
// scherm, geen bestand. Het scherm geeft rijen tekst en de huidige ledenlijst, en krijgt
// een plan terug van wat er zou gebeuren. Dat is waarom de trainer het resultaat kan zien
// vóór er iets weggeschreven wordt — en waarom die belofte hier te testen valt.

import { isValidEmail, normalizePhone } from './contact';
import type { Role, User } from './types';

/** De koppen van het voorbeeldbestand, in de volgorde waarin ze daar staan. */
export const LEDEN_KOPPEN = ['naam', 'email', 'rol', 'telefoon', 'uurtarief'] as const;

/**
 * De rolnamen zoals een trainer ze schrijft. Engels staat erbij omdat een export uit deze
 * app of uit een ander systeem ze zo kan opleveren; dat is geen reden om af te keuren.
 */
const ROLNAMEN: Record<string, Role> = {
  speler: 'player',
  player: 'player',
  leerling: 'player',
  trainer: 'coach',
  coach: 'coach',
  ouder: 'parent',
  parent: 'parent',
};

/**
 * De rol uit één cel. Leeg is een speler — dat is verreweg het vaakst waar, en een club die
 * alleen leerlingen invoert hoeft dan geen kolom `rol` te hebben. Onbekend is `null` en
 * geen speler: stil van "hoofdtrainer" een speler maken is precies het soort fout dat pas
 * opvalt als die persoon zijn agenda niet ziet.
 */
export function leesRol(waarde: string): Role | null {
  const schoon = waarde.trim().toLowerCase();
  if (!schoon) return 'player';
  return ROLNAMEN[schoon] ?? null;
}

/**
 * Een uurtarief uit één cel. Leeg levert `undefined` — geen tarief is iets anders dan een
 * tarief van nul, en dat verschil is elders in de app zichtbaar (een trainer zonder tarief
 * krijgt een waarschuwing, een trainer met €0 niet). Onleesbaar levert `null`.
 */
export function leesUurtarief(waarde: string): number | undefined | null {
  const schoon = waarde.replace(/[€\s]/g, '').replace(',', '.');
  if (!schoon) return undefined;
  const getal = Number(schoon);
  return Number.isFinite(getal) ? getal : null;
}

/** Waar staat welke kolom? De index per veld; ontbrekende optionele kolommen staan er niet in. */
export interface Kolommen {
  naam: number;
  email: number;
  rol?: number;
  telefoon?: number;
  uurtarief?: number;
}

/**
 * Andere schrijfwijzen die we aannemen. De kop wordt eerst klein gemaakt en van spaties
 * ontdaan, dus hier staan alleen de echt andere woorden.
 */
const KOPNAMEN: Record<string, keyof Kolommen> = {
  naam: 'naam',
  name: 'naam',
  email: 'email',
  'e-mail': 'email',
  mail: 'email',
  rol: 'rol',
  role: 'rol',
  telefoon: 'telefoon',
  telefoonnummer: 'telefoon',
  gsm: 'telefoon',
  phone: 'telefoon',
  uurtarief: 'uurtarief',
  tarief: 'uurtarief',
};

/**
 * De kopregel lezen. `null` betekent: hier ontbreekt een kolom die we niet kunnen missen.
 * Naam en e-mailadres zijn verplicht — zonder adres valt een lid later nooit aan zijn login
 * te koppelen, en dan is de import zinloos werk geweest.
 */
export function kolomIndexen(kopregel: readonly string[]): Kolommen | null {
  const gevonden: Partial<Record<keyof Kolommen, number>> = {};
  kopregel.forEach((kop, i) => {
    const veld = KOPNAMEN[kop.trim().toLowerCase()];
    // De eerste kolom met deze naam wint; een tweede is een vergissing en geen overschrijving.
    if (veld && gevonden[veld] === undefined) gevonden[veld] = i;
  });
  if (gevonden.naam === undefined || gevonden.email === undefined) return null;
  return { ...gevonden, naam: gevonden.naam, email: gevonden.email };
}
```

- [ ] **Step 4: Draai de tests en zie ze slagen**

Run: `npx jest lib/import-leden.test.ts`
Expected: PASS — alle tests van `leesRol`, `leesUurtarief` en `kolomIndexen`.

- [ ] **Step 5: Commit**

```bash
git add lib/import-leden.ts lib/import-leden.test.ts
git commit -m "feat(import): kolommen, rollen en tarieven uit een ledenbestand lezen"
```

---

### Task 3: Het plan — nieuw, bijgewerkt, fout

Het hart van de import. Eén regel om vooraf te kennen: **de rol van een bestaand lid verandert de import nooit.** `updateUser` in de provider sluit `role` met zoveel woorden uit van zijn type, en dat is met opzet — trainer word je in Beheer, bewust. Zegt het bestand iets anders dan de club, dan wordt die regel afgekeurd mét reden in plaats van half doorgevoerd.

**Files:**
- Modify: `lib/import-leden.ts`
- Test: `lib/import-leden.test.ts`

- [ ] **Step 1: Schrijf de falende tests**

Voeg onderaan `lib/import-leden.test.ts` toe (en breid de import bovenin uit met `planImport`, plus `import type { User } from './types';`):

```ts
const lid = (id: string, email: string, extra: Partial<User> = {}): User => ({
  id, name: 'Bestaand', email, role: 'player', ...extra,
});

const kop = ['naam', 'email', 'rol', 'telefoon', 'uurtarief'];

describe('planImport', () => {
  it('zet een onbekend adres bij de nieuwe leden', () => {
    const plan = planImport([kop, ['Jonas Peeters', 'jonas@club.be', 'speler', '0470123456', '']], []);
    expect(plan.fouten).toEqual([]);
    expect(plan.bijgewerkt).toEqual([]);
    expect(plan.nieuw).toEqual([
      { name: 'Jonas Peeters', email: 'jonas@club.be', role: 'player', phone: '0470123456' },
    ]);
  });

  it('neemt het uurtarief mee bij een trainer', () => {
    const plan = planImport([kop, ['Sofie Maes', 'sofie@club.be', 'trainer', '', '45']], []);
    expect(plan.nieuw[0]).toEqual({
      name: 'Sofie Maes', email: 'sofie@club.be', role: 'coach', hourly_rate: 45,
    });
  });

  it('herkent een bestaand lid op adres, ongeacht hoofdletters', () => {
    const bestaande = [lid('u1', 'jonas@club.be')];
    const plan = planImport([kop, ['Jonas Peeters', 'JONAS@club.be', 'speler', '0470', '']], bestaande);
    expect(plan.nieuw).toEqual([]);
    expect(plan.bijgewerkt).toEqual([
      { bestaand: bestaande[0], wijzigingen: { name: 'Jonas Peeters', phone: '0470' } },
    ]);
  });

  it('laat een bestaand lid dat niets nieuws meebrengt helemaal met rust', () => {
    const bestaande = [lid('u1', 'jonas@club.be', { name: 'Jonas', phone: '0470' })];
    const plan = planImport([kop, ['Jonas', 'jonas@club.be', 'speler', '0470', '']], bestaande);
    expect(plan.bijgewerkt).toEqual([]);
    expect(plan.nieuw).toEqual([]);
    expect(plan.fouten).toEqual([]);
  });

  it('overschrijft een ingevuld veld niet met een lege cel', () => {
    const bestaande = [lid('u1', 'jonas@club.be', { name: 'Jonas', phone: '0470' })];
    const plan = planImport([kop, ['Jonas', 'jonas@club.be', '', '', '']], bestaande);
    expect(plan.bijgewerkt).toEqual([]);
  });

  it('weigert een regel waarvan de rol niet klopt met wat de club al weet', () => {
    const bestaande = [lid('u1', 'jonas@club.be')];
    const plan = planImport([kop, ['Jonas', 'jonas@club.be', 'trainer', '', '']], bestaande);
    expect(plan.bijgewerkt).toEqual([]);
    expect(plan.fouten).toEqual([
      { regel: 2, reden: 'Staat al in de club met een andere rol; dat wijzig je in Beheer.' },
    ]);
  });

  it('weigert een regel zonder naam of met een adres dat er geen is', () => {
    const plan = planImport([
      kop,
      ['', 'leeg@club.be', '', '', ''],
      ['Zonder adres', '', '', '', ''],
      ['Krom adres', 'jonas apenstaartje club', '', '', ''],
    ], []);
    expect(plan.nieuw).toEqual([]);
    expect(plan.fouten).toEqual([
      { regel: 2, reden: 'Geen naam ingevuld.' },
      { regel: 3, reden: 'Geen e-mailadres ingevuld.' },
      { regel: 4, reden: 'Dit is geen geldig e-mailadres.' },
    ]);
  });

  it('weigert een onbekende rol en een onleesbaar tarief, met de regel erbij', () => {
    const plan = planImport([
      kop,
      ['Jonas', 'jonas@club.be', 'hoofdtrainer', '', ''],
      ['Sofie', 'sofie@club.be', 'trainer', '', 'veel'],
    ], []);
    expect(plan.nieuw).toEqual([]);
    expect(plan.fouten).toEqual([
      { regel: 2, reden: 'Onbekende rol "hoofdtrainer". Kies speler, trainer of ouder.' },
      { regel: 3, reden: 'Het uurtarief "veel" is geen bedrag.' },
    ]);
  });

  it('houdt het tweede voorkomen van hetzelfde adres tegen', () => {
    const plan = planImport([
      kop,
      ['Jonas', 'jonas@club.be', '', '', ''],
      ['Jonas P', 'JONAS@club.be', '', '', ''],
    ], []);
    expect(plan.nieuw).toHaveLength(1);
    expect(plan.fouten).toEqual([
      { regel: 3, reden: 'Dit adres staat eerder in het bestand, op regel 2.' },
    ]);
  });

  it('houdt de goede regels over als er een foute tussen zit', () => {
    const plan = planImport([
      kop,
      ['Jonas', 'jonas@club.be', '', '', ''],
      ['', '', '', '', ''],
      ['Sofie', 'sofie@club.be', '', '', ''],
    ], []);
    expect(plan.nieuw).toHaveLength(2);
    expect(plan.fouten).toHaveLength(1);
  });

  it('zegt het als de kopregel een verplichte kolom mist', () => {
    const plan = planImport([['naam', 'telefoon'], ['Jonas', '0470']], []);
    expect(plan.nieuw).toEqual([]);
    expect(plan.fouten).toEqual([
      { regel: 1, reden: 'De kopregel mist de kolom "naam" of "email".' },
    ]);
  });

  it('zegt het als het bestand leeg is', () => {
    expect(planImport([], []).fouten).toEqual([
      { regel: 1, reden: 'Dit bestand is leeg.' },
    ]);
  });
});
```

- [ ] **Step 2: Draai de tests en zie ze falen**

Run: `npx jest lib/import-leden.test.ts -t planImport`
Expected: FAIL — `planImport is not a function`.

- [ ] **Step 3: Schrijf `planImport`**

Onderaan `lib/import-leden.ts`:

```ts
// ---------------------------------------------------------------------------
// Het plan
// ---------------------------------------------------------------------------

/** Eén regel die niet verwerkt wordt, met de reden in gewone taal. */
export interface ImportFout {
  /** Het regelnummer zoals de trainer het in Excel ziet: de kopregel is regel 1. */
  regel: number;
  reden: string;
}

/** Eén bestaand lid, en wat dit bestand aan hem verandert. */
export interface ImportBijwerking {
  bestaand: User;
  wijzigingen: Partial<Omit<User, 'id' | 'role'>>;
}

export interface ImportPlan {
  nieuw: Omit<User, 'id'>[];
  bijgewerkt: ImportBijwerking[];
  fouten: ImportFout[];
}

/** Adressen vergelijken zoals de databank het doet: hoofdletterongevoelig. */
function sleutel(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Wat verandert dit bestand aan een bestaand lid?
 *
 * Alleen velden die in het bestand ingevuld zijn én iets anders zeggen dan wat er staat.
 * Een lege cel betekent "hier weet ik niets van" en nooit "maak dit leeg" — anders wist een
 * bestand met alleen namen erin alle telefoonnummers van de club.
 */
function verschillen(bestaand: User, regel: Omit<User, 'id'>): Partial<Omit<User, 'id' | 'role'>> {
  const wijzigingen: Partial<Omit<User, 'id' | 'role'>> = {};
  if (regel.name && regel.name !== bestaand.name) wijzigingen.name = regel.name;
  if (regel.phone && regel.phone !== bestaand.phone) wijzigingen.phone = regel.phone;
  if (regel.hourly_rate !== undefined && regel.hourly_rate !== bestaand.hourly_rate) {
    wijzigingen.hourly_rate = regel.hourly_rate;
  }
  return wijzigingen;
}

/**
 * Wat zou dit bestand doen met de club? Schrijft niets weg — dat is het hele punt: het
 * scherm toont dit plan eerst, en pas als de trainer het herkent gebeurt er iets.
 */
export function planImport(
  rijen: ReadonlyArray<readonly string[]>,
  bestaande: readonly User[],
): ImportPlan {
  const plan: ImportPlan = { nieuw: [], bijgewerkt: [], fouten: [] };
  if (rijen.length === 0) {
    plan.fouten.push({ regel: 1, reden: 'Dit bestand is leeg.' });
    return plan;
  }

  const kolommen = kolomIndexen(rijen[0]);
  if (!kolommen) {
    plan.fouten.push({ regel: 1, reden: 'De kopregel mist de kolom "naam" of "email".' });
    return plan;
  }

  const bekend = new Map(bestaande.map((u) => [sleutel(u.email), u]));
  // Waar in het bestand we een adres eerder zagen — voor de melding "staat al op regel 2".
  const gezien = new Map<string, number>();

  for (let i = 1; i < rijen.length; i++) {
    const rij = rijen[i];
    const regel = i + 1;
    const cel = (index: number | undefined): string =>
      index === undefined ? '' : (rij[index] ?? '').trim();

    const naam = cel(kolommen.naam);
    const email = cel(kolommen.email);
    if (!naam) { plan.fouten.push({ regel, reden: 'Geen naam ingevuld.' }); continue; }
    if (!email) { plan.fouten.push({ regel, reden: 'Geen e-mailadres ingevuld.' }); continue; }
    if (!isValidEmail(email)) {
      plan.fouten.push({ regel, reden: 'Dit is geen geldig e-mailadres.' });
      continue;
    }

    const eerder = gezien.get(sleutel(email));
    if (eerder !== undefined) {
      plan.fouten.push({
        regel,
        reden: `Dit adres staat eerder in het bestand, op regel ${eerder}.`,
      });
      continue;
    }

    const rolCel = cel(kolommen.rol);
    const role = leesRol(rolCel);
    if (role === null) {
      plan.fouten.push({
        regel,
        reden: `Onbekende rol "${rolCel}". Kies speler, trainer of ouder.`,
      });
      continue;
    }

    const tariefCel = cel(kolommen.uurtarief);
    const hourly_rate = leesUurtarief(tariefCel);
    if (hourly_rate === null) {
      plan.fouten.push({ regel, reden: `Het uurtarief "${tariefCel}" is geen bedrag.` });
      continue;
    }

    gezien.set(sleutel(email), regel);

    // Een leeg optioneel veld hoort niet als sleutel met `undefined` in het object te staan:
    // dat is het verschil tussen "niet ingevuld" en "leeggemaakt", en de tests zien het.
    const lid: Omit<User, 'id'> = { name: naam, email, role };
    const phone = normalizePhone(cel(kolommen.telefoon));
    if (phone) lid.phone = phone;
    if (hourly_rate !== undefined) lid.hourly_rate = hourly_rate;

    const bestaandLid = bekend.get(sleutel(email));
    if (!bestaandLid) {
      plan.nieuw.push(lid);
      continue;
    }

    // De rol van iemand die er al is, verandert de import nooit: `updateUser` sluit `role`
    // uit van zijn type, en dat is met opzet — trainer word je in Beheer, bewust. Een
    // bestand dat iets anders beweert, wordt afgekeurd en niet half doorgevoerd. De cel is
    // hier bewust `rolCel` en niet `role`: een lege cel zegt niets en mag niets afkeuren.
    if (rolCel && role !== bestaandLid.role) {
      plan.fouten.push({
        regel,
        reden: 'Staat al in de club met een andere rol; dat wijzig je in Beheer.',
      });
      continue;
    }

    const wijzigingen = verschillen(bestaandLid, lid);
    if (Object.keys(wijzigingen).length > 0) {
      plan.bijgewerkt.push({ bestaand: bestaandLid, wijzigingen });
    }
  }

  return plan;
}
```

- [ ] **Step 4: Draai de tests en zie ze slagen**

Run: `npx jest lib/import-leden.test.ts`
Expected: PASS — alles, ook de tests uit Task 2.

- [ ] **Step 5: Commit**

```bash
git add lib/import-leden.ts lib/import-leden.test.ts
git commit -m "feat(import): het plan — wie er nieuw is, wie bijgewerkt wordt, wat er misgaat"
```

---

### Task 4: Het voorbeeldbestand

Een knop die een CSV met alleen de koppen en twee voorbeeldregels downloadt. Kost bijna niets en scheelt het raden van kolomnamen — en het bestand dat eruit komt, gaat er ook weer in.

**Files:**
- Modify: `lib/import-leden.ts`
- Test: `lib/import-leden.test.ts`

- [ ] **Step 1: Schrijf de falende test**

Onderaan `lib/import-leden.test.ts` (breid de import bovenin uit met `voorbeeldLedenCsv`, en voeg `import { parseCsv } from './csv';` toe):

```ts
describe('voorbeeldLedenCsv', () => {
  it('levert een bestand op dat de import zelf zonder klachten leest', () => {
    const plan = planImport(parseCsv(voorbeeldLedenCsv()), []);
    expect(plan.fouten).toEqual([]);
    expect(plan.nieuw).toHaveLength(2);
  });

  it('toont een speler en een trainer, zodat beide vormen te zien zijn', () => {
    const plan = planImport(parseCsv(voorbeeldLedenCsv()), []);
    expect(plan.nieuw.map((u) => u.role)).toEqual(['player', 'coach']);
  });
});
```

- [ ] **Step 2: Draai de test en zie hem falen**

Run: `npx jest lib/import-leden.test.ts -t voorbeeldLedenCsv`
Expected: FAIL — `voorbeeldLedenCsv is not a function`.

- [ ] **Step 3: Schrijf de functie**

Onderaan `lib/import-leden.ts`:

```ts
/**
 * Het voorbeeldbestand. Twee regels en niet één: een speler zonder tarief en een trainer
 * mét, zodat een trainer ziet dat een lege cel gewoon mag. Puntkomma's, want dat is wat
 * Nederlandse Excel zelf schrijft en dus wat er straks terugkomt.
 */
export function voorbeeldLedenCsv(): string {
  return [
    LEDEN_KOPPEN.join(';'),
    'Jonas Peeters;jonas@voorbeeld.be;speler;0470 12 34 56;',
    'Sofie Maes;sofie@voorbeeld.be;trainer;;45',
  ].join('\n');
}
```

- [ ] **Step 4: Draai de tests en zie ze slagen**

Run: `npx jest lib/import-leden.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/import-leden.ts lib/import-leden.test.ts
git commit -m "feat(import): een voorbeeldbestand om van te vertrekken"
```

---

### Task 5: Een bestand van de gebruiker inlezen

Het enige platformafhankelijke stukje van de import, en daarom apart. `lib/share.ts` is de tegenhanger: die geeft een bestand áán de browser en maakt precies dezelfde keuze — op web een echt bestand, op een telefoon iets anders, zonder pakketten erbij. Dit bestand krijgt geen tests: er valt niets te toetsen dat niet de DOM zelf is, net als bij `share.ts`.

**Files:**
- Create: `lib/bestand.ts`

- [ ] **Step 1: Schrijf het bestand**

`lib/bestand.ts`:

```ts
// Een tekstbestand van de gebruiker inlezen. De tegenhanger van lib/share.ts, dat een
// bestand wegschrijft, en met dezelfde keuze erin: op web bestaat een bestandskiezer, op
// een telefoon niet zonder `expo-document-picker` erbij. Eén pakket voor één knop die op de
// website — waar de club de app gebruikt — allang werkt, is het niet waard. Het scherm
// verbergt de knop daar dus en zet er een plakvak neer, in plaats van hem te tonen en dan
// te falen.

import { Platform } from 'react-native';

/** Kan dit toestel de gebruiker een bestand laten kiezen? */
export const kanBestandKiezen: boolean =
  Platform.OS === 'web' && typeof document !== 'undefined' && typeof FileReader !== 'undefined';

/**
 * Vraag de gebruiker om een CSV en geef de inhoud terug. `null` betekent: hij heeft het
 * venster weggeklikt, of het lezen mislukte. Dat is geen fout om een melding over te tonen —
 * er is dan gewoon niets gebeurd.
 *
 * De belofte lost nooit op als de gebruiker het bestandsvenster wegklikt zonder te kiezen;
 * dat is hoe `input type=file` werkt en het scherm kan daar niets zinnigs mee. Het scherm
 * blijft in dat geval staan waar het stond, en dat klopt.
 */
export function kiesTekstbestand(): Promise<string | null> {
  if (!kanBestandKiezen) return Promise.resolve(null);
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,text/csv,text/plain';
    input.onchange = () => {
      const bestand = input.files?.[0];
      if (!bestand) { resolve(null); return; }
      const lezer = new FileReader();
      lezer.onload = () => resolve(typeof lezer.result === 'string' ? lezer.result : null);
      lezer.onerror = () => resolve(null);
      // UTF-8 met de BOM erin die Excel schrijft; `parseCsv` haalt die er weer af.
      lezer.readAsText(bestand, 'utf-8');
    };
    input.click();
  });
}
```

- [ ] **Step 2: Controleer dat TypeScript tevreden is**

Run: `npx tsc --noEmit`
Expected: geen fouten.

- [ ] **Step 3: Commit**

```bash
git add lib/bestand.ts
git commit -m "feat(bestand): een tekstbestand van de gebruiker inlezen op web"
```

---

### Task 6: Het importscherm

Bestand kiezen of plakken → plan tonen → importeren. Geen tests: alle regelgeving zit in Task 1 t/m 4 en is daar getoetst; dit scherm roept ze aan en toont het resultaat.

**Files:**
- Create: `app/admin/leden-import.tsx`

- [ ] **Step 1: Schrijf het scherm**

`app/admin/leden-import.tsx`:

```tsx
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { useT } from '../../lib/i18n';
import { parseCsv } from '../../lib/csv';
import { planImport, voorbeeldLedenCsv, type ImportPlan } from '../../lib/import-leden';
import { kanBestandKiezen, kiesTekstbestand } from '../../lib/bestand';
import { shareCsv } from '../../lib/share';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography } from '../../constants/theme';

/**
 * Leden importeren uit een lijst die de club al heeft.
 *
 * Het scherm schrijft nooit iets weg op grond van een bestand alleen: eerst komt het plan
 * in beeld ("40 nieuw, 2 bijgewerkt, 1 fout"), en pas de knop eronder doet iets. Wie het
 * verkeerde bestand koos, ziet dat vóór het gebeurd is en niet erna.
 */
export default function LedenImport(): React.JSX.Element {
  const t = useT();
  const { currentUser, users, addUser, updateUser } = useSimpleData();
  const [tekst, setTekst] = useState<string>('');
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [bezig, setBezig] = useState<boolean>(false);
  const [resultaat, setResultaat] = useState<string | null>(null);

  if (currentUser?.role !== 'coach') {
    return (
      <Screen scroll={false}>
        <Text style={styles.muted}>{t('Beheer is alleen voor trainers.')}</Text>
      </Screen>
    );
  }

  const toonPlan = (inhoud: string): void => {
    setTekst(inhoud);
    setResultaat(null);
    setPlan(planImport(parseCsv(inhoud), users));
  };

  const opnieuw = (): void => {
    setTekst('');
    setPlan(null);
    setResultaat(null);
  };

  const voerUit = async (): Promise<void> => {
    if (!plan || bezig) return;
    setBezig(true);
    let toegevoegd = 0;
    let bijgewerkt = 0;
    let mislukt = 0;
    // Eén voor één en niet in één klap: elke wijziging loopt zo over dezelfde bewaakte weg
    // als een trainer die met de hand een lid toevoegt. Het kost een ronde per lid en dat
    // duurt merkbaar bij een grote lijst — de winst is dat er geen tweede manier bestaat om
    // een lid de club in te krijgen, met eigen regels die kunnen gaan afwijken.
    for (const lid of plan.nieuw) {
      try { await addUser(lid); toegevoegd++; } catch { mislukt++; }
    }
    for (const b of plan.bijgewerkt) {
      try { await updateUser(b.bestaand.id, b.wijzigingen); bijgewerkt++; } catch { mislukt++; }
    }
    setBezig(false);
    setPlan(null);
    setTekst('');
    setResultaat(
      mislukt > 0
        ? t('{toegevoegd} toegevoegd, {bijgewerkt} bijgewerkt, {mislukt} mislukt. Probeer het bestand opnieuw — wie er al staat, komt er niet dubbel bij.',
          { toegevoegd, bijgewerkt, mislukt })
        : t('{toegevoegd} toegevoegd en {bijgewerkt} bijgewerkt.', { toegevoegd, bijgewerkt }),
    );
  };

  return (
    <Screen>
      <Card>
        <Text style={styles.kop}>{t('Leden importeren')}</Text>
        <Text style={styles.uitleg}>
          {t('Sla je Excel-lijst op als CSV en kies hem hier. Kolommen: naam, email, rol, telefoon, uurtarief. Alleen naam en email zijn verplicht.')}
        </Text>
        <Button
          label={t('Voorbeeldbestand downloaden')}
          variant="secondary"
          onPress={() => { void shareCsv('leden-voorbeeld.csv', voorbeeldLedenCsv()); }}
        />
      </Card>

      {plan === null ? (
        <Card>
          {kanBestandKiezen ? (
            <Button
              label={t('Bestand kiezen')}
              onPress={() => {
                void kiesTekstbestand().then((inhoud) => {
                  if (inhoud !== null) toonPlan(inhoud);
                });
              }}
            />
          ) : (
            <>
              {/* Op een telefoon is er geen bestandskiezer. Plakken uit Excel geeft
                  tab-gescheiden kolommen en die leest `parseCsv` ook. */}
              <Text style={styles.label}>{t('Plak hier de kolommen uit Excel')}</Text>
              <TextInput
                style={styles.plakvak}
                value={tekst}
                onChangeText={setTekst}
                multiline
                numberOfLines={8}
                placeholder={t('naam;email;rol')}
                placeholderTextColor={tennisColors.textMuted}
              />
              <Button
                label={t('Nakijken')}
                disabled={tekst.trim().length === 0}
                onPress={() => toonPlan(tekst)}
                style={styles.knop}
              />
            </>
          )}
          {resultaat ? <Text style={styles.resultaat}>{resultaat}</Text> : null}
        </Card>
      ) : (
        <>
          <Card>
            <Text style={styles.kop}>{t('Dit gaat er gebeuren')}</Text>
            <Text style={styles.telling}>
              {t('{nieuw} nieuw, {bijgewerkt} bijgewerkt, {fouten} fout', {
                nieuw: plan.nieuw.length,
                bijgewerkt: plan.bijgewerkt.length,
                fouten: plan.fouten.length,
              })}
            </Text>

            {plan.nieuw.map((lid) => (
              <Text key={`n-${lid.email}`} style={styles.regel}>
                {t('Nieuw')}: {lid.name} — {lid.email}
              </Text>
            ))}
            {plan.bijgewerkt.map((b) => (
              <Text key={`b-${b.bestaand.id}`} style={styles.regel}>
                {t('Bijwerken')}: {b.bestaand.name} — {Object.keys(b.wijzigingen).join(', ')}
              </Text>
            ))}
          </Card>

          {plan.fouten.length > 0 ? (
            <Card>
              <Text style={styles.foutKop}>{t('Deze regels worden overgeslagen')}</Text>
              {plan.fouten.map((f) => (
                <Text key={`f-${f.regel}`} style={styles.fout}>
                  {t('Regel {regel}', { regel: f.regel })}: {t(f.reden)}
                </Text>
              ))}
            </Card>
          ) : null}

          <Card>
            <Button
              label={bezig ? t('Bezig…') : t('Importeren')}
              disabled={bezig || (plan.nieuw.length === 0 && plan.bijgewerkt.length === 0)}
              onPress={() => { void voerUit(); }}
            />
            <Button
              label={t('Ander bestand')}
              variant="secondary"
              disabled={bezig}
              onPress={opnieuw}
              style={styles.knop}
            />
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: tennisColors.textMuted, fontSize: 14 },
  kop: { ...typography.h3, color: tennisColors.text },
  uitleg: {
    fontSize: 14,
    color: tennisColors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: tennisColors.textMuted,
    marginBottom: spacing.xs,
  },
  plakvak: {
    backgroundColor: tennisColors.background,
    borderWidth: 1,
    borderColor: tennisColors.border,
    borderRadius: 8,
    padding: spacing.md,
    minHeight: 160,
    fontSize: 14,
    color: tennisColors.text,
    textAlignVertical: 'top',
  },
  knop: { marginTop: spacing.md },
  telling: { ...typography.h3, color: tennisColors.primary, marginBottom: spacing.sm },
  regel: { fontSize: 14, color: tennisColors.text, marginTop: spacing.xs },
  foutKop: { ...typography.h3, color: tennisColors.danger },
  fout: { fontSize: 14, color: tennisColors.danger, marginTop: spacing.xs },
  resultaat: { fontSize: 14, color: tennisColors.text, marginTop: spacing.md },
});
```

- [ ] **Step 2: Controleer dat TypeScript tevreden is**

Run: `npx tsc --noEmit`
Expected: geen fouten. Klaagt hij over `typography.label` of een kleur die niet bestaat, kijk dan in `constants/theme.ts` en `constants/tennis-colors.ts` welke namen er wél zijn.

- [ ] **Step 3: Commit**

```bash
git add app/admin/leden-import.tsx
git commit -m "feat(beheer): scherm om leden te importeren, met een voorbeeld vooraf"
```

---

### Task 7: De tegel in Beheer

**Files:**
- Modify: `app/admin/index.tsx`

- [ ] **Step 1: Voeg het icoon toe aan de import**

Wijzig in `app/admin/index.tsx` de import uit `lucide-react-native` zodat `Upload` erbij staat:

```tsx
import {
  CreditCard, BarChart3, LayoutGrid, Settings as SettingsIcon, UserPlus, Target, Ticket,
  Upload, type LucideIcon,
} from 'lucide-react-native';
```

- [ ] **Step 2: Voeg de tegel toe**

In de groep `club`, direct na de tegel `add`:

```tsx
        { key: 'import', title: t('Leden importeren'), subtitle: t('Uit een Excel-lijst'), icon: Upload, onPress: () => router.push('/admin/leden-import') },
```

- [ ] **Step 3: Controleer**

Run: `npx tsc --noEmit`
Expected: geen fouten.

- [ ] **Step 4: Commit**

```bash
git add app/admin/index.tsx
git commit -m "feat(beheer): tegel naar het importscherm"
```

---

### Task 8: De controles van het wachtwoordscherm

Los van het scherm, zodat ze te testen zijn zonder scherm — dat is de enige reden dat dit een eigen bestand is.

**Files:**
- Create: `lib/wachtwoord.ts`
- Test: `lib/wachtwoord.test.ts`

- [ ] **Step 1: Schrijf de falende tests**

`lib/wachtwoord.test.ts`:

```ts
import { controleerWachtwoord, gaatOverEenBestaandAccount, MIN_WACHTWOORD } from './wachtwoord';

describe('controleerWachtwoord', () => {
  it('keurt een goed en tweemaal gelijk wachtwoord goed', () => {
    expect(controleerWachtwoord('geheim123', 'geheim123')).toBeNull();
  });

  it('houdt een te kort wachtwoord tegen', () => {
    expect(controleerWachtwoord('kort', 'kort')).toBe(
      'Kies een wachtwoord van minstens zes tekens.',
    );
  });

  it('houdt twee verschillende wachtwoorden tegen', () => {
    expect(controleerWachtwoord('geheim123', 'geheim124')).toBe(
      'De twee wachtwoorden zijn niet gelijk.',
    );
  });

  it('klaagt eerst over de lengte, want dat is de fout die je zelf ziet', () => {
    expect(controleerWachtwoord('kort', 'anders')).toBe(
      'Kies een wachtwoord van minstens zes tekens.',
    );
  });

  it('telt spaties mee als tekens — een wachtwoord is geen naam', () => {
    expect(controleerWachtwoord('a b c ', 'a b c ')).toBeNull();
    expect(MIN_WACHTWOORD).toBe(6);
  });
});

describe('gaatOverEenBestaandAccount', () => {
  it('herkent waar Supabase mee komt als het adres al een login heeft', () => {
    expect(gaatOverEenBestaandAccount('User already registered')).toBe(true);
    expect(gaatOverEenBestaandAccount('A user with this email address has already been registered'))
      .toBe(true);
  });

  it('laat een andere fout met rust', () => {
    expect(gaatOverEenBestaandAccount('Network request failed')).toBe(false);
  });
});
```

- [ ] **Step 2: Draai de tests en zie ze falen**

Run: `npx jest lib/wachtwoord.test.ts`
Expected: FAIL — `Cannot find module './wachtwoord'`.

- [ ] **Step 3: Schrijf het bestand**

`lib/wachtwoord.ts`:

```ts
// De controles van het scherm "stel je wachtwoord in", los van dat scherm.
//
// Ze staan hier omdat een verkeerd getypt wachtwoord dat je nog nooit gebruikt hebt je
// buitensluit zonder dat er een weg terug is. Dat is te belangrijk om alleen in een scherm
// te bestaan waar geen test bij kan.

/** Supabase eist zes tekens; de app zegt dat vooraf in plaats van het antwoord af te wachten. */
export const MIN_WACHTWOORD = 6;

/**
 * Deugt dit wachtwoord, en is het tweemaal gelijk getypt? Geeft de melding in het
 * Nederlands terug, of `null` als er niets aan de hand is. Het scherm haalt hem door `t()`.
 *
 * De lengte gaat vóór de gelijkheid: wie een te kort wachtwoord tweemaal fout typt, heeft
 * meer aan "te kort" dan aan "niet gelijk" — dat eerste is de fout die hij zelf kan zien.
 */
export function controleerWachtwoord(wachtwoord: string, herhaling: string): string | null {
  if (wachtwoord.length < MIN_WACHTWOORD) return 'Kies een wachtwoord van minstens zes tekens.';
  if (wachtwoord !== herhaling) return 'De twee wachtwoorden zijn niet gelijk.';
  return null;
}

/**
 * Gaat deze foutmelding erover dat het adres al een login heeft?
 *
 * Dat is de belangrijkste fout van dit scherm: iemand die vorig seizoen al een wachtwoord
 * koos en het vergeten is, komt hier terecht en hoort "log gewoon in" te lezen in plaats van
 * de Engelse tekst van Supabase. De formulering aan die kant verandert weleens, vandaar dat
 * er op meerdere woorden gelet wordt.
 */
export function gaatOverEenBestaandAccount(melding: string): boolean {
  return /already registered|already been registered|already exists/i.test(melding);
}
```

- [ ] **Step 4: Draai de tests en zie ze slagen**

Run: `npx jest lib/wachtwoord.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/wachtwoord.ts lib/wachtwoord.test.ts
git commit -m "feat(login): de controles van het wachtwoordscherm, apart en getest"
```

---

### Task 9: Geen lege naam meesturen bij aanmelden

Een klein maar echt gat. De databank kiest de naam met `coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))`. Sturen we een lége naam mee, dan is dat voor `coalesce` een waarde en geen ontbrekende naam — de nieuwe gebruiker heet dan `''`. Het wachtwoordscherm van Task 10 vraagt geen naam, dus zonder deze wijziging is dat precies wat er gebeurt.

**Files:**
- Modify: `providers/supabaseStore.ts:186-193`

- [ ] **Step 1: Wijzig `signUp`**

Vervang de functie door:

```ts
export async function signUp(email: string, password: string, name: string): Promise<void> {
  const schoon = name.trim();
  const { error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    // Geen naam? Dan sturen we het veld helemaal niet mee. Een lege string is voor de
    // `coalesce` in `link_auth_user` een geldige waarde, en dan heet de nieuwe gebruiker
    // letterlijk niets in plaats van het deel vóór het apenstaartje.
    options: schoon ? { data: { name: schoon } } : undefined,
  });
  if (error) throw new Error(loginMessage(error.message));
}
```

- [ ] **Step 2: Controleer**

Run: `npx tsc --noEmit`
Expected: geen fouten.

- [ ] **Step 3: Commit**

```bash
git add providers/supabaseStore.ts
git commit -m "fix(login): geen lege naam meesturen bij aanmelden"
```

---

### Task 10: De derde stand op het loginscherm

`app/login.tsx` heeft nu een `aanmelden`-schakelaar met twee standen. Die wordt een keuze uit drie. De nieuwe stand krijgt de voorkeurspositie, want dit is de weg die de meeste mensen na een import nemen.

**Files:**
- Modify: `app/login.tsx` (de component `WachtwoordLogin`)

- [ ] **Step 1: Breid de imports uit**

Bovenaan `app/login.tsx`, bij de bestaande imports:

```tsx
import { controleerWachtwoord, gaatOverEenBestaandAccount } from '../lib/wachtwoord';
```

- [ ] **Step 2: Vervang de component `WachtwoordLogin`**

Vervang de hele functie `WachtwoordLogin` (inclusief het commentaarblok erboven) door:

```tsx
/**
 * Inloggen met e-mailadres en wachtwoord — de weg zodra de club een databank heeft.
 *
 * Drie standen op één scherm, en dat is met opzet. Een speler die de trainer al heeft
 * ingevoerd, bestáát: hij heeft lessen, een beurtenkaart en een dossier, en mist alleen nog
 * een wachtwoord. "Maak een account aan" is voor hem een leugen en "eerste keer hier" niet.
 * Onder water is het hetzelfde: `signUp` maakt de login, en de trigger `link_auth_user` in
 * de databank hangt hem aan de rij met datzelfde adres.
 */
type Stand = 'inloggen' | 'eerste' | 'aanmelden';

function WachtwoordLogin(): React.JSX.Element {
  const t = useT();
  const { signIn, signUp } = useSimpleData();
  const [stand, setStand] = useState<Stand>('inloggen');
  const [email, setEmail] = useState<string>('');
  const [wachtwoord, setWachtwoord] = useState<string>('');
  const [herhaling, setHerhaling] = useState<string>('');
  const [naam, setNaam] = useState<string>('');
  const [melding, setMelding] = useState<string | null>(null);
  const [bezig, setBezig] = useState<boolean>(false);

  const klaar = email.trim().length > 0 && wachtwoord.length > 0
    && (stand !== 'aanmelden' || naam.trim().length > 0)
    && (stand !== 'eerste' || herhaling.length > 0);

  const wissel = (naarStand: Stand): void => {
    setStand(naarStand);
    setMelding(null);
    setHerhaling('');
  };

  const verstuur = async (): Promise<void> => {
    if (!klaar || bezig) return;
    setMelding(null);

    if (stand === 'eerste') {
      const klacht = controleerWachtwoord(wachtwoord, herhaling);
      if (klacht) { setMelding(t(klacht)); return; }
    }

    setBezig(true);
    try {
      if (stand === 'inloggen') {
        await signIn(email, wachtwoord);
      } else if (stand === 'eerste') {
        // Geen naam: die staat al in de ledenlijst en hoort van de trainer te blijven.
        // Is dit adres onbekend, dan valt de databank terug op het deel vóór het apenstaartje.
        await signUp(email, wachtwoord, '');
        setMelding(t('Klaar. Log in met je nieuwe wachtwoord.'));
        setStand('inloggen');
      } else {
        await signUp(email, wachtwoord, naam);
        // Staat "bevestig je e-mailadres" aan in Supabase, dan gebeurt er nu nog niets
        // zichtbaars; zonder dit bericht lijkt de knop kapot.
        setMelding(t('Account aangemaakt. Kijk in je mailbox als er om bevestiging gevraagd wordt.'));
      }
    } catch (e: unknown) {
      const ruw = e instanceof Error ? e.message : '';
      // De belangrijkste fout van dit scherm: iemand die vorig seizoen al een wachtwoord
      // koos en dat vergeten is. Die hoort geen Engelse databankmelding te lezen.
      setMelding(
        stand !== 'inloggen' && gaatOverEenBestaandAccount(ruw)
          ? t('Er bestaat al een wachtwoord voor dit adres. Log gewoon in.')
          : (ruw || t('Inloggen mislukt.')),
      );
    } finally {
      setBezig(false);
    }
  };

  const knopLabel = stand === 'inloggen'
    ? t('Inloggen')
    : stand === 'eerste' ? t('Wachtwoord instellen') : t('Account aanmaken');

  return (
    <View style={styles.listInner}>
      <Card>
        {stand === 'aanmelden' ? (
          <>
            <Text style={styles.label}>{t('Naam')}</Text>
            <TextInput
              style={styles.input}
              value={naam}
              onChangeText={setNaam}
              placeholder={t('Voor- en achternaam')}
              placeholderTextColor={tennisColors.textMuted}
              autoComplete="name"
            />
          </>
        ) : null}

        <Text style={styles.label}>{t('E-mailadres')}</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder={t('jij@voorbeeld.be')}
          placeholderTextColor={tennisColors.textMuted}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />

        <Text style={styles.label}>{t('Wachtwoord')}</Text>
        <TextInput
          style={styles.input}
          value={wachtwoord}
          onChangeText={setWachtwoord}
          placeholder={t('Minstens zes tekens')}
          placeholderTextColor={tennisColors.textMuted}
          secureTextEntry
          autoComplete={stand === 'inloggen' ? 'current-password' : 'new-password'}
          onSubmitEditing={() => {
            void verstuur();
          }}
        />

        {stand === 'eerste' ? (
          <>
            {/* Twee keer, want een typefout hier sluit je buiten zonder weg terug. */}
            <Text style={styles.label}>{t('Wachtwoord nog eens')}</Text>
            <TextInput
              style={styles.input}
              value={herhaling}
              onChangeText={setHerhaling}
              placeholder={t('Dezelfde als hierboven')}
              placeholderTextColor={tennisColors.textMuted}
              secureTextEntry
              autoComplete="new-password"
              onSubmitEditing={() => {
                void verstuur();
              }}
            />
          </>
        ) : null}

        {melding ? <Text style={styles.melding}>{melding}</Text> : null}

        <Button
          label={knopLabel}
          variant="primary"
          disabled={!klaar || bezig}
          onPress={() => {
            void verstuur();
          }}
          style={styles.knop}
        />

        {stand !== 'eerste' ? (
          <Text
            style={styles.wissel}
            accessibilityRole="button"
            accessibilityLabel={t('Eerste keer hier? Stel je wachtwoord in')}
            onPress={() => wissel('eerste')}
          >
            {t('Eerste keer hier? Stel je wachtwoord in')}
          </Text>
        ) : null}

        {stand !== 'inloggen' ? (
          <Text
            style={styles.wissel}
            accessibilityRole="button"
            accessibilityLabel={t('Ik heb al een account')}
            onPress={() => wissel('inloggen')}
          >
            {t('Ik heb al een account')}
          </Text>
        ) : null}

        {stand !== 'aanmelden' ? (
          <Text
            style={styles.wissel}
            accessibilityRole="button"
            accessibilityLabel={t('Ik sta nog niet bij de club')}
            onPress={() => wissel('aanmelden')}
          >
            {t('Ik sta nog niet bij de club')}
          </Text>
        ) : null}
      </Card>
    </View>
  );
}
```

- [ ] **Step 3: Controleer**

Run: `npx tsc --noEmit`
Expected: geen fouten. Blijft er een waarschuwing over een ongebruikte `aanmelden`-variabele staan, dan is er een restant van de oude component blijven staan — verwijder dat.

- [ ] **Step 4: Commit**

```bash
git add app/login.tsx
git commit -m "feat(login): eerste keer hier? stel je wachtwoord in"
```

---

### Task 11: De Engelse kant

Elke nieuwe Nederlandse zin uit Task 6 en 10 krijgt zijn vertaling. Staat een zin er niet, dan blijft het Nederlands staan — dat is een zichtbaar gat en geen stille fout, maar we laten het niet zo.

**Files:**
- Modify: `lib/i18n-en.ts`

- [ ] **Step 1: Voeg de zinnen toe**

Onderaan het `EN`-object, vóór de sluitende accolade:

```ts
  // --- leden importeren ---------------------------------------------------
  'Leden importeren': 'Import members',
  'Uit een Excel-lijst': 'From an Excel list',
  'Sla je Excel-lijst op als CSV en kies hem hier. Kolommen: naam, email, rol, telefoon, uurtarief. Alleen naam en email zijn verplicht.':
    'Save your Excel list as CSV and pick it here. Columns: naam, email, rol, telefoon, uurtarief. Only naam and email are required.',
  'Voorbeeldbestand downloaden': 'Download a sample file',
  'Bestand kiezen': 'Choose a file',
  'Plak hier de kolommen uit Excel': 'Paste the columns from Excel here',
  'Nakijken': 'Check',
  'Dit gaat er gebeuren': 'This is what will happen',
  '{nieuw} nieuw, {bijgewerkt} bijgewerkt, {fouten} fout':
    '{nieuw} new, {bijgewerkt} updated, {fouten} skipped',
  'Nieuw': 'New',
  'Bijwerken': 'Update',
  'Deze regels worden overgeslagen': 'These rows are skipped',
  'Regel {regel}': 'Row {regel}',
  'Importeren': 'Import',
  'Bezig…': 'Working…',
  'Ander bestand': 'Another file',
  '{toegevoegd} toegevoegd en {bijgewerkt} bijgewerkt.':
    '{toegevoegd} added and {bijgewerkt} updated.',
  '{toegevoegd} toegevoegd, {bijgewerkt} bijgewerkt, {mislukt} mislukt. Probeer het bestand opnieuw — wie er al staat, komt er niet dubbel bij.':
    '{toegevoegd} added, {bijgewerkt} updated, {mislukt} failed. Try the file again — nobody already there gets added twice.',

  // --- redenen waarom een regel wordt overgeslagen -------------------------
  'Dit bestand is leeg.': 'This file is empty.',
  'De kopregel mist de kolom "naam" of "email".':
    'The header row is missing the "naam" or "email" column.',
  'Geen naam ingevuld.': 'No name filled in.',
  'Geen e-mailadres ingevuld.': 'No email address filled in.',
  'Dit is geen geldig e-mailadres.': 'This is not a valid email address.',
  'Staat al in de club met een andere rol; dat wijzig je in Beheer.':
    'Already in the club with a different role; change that in Admin.',

  // --- eerste keer inloggen -----------------------------------------------
  'Eerste keer hier? Stel je wachtwoord in': 'First time here? Set your password',
  'Ik sta nog niet bij de club': "I'm not a member yet",
  'Wachtwoord instellen': 'Set password',
  'Wachtwoord nog eens': 'Password again',
  'Dezelfde als hierboven': 'The same as above',
  'Klaar. Log in met je nieuwe wachtwoord.': 'Done. Log in with your new password.',
  'Er bestaat al een wachtwoord voor dit adres. Log gewoon in.':
    'This address already has a password. Just log in.',
  'Kies een wachtwoord van minstens zes tekens.': 'Choose a password of at least six characters.',
  'De twee wachtwoorden zijn niet gelijk.': 'The two passwords are not the same.',
```

**Let op:** de meldingen met een aanhalingsteken erin — `Onbekende rol "hoofdtrainer"...`, `Het uurtarief "veel" is geen bedrag.` en `Dit adres staat eerder in het bestand, op regel 2.` — staan hier bewust **niet**. Die worden in `lib/import-leden.ts` samengesteld met de waarde erin en zijn dus geen vaste zin. Ze blijven in het Nederlands staan; dat is een bekend gat en geen vergetelheid. Wil je ze later vertalen, dan moeten die redenen eerst een vorm met plaatshouders krijgen (`Onbekende rol "{rol}"...`) die het scherm door `t(reden, vars)` haalt.

- [ ] **Step 2: Controleer**

Run: `npx tsc --noEmit`
Expected: geen fouten. Klaagt hij over een dubbele sleutel, dan bestond die zin al — haal jouw regel dan weg en gebruik de bestaande.

- [ ] **Step 3: Commit**

```bash
git add lib/i18n-en.ts
git commit -m "feat(taal): de Engelse kant van de import en het wachtwoordscherm"
```

---

### Task 12: De regel in de README

De bekende opening: wie het adres van een clublid kent, kan dat account claimen zolang Supabase geen bevestigingsmail eist. Dat gold al voor "Account aanmaken", maar na een import staan er ineens vijftig adressen die iemand zou kunnen raden. Dat hoort ergens te staan waar wie het project opzet het leest.

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Zoek de Supabase-paragraaf**

Run: `grep -n "Supabase" README.md`

- [ ] **Step 2: Voeg de alinea toe, direct na de instructies om het schema te draaien**

```markdown
### Zet "Confirm email" aan

In Supabase, onder Authentication → Providers → Email, staat **Confirm email**. Zet die aan
voordat je leden importeert.

Waarom het uitmaakt: een geïmporteerd lid stelt zijn wachtwoord zelf in op het loginscherm,
en het enige dat hij daarvoor nodig heeft is zijn e-mailadres. Staat de bevestiging uit, dan
kan iemand die het adres van een clublid kent dat account claimen voordat het lid zelf komt.
Staat ze aan, dan is er eerst een mail nodig die op dat adres aankomt — en die heeft hij
alleen als het echt van hem is.
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: zet Confirm email aan voordat je leden importeert"
```

---

### Task 13: Oplevering

- [ ] **Step 1: De hele testsuite**

Run: `npm test`
Expected: alles groen. Er stonden er 483; er komen er ongeveer 35 bij.

- [ ] **Step 2: TypeScript over het hele project**

Run: `npx tsc --noEmit`
Expected: geen fouten.

- [ ] **Step 3: De webbundel**

Run: `npx expo export --platform web`
Expected: geen fouten. Dit vangt wat `tsc` niet ziet — een import die niet bestaat, een stijl die niet geïmporteerd is.

- [ ] **Step 4: Met de hand nalopen op web**

⚠️ **Draai dit zonder de Supabase-sleutels in `.env`**, of met verzonnen adressen die je daarna weer weghaalt — de dev-server praat anders met de échte databank van de club.

Run: `npm run web`

De import (log in als trainer, ga naar Beheer → Leden importeren):

- [ ] *Voorbeeldbestand downloaden* geeft een CSV die in Excel netjes in kolommen staat.
- [ ] Datzelfde bestand er weer in: 2 nieuw, 0 bijgewerkt, 0 fout.
- [ ] *Importeren*: de twee namen staan daarna bij de spelers en trainers.
- [ ] Hetzelfde bestand nóg eens: 0 nieuw, 0 bijgewerkt — herhalen verdubbelt niemand.
- [ ] Wijzig in het bestand een telefoonnummer: 0 nieuw, 1 bijgewerkt, en het nieuwe nummer staat er na het importeren.
- [ ] Een bestand met een regel zonder adres en een regel met rol "hoofdtrainer": beide staan bij de overgeslagen regels met het juiste regelnummer, en de goede regels gaan gewoon door.
- [ ] *Ander bestand* brengt je terug naar het begin.

Het wachtwoordscherm (alleen zinvol mét Supabase-sleutels — gebruik een verzonnen adres):

- [ ] Importeer een lid met een adres waar je bij kunt. Log uit.
- [ ] *Eerste keer hier? Stel je wachtwoord in* → adres + tweemaal hetzelfde wachtwoord → je komt binnen (of krijgt de bevestigingsmail, als *Confirm email* aanstaat).
- [ ] Je naam op het profielscherm is de naam die de trainer invoerde, niet het deel vóór het apenstaartje.
- [ ] Je ziet de lessen die er vóór je eerste login al voor je stonden.
- [ ] Datzelfde adres nog eens via "stel je wachtwoord in": je leest "Er bestaat al een wachtwoord voor dit adres. Log gewoon in."
- [ ] Twee verschillende wachtwoorden: "De twee wachtwoorden zijn niet gelijk", zonder dat er iets naar de databank gaat.
- [ ] Een wachtwoord van vier tekens: "minstens zes tekens".
- [ ] Zet de taal op Engels en loop het loginscherm en het importscherm nog eens langs: alles vertaald, op de drie samengestelde foutredenen na (zie Task 11).

- [ ] **Step 5: Werk `OPENSTAAND.md` bij**

Zet onder "Wat er nog moet gebeuren" wat er nu af is en wat er open blijft:

```markdown
- **Leden importeren** staat er (Beheer → Leden importeren): CSV met naam, email, rol,
  telefoon, uurtarief; voorbeeld vooraf, dubbele adressen en foute regels worden benoemd en
  overgeslagen. Geïmporteerde leden stellen hun wachtwoord zelf in op het loginscherm.
  Nog open: de rol van een bestaand lid wijzigen kan alleen met de hand in Beheer, en drie
  samengestelde foutmeldingen zijn niet vertaald.
```

```bash
git add OPENSTAAND.md
git commit -m "docs: leden importeren en het wachtwoordscherm staan erop"
```

---

## Wat er bewust niet in dit plan zit

- **Uitnodigingsmails bij de import.** Vraagt een Supabase Edge Function met de service-role sleutel en werkende mailbezorging. Kan later; niets hierboven staat het in de weg.
- **Echte `.xlsx` lezen.** Een xlsx is een zip, dus dat vraagt decompressie. "Opslaan als CSV" is één klik voor de trainer.
- **Verwijderen via de import.** Een naam die uit het bestand valt, verdwijnt niet uit de club. Iemand wissen die lessen en een dossier heeft, is een besluit en geen bijwerking van een bestand.
- **De rol van een bestaand lid wijzigen.** `updateUser` sluit `role` uit van zijn type, met opzet. De import keurt zo'n regel af met reden; de trainer wijzigt het in Beheer.
