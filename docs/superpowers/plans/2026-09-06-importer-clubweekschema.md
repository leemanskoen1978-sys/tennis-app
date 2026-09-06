# Importer voor het clubweekschema — implementatieplan

> **Voor uitvoerders:** gebruik superpowers:subagent-driven-development of
> superpowers:executing-plans om dit taak voor taak uit te voeren. De stappen zijn afvinkbaar.

**Doel:** de echte clublijst van 192 groepen en 550 spelers inleesbaar maken — één regel per
groep, spelers komma-gescheiden, zonder één datum in het bestand.

**Aanpak:** een nieuwe lezer `lib/import-weekschema.ts` die het clubformaat rechtstreeks naar
`GeplandeGroep[]` vertaalt en op dát punt in de bestaande pijplijn haakt. Alles ná
`GeplandeGroep` — spelers, koppelingen, `lessenUitGroep`, het plan, de droogloop, het toepassen
— kent het bestandsformaat niet en blijft ongewijzigd. `planImportLessen` kijkt naar de koprij
en kiest de lezer. Het bestaande formaat van `koen.xlsx` blijft werken; daar hangen tests aan
die niet mogen wijzigen.

**Waar de datums vandaan komen:** het bestand heeft ze niet. Het seizoen staat sinds
`SEIZOEN-EN-LESDUUR.sql` in de clubinstellingen (7 september 2026 t/m 30 juni 2027, overgenomen
uit "GANTOISE TENNIS - KALENDER JAARCYCLUS 2026-2027": het groen begint in week 37 en eindigt op
30 juni). De dertien vakantieperiodes stonden er al en kloppen. `lessenUitGroep` plant daarmee
per weekdag van `season_start` tot `season_end` en slaat de vakanties over.

**Techniek:** TypeScript, geen nieuwe afhankelijkheden. Tests met Jest in `lib/`, zoals alle
1591 bestaande tests. `npx tsc --noEmit` en `npx jest` moeten na elke taak groen zijn.

---

## Vooraf: wat de gebruiker al besliste

Deze staan vast en zijn geen ontwerpruimte meer:

| Onderwerp | Beslissing |
| --- | --- |
| Sleutel | weekdag + beginuur + terrein. De kolom `Groep` komt er alléén bij op de momenten waar het anders botst (5 van de 192). |
| Overlap | Blokkeert nooit, waarschuwt altijd. Al gebouwd; deze importer erft dat gedrag. |
| Seizoen | Uit de clubinstellingen, niet uit het bestand en niet uit een schermveld. |
| Lesduur | Nieuw veld `duration_minutes` op de lesgroep, gelezen uit de kolom `Uur`. Leeg = de clubinstelling. |
| Meerdere terreinen op één regel (2×) | Het eerste terrein wint, de rest in een waarschuwing. |
| Meerdere trainers op één regel | De eerste wint, de rest in een waarschuwing. |
| Regels zonder spelers (2×) | De groep wordt aangemaakt met een leeg rooster; er worden geen lessen ingepland. |
| `Doelgroep` / `Groep` | `Doelgroep` wordt `level`, `Groep` wordt de naam. Niet tegen elkaar controleren. |
| Betaalwijze | `invoice`, zoals elke groepsles. Betalingen gebeuren extern; de app rekent er niet aan. |

## Bestandsindeling

| Bestand | Verantwoordelijkheid |
| --- | --- |
| `SEIZOEN-EN-LESDUUR.sql` | **Bestaat al.** Zet `season_start`/`season_end` in `club_settings` en voegt `duration_minutes` toe aan `lesson_groups`. Draait de gebruiker zelf. |
| `lib/types.ts` | `Settings.season_start`, `Settings.season_end`, `LesGroep.duration_minutes` erbij. |
| `lib/import-weekschema.ts` | **Nieuw.** Het clubformaat lezen: koprij, weekdag, uurreeks, lijstcellen, en van regels naar `GeplandeGroep[]`. Kent geen opslag en geen provider. |
| `lib/import-weekschema.test.ts` | **Nieuw.** De tests daarvan. |
| `lib/import-trainingen.ts` | `GeplandeGroep.duurMinuten` erbij; `spelersUitRegels` op een smaller type; `planImportLessen` kiest de lezer en geeft de duur per groep door. |
| `app/admin/trainingen-import.tsx` | Het seizoen en het herkende formaat tonen in de droogloop. |
| `providers/supabaseStore.ts` | Niets. `selectAllOptioneel<LesGroep>` neemt een nieuwe kolom vanzelf mee. |

`lib/import-trainingen.ts` is met 2443 regels al groot. Daarom komt de nieuwe lezer ernaast en
niet erin: het is een tweede formaat, geen uitbreiding van het eerste, en de twee delen alleen
hun uitkomsttype.

---

## Taak 1: het seizoen en de lesduur in de typen

**Bestanden:**
- Wijzigen: `lib/types.ts` (`Settings` rond regel 470, `LesGroep` rond regel 567)
- Wijzigen: `lib/import-trainingen.ts` (bij `lesduurVan`, regel 1118)
- Test: `lib/import-trainingen.test.ts`

- [ ] **Stap 1: schrijf de falende test**

In `lib/import-trainingen.test.ts`, bij de andere `lesduurVan`-tests:

```ts
describe('seizoenUitSettings', () => {
  it('leest het seizoen uit de clubinstellingen', () => {
    expect(seizoenUitSettings({ season_start: '2026-09-07', season_end: '2027-06-30' }))
      .toEqual({ van: '2026-09-07', tot: '2027-06-30' });
  });

  it('geeft null als het seizoen niet ingesteld is', () => {
    expect(seizoenUitSettings({})).toBeNull();
  });

  it('geeft null bij een half seizoen: één datum zonder de andere is geen periode', () => {
    expect(seizoenUitSettings({ season_start: '2026-09-07' })).toBeNull();
    expect(seizoenUitSettings({ season_end: '2027-06-30' })).toBeNull();
  });

  it('geeft null als het einde voor het begin ligt', () => {
    expect(seizoenUitSettings({ season_start: '2027-06-30', season_end: '2026-09-07' }))
      .toBeNull();
  });

  it('geeft null bij een datum die geen jjjj-mm-dd is', () => {
    expect(seizoenUitSettings({ season_start: '7 september', season_end: '2027-06-30' }))
      .toBeNull();
  });
});
```

Voeg `seizoenUitSettings` toe aan de bestaande import bovenaan het testbestand.

- [ ] **Stap 2: draai de test en zie hem falen**

Run: `npx jest lib/import-trainingen.test.ts -t seizoenUitSettings`
Verwacht: FAIL, `seizoenUitSettings is not a function`.

- [ ] **Stap 3: schrijf de implementatie**

In `lib/types.ts`, in `Settings`, achter `lesson_duration_minutes`:

```ts
  /**
   * De eerste lesdag van het seizoen, als jjjj-mm-dd — dezelfde dagsleutel als `Vakantie.van`.
   *
   * WAAROM DIT NAAST DE VAKANTIES STAAT. De clubkalender kleurt de dagen zonder les rood en de
   * dagen buiten het seizoen wit. Alleen het rood zit in `vakanties`; het wit is geen vakantie
   * maar een rand, en dat verschil kon de databank niet uitdrukken. De importer van het
   * weekschema heeft die rand nodig: het bestand is een weekschema zonder één datum, en zonder
   * begin en einde zou hij het seizoen moeten raden.
   *
   * Optioneel, en afwezig betekent "nog niet ingesteld" — net als `vakanties` en
   * `lesson_duration_minutes`. De app doet dan wat ze deed voordat dit bestond.
   */
  season_start?: string;
  /** De laatste lesdag van het seizoen, meegerekend. */
  season_end?: string;
```

In `lib/types.ts`, in `LesGroep`, achter `start_minute`:

```ts
  /**
   * Hoe lang een les van deze groep duurt, in minuten. Leeg = de lesduur van de club.
   *
   * De club werkt met 60 minuten, en voor 188 van haar 192 groepen klopt dat. Twee groepen
   * duren 30 minuten en twee 90; dat staat in de kolom `Uur` van de clublijst als een reeks
   * ("16:00 - 17:00"). Zonder dit veld ging die duur bij het inlezen verloren en stonden die
   * vier groepen op 60 minuten in de agenda.
   *
   * Leeg en niet "60": zo hoeft geen enkele bestaande groep aangeraakt te worden, en verandert
   * een gewijzigde clubinstelling nog steeds alles behalve de vier uitzonderingen.
   */
  duration_minutes?: number;
```

In `lib/import-trainingen.ts`, direct onder `lesduurVan`:

```ts
/** Het seizoen als twee dagsleutels; `null` zolang de club het niet ingesteld heeft. */
export interface Seizoen {
  van: string;
  tot: string;
}

/** Een dagsleutel jjjj-mm-dd, en niets anders. Dezelfde vorm als `Vakantie.van`. */
const DAGSLEUTEL = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Het seizoen uit de clubinstellingen, of `null` als het er niet bruikbaar in staat.
 *
 * Eén ingang, zodat elke plek die het seizoen nodig heeft dezelfde afwezigheid ziet. `null` is
 * hier geen fout maar een toestand: een club die het nog niet ingesteld heeft, hoort dat te
 * lezen te krijgen in plaats van een verzonnen jaartal te zien.
 *
 * Een half seizoen telt als afwezig. Eén datum zonder de andere kan `lessenUitGroep` niets mee,
 * en hem aanvullen met een gok is precies wat dit veld moest wegnemen.
 */
export function seizoenUitSettings(
  settings: Pick<Settings, 'season_start' | 'season_end'>,
): Seizoen | null {
  const van = (settings.season_start ?? '').trim();
  const tot = (settings.season_end ?? '').trim();
  if (!DAGSLEUTEL.test(van) || !DAGSLEUTEL.test(tot)) return null;
  if (tot < van) return null;
  return { van, tot };
}
```

- [ ] **Stap 4: draai de tests**

Run: `npx jest lib/import-trainingen.test.ts -t seizoenUitSettings && npx tsc --noEmit`
Verwacht: PASS, en tsc exit 0.

- [ ] **Stap 5: commit**

```bash
git add lib/types.ts lib/import-trainingen.ts lib/import-trainingen.test.ts
git commit -m "feat(import): het seizoen en de lesduur per groep in de typen"
```

---

## Taak 2: de weekdagcel lezen

**Bestanden:**
- Aanmaken: `lib/import-weekschema.ts`
- Aanmaken: `lib/import-weekschema.test.ts`

- [ ] **Stap 1: schrijf de falende test**

```ts
import { leesWeekdagCel } from './import-weekschema';

describe('leesWeekdagCel', () => {
  it('leest de zeven dagen, met zondag = 0 zoals LesGroep.weekday', () => {
    expect(leesWeekdagCel('zondag')).toBe(0);
    expect(leesWeekdagCel('maandag')).toBe(1);
    expect(leesWeekdagCel('dinsdag')).toBe(2);
    expect(leesWeekdagCel('woensdag')).toBe(3);
    expect(leesWeekdagCel('donderdag')).toBe(4);
    expect(leesWeekdagCel('vrijdag')).toBe(5);
    expect(leesWeekdagCel('zaterdag')).toBe(6);
  });

  it('trekt zich niets aan van hoofdletters en spaties', () => {
    expect(leesWeekdagCel('  Woensdag ')).toBe(3);
    expect(leesWeekdagCel('WOENSDAG')).toBe(3);
  });

  it('leest de afkortingen die de club gebruikt', () => {
    expect(leesWeekdagCel('wo')).toBe(3);
    expect(leesWeekdagCel('za')).toBe(6);
    expect(leesWeekdagCel('do')).toBe(4);
  });

  it('geeft null bij iets dat geen weekdag is', () => {
    expect(leesWeekdagCel('')).toBeNull();
    expect(leesWeekdagCel('woensdagavond')).toBeNull();
    expect(leesWeekdagCel('3')).toBeNull();
  });
});
```

- [ ] **Stap 2: draai de test en zie hem falen**

Run: `npx jest lib/import-weekschema.test.ts`
Verwacht: FAIL, "Cannot find module './import-weekschema'".

- [ ] **Stap 3: schrijf de implementatie**

Maak `lib/import-weekschema.ts` aan met de kopregel-uitleg en deze functie:

```ts
// De clublijst lezen: het tweede importformaat.
//
// WAAROM DIT NAAST lib/import-trainingen BESTAAT. Dat bestand leest het sjabloon van de app:
// één regel per les per leerling, met een datum. De club levert iets anders aan — één regel per
// groep, met de spelers komma-gescheiden in één cel, en zonder één datum. Het is een weekschema;
// de lessen volgen uit de clubkalender.
//
// De twee formaten delen hun uitkomst en niets anders. Deze module vertaalt naar `GeplandeGroep`
// uit lib/import-trainingen, en daar houdt het op: alles wat daarna komt — spelers, koppelingen,
// `lessenUitGroep`, het plan, de droogloop — kent geen formaat en werkt voor allebei. Vandaar dat
// dit een aparte module is en geen tak in de bestaande lezer: het enige wat ze gemeen hebben is
// het punt waar ze samenkomen.
//
// Deze module schrijft niets weg en kent geen provider: rijen tekst gaan erin, geplande groepen
// komen eruit. Zo blijft ze testbaar zonder databank, net als de rest van lib/.

/**
 * De Nederlandse weekdagen, zondag = 0 — dezelfde telling als `LesGroep.weekday` en
 * `Date#getDay`. De afkortingen staan erbij omdat de club ze in haar eigen lijst gebruikt.
 */
const WEEKDAGEN = new Map<string, number>([
  ['zondag', 0], ['zo', 0],
  ['maandag', 1], ['ma', 1],
  ['dinsdag', 2], ['di', 2],
  ['woensdag', 3], ['wo', 3],
  ['donderdag', 4], ['do', 4],
  ['vrijdag', 5], ['vr', 5],
  ['zaterdag', 6], ['za', 6],
]);

/**
 * De weekdag uit een cel, of `null` als er iets anders staat.
 *
 * `null` en geen 0: zondag ís 0, en een fout die als zondag binnenkomt zou 192 groepen op de
 * verkeerde dag kunnen zetten zonder dat er iets van te zien is.
 */
export function leesWeekdagCel(waarde: string): number | null {
  const sleutel = waarde.trim().toLowerCase();
  if (!sleutel) return null;
  const dag = WEEKDAGEN.get(sleutel);
  return dag === undefined ? null : dag;
}
```

- [ ] **Stap 4: draai de tests**

Run: `npx jest lib/import-weekschema.test.ts && npx tsc --noEmit`
Verwacht: PASS, tsc exit 0.

- [ ] **Stap 5: commit**

```bash
git add lib/import-weekschema.ts lib/import-weekschema.test.ts
git commit -m "feat(weekschema): de weekdagcel lezen"
```

---

## Taak 3: de uurreeks lezen — begintijd én lesduur

**Bestanden:**
- Wijzigen: `lib/import-weekschema.ts`
- Wijzigen: `lib/import-weekschema.test.ts`

- [ ] **Stap 1: schrijf de falende test**

```ts
import { leesUurReeksCel } from './import-weekschema';

describe('leesUurReeksCel', () => {
  it('leest begin, einde en de duur ertussen', () => {
    expect(leesUurReeksCel('16:00 - 17:00'))
      .toEqual({ uur: 16, minuut: 0, duurMinuten: 60 });
  });

  it('leest de twee afwijkende duren van de club', () => {
    expect(leesUurReeksCel('09:00 - 09:30'))
      .toEqual({ uur: 9, minuut: 0, duurMinuten: 30 });
    expect(leesUurReeksCel('19:00 - 20:30'))
      .toEqual({ uur: 19, minuut: 0, duurMinuten: 90 });
  });

  it('trekt zich niets aan van de spaties en het soort streepje', () => {
    expect(leesUurReeksCel('16:00-17:00')?.duurMinuten).toBe(60);
    expect(leesUurReeksCel('16:00 – 17:00')?.duurMinuten).toBe(60);
    expect(leesUurReeksCel('  16.00 tot 17.00  ')?.duurMinuten).toBe(60);
  });

  it('leest een half uur begintijd mee', () => {
    expect(leesUurReeksCel('17:30 - 18:30'))
      .toEqual({ uur: 17, minuut: 30, duurMinuten: 60 });
  });

  it('neemt een enkel uur zonder einde aan, zonder duur', () => {
    expect(leesUurReeksCel('16:00')).toEqual({ uur: 16, minuut: 0, duurMinuten: null });
  });

  it('geeft null bij een lege of onleesbare cel', () => {
    expect(leesUurReeksCel('')).toBeNull();
    expect(leesUurReeksCel('avond')).toBeNull();
    expect(leesUurReeksCel('25:00 - 26:00')).toBeNull();
  });

  it('geeft null als het einde niet na het begin ligt', () => {
    expect(leesUurReeksCel('17:00 - 16:00')).toBeNull();
    expect(leesUurReeksCel('17:00 - 17:00')).toBeNull();
  });
});
```

- [ ] **Stap 2: draai de test en zie hem falen**

Run: `npx jest lib/import-weekschema.test.ts -t leesUurReeksCel`
Verwacht: FAIL, `leesUurReeksCel is not a function`.

- [ ] **Stap 3: schrijf de implementatie**

Bovenaan `lib/import-weekschema.ts`:

```ts
import { leesUurCel } from './import-trainingen';
```

En erbij:

```ts
/** Wat er in de kolom `Uur` staat: waar de les begint, en hoe lang hij duurt. */
export interface UurReeks {
  uur: number;
  minuut: number;
  /**
   * De duur in minuten, of `null` als de cel alleen een begintijd gaf. `null` betekent "de
   * lesduur van de club" en niet "nul minuten"; het onderscheid is precies waarom dit veld
   * bestaat.
   */
  duurMinuten: number | null;
}

/**
 * De scheiding tussen begin en einde: een streepje in drie schrijfwijzen, of het woord "tot".
 * Het en-streepje staat erbij omdat Excel het koppelteken graag automatisch vervangt.
 */
const REEKSSCHEIDING = /\s*(?:-|–|—|tot)\s*/;

/**
 * De begintijd en de lesduur uit één cel als `16:00 - 17:00`.
 *
 * De duur staat hier en niet in de clubinstelling omdat het bestand hem geeft: 188 groepen van
 * de club duren 60 minuten, twee 30 en twee 90. Die vier gingen zonder deze functie verloren.
 *
 * `leesUurCel` uit lib/import-trainingen doet het lezen van één tijdstip, en dat blijft de enige
 * plek die dat kan — hier komt geen tweede versie van. Wat deze functie toevoegt is de reeks:
 * hem doormidden hakken en het verschil uitrekenen.
 */
export function leesUurReeksCel(waarde: string): UurReeks | null {
  const tekst = waarde.trim();
  if (!tekst) return null;
  const delen = tekst.split(REEKSSCHEIDING).filter((d) => d.length > 0);
  const begin = leesUurCel(delen[0] ?? '');
  if (!begin) return null;
  if (delen.length < 2) return { uur: begin.uur, minuut: begin.minuut, duurMinuten: null };
  const einde = leesUurCel(delen[1]);
  if (!einde) return null;
  const duurMinuten = (einde.uur * 60 + einde.minuut) - (begin.uur * 60 + begin.minuut);
  // Een les die eindigt voor hij begint is geen les over middernacht maar een tikfout: de club
  // geeft geen les om half een 's nachts. Hem doorlaten zou een negatieve duur opleveren en dat
  // maakt `lessenUitGroep` stil kapot.
  if (duurMinuten <= 0) return null;
  return { uur: begin.uur, minuut: begin.minuut, duurMinuten };
}
```

- [ ] **Stap 4: draai de tests**

Run: `npx jest lib/import-weekschema.test.ts && npx tsc --noEmit`
Verwacht: PASS, tsc exit 0.

- [ ] **Stap 5: commit**

```bash
git add lib/import-weekschema.ts lib/import-weekschema.test.ts
git commit -m "feat(weekschema): de uurreeks lezen, met de lesduur erin"
```

---

## Taak 4: de lijstcellen lezen — spelers, trainers, terreinen

**Bestanden:**
- Wijzigen: `lib/import-weekschema.ts`
- Wijzigen: `lib/import-weekschema.test.ts`

- [ ] **Stap 1: schrijf de falende test**

```ts
import { leesLijstCel } from './import-weekschema';

describe('leesLijstCel', () => {
  it('splitst op komma en haalt de spaties eraf', () => {
    expect(leesLijstCel('Devries Ann, Lasoen Bart'))
      .toEqual(['Devries Ann', 'Lasoen Bart']);
  });

  it('splitst ook op puntkomma en op een nieuwe regel', () => {
    expect(leesLijstCel('Terrein 10; Terrein 11')).toEqual(['Terrein 10', 'Terrein 11']);
    expect(leesLijstCel('Jan Jansen\nPiet Peeters')).toEqual(['Jan Jansen', 'Piet Peeters']);
  });

  it('laat lege stukken weg, ook bij een komma aan het eind', () => {
    expect(leesLijstCel('Jan Jansen, , Piet Peeters,')).toEqual(['Jan Jansen', 'Piet Peeters']);
  });

  it('ontdubbelt dezelfde naam, ongeacht hoofdletters', () => {
    expect(leesLijstCel('Jan Jansen, jan jansen')).toEqual(['Jan Jansen']);
  });

  it('geeft een lege lijst bij een lege cel', () => {
    expect(leesLijstCel('')).toEqual([]);
    expect(leesLijstCel('   ')).toEqual([]);
  });

  it('houdt één naam heel als er geen scheiding in staat', () => {
    expect(leesLijstCel('Devries Ann')).toEqual(['Devries Ann']);
  });
});
```

- [ ] **Stap 2: draai de test en zie hem falen**

Run: `npx jest lib/import-weekschema.test.ts -t leesLijstCel`
Verwacht: FAIL, `leesLijstCel is not a function`.

- [ ] **Stap 3: schrijf de implementatie**

```ts
/** Komma, puntkomma of een regeleinde; alle drie komen ze in de clublijst voor. */
const LIJSTSCHEIDING = /[,;\r\n]+/;

/**
 * Eén cel met meerdere waarden erin, uit elkaar gehaald.
 *
 * Dit is het hart van het verschil met het eerste formaat: daar stond één leerling per regel,
 * hier staan er zeven in één vakje. De volgorde blijft die van het bestand — bij `Trainer(s)`
 * en `Terrein(en)` wint de eerste, en dat mag geen kwestie van toeval zijn.
 *
 * Ontdubbelen gebeurt op kleine letters, want "Jan Jansen" en "jan jansen" zijn in dezelfde cel
 * dezelfde persoon. Wat er teruggegeven wordt is wél de schrijfwijze zoals ze in het bestand
 * stond: die gaat straks in een ledenkaart staan.
 */
export function leesLijstCel(waarde: string): string[] {
  const uit: string[] = [];
  const gezien = new Set<string>();
  for (const stuk of waarde.split(LIJSTSCHEIDING)) {
    const naam = stuk.trim();
    if (!naam) continue;
    const sleutel = naam.toLowerCase();
    if (gezien.has(sleutel)) continue;
    gezien.add(sleutel);
    uit.push(naam);
  }
  return uit;
}
```

- [ ] **Stap 4: draai de tests**

Run: `npx jest lib/import-weekschema.test.ts && npx tsc --noEmit`
Verwacht: PASS, tsc exit 0.

- [ ] **Stap 5: commit**

```bash
git add lib/import-weekschema.ts lib/import-weekschema.test.ts
git commit -m "feat(weekschema): een cel met meerdere waarden uit elkaar halen"
```

---

## Taak 5: de koprij herkennen en de twee formaten uit elkaar houden

**Bestanden:**
- Wijzigen: `lib/import-weekschema.ts`
- Wijzigen: `lib/import-weekschema.test.ts`

- [ ] **Stap 1: schrijf de falende test**

```ts
import { leesKopregelWeekschema, isWeekschema } from './import-weekschema';

describe('leesKopregelWeekschema', () => {
  const kop = ['Doelgroep', 'Groep', 'Weekdag', 'Uur', 'Terrein(en)', 'Trainer(s)', 'Speler(s)'];

  it('wijst de zeven kolommen aan', () => {
    expect(leesKopregelWeekschema(kop).kolommen).toEqual({
      doelgroep: 0, groep: 1, weekdag: 2, uur: 3, terreinen: 4, trainers: 5, spelers: 6,
    });
  });

  it('trekt zich niets aan van hoofdletters, spaties en de haakjes', () => {
    const anders = ['doel groep', 'GROEP', 'week dag', 'uur', 'Terreinen', 'Trainers', 'Spelers'];
    expect(leesKopregelWeekschema(anders).kolommen).toEqual({
      doelgroep: 0, groep: 1, weekdag: 2, uur: 3, terreinen: 4, trainers: 5, spelers: 6,
    });
  });

  it('geeft geen kolommen als een verplichte kop ontbreekt', () => {
    const zonderUur = ['Doelgroep', 'Groep', 'Weekdag', 'Terrein(en)', 'Trainer(s)', 'Speler(s)'];
    expect(leesKopregelWeekschema(zonderUur).kolommen).toBeNull();
  });

  it('meldt een kop die twee keer staat', () => {
    expect(leesKopregelWeekschema([...kop, 'Groep']).dubbel).toEqual(['Groep']);
  });

  it('meldt een kop die niemand kent, zonder erover te vallen', () => {
    const uitkomst = leesKopregelWeekschema([...kop, 'Opmerking']);
    expect(uitkomst.nietHerkend).toEqual(['Opmerking']);
    expect(uitkomst.kolommen).not.toBeNull();
  });
});

describe('isWeekschema', () => {
  it('herkent de clublijst', () => {
    expect(isWeekschema(
      ['Doelgroep', 'Groep', 'Weekdag', 'Uur', 'Terrein(en)', 'Trainer(s)', 'Speler(s)'],
    )).toBe(true);
  });

  it('herkent het sjabloon van de app niet als weekschema', () => {
    expect(isWeekschema(['Datum', 'Uur', 'Groep', 'Coach', 'Leerling'])).toBe(false);
  });

  it('is geen weekschema zonder Weekdag, ook al staat Speler(s) er', () => {
    expect(isWeekschema(['Groep', 'Uur', 'Speler(s)'])).toBe(false);
  });
});
```

- [ ] **Stap 2: draai de test en zie hem falen**

Run: `npx jest lib/import-weekschema.test.ts -t Weekschema`
Verwacht: FAIL, `leesKopregelWeekschema is not a function`.

- [ ] **Stap 3: schrijf de implementatie**

```ts
/** Welke kolom waar staat. Alle zeven zijn verplicht: dit formaat komt uit één bron. */
export interface KolommenWeekschema {
  doelgroep: number;
  groep: number;
  weekdag: number;
  uur: number;
  terreinen: number;
  trainers: number;
  spelers: number;
}

/**
 * De koppen zoals de club ze spelt, met de schrijfwijzen die we aannemen. De kop wordt eerst
 * klein gemaakt, van spaties ontdaan — ook die er middenin — en van haakjes: `Terrein(en)`,
 * `Terreinen` en `terrein en` komen alle drie op `terreinen` uit.
 *
 * Een `Map` en geen object-literal, om dezelfde reden als in lib/import-trainingen: een gewoon
 * object erft van `Object.prototype`, dus `{}['constructor']` zou een kolom kunnen lijken.
 */
const WEEKSCHEMA_KOPPEN = new Map<string, keyof KolommenWeekschema>([
  ['doelgroep', 'doelgroep'],
  ['groep', 'groep'],
  ['weekdag', 'weekdag'],
  ['dag', 'weekdag'],
  ['uur', 'uur'],
  ['tijd', 'uur'],
  ['terreinen', 'terreinen'],
  ['terrein', 'terreinen'],
  ['baan', 'terreinen'],
  ['banen', 'terreinen'],
  ['trainers', 'trainers'],
  ['trainer', 'trainers'],
  ['coach', 'trainers'],
  ['spelers', 'spelers'],
  ['speler', 'spelers'],
  ['leerlingen', 'spelers'],
]);

/** Kop naar sleutel: klein, zonder spaties, zonder haakjes. */
function kopSleutel(kop: string): string {
  return kop.trim().toLowerCase().replace(/[()\s]/g, '');
}

export interface KopregelWeekschema {
  kolommen: KolommenWeekschema | null;
  nietHerkend: string[];
  dubbel: string[];
}

/**
 * De koprij van de clublijst lezen.
 *
 * Alle zeven kolommen zijn verplicht, anders dan bij het sjabloon van de app waar er vier
 * optioneel zijn. Dat is geen strengheid om de strengheid: dit formaat komt uit één export van
 * één club, en een ontbrekende kolom betekent hier dat het bestand iets anders is dan we denken
 * — niet dat de beheerder een vakje leegliet.
 */
export function leesKopregelWeekschema(kopregel: readonly string[]): KopregelWeekschema {
  const gevonden = new Map<keyof KolommenWeekschema, number>();
  const nietHerkend: string[] = [];
  const dubbel: string[] = [];
  kopregel.forEach((kop, index) => {
    const rauw = kop.trim();
    if (!rauw) return;
    const veld = WEEKSCHEMA_KOPPEN.get(kopSleutel(rauw));
    if (!veld) { nietHerkend.push(rauw); return; }
    if (gevonden.has(veld)) { dubbel.push(rauw); return; }
    gevonden.set(veld, index);
  });
  const velden: Array<keyof KolommenWeekschema> = [
    'doelgroep', 'groep', 'weekdag', 'uur', 'terreinen', 'trainers', 'spelers',
  ];
  if (velden.some((v) => !gevonden.has(v))) return { kolommen: null, nietHerkend, dubbel };
  return {
    kolommen: {
      doelgroep: gevonden.get('doelgroep')!,
      groep: gevonden.get('groep')!,
      weekdag: gevonden.get('weekdag')!,
      uur: gevonden.get('uur')!,
      terreinen: gevonden.get('terreinen')!,
      trainers: gevonden.get('trainers')!,
      spelers: gevonden.get('spelers')!,
    },
    nietHerkend,
    dubbel,
  };
}

/**
 * Is dit blad de clublijst, of het sjabloon van de app?
 *
 * Op `Weekdag` en niet op de zeven kolommen samen: een bestand waarin één kop verkeerd gespeld
 * is, hoort de nette foutmelding van de weekschemalezer te krijgen ("de koprij mist een
 * verplichte kolom") en niet stilzwijgend door de andere lezer beoordeeld te worden, die dan
 * over een ontbrekende `Datum` klaagt. `Weekdag` is bovendien het ene woord dat in het sjabloon
 * van de app niet voorkomt en er ook nooit in kan komen: dat sjabloon heeft datums.
 */
export function isWeekschema(kopregel: readonly string[]): boolean {
  return kopregel.some((kop) => {
    const sleutel = kopSleutel(kop);
    return WEEKSCHEMA_KOPPEN.get(sleutel) === 'weekdag';
  });
}
```

- [ ] **Stap 4: draai de tests**

Run: `npx jest lib/import-weekschema.test.ts && npx tsc --noEmit`
Verwacht: PASS, tsc exit 0.

- [ ] **Stap 5: commit**

```bash
git add lib/import-weekschema.ts lib/import-weekschema.test.ts
git commit -m "feat(weekschema): de koprij lezen en de twee formaten uit elkaar houden"
```

---

## Taak 6: van rijen naar leesbare regels

**Bestanden:**
- Wijzigen: `lib/import-weekschema.ts`
- Wijzigen: `lib/import-weekschema.test.ts`

- [ ] **Stap 1: schrijf de falende test**

```ts
import { leesWeekRegels } from './import-weekschema';

const KOP = ['Doelgroep', 'Groep', 'Weekdag', 'Uur', 'Terrein(en)', 'Trainer(s)', 'Speler(s)'];
const rij = (
  doelgroep: string, groep: string, dag: string, uur: string,
  terrein: string, trainer: string, spelers: string,
) => [doelgroep, groep, dag, uur, terrein, trainer, spelers];

describe('leesWeekRegels', () => {
  it('leest een gewone regel helemaal uit', () => {
    const uit = leesWeekRegels([
      KOP,
      rij('Kidstennis blauw', 'Blauw - Groep 1', 'woensdag', '14:00 - 15:00',
        'Terrein 7', 'Devries Ann', 'Jan Jansen, Piet Peeters'),
    ]);
    expect(uit.fouten).toEqual([]);
    expect(uit.regels).toEqual([{
      regel: 2,
      doelgroep: 'Kidstennis blauw',
      groep: 'Blauw - Groep 1',
      weekdag: 3,
      beginuur: 14,
      beginminuut: 0,
      duurMinuten: 60,
      terreinen: ['Terrein 7'],
      trainers: ['Devries Ann'],
      spelers: ['Jan Jansen', 'Piet Peeters'],
    }]);
  });

  it('leest meerdere terreinen en meerdere trainers als lijst', () => {
    const uit = leesWeekRegels([
      KOP,
      rij('Kidstennis wit', 'Wit - Groep 1', 'zaterdag', '09:00 - 10:00',
        'Terrein 10, Terrein 11', 'Devries Ann, Lasoen Bart', 'Jan Jansen'),
    ]);
    expect(uit.regels[0].terreinen).toEqual(['Terrein 10', 'Terrein 11']);
    expect(uit.regels[0].trainers).toEqual(['Devries Ann', 'Lasoen Bart']);
  });

  it('laat een groep zonder spelers door: dat zijn er twee in de echte lijst', () => {
    const uit = leesWeekRegels([
      KOP,
      rij('Tienertennis', 'Tieners - Groep 2', 'vrijdag', '18:00 - 19:00',
        'Terrein 8', 'Lasoen Bart', ''),
    ]);
    expect(uit.fouten).toEqual([]);
    expect(uit.regels[0].spelers).toEqual([]);
  });

  it('slaat een lege rij stil over', () => {
    const uit = leesWeekRegels([KOP, ['', '', '', '', '', '', '']]);
    expect(uit.regels).toEqual([]);
    expect(uit.fouten).toEqual([]);
  });

  it('meldt een onleesbare weekdag met het regelnummer uit Excel', () => {
    const uit = leesWeekRegels([
      KOP,
      rij('Kidstennis rood', 'Rood - Groep 3', 'ergens', '14:00 - 15:00',
        'Terrein 7', 'Devries Ann', 'Jan Jansen'),
    ]);
    expect(uit.regels).toEqual([]);
    expect(uit.fouten).toHaveLength(1);
    expect(uit.fouten[0].regel).toBe(2);
    expect(uit.fouten[0].vars).toEqual({ waarde: 'ergens' });
  });

  it('geeft één melding per stukgelopen regel en niet meer', () => {
    const uit = leesWeekRegels([
      KOP,
      rij('Kidstennis rood', '', 'ergens', 'ook niet', '', '', ''),
    ]);
    expect(uit.fouten).toHaveLength(1);
  });

  it('meldt een leeg bestand', () => {
    expect(leesWeekRegels([]).fouten).toHaveLength(1);
  });

  it('meldt een koprij zonder verplichte kolom, mét de lijstjes erbij', () => {
    const uit = leesWeekRegels([['Groep', 'Uur', 'Onbekend']]);
    expect(uit.regels).toEqual([]);
    expect(uit.fouten).toHaveLength(1);
    expect(uit.nietHerkend).toEqual(['Onbekend']);
  });
});
```

- [ ] **Stap 2: draai de test en zie hem falen**

Run: `npx jest lib/import-weekschema.test.ts -t leesWeekRegels`
Verwacht: FAIL, `leesWeekRegels is not a function`.

- [ ] **Stap 3: schrijf de implementatie**

```ts
import type { ImportFoutLessen } from './import-trainingen';

/** Eén regel van de clublijst: één groep, met alles wat erover in het bestand staat. */
export interface WeekRegel {
  /** Het regelnummer zoals de beheerder het in Excel ziet: de koprij is regel 1. */
  regel: number;
  doelgroep: string;
  groep: string;
  /** 0-6 met zondag = 0, dezelfde telling als `LesGroep.weekday`. */
  weekdag: number;
  beginuur: number;
  beginminuut: number;
  /** `null` als de cel geen einde gaf; dan geldt de lesduur van de club. */
  duurMinuten: number | null;
  terreinen: string[];
  trainers: string[];
  spelers: string[];
}

export interface GelezenWeekschema {
  regels: WeekRegel[];
  fouten: ImportFoutLessen[];
  nietHerkend: string[];
  dubbel: string[];
}

/**
 * Het hele blad, van rauwe teksten naar regels met betekenis. Schrijft niets weg en kijkt naar
 * niets buiten dit bestand: of de trainer bestaat en welke groep dit wordt, is de volgende stap.
 *
 * Eén regel in het bestand leidt tot precies één mededeling, net als in `leesLesRegels`: een rij
 * die op de weekdag sneuvelt krijgt er geen tweede melding over het uur bovenop. Bij 192 regels
 * is dat het verschil tussen een lijstje dat je naloopt en een muur die je wegklikt.
 */
export function leesWeekRegels(rijen: ReadonlyArray<readonly string[]>): GelezenWeekschema {
  const uit: GelezenWeekschema = { regels: [], fouten: [], nietHerkend: [], dubbel: [] };
  if (rijen.length === 0) {
    uit.fouten.push({ regel: 1, reden: 'Dit bestand is leeg.' });
    return uit;
  }

  // Eerst overnemen, dán pas afhaken: juist als de koprij niet deugt, heeft de beheerder die
  // lijstjes nodig — dat is het geval waarin hij zijn bestand moet aanpassen.
  const kop = leesKopregelWeekschema(rijen[0]);
  uit.nietHerkend = kop.nietHerkend;
  uit.dubbel = kop.dubbel;
  const { kolommen } = kop;
  if (!kolommen) {
    uit.fouten.push({
      regel: 1,
      reden: 'De koprij mist een verplichte kolom: Doelgroep, Groep, Weekdag, Uur, Terrein(en), Trainer(s) of Speler(s).',
    });
    return uit;
  }

  for (let i = 1; i < rijen.length; i++) {
    const rij = rijen[i];
    const regel = i + 1;
    const cel = (index: number): string => (rij[index] ?? '').trim();

    // Een rij waarvan alle cellen leeg zijn is geen vergissing: Excel houdt gewiste rijen nog
    // een tijdje vast, en tussen twee doelgroepen staat weleens een witregel.
    if (rij.every((c) => !c || !c.trim())) continue;

    const dagCel = cel(kolommen.weekdag);
    const weekdag = leesWeekdagCel(dagCel);
    if (weekdag === null) {
      uit.fouten.push({
        regel,
        reden: 'Deze weekdag kon niet gelezen worden: {waarde}',
        vars: { waarde: dagCel },
      });
      continue;
    }

    const uurCel = cel(kolommen.uur);
    const reeks = leesUurReeksCel(uurCel);
    if (!reeks) {
      uit.fouten.push({
        regel,
        reden: 'Dit uur kon niet gelezen worden: {waarde}',
        vars: { waarde: uurCel },
      });
      continue;
    }

    // De trainer wordt alleen op leeg gecontroleerd, niet op bestaan: of deze naam een trainer
    // van de club is, weet dit bestand niet en dat hoort bij het plan (D-07).
    const trainers = leesLijstCel(cel(kolommen.trainers));
    if (trainers.length === 0) {
      uit.fouten.push({ regel, reden: 'Geen trainer ingevuld.' });
      continue;
    }

    // Een lege `Speler(s)` is uitdrukkelijk géén fout: er staan twee zulke groepen in de echte
    // clublijst. De groep komt er gewoon, met een leeg rooster.
    uit.regels.push({
      regel,
      doelgroep: cel(kolommen.doelgroep),
      groep: cel(kolommen.groep),
      weekdag,
      beginuur: reeks.uur,
      beginminuut: reeks.minuut,
      duurMinuten: reeks.duurMinuten,
      terreinen: leesLijstCel(cel(kolommen.terreinen)),
      trainers,
      spelers: leesLijstCel(cel(kolommen.spelers)),
    });
  }

  return uit;
}
```

- [ ] **Stap 4: draai de tests**

Run: `npx jest lib/import-weekschema.test.ts && npx tsc --noEmit`
Verwacht: PASS, tsc exit 0.

- [ ] **Stap 5: commit**

```bash
git add lib/import-weekschema.ts lib/import-weekschema.test.ts
git commit -m "feat(weekschema): van rijen naar regels, met één melding per regel"
```

---

## Taak 7: de sleutel, met de groepsnaam als tiebreak

**Bestanden:**
- Wijzigen: `lib/import-weekschema.ts`
- Wijzigen: `lib/import-weekschema.test.ts`

Dit is de beslissing van de gebruiker: **weekdag + beginuur + terrein**, en de groepsnaam komt er
alléén bij op de momenten waar dat anders botst. Op de echte lijst botsen vijf momenten (alle
vijf Terrein 7, het kleutertennis); met de naam erbij nul. Zou de naam er altijd in zitten, dan
zou hernoemen voor de 187 andere groepen een nieuwe groep opleveren in plaats van een wijziging.

- [ ] **Stap 1: schrijf de falende test**

```ts
import { weekSleutels } from './import-weekschema';

const basis = {
  regel: 2, doelgroep: '', weekdag: 3, beginuur: 14, beginminuut: 0,
  duurMinuten: 60, trainers: ['Devries Ann'], spelers: [],
};

describe('weekSleutels', () => {
  it('gebruikt weekdag, uur en terrein als er niets botst', () => {
    const sleutels = weekSleutels([
      { ...basis, groep: 'Blauw 1', terreinen: ['Terrein 7'] },
      { ...basis, weekdag: 6, groep: 'Rood 1', terreinen: ['Terrein 7'] },
    ]);
    expect(sleutels).toEqual(['3|14|terrein 7', '6|14|terrein 7']);
  });

  it('zet de groepsnaam erbij zodra twee regels op dezelfde sleutel vallen', () => {
    const sleutels = weekSleutels([
      { ...basis, groep: 'Blauw 1', terreinen: ['Terrein 7'] },
      { ...basis, groep: 'Rood 3', terreinen: ['Terrein 7'] },
    ]);
    expect(sleutels).toEqual(['3|14|terrein 7|blauw 1', '3|14|terrein 7|rood 3']);
  });

  it('laat de 187 andere groepen ongemoeid als er ergens anders wél botst', () => {
    const sleutels = weekSleutels([
      { ...basis, groep: 'Blauw 1', terreinen: ['Terrein 7'] },
      { ...basis, groep: 'Rood 3', terreinen: ['Terrein 7'] },
      { ...basis, weekdag: 5, groep: 'Tieners 2', terreinen: ['Terrein 8'] },
    ]);
    expect(sleutels[2]).toBe('5|14|terrein 8');
  });

  it('gebruikt alleen het eerste terrein, want daar komt de groep te staan', () => {
    const sleutels = weekSleutels([
      { ...basis, groep: 'Wit 1', terreinen: ['Terrein 10', 'Terrein 11'] },
    ]);
    expect(sleutels).toEqual(['3|14|terrein 10']);
  });

  it('kan zonder terrein', () => {
    expect(weekSleutels([{ ...basis, groep: 'Blauw 1', terreinen: [] }])).toEqual(['3|14|']);
  });

  it('houdt twee regels die op alles gelijk zijn toch uit elkaar', () => {
    const sleutels = weekSleutels([
      { ...basis, groep: 'Blauw 1', terreinen: ['Terrein 7'] },
      { ...basis, groep: 'Blauw 1', terreinen: ['Terrein 7'] },
    ]);
    expect(sleutels[0]).not.toBe(sleutels[1]);
  });
});
```

- [ ] **Stap 2: draai de test en zie hem falen**

Run: `npx jest lib/import-weekschema.test.ts -t weekSleutels`
Verwacht: FAIL, `weekSleutels is not a function`.

- [ ] **Stap 3: schrijf de implementatie**

```ts
/** De sleutel zonder tiebreak: weekdag, beginuur en het eerste terrein. */
function grondSleutel(r: Pick<WeekRegel, 'weekdag' | 'beginuur' | 'terreinen'>): string {
  return `${r.weekdag}|${r.beginuur}|${(r.terreinen[0] ?? '').trim().toLowerCase()}`;
}

/**
 * De herkenningssleutel per regel, in dezelfde volgorde als de regels erin gingen.
 *
 * WAAROM DE NAAM ER NIET ALTIJD IN ZIT. De beslissing van de eigenaar: de sleutel is weekdag +
 * uur + terrein, en `Groep` komt er alleen bij als tiebreak. Op de echte clublijst botsen vijf
 * momenten — alle vijf Terrein 7, waar blauw, rood en het multimove samen op een halve baan
 * staan — en met de naam erbij nul. Zat de naam er altijd in, dan zou een groep die in de club
 * hernoemd wordt bij de volgende import als nieuwe groep terugkomen, en dat zou voor 187 groepen
 * gelden om vijf gevallen op te lossen.
 *
 * De beginminuut telt niet mee, net zomin als in `groepSleutel` van lib/lesgroepen: twee groepen
 * op 17:00 en 17:15 vallen samen. Dat is de bestaande, aanvaarde grofheid, en hier afwijken zou
 * de import iets anders laten herkennen dan de rest van de app.
 *
 * Blijven twee regels ook mét hun naam gelijk, dan krijgt de tweede er een volgnummer bij. Twee
 * identieke regels zijn een fout in het bestand, maar ze samen laten vallen zou stil één van de
 * twee groepen wegmaken; zo blijven ze allebei zichtbaar.
 */
export function weekSleutels(
  regels: ReadonlyArray<Pick<WeekRegel, 'weekdag' | 'beginuur' | 'terreinen' | 'groep'>>,
): string[] {
  const telling = new Map<string, number>();
  for (const r of regels) {
    const g = grondSleutel(r);
    telling.set(g, (telling.get(g) ?? 0) + 1);
  }
  const gebruikt = new Map<string, number>();
  return regels.map((r) => {
    const g = grondSleutel(r);
    const basis = (telling.get(g) ?? 0) > 1
      ? `${g}|${r.groep.trim().toLowerCase()}`
      : g;
    const eerder = gebruikt.get(basis) ?? 0;
    gebruikt.set(basis, eerder + 1);
    return eerder === 0 ? basis : `${basis}#${eerder + 1}`;
  });
}
```

- [ ] **Stap 4: draai de tests**

Run: `npx jest lib/import-weekschema.test.ts && npx tsc --noEmit`
Verwacht: PASS, tsc exit 0.

- [ ] **Stap 5: commit**

```bash
git add lib/import-weekschema.ts lib/import-weekschema.test.ts
git commit -m "feat(weekschema): de sleutel, met de groepsnaam alleen als tiebreak"
```

---

## Taak 8: van regels naar geplande groepen

**Bestanden:**
- Wijzigen: `lib/import-weekschema.ts`
- Wijzigen: `lib/import-trainingen.ts` (`GeplandeGroep` rond regel 489)
- Wijzigen: `lib/import-weekschema.test.ts`

- [ ] **Stap 1: schrijf de falende test**

```ts
import { groepenUitWeekRegels } from './import-weekschema';
import type { Court, LesGroep } from './types';

const SEIZOEN = { van: '2026-09-07', tot: '2027-06-30' };
const BANEN: Court[] = [
  { id: 'c7', name: 'Terrein 7', hourly_rate: 60 } as Court,
  { id: 'c8', name: 'Terrein 8', hourly_rate: 60 } as Court,
];
const regel = (over: Partial<WeekRegel> = {}): WeekRegel => ({
  regel: 2, doelgroep: 'Kidstennis blauw', groep: 'Blauw - Groep 1', weekdag: 3,
  beginuur: 14, beginminuut: 0, duurMinuten: 60, terreinen: ['Terrein 7'],
  trainers: ['Devries Ann'], spelers: ['Jan Jansen', 'Piet Peeters'], ...over,
});

describe('groepenUitWeekRegels', () => {
  it('maakt van één regel één groep', () => {
    const { groepen } = groepenUitWeekRegels([regel()], [], BANEN, SEIZOEN);
    expect(groepen).toHaveLength(1);
    expect(groepen[0]).toMatchObject({
      naam: 'Blauw - Groep 1',
      niveau: 'Kidstennis blauw',
      weekdag: 3,
      beginuur: 14,
      beginminuut: 0,
      duurMinuten: 60,
      coachNaam: 'Devries Ann',
      baanNaam: 'Terrein 7',
      seizoenVan: '2026-09-07',
      seizoenTot: '2027-06-30',
      leerlingNamen: ['Jan Jansen', 'Piet Peeters'],
      bestaand: null,
      viaGroepId: false,
    });
  });

  it('neemt het eerste terrein en meldt de rest', () => {
    const { groepen, waarschuwingen } = groepenUitWeekRegels(
      [regel({ terreinen: ['Terrein 10', 'Terrein 11'] })], [], BANEN, SEIZOEN,
    );
    expect(groepen[0].baanNaam).toBe('Terrein 10');
    expect(waarschuwingen).toHaveLength(1);
    expect(waarschuwingen[0].regel).toBe(2);
  });

  it('neemt de eerste trainer en meldt de rest', () => {
    const { groepen, waarschuwingen } = groepenUitWeekRegels(
      [regel({ trainers: ['Devries Ann', 'Lasoen Bart'] })], [], BANEN, SEIZOEN,
    );
    expect(groepen[0].coachNaam).toBe('Devries Ann');
    expect(waarschuwingen).toHaveLength(1);
  });

  it('maakt een groep zonder spelers aan, met een leeg rooster en zonder waarschuwing', () => {
    const { groepen, waarschuwingen } = groepenUitWeekRegels(
      [regel({ spelers: [] })], [], BANEN, SEIZOEN,
    );
    expect(groepen[0].leerlingNamen).toEqual([]);
    expect(waarschuwingen).toEqual([]);
  });

  it('herkent een bestaande groep op weekdag, uur en baan', () => {
    const bestaand: LesGroep = {
      id: 'g1', name: 'Blauw - Groep 1', level: 'Kidstennis blauw', weekday: 3,
      start_hour: 14, start_minute: 0, court_id: 'c7', season_start: '2026-09-07',
      season_end: '2027-06-30', roster: [], archived: false,
    };
    const { groepen } = groepenUitWeekRegels([regel()], [bestaand], BANEN, SEIZOEN);
    expect(groepen[0].bestaand?.id).toBe('g1');
  });

  it('herkent een gearchiveerde groep niet: archiveren was een bewuste daad', () => {
    const bestaand: LesGroep = {
      id: 'g1', name: 'Blauw - Groep 1', level: '', weekday: 3, start_hour: 14,
      start_minute: 0, court_id: 'c7', season_start: '2026-09-07', season_end: '2027-06-30',
      roster: [], archived: true,
    };
    const { groepen } = groepenUitWeekRegels([regel()], [bestaand], BANEN, SEIZOEN);
    expect(groepen[0].bestaand).toBeNull();
  });

  it('houdt twee groepen op hetzelfde terrein en uur uit elkaar via hun naam', () => {
    const { groepen } = groepenUitWeekRegels(
      [regel({ groep: 'Blauw - Groep 1' }), regel({ regel: 3, groep: 'Rood - Groep 3' })],
      [], BANEN, SEIZOEN,
    );
    expect(groepen).toHaveLength(2);
    expect(groepen[0].sleutel).not.toBe(groepen[1].sleutel);
  });

  it('meldt een terrein dat de club niet kent, en plant de groep zonder baan', () => {
    const { groepen, waarschuwingen } = groepenUitWeekRegels(
      [regel({ terreinen: ['Terrein 99'] })], [], BANEN, SEIZOEN,
    );
    expect(groepen[0].baanNaam).toBe('Terrein 99');
    expect(waarschuwingen.some((w) => w.regel === 2)).toBe(true);
  });

  it('laat duurMinuten leeg als de cel geen einde gaf', () => {
    const { groepen } = groepenUitWeekRegels(
      [regel({ duurMinuten: null })], [], BANEN, SEIZOEN,
    );
    expect(groepen[0].duurMinuten).toBeNull();
  });
});
```

- [ ] **Stap 2: draai de test en zie hem falen**

Run: `npx jest lib/import-weekschema.test.ts -t groepenUitWeekRegels`
Verwacht: FAIL, `groepenUitWeekRegels is not a function`.

- [ ] **Stap 3: schrijf de implementatie**

Eerst in `lib/import-trainingen.ts`, in `GeplandeGroep`, achter `beginminuut`:

```ts
  /**
   * De lesduur van deze groep in minuten, of `null` voor de lesduur van de club.
   *
   * Het sjabloon van de app geeft die niet — daar staat één begintijd per les — dus daar is dit
   * altijd `null`. De clublijst geeft een reeks (`16:00 - 17:00`) en daaruit volgt de duur; vier
   * van haar 192 groepen wijken af van de 60 minuten van de club.
   */
  duurMinuten: number | null;
```

Vul dat veld in `groepenUitRegels` in met `duurMinuten: null` waar `GeplandeGroep` opgebouwd
wordt (rond regel 846, bij `seizoenVan: emmer.seizoenVan`). Dan blijft het eerste formaat exact
doen wat het deed.

In `lib/import-weekschema.ts`:

```ts
import { actieveGroepen, groepSleutel } from './lesgroepen';
import { zoekBaan, type GeplandeGroep, type Seizoen } from './import-trainingen';
import type { Court, LesGroep } from './types';

/**
 * Van regels naar geplande groepen: de laatste stap die het formaat nog kent.
 *
 * Wat hier NIET gebeurt, en met opzet: de trainer opzoeken, de spelers aan leden koppelen, de
 * lessen inplannen. Dat doet `planImportLessen` voor allebei de formaten met dezelfde functies.
 * Deze functie levert `GeplandeGroep` op en daarmee houdt het verschil tussen de twee bestanden
 * op te bestaan.
 *
 * Het seizoen komt van buiten en niet uit het bestand, want het bestand heeft geen datums. Het
 * staat in de clubinstellingen sinds SEIZOEN-EN-LESDUUR.sql; `seizoenUitSettings` haalt het
 * eruit.
 */
export function groepenUitWeekRegels(
  regels: readonly WeekRegel[],
  bestaande: readonly LesGroep[],
  courts: readonly Court[],
  seizoen: Seizoen,
): { groepen: GeplandeGroep[]; waarschuwingen: ImportFoutLessen[] } {
  const waarschuwingen: ImportFoutLessen[] = [];

  // Gearchiveerde groepen tellen niet mee bij het herkennen — dezelfde regel als in
  // `groepenUitRegels`: archiveren was een bewuste daad van de club, en een import die zo'n
  // groep weer tot leven wekt maakt die daad ongedaan zonder het te vragen.
  const actief = actieveGroepen([...bestaande]);
  const opSleutel = new Map<string, LesGroep>();
  for (const g of actief) {
    // De eerste wint: twee actieve groepen op dezelfde sleutel mag, en welke van de twee we dan
    // kiezen is niet aan de import om stil te veranderen.
    if (!opSleutel.has(groepSleutel(g))) opSleutel.set(groepSleutel(g), g);
  }
  // Dezelfde tiebreak als in het bestand, maar dan over de bestaande groepen: botsen er twee op
  // hun grondsleutel, dan komt hun naam erbij. Zonder dit zou een bestand waarin het
  // kleutertennis mét naam gesleuteld is, nooit een bestaande groep terugvinden.
  const naamSleutel = new Map<string, LesGroep>();
  for (const g of actief) {
    naamSleutel.set(`${groepSleutel(g)}|${g.name.trim().toLowerCase()}`, g);
  }

  const sleutels = weekSleutels(regels);
  const groepen = regels.map((r, i) => {
    const sleutel = sleutels[i];
    const baanNaam = (r.terreinen[0] ?? '').trim();

    if (r.terreinen.length > 1) {
      waarschuwingen.push({
        regel: r.regel,
        reden: 'Deze groep staat op meerdere terreinen; ik zet haar op {baan}. De andere: {rest}.',
        vars: { baan: baanNaam, rest: r.terreinen.slice(1).join(', ') },
      });
    }
    if (r.trainers.length > 1) {
      waarschuwingen.push({
        regel: r.regel,
        reden: 'Deze groep heeft meerdere trainers; ik zet {trainer} erop. De andere: {rest}.',
        vars: { trainer: r.trainers[0], rest: r.trainers.slice(1).join(', ') },
      });
    }
    if (baanNaam && !zoekBaan(courts, baanNaam)) {
      waarschuwingen.push({
        regel: r.regel,
        reden: 'Dit terrein kent de club niet: {baan}. De groep komt er, maar zonder lessen tot je haar een baan geeft.',
        vars: { baan: baanNaam },
      });
    }

    // Eerst op de sleutel mét naam, dan op de grondsleutel. Die volgorde en niet andersom: een
    // bestand dat de naam nodig had om twee groepen uit elkaar te houden, moet ze ook allebei
    // kunnen terugvinden — anders wijzen ze straks naar dezelfde bestaande groep.
    const bestaandeGroep = naamSleutel.get(sleutel)
      ?? opSleutel.get(sleutel)
      ?? null;

    return {
      sleutel,
      bestaand: bestaandeGroep,
      // Dit formaat heeft geen kolom `Groep-ID`; het herkennen loopt uitsluitend via de sleutel.
      viaGroepId: false,
      naam: r.groep.trim() || groepsnaamUitMoment(r.weekdag, r.beginuur, r.beginminuut, baanNaam),
      niveau: r.doelgroep.trim(),
      weekdag: r.weekdag,
      beginuur: r.beginuur,
      beginminuut: r.beginminuut,
      duurMinuten: r.duurMinuten,
      coachNaam: r.trainers[0] ?? '',
      baanNaam,
      seizoenVan: seizoen.van,
      seizoenTot: seizoen.tot,
      leerlingNamen: r.spelers,
      // Dit formaat kent geen `LesRegel`. De pijplijn erna gebruikt `regels` alleen om naar een
      // regelnummer te wijzen, en dat zit al in de waarschuwingen hierboven.
      regels: [],
    } satisfies GeplandeGroep;
  });

  return { groepen, waarschuwingen };
}
```

Exporteer `groepsnaamUitMoment` en `zoekBaan` uit `lib/import-trainingen.ts` als dat nog niet zo
is (beide staan er al als `export function`).

- [ ] **Stap 4: draai de tests**

Run: `npx jest && npx tsc --noEmit`
Verwacht: alle suites groen. Loopt `lib/import-trainingen.test.ts` stuk op het nieuwe verplichte
veld `duurMinuten`, vul het daar in de verwachte objecten aan met `duurMinuten: null` — dat is
wat het eerste formaat oplevert.

- [ ] **Stap 5: commit**

```bash
git add lib/import-weekschema.ts lib/import-weekschema.test.ts lib/import-trainingen.ts lib/import-trainingen.test.ts
git commit -m "feat(weekschema): van regels naar geplande groepen"
```

---

## Taak 9: de spelerslezer op een smaller type

`spelersUitRegels` leest van een `LesRegel` alleen `regel`, `leerling` en `emailLeerling`. Het
weekschema heeft geen `LesRegel` — het heeft per groep een lijst namen zonder e-mail. Door het
type te versmallen werkt dezelfde functie voor allebei, in plaats van dat er een tweede komt die
straks anders gaat matchen.

**Bestanden:**
- Wijzigen: `lib/import-trainingen.ts` (`spelersUitRegels`, regel 964)
- Wijzigen: `lib/import-weekschema.test.ts`

- [ ] **Stap 1: schrijf de falende test**

```ts
import { spelersUitRegels } from './import-trainingen';
import { spelerRegelsUitWeek } from './import-weekschema';

describe('spelerRegelsUitWeek', () => {
  it('maakt van de spelers per groep één lijst voor spelersUitRegels', () => {
    const uit = spelerRegelsUitWeek([
      regel({ regel: 2, spelers: ['Jan Jansen', 'Piet Peeters'] }),
      regel({ regel: 3, spelers: ['Jan Jansen'] }),
    ]);
    expect(uit).toEqual([
      { regel: 2, leerling: 'Jan Jansen', emailLeerling: '' },
      { regel: 2, leerling: 'Piet Peeters', emailLeerling: '' },
      { regel: 3, leerling: 'Jan Jansen', emailLeerling: '' },
    ]);
  });

  it('levert samen met spelersUitRegels één speler per unieke naam', () => {
    const { spelers } = spelersUitRegels(spelerRegelsUitWeek([
      regel({ regel: 2, spelers: ['Jan Jansen', 'Piet Peeters'] }),
      regel({ regel: 3, spelers: ['jan jansen'] }),
    ]), []);
    expect(spelers.map((s) => s.naam)).toEqual(['Jan Jansen', 'Piet Peeters']);
  });
});
```

- [ ] **Stap 2: draai de test en zie hem falen**

Run: `npx jest lib/import-weekschema.test.ts -t spelerRegelsUitWeek`
Verwacht: FAIL, `spelerRegelsUitWeek is not a function`.

- [ ] **Stap 3: schrijf de implementatie**

In `lib/import-trainingen.ts`, de handtekening van `spelersUitRegels`:

```ts
/**
 * De drie velden die deze functie van een regel leest. Smal gehouden zodat het weekschema —
 * dat geen `LesRegel` kent, maar per groep een lijst namen — dezelfde spelerslezer kan
 * gebruiken. Eén plek die bepaalt wie een bestaand lid is en wie een nieuw, voor allebei de
 * formaten: een tweede zou vroeg of laat anders gaan matchen dan deze.
 */
export type SpelerRegel = Pick<LesRegel, 'regel' | 'leerling' | 'emailLeerling'>;

export function spelersUitRegels(
  regels: readonly SpelerRegel[],
  users: readonly User[],
): { spelers: GeplandeSpeler[]; waarschuwingen: ImportFoutLessen[] } {
```

De body blijft ongewijzigd. In `lib/import-weekschema.ts`:

```ts
import type { SpelerRegel } from './import-trainingen';

/**
 * De spelers van alle groepen als één platte lijst, zodat `spelersUitRegels` ze kan lezen.
 *
 * De volgorde is die van het bestand, en het regelnummer is dat van de groep waarin de speler
 * stond: een melding over "Jan Jansen" wijst dan naar de regel waar de beheerder hem ziet
 * staan. Ontdubbelen gebeurt hier niet — dat doet `spelersUitRegels` al, en het twee keer doen
 * zou betekenen dat twee plekken moeten blijven afspreken wat dezelfde naam is.
 *
 * De e-mail is altijd leeg: de clublijst heeft geen adreskolom. `spelersUitRegels` maakt daar
 * een lid zonder adres van, precies zoals bij een leeg vakje in het andere formaat.
 */
export function spelerRegelsUitWeek(regels: readonly WeekRegel[]): SpelerRegel[] {
  const uit: SpelerRegel[] = [];
  for (const r of regels) {
    for (const naam of r.spelers) {
      uit.push({ regel: r.regel, leerling: naam, emailLeerling: '' });
    }
  }
  return uit;
}
```

- [ ] **Stap 4: draai de tests**

Run: `npx jest && npx tsc --noEmit`
Verwacht: alles groen; `lib/import-trainingen.test.ts` hoort ongewijzigd te blijven slagen.

- [ ] **Stap 5: commit**

```bash
git add lib/import-trainingen.ts lib/import-weekschema.ts lib/import-weekschema.test.ts
git commit -m "refactor(import): één spelerslezer voor allebei de formaten"
```

---

## Taak 10: `planImportLessen` kiest de lezer en geeft de duur door

**Bestanden:**
- Wijzigen: `lib/import-trainingen.ts` (`planImportLessen`, regel 1742)
- Wijzigen: `lib/import-trainingen.test.ts`

- [ ] **Stap 1: schrijf de falende test**

In `lib/import-trainingen.test.ts`:

```ts
describe('planImportLessen met het clubweekschema', () => {
  const KOP = ['Doelgroep', 'Groep', 'Weekdag', 'Uur', 'Terrein(en)', 'Trainer(s)', 'Speler(s)'];
  const SETTINGS = {
    lesson_duration_minutes: 60,
    vakanties: [],
    season_start: '2026-09-07',
    season_end: '2026-09-30',
  };
  const NU = new Date('2026-09-06T12:00:00.000Z');

  it('leest het weekschema en plant de woensdagen van september in', () => {
    const plan = planImportLessen(
      [KOP, ['Kidstennis blauw', 'Blauw 1', 'woensdag', '14:00 - 15:00',
        'Terrein 7', 'Ann Devries', 'Jan Jansen']],
      [], [trainerAnn], [terrein7], [], SETTINGS, NU,
    );
    expect(plan.fouten).toEqual([]);
    expect(plan.groepenNieuw).toHaveLength(1);
    // Woensdag 9, 16, 23 en 30 september.
    expect(plan.nieuweLessen).toHaveLength(4);
  });

  it('gebruikt de duur uit het bestand en niet die van de club', () => {
    const plan = planImportLessen(
      [KOP, ['Kidstennis wit', 'Wit 1', 'woensdag', '14:00 - 14:30',
        'Terrein 7', 'Ann Devries', 'Jan Jansen']],
      [], [trainerAnn], [terrein7], [], SETTINGS, NU,
    );
    const les = plan.nieuweLessen[0];
    const duur = (new Date(les.end_time).getTime() - new Date(les.start_time).getTime()) / 60000;
    expect(duur).toBe(30);
  });

  it('valt op de clubinstelling terug als het bestand geen einde gaf', () => {
    const plan = planImportLessen(
      [KOP, ['Kidstennis wit', 'Wit 1', 'woensdag', '14:00',
        'Terrein 7', 'Ann Devries', 'Jan Jansen']],
      [], [trainerAnn], [terrein7], [], SETTINGS, NU,
    );
    const les = plan.nieuweLessen[0];
    const duur = (new Date(les.end_time).getTime() - new Date(les.start_time).getTime()) / 60000;
    expect(duur).toBe(60);
  });

  it('weigert het weekschema zolang het seizoen niet ingesteld is', () => {
    const plan = planImportLessen(
      [KOP, ['Kidstennis blauw', 'Blauw 1', 'woensdag', '14:00 - 15:00',
        'Terrein 7', 'Ann Devries', 'Jan Jansen']],
      [], [trainerAnn], [terrein7], [],
      { lesson_duration_minutes: 60, vakanties: [] }, NU,
    );
    expect(plan.groepenNieuw).toEqual([]);
    expect(plan.fouten).toHaveLength(1);
  });

  it('laat het bestaande formaat werken zoals het werkte', () => {
    // Dezelfde verwachting als de bestaande test hierboven; hier alleen om vast te leggen dat
    // de formaatkeuze het oude pad niet raakt.
    const plan = planImportLessen(
      [['Datum', 'Uur', 'Groep', 'Coach', 'Leerling'],
        ['2026-09-09', '14:00', 'Blauw 1', 'Ann Devries', 'Jan Jansen']],
      [], [trainerAnn], [terrein7], [], SETTINGS, NU,
    );
    expect(plan.fouten).toEqual([]);
    expect(plan.regels).toHaveLength(1);
  });
});
```

Gebruik voor `trainerAnn` en `terrein7` de bestaande hulpjes uit dat testbestand.

- [ ] **Stap 2: draai de test en zie hem falen**

Run: `npx jest lib/import-trainingen.test.ts -t weekschema`
Verwacht: FAIL — het weekschema wordt nu als het oude formaat gelezen en klaagt over een
ontbrekende `Datum`.

- [ ] **Stap 3: schrijf de implementatie**

In `lib/import-trainingen.ts`, bovenaan:

```ts
import {
  isWeekschema, leesWeekRegels, groepenUitWeekRegels, spelerRegelsUitWeek,
} from './import-weekschema';
```

`planImportLessen` krijgt de seizoensvelden in zijn `settings`-type en een aftakking bovenaan:

```ts
export function planImportLessen(
  rijen: ReadonlyArray<readonly string[]>,
  bestaandeGroepen: readonly LesGroep[],
  users: readonly User[],
  courts: readonly Court[],
  bookings: readonly ImportBoeking[],
  settings: Pick<
    Settings, 'lesson_duration_minutes' | 'vakanties' | 'season_start' | 'season_end'
  >,
  nu: Date,
): ImportPlanLessen {
```

Vervang de opening van de body — tot en met `const idVanNaam = ...` — door:

```ts
  // Welk formaat is dit? De clublijst heeft een kolom `Weekdag` en het sjabloon van de app
  // heeft datums; die twee sluiten elkaar uit. Zie `isWeekschema` voor waarom er op dat ene
  // woord gekozen wordt en niet op de zeven koppen samen.
  const week = rijen.length > 0 && isWeekschema(rijen[0]);

  const gelezenWeek = week ? leesWeekRegels(rijen) : null;
  const gelezen = week ? null : leesLesRegels(rijen);

  const plan: ImportPlanLessen = {
    regels: gelezen?.regels ?? [],
    groepenNieuw: [],
    groepenBijgewerkt: [],
    groepenOngewijzigd: [],
    spelersNieuw: [],
    nieuweLessen: [],
    ongewijzigdeLessen: [],
    overgeslagen: [],
    botsingen: [],
    handmatigGewijzigd: [],
    verdwenenUitBestand: [],
    trainerwissels: [],
    fouten: [...(gelezenWeek?.fouten ?? gelezen?.fouten ?? [])],
    waarschuwingen: [],
    nietHerkend: gelezenWeek?.nietHerkend ?? gelezen?.nietHerkend ?? [],
    dubbel: gelezenWeek?.dubbel ?? gelezen?.dubbel ?? [],
  };

  let uitGroepen: { groepen: GeplandeGroep[]; waarschuwingen: ImportFoutLessen[] };
  let spelerRegels: readonly SpelerRegel[];

  if (gelezenWeek) {
    if (gelezenWeek.regels.length === 0) return plan;
    // Het weekschema heeft geen datums; zonder seizoen valt er niets in te plannen. Dit is een
    // fout en geen waarschuwing: doorgaan zou 192 groepen zonder één les opleveren, en dat leest
    // als "de import deed niets" in plaats van als "er ontbreekt een instelling".
    const seizoen = seizoenUitSettings(settings);
    if (!seizoen) {
      plan.fouten.push({
        regel: 1,
        reden: 'Dit bestand is een weekschema zonder datums, en het seizoen van de club staat nog niet ingesteld. Zet het in Beheer → Kalender en probeer opnieuw.',
      });
      return plan;
    }
    uitGroepen = groepenUitWeekRegels(gelezenWeek.regels, bestaandeGroepen, courts, seizoen);
    spelerRegels = spelerRegelsUitWeek(gelezenWeek.regels);
  } else {
    if (!gelezen || gelezen.regels.length === 0) return plan;
    uitGroepen = groepenUitRegels(gelezen.regels, bestaandeGroepen, courts);
    spelerRegels = gelezen.regels;
  }

  plan.waarschuwingen.push(...uitGroepen.waarschuwingen);

  const uitSpelers = spelersUitRegels(spelerRegels, users);
  plan.waarschuwingen.push(...uitSpelers.waarschuwingen);
  plan.spelersNieuw = uitSpelers.spelers.filter((s) => s.bestaand === null);
  const idVanNaam = new Map(uitSpelers.spelers.map((s) => [normalizeName(s.naam), spelerSleutel(s)]));
```

En in de lus over de groepen, waar `lessenUitGroep` aangeroepen wordt, de duur per groep:

```ts
  const clubDuur = lesduurVan(settings);
```

vervangt de bestaande `const duurMinuten = lesduurVan(settings);`, en de aanroep wordt:

```ts
    // De duur van de groep wint van die van de club. Vier van de 192 groepen van de club wijken
    // af (twee van 30 minuten, twee van 90) en die stonden zonder dit op 60.
    const groepDuur = groep.duurMinuten ?? clubDuur;
    const uitLessen = lessenUitGroep(
      groep, koppeling, users, relevanteBoekingen, vakanties, groepDuur, nu,
    );
```

Zorg dat `duration_minutes` meegaat waar een groep weggeschreven wordt: in `bouwImportWijziging`
(rond regel 1959, waar `season_start: inPlan.groep.seizoenVan` staat) komt erbij:

```ts
    duration_minutes: inPlan.groep.duurMinuten ?? undefined,
```

en in `groepWijzigingen` (rond regel 1636), naast de seizoensvergelijking:

```ts
  // De duur telt mee als wijziging: een groep die in het bestand van 60 naar 90 minuten gaat,
  // hoort dat in de app ook te worden. `undefined` in het bestand betekent "de clubinstelling"
  // en overschrijft een ingestelde duur niet — dat zou een handmatige correctie wegvegen.
  if (groep.duurMinuten !== null && groep.duurMinuten !== bestaand.duration_minutes) {
    wijzigingen.duration_minutes = groep.duurMinuten;
  }
```

- [ ] **Stap 4: draai de tests**

Run: `npx jest && npx tsc --noEmit`
Verwacht: alle suites groen, inclusief de 1591 bestaande.

- [ ] **Stap 5: commit**

```bash
git add lib/import-trainingen.ts lib/import-trainingen.test.ts
git commit -m "feat(import): het clubweekschema inlezen, met de lesduur per groep"
```

---

## Taak 11: het importscherm toont het formaat en het seizoen

**Bestanden:**
- Wijzigen: `app/admin/trainingen-import.tsx`
- Wijzigen: `lib/i18n-en.ts`

- [ ] **Stap 1: lees hoe de droogloop nu opgebouwd wordt**

Run: `sed -n '360,500p' app/admin/trainingen-import.tsx`

De teller boven de droogloop toont vandaag het aantal groepen, spelers en lessen. Daar komt één
regel bij.

- [ ] **Stap 2: voeg de regel toe**

Boven de bestaande tellerregel, in dezelfde stijl als de omliggende `<Text style={styles.hint}>`:

```tsx
{/* Welk bestand hij denkt te lezen, en over welke periode. Bij een weekschema staat er geen
    enkele datum in het bestand: dan komen de 192 groepen op een seizoen te staan dat de
    beheerder hier niet ziet tenzij het er staat. Dat is precies het getal dat je wil kunnen
    natellen voor je op toepassen drukt. */}
<Text style={styles.hint}>
  {t('Weekschema van de club — seizoen {van} t/m {tot}.', {
    van: formatDag(seizoen.van),
    tot: formatDag(seizoen.tot),
  })}
</Text>
```

Toon die regel alleen als het bestand een weekschema is; gebruik `isWeekschema(rijen[0])` op de
gelezen rijen die het scherm al in handen heeft.

- [ ] **Stap 3: voeg de Engelse teksten toe**

In `lib/i18n-en.ts`, bij de andere importteksten, voor elke nieuwe `t(...)` uit taak 8, 10 en 11
een regel. De sleutels zijn de Nederlandse zinnen; zoek de bestaande importblokken op met
`grep -n "import" lib/i18n-en.ts`.

- [ ] **Stap 4: draai de tests**

Run: `npx jest && npx tsc --noEmit`
Verwacht: groen. Er is een bestaande test die bewaakt dat elke `t(...)`-sleutel een Engelse
vertaling heeft; die vangt een vergeten regel.

- [ ] **Stap 5: commit**

```bash
git add app/admin/trainingen-import.tsx lib/i18n-en.ts
git commit -m "feat(import): de droogloop toont het formaat en het seizoen"
```

---

## Taak 12: een geanonimiseerd voorbeeldbestand

De echte clublijst met 550 namen mag **niet** in de repository: die is publiek. Er staat al een
geanonimiseerde fixture voor het eerste formaat in `lib/__fixtures__/lessen-voorbeeld.xlsx`, met
een test die bewaakt dat er geen echte naam in terechtkomt. Het weekschema krijgt dezelfde
behandeling.

**Bestanden:**
- Aanmaken: `lib/__fixtures__/weekschema-voorbeeld.xlsx`
- Wijzigen: `lib/import-weekschema.test.ts`

- [ ] **Stap 1: kijk hoe de bestaande fixture gemaakt en bewaakt wordt**

Run: `grep -rn "lessen-voorbeeld" lib/ scripts/ | head`

- [ ] **Stap 2: maak het bestand met verzonnen namen**

Neem de vorm van de echte lijst over — zeven kolommen, één regel per groep — en vul hem met
twaalf regels die de gevallen dekken die ertoe doen: een gewone groep, de vijf-op-Terrein-7
situatie (drie groepen op woensdag 14:00), een regel met twee terreinen, een regel met twee
trainers, een regel zonder spelers, een groep van 30 minuten en een van 90.

- [ ] **Stap 3: schrijf de test die door het hele bestand heen leest**

```ts
it('leest het voorbeeldbestand van kop tot staart', () => {
  const rijen = leesXlsx(readFileSync('lib/__fixtures__/weekschema-voorbeeld.xlsx'));
  const uit = leesWeekRegels(rijen);
  expect(uit.fouten).toEqual([]);
  expect(uit.regels).toHaveLength(12);
});

it('bevat geen enkele echte naam uit de clublijst', () => {
  const tekst = readFileSync('lib/__fixtures__/weekschema-voorbeeld.xlsx').toString('latin1');
  for (const naam of ['Devries', 'Lasoen']) {
    expect(tekst).not.toContain(naam);
  }
});
```

- [ ] **Stap 4: draai de tests**

Run: `npx jest lib/import-weekschema.test.ts && npx tsc --noEmit`
Verwacht: PASS.

- [ ] **Stap 5: commit**

```bash
git add lib/__fixtures__/weekschema-voorbeeld.xlsx lib/import-weekschema.test.ts
git commit -m "test(weekschema): een geanonimiseerd voorbeeldbestand"
```

---

## Taak 13: een demo-adres voor elk nieuw lid zonder e-mail

**DIT BLOKKEERT DE IMPORT.** `users.email` is in `supabase-schema.sql` gedeclareerd als
`unique not null`. De clublijst heeft geen e-mailkolom, dus `nieuwLidUitSpeler` zou 550 leden met
een leeg adres opleveren en de tweede daarvan botst op die unieke sleutel. De import breekt dan
halverwege af, met leerlingen zonder groep als restant. Dat is nooit opgevallen omdat
`koen.xlsx` wél adressen heeft.

**Bestanden:**
- Wijzigen: `lib/import-trainingen.ts` (`nieuwLidUitSpeler`, regel 1022; `bouwImportWijziging`, regel 2259)
- Wijzigen: `lib/import-trainingen.test.ts`

- [ ] **Stap 1: schrijf de falende test**

```ts
describe('demoAdres', () => {
  it('maakt een adres uit de naam', () => {
    expect(demoAdres('Jan Jansen', new Set())).toBe('jan.jansen@example.com');
  });

  it('haalt accenten, streepjes en dubbele spaties weg', () => {
    expect(demoAdres('Émile  Van der Meer-Ruys', new Set()))
      .toBe('emile.van.der.meer.ruys@example.com');
  });

  it('telt door bij een naamgenoot, zodat het adres uniek blijft', () => {
    const bezet = new Set(['jan.jansen@example.com']);
    expect(demoAdres('Jan Jansen', bezet)).toBe('jan.jansen2@example.com');
    bezet.add('jan.jansen2@example.com');
    expect(demoAdres('Jan Jansen', bezet)).toBe('jan.jansen3@example.com');
  });

  it('valt terug op een naamloos adres als er van de naam niets overblijft', () => {
    expect(demoAdres('???', new Set())).toBe('lid@example.com');
  });
});

describe('bouwImportWijziging zonder e-mailkolom', () => {
  it('geeft elk nieuw lid een eigen adres, zodat de unieke sleutel niet botst', () => {
    const plan = planImportLessen(
      [['Doelgroep', 'Groep', 'Weekdag', 'Uur', 'Terrein(en)', 'Trainer(s)', 'Speler(s)'],
        ['Kidstennis blauw', 'Blauw 1', 'woensdag', '14:00 - 15:00', 'Terrein 7',
          'Ann Devries', 'Jan Jansen, Piet Peeters, Marie Maes']],
      [], [trainerAnn], [terrein7], [], SETTINGS, NU,
    );
    const wijziging = bouwImportWijziging(plan, alleKeuzes(plan), maakId);
    const adressen = wijziging.nieuweUsers.map((u) => u.email);
    expect(new Set(adressen).size).toBe(adressen.length);
    expect(adressen.every((a) => a.endsWith('@example.com'))).toBe(true);
  });

  it('houdt het adres uit het bestand als dat er wél is', () => {
    const plan = planImportLessen(
      [['Datum', 'Uur', 'Groep', 'Coach', 'Leerling', 'E-mail leerling'],
        ['2026-09-09', '14:00', 'Blauw 1', 'Ann Devries', 'Jan Jansen', 'jan@echt.be']],
      [], [trainerAnn], [terrein7], [], SETTINGS, NU,
    );
    const wijziging = bouwImportWijziging(plan, alleKeuzes(plan), maakId);
    expect(wijziging.nieuweUsers[0].email).toBe('jan@echt.be');
  });
});
```

- [ ] **Stap 2: draai de test en zie hem falen**

Run: `npx jest lib/import-trainingen.test.ts -t demoAdres`
Verwacht: FAIL, `demoAdres is not a function`.

- [ ] **Stap 3: schrijf de implementatie**

In `lib/import-trainingen.ts`, boven `nieuwLidUitSpeler`:

```ts
/**
 * Het domein voor een verzonnen adres. `example.com` is bij RFC 2606 gereserveerd en kan nooit
 * post ontvangen — er gaat dus met zekerheid geen mail naar een echt persoon die toevallig zo
 * heet. Een eigen domein zou dat niet garanderen.
 */
const DEMO_DOMEIN = 'example.com';

/**
 * Een verzonnen, uniek e-mailadres voor een lid waarvan het bestand er geen geeft.
 *
 * WAAROM DIT MOET. `users.email` is `unique not null`. Een clublijst zonder e-mailkolom zou
 * anders 550 leden met een leeg adres opleveren, en de tweede daarvan laat de hele import
 * stranden op die unieke sleutel — halverwege, met leerlingen zonder groep als restant. Een leeg
 * adres is dus geen "nog niet ingevuld" maar een bom.
 *
 * Het adres is afgeleid van de naam en niet van een toevalsgetal: zo is het te lezen, en ziet de
 * beheerder in Beheer → Leden meteen dat het een verzonnen adres is en van wie.
 *
 * `bezet` gaat erin en wordt er niet door bijgewerkt: de aanroeper houdt de lijst bij, want
 * alleen die weet welke adressen er in dezelfde importbeurt al uitgedeeld zijn. Dat de club nog
 * echte adressen heeft die hierop lijken, kan niet: `example.com` gebruikt niemand.
 */
export function demoAdres(naam: string, bezet: ReadonlySet<string>): string {
  const stam = naam
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
  const basis = stam || 'lid';
  let adres = `${basis}@${DEMO_DOMEIN}`;
  let n = 1;
  while (bezet.has(adres)) {
    n += 1;
    adres = `${basis}${n}@${DEMO_DOMEIN}`;
  }
  return adres;
}
```

`nieuwLidUitSpeler` krijgt de bezette adressen mee:

```ts
/**
 * Hoe een nieuw lid eruitziet. Zonder adres in het bestand krijgt hij een demo-adres; zie
 * `demoAdres` voor waarom dat geen luxe is maar een voorwaarde.
 */
export function nieuwLidUitSpeler(
  speler: GeplandeSpeler,
  bezet: ReadonlySet<string> = new Set(),
): Omit<User, 'id'> {
  return {
    name: speler.naam,
    email: speler.email || demoAdres(speler.naam, bezet),
    role: 'player',
  };
}
```

En in `bouwImportWijziging`, de lus rond regel 2259:

```ts
  // De adressen die deze importbeurt al uitgedeeld heeft, plus die van de bestaande leden. Eén
  // verzameling voor allebei: een verzonnen adres mag niet botsen met een verzonnen adres van
  // twee regels eerder, en ook niet met een echt adres dat de club al kent.
  const bezetteAdressen = new Set(
    bestaandeUsers.map((u) => u.email.trim().toLowerCase()).filter(Boolean),
  );
  for (const speler of plan.spelersNieuw) {
    const id = maakId('u');
    idVanPlaatshouder.set(spelerSleutel(speler), id);
    const nieuw = { ...nieuwLidUitSpeler(speler, bezetteAdressen), id };
    bezetteAdressen.add(nieuw.email.toLowerCase());
    uit.nieuweUsers.push(nieuw);
  }
```

`bestaandeUsers` is de ledenlijst die `bouwImportWijziging` al in handen heeft; kijk in de
handtekening welke parameter dat is en gebruik die naam.

- [ ] **Stap 4: draai de tests**

Run: `npx jest && npx tsc --noEmit`
Verwacht: alles groen.

- [ ] **Stap 5: commit**

```bash
git add lib/import-trainingen.ts lib/import-trainingen.test.ts
git commit -m "fix(import): elk nieuw lid krijgt een uniek adres, ook zonder e-mailkolom"
```

---

## Taak 14: onbekende trainers worden aangemaakt

Vandaag zoekt `zoekTrainer` de naam op in de ledenlijst en levert een waarschuwing op als hij er
niet is; de groep komt er dan zonder trainer en zonder lessen. Bij de clublijst zijn dat twaalf
trainers die de club nog niet als account heeft, en dan zou er geen enkele les ingepland worden.

**Bestanden:**
- Wijzigen: `lib/import-trainingen.ts` (`ImportPlanLessen`, regel 1688; `planImportLessen`; `bouwImportWijziging`)
- Wijzigen: `lib/import-trainingen.test.ts`

- [ ] **Stap 1: schrijf de falende test**

```ts
describe('trainers die de club nog niet kent', () => {
  const KOP = ['Doelgroep', 'Groep', 'Weekdag', 'Uur', 'Terrein(en)', 'Trainer(s)', 'Speler(s)'];

  it('zet een onbekende trainer in het plan als nieuwe trainer', () => {
    const plan = planImportLessen(
      [KOP, ['Kidstennis blauw', 'Blauw 1', 'woensdag', '14:00 - 15:00',
        'Terrein 7', 'Ann Devries', 'Jan Jansen']],
      [], [], [terrein7], [], SETTINGS, NU,
    );
    expect(plan.trainersNieuw.map((t) => t.naam)).toEqual(['Ann Devries']);
  });

  it('noemt dezelfde trainer één keer, ook als hij twintig groepen draait', () => {
    const plan = planImportLessen(
      [KOP,
        ['Kidstennis blauw', 'Blauw 1', 'woensdag', '14:00 - 15:00', 'Terrein 7', 'Ann Devries', 'Jan Jansen'],
        ['Kidstennis rood', 'Rood 3', 'woensdag', '15:00 - 16:00', 'Terrein 7', 'ann devries', 'Piet Peeters']],
      [], [], [terrein7], [], SETTINGS, NU,
    );
    expect(plan.trainersNieuw).toHaveLength(1);
  });

  it('noemt een trainer die de club al kent niet als nieuw', () => {
    const plan = planImportLessen(
      [KOP, ['Kidstennis blauw', 'Blauw 1', 'woensdag', '14:00 - 15:00',
        'Terrein 7', 'Ann Devries', 'Jan Jansen']],
      [], [trainerAnn], [terrein7], [], SETTINGS, NU,
    );
    expect(plan.trainersNieuw).toEqual([]);
  });

  it('maakt de trainer aan met rol coach en een demo-adres, en hangt de groep eraan', () => {
    const plan = planImportLessen(
      [KOP, ['Kidstennis blauw', 'Blauw 1', 'woensdag', '14:00 - 15:00',
        'Terrein 7', 'Ann Devries', 'Jan Jansen']],
      [], [], [terrein7], [], SETTINGS, NU,
    );
    const wijziging = bouwImportWijziging(plan, alleKeuzes(plan), maakId);
    const trainer = wijziging.nieuweUsers.find((u) => u.role === 'coach');
    expect(trainer).toMatchObject({ name: 'Ann Devries', email: 'ann.devries@example.com' });
    expect(wijziging.nieuweGroepen[0].coach_id).toBe(trainer!.id);
  });

  it('plant de lessen in nu de trainer bestaat', () => {
    const plan = planImportLessen(
      [KOP, ['Kidstennis blauw', 'Blauw 1', 'woensdag', '14:00 - 15:00',
        'Terrein 7', 'Ann Devries', 'Jan Jansen']],
      [], [], [terrein7], [], SETTINGS, NU,
    );
    expect(plan.nieuweLessen.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Stap 2: draai de test en zie hem falen**

Run: `npx jest lib/import-trainingen.test.ts -t "trainers die de club nog niet kent"`
Verwacht: FAIL, `plan.trainersNieuw` bestaat niet.

- [ ] **Stap 3: schrijf de implementatie**

In `ImportPlanLessen` (regel 1688) erbij:

```ts
  /**
   * De trainers uit het bestand die de club nog niet als account heeft.
   *
   * WAAROM DIT MOET BESTAAN. `zoekTrainer` leverde tot nu toe een waarschuwing op en de groep
   * kwam er zonder trainer — en zonder trainer plant `lessenUitGroep` geen enkele les, want
   * `Booking.coach_id` is verplicht. Bij de clublijst zijn dat twaalf trainers en dus 192
   * groepen zonder één les. De beheerder in twaalf schermen laten aanklikken voor hij mag
   * importeren, is geen betere uitkomst dan ze aanmaken en het hem laten zien.
   *
   * Ze worden aangemaakt met rol `coach` en een demo-adres op example.com; een login krijgen ze
   * er niet bij, dat doet TRAINERS-LOGIN.sql na afloop.
   */
  trainersNieuw: GeplandeTrainer[];
```

Met erboven:

```ts
/** Een trainer uit het bestand: hoe hij er stond, en wie hij bij ons al is. */
export interface GeplandeTrainer {
  naam: string;
  bestaand: User | null;
}

/**
 * Wie er in dit bestand lesgeeft, en wie van hen de club al kent.
 *
 * Eén ingang per unieke naam, genormaliseerd — dezelfde trainer op twintig groepen is één
 * account. Precies de vorm van `spelersUitRegels`, en met opzet: het is dezelfde vraag over een
 * andere kolom.
 *
 * Passen er twee bestaande trainers op dezelfde naam, dan komt er géén koppeling uit maar een
 * melding, net als bij een leerling. Een derde naamgenoot aanmaken is erger dan hem overslaan.
 */
export function trainersUitGroepen(
  groepen: readonly GeplandeGroep[],
  users: readonly User[],
): { trainers: GeplandeTrainer[]; waarschuwingen: ImportFoutLessen[] } {
  const gezien = new Set<string>();
  const trainers: GeplandeTrainer[] = [];
  const waarschuwingen: ImportFoutLessen[] = [];
  for (const groep of groepen) {
    const naam = groep.coachNaam.trim();
    if (!naam) continue;
    const sleutel = normalizeName(naam);
    if (gezien.has(sleutel)) continue;
    gezien.add(sleutel);
    const bestaand = zoekTrainer(users, naam);
    if (!bestaand) {
      const kandidaten = users.filter(
        (u) => u.role === 'coach' && zelfdeNaamOngeachtVolgorde(u.name, naam),
      );
      if (kandidaten.length > 1) {
        waarschuwingen.push({
          regel: 1,
          reden: 'Er staan al meerdere trainers die {naam} kunnen zijn; koppel deze groep zelf.',
          vars: { naam },
        });
        continue;
      }
    }
    trainers.push({ naam, bestaand });
  }
  return { trainers, waarschuwingen };
}
```

In `planImportLessen`, direct na `uitGroepen` en vóór de lus over de groepen:

```ts
  const uitTrainers = trainersUitGroepen(uitGroepen.groepen, users);
  plan.waarschuwingen.push(...uitTrainers.waarschuwingen);
  plan.trainersNieuw = uitTrainers.trainers.filter((t) => t.bestaand === null);

  // De nieuwe trainers meetellen als bestaande gebruikers voor de rest van dit plan. Zonder dit
  // vindt `koppelingVoorGroep` ze niet en plant `lessenUitGroep` geen les — precies de toestand
  // die deze stap wegneemt. Het zijn plaatshouders met een id dat pas in `bouwImportWijziging`
  // een echt id wordt, net als bij een nieuwe speler.
  const usersMetNieuwe: User[] = [
    ...users,
    ...plan.trainersNieuw.map((t) => ({
      id: `${NIEUWE_TRAINER}${normalizeName(t.naam)}`,
      name: t.naam,
      email: '',
      role: 'coach' as const,
    })),
  ];
```

Gebruik daarna `usersMetNieuwe` in plaats van `users` bij `koppelingVoorGroep` en
`lessenUitGroep`. Naast `NIEUWE_SPELER` (regel 1654) komt:

```ts
/** Het voorvoegsel van een trainer die nog aangemaakt moet worden. Zie `NIEUWE_SPELER`. */
export const NIEUWE_TRAINER = 'nieuwe-trainer:';
```

In `bouwImportWijziging`, vóór de spelerslus:

```ts
  // De trainers eerst: de groepen verwijzen ernaar, en een groep zonder trainer plant geen les.
  for (const trainer of plan.trainersNieuw) {
    const id = maakId('u');
    idVanPlaatshouder.set(`${NIEUWE_TRAINER}${normalizeName(trainer.naam)}`, id);
    const nieuw = {
      id,
      name: trainer.naam,
      email: demoAdres(trainer.naam, bezetteAdressen),
      role: 'coach' as const,
    };
    bezetteAdressen.add(nieuw.email.toLowerCase());
    uit.nieuweUsers.push(nieuw);
  }
```

Zorg dat `bezetteAdressen` (uit taak 13) hierboven al opgebouwd is, en dat `coach_id` en
`taught_by_id` van een groep of les die op een plaatshouder wijst, door dezelfde
`idVanPlaatshouder`-vervanging gaan als het rooster.

- [ ] **Stap 4: draai de tests**

Run: `npx jest && npx tsc --noEmit`
Verwacht: alles groen.

- [ ] **Stap 5: commit**

```bash
git add lib/import-trainingen.ts lib/import-trainingen.test.ts
git commit -m "feat(import): onbekende trainers worden aangemaakt met een demo-adres"
```

---

## Taak 15: het importscherm toont de nieuwe trainers

**Bestanden:**
- Wijzigen: `app/admin/trainingen-import.tsx`
- Wijzigen: `lib/i18n-en.ts`

- [ ] **Stap 1: zoek waar de nieuwe spelers geteld worden**

Run: `grep -n "spelersNieuw" app/admin/trainingen-import.tsx`

- [ ] **Stap 2: zet de trainers ernaast**

Twaalf nieuwe accounts aanmaken is geen detail, dus het staat naast het aantal nieuwe spelers en
niet erin verstopt:

```tsx
{plan.trainersNieuw.length > 0 ? (
  <Text style={styles.hint}>
    {t('{aantal} trainers worden aangemaakt: {namen}.', {
      aantal: String(plan.trainersNieuw.length),
      namen: plan.trainersNieuw.map((t) => t.naam).join(', '),
    })}
  </Text>
) : null}
```

- [ ] **Stap 3: voeg de Engelse tekst toe**

In `lib/i18n-en.ts` de sleutel `'{aantal} trainers worden aangemaakt: {namen}.'`.

- [ ] **Stap 4: draai de tests**

Run: `npx jest && npx tsc --noEmit`
Verwacht: groen; de vertaaltest vangt een vergeten sleutel.

- [ ] **Stap 5: commit**

```bash
git add app/admin/trainingen-import.tsx lib/i18n-en.ts
git commit -m "feat(import): de droogloop toont welke trainers aangemaakt worden"
```

---

## Na afloop: wat de gebruiker zelf moet doen

1. **`SEIZOEN-EN-LESDUUR.sql` draaien** in de Supabase SQL-editor. Zonder dat staat het seizoen
   niet ingesteld en weigert de import het weekschema met een nette melding.
2. **De droogloop nalopen** met de echte clublijst voordat er iets toegepast wordt. Verwacht:
   192 groepen, 550 spelers, 12 trainers, en botsingen op vijf momenten op Terrein 7 — die vijf
   zijn goed en horen in het rood te staan.
3. **`TRAINERS-LOGIN.sql` draaien**, ná de import. Dat geeft de twaalf aangemaakte trainers
   een login met wachtwoord `123`. Het bestand maakt zelf geen trainers aan — het geeft de
   trainers die de import aanmaakte een account in `auth.users`, met een identiteitsrij erbij
   (zonder die rij weigert Supabase het inloggen met "Invalid login credentials", de valkuil
   waar `leslie-login.sql` ook op stuitte).
4. Let op: **de dev-server praat met de productiedatabank van de club.** Er is geen tweede
   omgeving.
5. **Het wachtwoord `123` is geen beveiliging.** Twaalf accounts met drie cijfers, op een
   databank met de namen en de agenda van 550 spelers. Prima om mee te testen, niet om te laten
   staan als de club er echt mee werkt. Onderaan `TRAINERS-LOGIN.sql` staat een uitgecommentarieerd
   blok dat de wachtwoorden ongeldig maakt zonder de accounts weg te gooien; daarna zet elke
   trainer via "wachtwoord vergeten" zijn eigen wachtwoord.
