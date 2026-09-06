import { readFileSync } from 'fs';
import { join } from 'path';

import { GROEPSLES_METHOD } from './beurtenkaart';
import { bladLessen, opzoektabellen } from './export-trainingen';
import {
  alsBezet, baanUitCellen, bestandAfgekeurdLessen, bouwImportWijziging, deelnemersVoorLes,
  geweigerdeNieuweGroepen, groepenUitRegels, overgeslagenPerReden,
  groepRosterVerschil, kiesLessenBlad, koppelingVoorGroep, leesDatumCel, leesKopregelLessen,
  leesLesRegels, leesUurCel, lesduurVan, lesSleutel, lessenUitGroep, nieuwLidUitSpeler,
  NIEUWE_SPELER, planImportLessen, spelerSleutel,
  groepWijzigingen, spelersUitRegels, voorbeeldTrainingenXlsx, zoekBaan, zoekTrainer,
  type GeplandeGroep, type GeplandeLes, type GroepKoppeling, type ImportBoeking,
  type ImportPlanLessen, type LesRegel, type OvergeslagenLes,
} from './import-trainingen';
import { groepSleutel } from './lesgroepen';
import type { Booking, Court, LesGroep, User } from './types';
import { dagSleutel } from './vakanties';
import { buildXlsx, datumNaarSerie } from './xlsx';
import { leesWerkmap } from './xlsx-lezen';

// De koprij van `koen.xlsx`, letterlijk zoals plan 05-03 hem uit het echte bestand las. Vier
// van de tien kolommen betekenen niets voor de import; ze mogen dus geen ruis opleveren.
const KOP_KOEN = [
  'Datum', 'Weekdag', 'Weeknr', 'Uur', 'Type les', 'Groep', 'Coach', 'Leerling',
  'Locatie', 'Indoor/Outdoor',
];

/** De koprij die de export van fase 4 schrijft: zestien kolommen, waarvan negen betekenis hebben. */
const KOP_EXPORT = [
  'Datum', 'Weekdag', 'Weeknr', 'Uur', 'Einduur', 'Type les', 'Groep', 'Groep-ID', 'Coach',
  'Gaf de les', 'Leerling', 'E-mail leerling', 'Baan', 'Indoor/Outdoor', 'Spelers', 'Status',
];

describe('leesKopregelLessen', () => {
  it('herkent de vijf verplichte kolommen', () => {
    const kop = leesKopregelLessen(['Datum', 'Uur', 'Groep', 'Coach', 'Leerling']);
    expect(kop.kolommen).toEqual({ datum: 0, uur: 1, groep: 2, coach: 3, leerling: 4 });
    expect(kop.nietHerkend).toEqual([]);
    expect(kop.dubbel).toEqual([]);
  });

  it('herkent ook de vier optionele kolommen', () => {
    const kop = leesKopregelLessen([
      'Datum', 'Uur', 'Groep', 'Coach', 'Leerling', 'Groep-ID', 'Type les', 'E-mail leerling', 'Baan',
    ]);
    expect(kop.kolommen).toEqual({
      datum: 0, uur: 1, groep: 2, coach: 3, leerling: 4,
      groepId: 5, typeLes: 6, emailLeerling: 7, baan: 8,
    });
    expect(kop.nietHerkend).toEqual([]);
  });

  it('trekt zich niets aan van hoofdletters, spaties eromheen en spaties erin', () => {
    const kop = leesKopregelLessen([' DATUM ', 'uur', 'Groep', 'coach', 'LEERLING', 'typeles', 'Groep - ID']);
    expect(kop.kolommen).toEqual({
      datum: 0, uur: 1, groep: 2, coach: 3, leerling: 4, typeLes: 5, groepId: 6,
    });
    expect(kop.nietHerkend).toEqual([]);
  });

  it('leest de kolommen ook als ze in een andere volgorde staan', () => {
    const kop = leesKopregelLessen(['Leerling', 'Coach', 'Groep', 'Uur', 'Datum']);
    expect(kop.kolommen).toEqual({ leerling: 0, coach: 1, groep: 2, uur: 3, datum: 4 });
  });

  it('meldt de kolommen van koen.xlsx niet als onbekend', () => {
    const kop = leesKopregelLessen(KOP_KOEN);
    expect(kop.kolommen).toEqual({
      datum: 0, uur: 3, typeLes: 4, groep: 5, coach: 6, leerling: 7,
    });
    expect(kop.nietHerkend).toEqual([]);
    expect(kop.dubbel).toEqual([]);
  });

  it('meldt de zestien kolommen van de eigen export niet als onbekend', () => {
    const kop = leesKopregelLessen(KOP_EXPORT);
    expect(kop.kolommen).not.toBeNull();
    expect(kop.nietHerkend).toEqual([]);
    expect(kop.dubbel).toEqual([]);
  });

  it('herkent Indoor/Outdoor als tweede baankolom', () => {
    const kop = leesKopregelLessen(['Datum', 'Uur', 'Groep', 'Coach', 'Leerling', 'Indoor/Outdoor']);
    expect(kop.kolommen?.baanAlt).toBe(5);
    expect(kop.kolommen?.baan).toBeUndefined();
    expect(kop.nietHerkend).toEqual([]);
    expect(kop.dubbel).toEqual([]);
  });

  it('leest Baan en Indoor/Outdoor als twee kolommen en meldt de tweede niet als dubbel', () => {
    // De eigen export schrijft ze allebei. Zouden ze op hetzelfde veld mikken, dan opende élke
    // herimport van een eigen exportbestand met "deze kolom staat er twee keer".
    const kop = leesKopregelLessen([
      'Datum', 'Uur', 'Groep', 'Coach', 'Leerling', 'Baan', 'Indoor/Outdoor',
    ]);
    expect(kop.kolommen?.baan).toBe(5);
    expect(kop.kolommen?.baanAlt).toBe(6);
    expect(kop.dubbel).toEqual([]);
    expect(kop.nietHerkend).toEqual([]);
  });

  it('meldt een echt onbekende kop, letterlijk, en keurt het bestand er niet om af', () => {
    const kop = leesKopregelLessen(['Datum', 'Uur', 'Groep', 'Coach', 'Leerling', ' Opmerking ']);
    expect(kop.nietHerkend).toEqual(['Opmerking']);
    expect(kop.kolommen).not.toBeNull();
  });

  it('laat de eerste kolom winnen en meldt de tweede als dubbel', () => {
    const kop = leesKopregelLessen(['Datum', 'Uur', 'Groep', 'Coach', 'Leerling', 'leerling']);
    expect(kop.kolommen?.leerling).toBe(4);
    expect(kop.dubbel).toEqual(['leerling']);
  });

  it('slaat een lege kop over zonder hem een vergissing te noemen', () => {
    const kop = leesKopregelLessen(['Datum', '', 'Uur', '   ', 'Groep', 'Coach', 'Leerling']);
    expect(kop.nietHerkend).toEqual([]);
    expect(kop.kolommen).not.toBeNull();
  });

  it.each(['Datum', 'Uur', 'Groep', 'Coach', 'Leerling'])(
    'geeft geen kolommen als %s ontbreekt', (weg) => {
      const koppen = ['Datum', 'Uur', 'Groep', 'Coach', 'Leerling'].filter((k) => k !== weg);
      expect(leesKopregelLessen(koppen).kolommen).toBeNull();
    },
  );

  it('vult nietHerkend en dubbel ook als een verplichte kolom ontbreekt', () => {
    // Juist dán heeft de beheerder die lijstjes nodig: "ik mis Coach, maar ik zag wel een
    // kolom Lesbegeleider die ik niet herken" is bruikbaar, "verplichte kolom ontbreekt" niet.
    const kop = leesKopregelLessen(['Datum', 'Uur', 'Groep', 'Leerling', 'Lesbegeleider', 'Datum']);
    expect(kop.kolommen).toBeNull();
    expect(kop.nietHerkend).toEqual(['Lesbegeleider']);
    expect(kop.dubbel).toEqual(['Datum']);
  });
});

describe('baanUitCellen', () => {
  it('leest het terreinnummer uit de tweede kolom als Baan er niet is', () => {
    expect(baanUitCellen('', '3')).toBe('3');
  });

  it('houdt de woorden Indoor en Outdoor voor de oude betekenis en dus voor geen baan', () => {
    // Dit is de hele reden dat deze functie bestaat: op alle 1398 regels van koen.xlsx staat
    // letterlijk `Indoor`. Zonder deze uitzondering kreeg elke groep een verzonnen baan die de
    // club niet heeft.
    expect(baanUitCellen('', 'Indoor')).toBe('');
    expect(baanUitCellen('', 'Outdoor')).toBe('');
  });

  it('trekt zich daarbij niets aan van hoofdletters of spaties eromheen', () => {
    expect(baanUitCellen('', '  outdoor ')).toBe('');
    expect(baanUitCellen('', ' INDOOR')).toBe('');
  });

  it('laat Baan winnen als beide kolommen gevuld zijn', () => {
    // De eigen export schrijft de échte baannaam in `Baan` en gebruikt `Indoor/Outdoor` alleen
    // nog voor het woord; die rondrit mag dus nooit op de tweede kolom uitkomen.
    expect(baanUitCellen('Baan 2', 'Indoor')).toBe('Baan 2');
    expect(baanUitCellen('Baan 2', '5')).toBe('Baan 2');
  });

  it('geeft een lege tekst als geen van beide kolommen iets zegt', () => {
    expect(baanUitCellen('', '')).toBe('');
    expect(baanUitCellen('  ', '   ')).toBe('');
  });

  it('trimt wat het teruggeeft', () => {
    expect(baanUitCellen(' Baan 2 ', '')).toBe('Baan 2');
    expect(baanUitCellen('', ' 3 ')).toBe('3');
  });
});

describe('bestandAfgekeurdLessen', () => {
  it('is waar bij precies één fout op regel 1 en geen enkele gelezen regel', () => {
    expect(bestandAfgekeurdLessen({ regels: [], fouten: [{ regel: 1, reden: 'Dit bestand is leeg.' }] }))
      .toBe(true);
  });

  it('is onwaar zodra er ook maar één regel wel gelezen kon worden', () => {
    expect(bestandAfgekeurdLessen({
      regels: [{}],
      fouten: [{ regel: 1, reden: 'Dit bestand is leeg.' }],
    })).toBe(false);
  });

  it('is onwaar bij een fout op een gewone regel', () => {
    expect(bestandAfgekeurdLessen({ regels: [], fouten: [{ regel: 7, reden: 'Geen coach ingevuld.' }] }))
      .toBe(false);
  });

  it('is onwaar zonder fouten', () => {
    expect(bestandAfgekeurdLessen({ regels: [], fouten: [] })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// De cellen en de regels
// ---------------------------------------------------------------------------

/**
 * Het echte bestand van de club, net als in `lib/xlsx-lezen.test.ts`. De helper staat hier
 * opnieuw en niet in een gedeeld testbestand: elk `lib/*.ts` heeft in dit project precies één
 * `lib/*.test.ts` ernaast, en een derde bestand dat geen module maar alleen testgerei is, zou
 * die regel doorbreken voor drie regels code. De prijs is deze kleine herhaling; de winst is dat
 * beide tests op zichzelf te lezen zijn.
 */
function koenBytes(): Uint8Array {
  const rauw = readFileSync(join(__dirname, '..', 'koen.xlsx'));
  return new Uint8Array(rauw.buffer, rauw.byteOffset, rauw.byteLength);
}

/** De koprij die de rest van deze tests gebruikt: de vijf verplichte kolommen, in die volgorde. */
const KOP_MINIMAAL = ['Datum', 'Uur', 'Groep', 'Coach', 'Leerling'];

describe('leesDatumCel', () => {
  it('leest het serienummer dat Excel opslaat', () => {
    expect(leesDatumCel('46274')).toEqual({ jaar: 2026, maand: 9, dag: 9 });
  });

  it('leest dezelfde dag als DD/MM/JJJJ', () => {
    expect(leesDatumCel('09/09/2026')).toEqual({ jaar: 2026, maand: 9, dag: 9 });
  });

  it('leest ook met een koppelteken of een punt als scheiding', () => {
    expect(leesDatumCel('9-9-2026')).toEqual({ jaar: 2026, maand: 9, dag: 9 });
    expect(leesDatumCel('9.9.2026')).toEqual({ jaar: 2026, maand: 9, dag: 9 });
  });

  it('leest de dag vóór de maand, zoals Nederlandse Excel schrijft', () => {
    expect(leesDatumCel('03/12/2026')).toEqual({ jaar: 2026, maand: 12, dag: 3 });
  });

  it('geeft niets bij een dag die in die maand niet bestaat', () => {
    // 31 februari mag nooit stilletjes 3 maart worden: dat is precies het soort verschuiving
    // die een heel seizoen scheeftrekt zonder dat iemand het merkt.
    expect(leesDatumCel('31/02/2026')).toBeNull();
    expect(leesDatumCel('31/04/2026')).toBeNull();
  });

  it('kent de schrikkeldag', () => {
    expect(leesDatumCel('29/02/2028')).toEqual({ jaar: 2028, maand: 2, dag: 29 });
    expect(leesDatumCel('29/02/2027')).toBeNull();
  });

  it('geeft niets bij tekst die geen datum is', () => {
    expect(leesDatumCel('morgen')).toBeNull();
    expect(leesDatumCel('')).toBeNull();
    expect(leesDatumCel('9/9')).toBeNull();
    expect(leesDatumCel('0')).toBeNull();
  });
});

describe('leesUurCel', () => {
  it('leest de tijdbreuk die Excel opslaat', () => {
    expect(leesUurCel('0.625')).toEqual({ uur: 15, minuut: 0 });
  });

  it('leest hetzelfde uur als HH:MM', () => {
    expect(leesUurCel('15:00')).toEqual({ uur: 15, minuut: 0 });
    expect(leesUurCel('9:30')).toEqual({ uur: 9, minuut: 30 });
    expect(leesUurCel('09.30')).toEqual({ uur: 9, minuut: 30 });
  });

  it('geeft 14:00 en niet 13:59 bij de breuk uit koen.xlsx', () => {
    expect(leesUurCel('0.58333333333333337')).toEqual({ uur: 14, minuut: 0 });
  });

  it('geeft niets buiten een echte klok', () => {
    expect(leesUurCel('24:00')).toBeNull();
    expect(leesUurCel('15:60')).toBeNull();
    expect(leesUurCel('kwart over')).toBeNull();
    expect(leesUurCel('')).toBeNull();
  });
});

describe('kiesLessenBlad', () => {
  const blad = (naam: string) => ({ naam, rijen: [] });

  it('kiest het blad Lessen uit de werkmap van de eigen export', () => {
    const gekozen = kiesLessenBlad([blad('Groepen'), blad('Lessen'), blad('Uren per trainer')]);
    expect(gekozen?.naam).toBe('Lessen');
  });

  it('trekt zich niets aan van hoofdletters', () => {
    expect(kiesLessenBlad([blad('Groepen'), blad('LESSEN')])?.naam).toBe('LESSEN');
  });

  it('neemt het enige blad als het anders heet', () => {
    expect(kiesLessenBlad([blad('Sheet1')])?.naam).toBe('Sheet1');
  });

  it('geeft niets bij een werkmap zonder bladen', () => {
    expect(kiesLessenBlad([])).toBeNull();
  });
});

describe('leesLesRegels', () => {
  it('geeft per bruikbare rij een regel met het nummer zoals Excel het toont', () => {
    const uitkomst = leesLesRegels([
      KOP_MINIMAAL,
      ['46274', '0.625', 'Groep 4', 'Leemans Koen', 'de Clippele Antoine'],
    ]);
    expect(uitkomst.fouten).toEqual([]);
    expect(uitkomst.regels).toEqual([{
      regel: 2,
      datum: { jaar: 2026, maand: 9, dag: 9 },
      uur: { uur: 15, minuut: 0 },
      groep: 'Groep 4',
      groepId: '',
      typeLes: '',
      coach: 'Leemans Koen',
      leerling: 'de Clippele Antoine',
      emailLeerling: '',
      baan: '',
    }]);
  });

  it('trimt elke tekstcel', () => {
    const uitkomst = leesLesRegels([
      [...KOP_MINIMAAL, 'Groep-ID', 'Type les', 'E-mail leerling', 'Baan'],
      ['09/09/2026', '15:00', ' Groep 4 ', ' Koen ', ' Antoine ', ' g-7 ', ' Duoles ', ' a@b.be ', ' Baan 2 '],
    ]);
    expect(uitkomst.regels[0]).toMatchObject({
      groep: 'Groep 4', coach: 'Koen', leerling: 'Antoine',
      groepId: 'g-7', typeLes: 'Duoles', emailLeerling: 'a@b.be', baan: 'Baan 2',
    });
  });

  it('meldt een onleesbare datum met regelnummer en waarde, en geeft er geen regel voor', () => {
    const uitkomst = leesLesRegels([
      KOP_MINIMAAL,
      ['morgen', '15:00', 'Groep 4', 'Koen', 'Antoine'],
    ]);
    expect(uitkomst.regels).toEqual([]);
    expect(uitkomst.fouten).toEqual([
      { regel: 2, reden: 'Deze datum kon niet gelezen worden: {waarde}', vars: { waarde: 'morgen' } },
    ]);
  });

  it('meldt een onleesbaar uur met regelnummer en waarde', () => {
    const uitkomst = leesLesRegels([
      KOP_MINIMAAL,
      ['09/09/2026', 'kwart over', 'Groep 4', 'Koen', 'Antoine'],
    ]);
    expect(uitkomst.regels).toEqual([]);
    expect(uitkomst.fouten[0]).toEqual(
      { regel: 2, reden: 'Dit uur kon niet gelezen worden: {waarde}', vars: { waarde: 'kwart over' } },
    );
  });

  it('meldt een lege coach en een lege leerling', () => {
    const uitkomst = leesLesRegels([
      KOP_MINIMAAL,
      ['09/09/2026', '15:00', 'Groep 4', '  ', 'Antoine'],
      ['09/09/2026', '15:00', 'Groep 4', 'Koen', ''],
    ]);
    expect(uitkomst.regels).toEqual([]);
    expect(uitkomst.fouten.map((f) => f.regel)).toEqual([2, 3]);
  });

  it('laat een lege groep gewoon door: dat is een privéles', () => {
    const uitkomst = leesLesRegels([
      KOP_MINIMAAL,
      ['09/09/2026', '15:00', '', 'Koen', 'Antoine'],
    ]);
    expect(uitkomst.fouten).toEqual([]);
    expect(uitkomst.regels[0].groep).toBe('');
  });

  it('slaat een lege rij stilzwijgend over, ook als er alleen witruimte in staat', () => {
    const uitkomst = leesLesRegels([
      KOP_MINIMAAL,
      [],
      ['  ', '', '   ', '', ' '],
      ['09/09/2026', '15:00', 'Groep 4', 'Koen', 'Antoine'],
    ]);
    expect(uitkomst.fouten).toEqual([]);
    expect(uitkomst.regels.map((r) => r.regel)).toEqual([4]);
  });

  it('keurt een bestand zonder verplichte kolom af met één fout op regel 1', () => {
    const uitkomst = leesLesRegels([
      ['Datum', 'Uur', 'Groep', 'Leerling'],
      ['09/09/2026', '15:00', 'Groep 4', 'Antoine'],
    ]);
    expect(uitkomst.regels).toEqual([]);
    expect(uitkomst.fouten).toHaveLength(1);
    expect(uitkomst.fouten[0].regel).toBe(1);
    expect(bestandAfgekeurdLessen(uitkomst)).toBe(true);
  });

  it('keurt een leeg bestand af met één fout op regel 1', () => {
    const uitkomst = leesLesRegels([]);
    expect(bestandAfgekeurdLessen(uitkomst)).toBe(true);
  });

  it('geeft de lijstjes van de koprij door', () => {
    const uitkomst = leesLesRegels([[...KOP_MINIMAAL, 'Opmerking', 'Coach']]);
    expect(uitkomst.nietHerkend).toEqual(['Opmerking']);
    expect(uitkomst.dubbel).toEqual(['Coach']);
  });

  it('leest de 1398 regels van koen.xlsx zonder één fout', () => {
    const blad = kiesLessenBlad(leesWerkmap(koenBytes()));
    const uitkomst = leesLesRegels(blad!.rijen);
    expect(uitkomst.fouten).toEqual([]);
    expect(uitkomst.nietHerkend).toEqual([]);
    expect(uitkomst.regels).toHaveLength(1398);
    expect(uitkomst.regels[0]).toMatchObject({
      regel: 2,
      datum: { jaar: 2026, maand: 9, dag: 9 },
      uur: { uur: 14, minuut: 0 },
      typeLes: 'Duoles',
      groep: 'Groep 4',
      coach: 'Leemans Koen',
      leerling: 'de Clippele Antoine',
    });
  });
});

describe('voorbeeldTrainingenXlsx', () => {
  const bladVan = () => {
    const bladen = leesWerkmap(voorbeeldTrainingenXlsx());
    const blad = kiesLessenBlad(bladen);
    if (!blad) throw new Error('het sjabloon heeft geen blad');
    return blad;
  };

  it('levert een werkmap op die de eigen lezer weer opent, met het blad Lessen', () => {
    expect(bladVan().naam).toBe('Lessen');
  });

  it('toont alle negen kolommen die de import leest', () => {
    const koprij = bladVan().rijen[0];
    for (const kop of [
      'Datum', 'Uur', 'Groep', 'Coach', 'Leerling',
      'Groep-ID', 'Type les', 'E-mail leerling', 'Baan',
    ]) {
      expect(koprij).toContain(kop);
    }
  });

  it('heeft een koprij die de eigen import zonder ruis herkent', () => {
    const kop = leesKopregelLessen(bladVan().rijen[0]);
    expect(kop.kolommen).not.toBeNull();
    expect(kop.nietHerkend).toEqual([]);
    expect(kop.dubbel).toEqual([]);
  });

  it('laat met twee regels zien dat een lege cel gewoon mag', () => {
    const rijen = bladVan().rijen;
    expect(rijen).toHaveLength(3); // de koprij plus twee voorbeeldregels
    const kolommen = leesKopregelLessen(rijen[0]).kolommen!;
    expect(rijen[2][kolommen.baan!]).toBe('');
    expect(rijen[2][kolommen.emailLeerling!]).toBe('');
    expect(rijen[1][kolommen.baan!]).not.toBe('');
    expect(rijen[1][kolommen.emailLeerling!]).not.toBe('');
  });

  it('wordt door de eigen import foutloos teruggelezen', () => {
    const uitkomst = leesLesRegels(bladVan().rijen);
    expect(uitkomst.fouten).toEqual([]);
    expect(uitkomst.nietHerkend).toEqual([]);
    expect(uitkomst.regels).toHaveLength(2);
  });

  it('legt met twee regels van dezelfde les de vorm uit die de import verwacht', () => {
    // Eén regel per les × leerling (D-01): dezelfde datum, hetzelfde uur, dezelfde groep,
    // twee verschillende leerlingen.
    const [een, twee] = leesLesRegels(bladVan().rijen).regels;
    expect(twee.datum).toEqual(een.datum);
    expect(twee.uur).toEqual(een.uur);
    expect(twee.groep).toBe(een.groep);
    expect(twee.leerling).not.toBe(een.leerling);
  });

  it('schrijft de datum als datumcel en niet als tekst', () => {
    const kolommen = leesKopregelLessen(bladVan().rijen[0]).kolommen!;
    const cel = bladVan().rijen[1][kolommen.datum];
    // Een datumcel komt er als het serienummer van Excel uit; een tekstcel zou "08/09/2027" geven.
    expect(cel).toMatch(/^\d+$/);
    const datum = leesDatumCel(cel)!;
    expect(datum).toEqual({ jaar: 2027, maand: 9, dag: 8 });
    expect(Number(cel)).toBe(datumNaarSerie(new Date(2027, 8, 8)));
  });
});

// ---------------------------------------------------------------------------
// De lesgroepen die uit de regels volgen (IMP-03)
// ---------------------------------------------------------------------------

/**
 * Eén lesregel, met alleen het veld dat de test wil zeggen. De beginwaarden zijn een woensdag
 * (9 september 2026 is `getDay() === 3`), zodat een test die over de weekdag gaat die datum
 * bewust moet overschrijven en niet per ongeluk.
 */
function regelVan(over: Partial<LesRegel> = {}): LesRegel {
  return {
    regel: 2,
    datum: { jaar: 2026, maand: 9, dag: 9 },
    uur: { uur: 17, minuut: 0 },
    groep: 'Groep 8',
    groepId: '',
    typeLes: 'Kidstennis oranje',
    coach: 'Leemans Koen',
    leerling: 'Peferoen Astor',
    emailLeerling: '',
    baan: '',
    ...over,
  };
}

/** Een bestaande lesgroep van de club, met alleen het veld dat de test wil zeggen. */
function groepVan(over: Partial<LesGroep> = {}): LesGroep {
  return {
    id: 'g-8-woensdag',
    name: 'Groep 8',
    level: 'Kidstennis oranje',
    weekday: 3,
    start_hour: 17,
    start_minute: 0,
    season_start: '2026-09-09',
    season_end: '2027-06-23',
    roster: [],
    archived: false,
    ...over,
  };
}

describe('groepenUitRegels', () => {
  it('voegt regels met dezelfde groep, dag en uur samen tot één groep', () => {
    const uitkomst = groepenUitRegels([
      regelVan({ regel: 2, leerling: 'Peferoen Astor' }),
      regelVan({ regel: 3, leerling: 'Martens Clara' }),
      regelVan({ regel: 4, datum: { jaar: 2026, maand: 9, dag: 16 }, leerling: 'Peferoen Astor' }),
    ], []);
    expect(uitkomst.groepen).toHaveLength(1);
    expect(uitkomst.groepen[0].leerlingNamen).toEqual(['Peferoen Astor', 'Martens Clara']);
    expect(uitkomst.groepen[0].regels).toHaveLength(3);
    expect(uitkomst.waarschuwingen).toEqual([]);
  });

  it('gebruikt de sleutel van lib/lesgroepen en geen eigen versie', () => {
    const [groep] = groepenUitRegels([regelVan()], []).groepen;
    expect(groep.sleutel).toBe(groepSleutel({ name: 'Groep 8', weekday: 3, start_hour: 17 }));
    expect(groep.weekdag).toBe(3);
    expect(groep.beginuur).toBe(17);
    expect(groep.beginminuut).toBe(0);
  });

  it('scheidt dezelfde groepsnaam op een andere dag of een ander uur', () => {
    const uitkomst = groepenUitRegels([
      regelVan({ regel: 2, leerling: 'Peferoen Astor' }),
      regelVan({ regel: 3, datum: { jaar: 2026, maand: 9, dag: 11 }, leerling: 'Bertrem Mila' }),
      regelVan({ regel: 4, datum: { jaar: 2026, maand: 9, dag: 11 }, uur: { uur: 19, minuut: 0 }, leerling: 'Malcolm Eric' }),
    ], []);
    expect(uitkomst.groepen).toHaveLength(3);
    expect(uitkomst.groepen.map((g) => g.leerlingNamen)).toEqual([
      ['Peferoen Astor'], ['Bertrem Mila'], ['Malcolm Eric'],
    ]);
  });

  it('maakt van een regel zonder groep geen groep — dat is een privéles', () => {
    const uitkomst = groepenUitRegels([regelVan({ groep: '' }), regelVan({ regel: 3, groep: '   ' })], []);
    expect(uitkomst.groepen).toEqual([]);
    expect(uitkomst.waarschuwingen).toEqual([]);
  });

  it('neemt de vroegste en de laatste datum als seizoen', () => {
    const [groep] = groepenUitRegels([
      regelVan({ regel: 2, datum: { jaar: 2026, maand: 10, dag: 7 } }),
      regelVan({ regel: 3, datum: { jaar: 2026, maand: 9, dag: 9 } }),
      regelVan({ regel: 4, datum: { jaar: 2027, maand: 6, dag: 23 } }),
    ], []).groepen;
    expect(groep.seizoenVan).toBe('2026-09-09');
    expect(groep.seizoenTot).toBe('2027-06-23');
  });

  it('kiest bij twee lessoorten de meest voorkomende en meldt beide waarden', () => {
    const uitkomst = groepenUitRegels([
      regelVan({ regel: 2, typeLes: 'Oranje' }),
      regelVan({ regel: 3, typeLes: 'Groen' }),
      regelVan({ regel: 4, typeLes: 'Oranje' }),
    ], []);
    expect(uitkomst.groepen[0].niveau).toBe('Oranje');
    expect(uitkomst.waarschuwingen).toHaveLength(1);
    expect(uitkomst.waarschuwingen[0].regel).toBe(3);
    expect(uitkomst.waarschuwingen[0].vars).toMatchObject({ gekozen: 'Oranje', andere: 'Groen' });
  });

  it('meldt niets over een lege Type les — een lege cel is geen tweede lessoort', () => {
    const uitkomst = groepenUitRegels([
      regelVan({ regel: 2, typeLes: 'Oranje' }),
      regelVan({ regel: 3, typeLes: '' }),
    ], []);
    expect(uitkomst.groepen[0].niveau).toBe('Oranje');
    expect(uitkomst.waarschuwingen).toEqual([]);
  });

  it('kiest bij twee coaches de meest voorkomende en meldt het', () => {
    const uitkomst = groepenUitRegels([
      regelVan({ regel: 2, coach: 'Leemans Koen' }),
      regelVan({ regel: 3, coach: 'Maes Sofie' }),
      regelVan({ regel: 4, coach: 'Leemans Koen' }),
    ], []);
    expect(uitkomst.groepen[0].coachNaam).toBe('Leemans Koen');
    expect(uitkomst.waarschuwingen).toHaveLength(1);
    expect(uitkomst.waarschuwingen[0].regel).toBe(3);
    expect(uitkomst.waarschuwingen[0].vars).toMatchObject({ gekozen: 'Leemans Koen', andere: 'Maes Sofie' });
  });

  it('herkent een bestaande groep op de sleutel', () => {
    const bestaand = groepVan();
    const [groep] = groepenUitRegels([regelVan()], [bestaand]).groepen;
    expect(groep.bestaand).toBe(bestaand);
  });

  it('laat een Groep-ID winnen van de sleutel, ook als naam en uur veranderd zijn', () => {
    const bestaand = groepVan({ id: 'g-42' });
    const uitkomst = groepenUitRegels([
      regelVan({ regel: 2, groepId: 'g-42', groep: 'Groep 9', uur: { uur: 18, minuut: 0 } }),
      regelVan({ regel: 3, groepId: 'g-42', groep: 'Groep 9', uur: { uur: 18, minuut: 0 }, leerling: 'Martens Clara' }),
    ], [bestaand]);
    expect(uitkomst.groepen).toHaveLength(1);
    expect(uitkomst.groepen[0].bestaand).toBe(bestaand);
    expect(uitkomst.groepen[0].naam).toBe('Groep 9');
    expect(uitkomst.waarschuwingen).toEqual([]);
  });

  it('voegt twee regels met hetzelfde Groep-ID samen, ook als hun sleutel verschilt', () => {
    const bestaand = groepVan({ id: 'g-42' });
    const uitkomst = groepenUitRegels([
      regelVan({ regel: 2, groepId: 'g-42', leerling: 'Peferoen Astor' }),
      regelVan({ regel: 3, groepId: 'g-42', uur: { uur: 19, minuut: 0 }, leerling: 'Martens Clara' }),
    ], [bestaand]);
    expect(uitkomst.groepen).toHaveLength(1);
    expect(uitkomst.groepen[0].leerlingNamen).toEqual(['Peferoen Astor', 'Martens Clara']);
  });

  it('valt terug op de sleutel bij een Groep-ID dat de club niet kent, met één waarschuwing', () => {
    const uitkomst = groepenUitRegels([
      regelVan({ regel: 2, groepId: 'van-vorig-seizoen' }),
      regelVan({ regel: 3, groepId: 'van-vorig-seizoen', leerling: 'Martens Clara' }),
    ], [groepVan()]);
    expect(uitkomst.groepen).toHaveLength(1);
    expect(uitkomst.groepen[0].sleutel).toBe(groepSleutel({ name: 'Groep 8', weekday: 3, start_hour: 17 }));
    expect(uitkomst.waarschuwingen).toHaveLength(1);
    expect(uitkomst.waarschuwingen[0].regel).toBe(2);
    expect(uitkomst.waarschuwingen[0].vars).toMatchObject({ waarde: 'van-vorig-seizoen' });
  });

  it('herkent een gearchiveerde groep niet — archiveren was een bewuste daad', () => {
    const uitkomst = groepenUitRegels([regelVan()], [groepVan({ archived: true })]);
    expect(uitkomst.groepen[0].bestaand).toBeNull();
  });

  it('herkent ook een gearchiveerde groep niet op haar Groep-ID', () => {
    const uitkomst = groepenUitRegels([regelVan({ groepId: 'g-8-woensdag' })], [groepVan({ archived: true })]);
    expect(uitkomst.groepen[0].bestaand).toBeNull();
    expect(uitkomst.waarschuwingen).toHaveLength(1);
  });

  it('levert op koen.xlsx tien groepen met zeven namen', () => {
    // Tien en niet zeven: "Groep 8" staat op drie momenten en "Groep 12" op twee. IMP-10 en de
    // ROADMAP zeggen "zeven lesgroepen" en tellen daarmee de groepsnámen; de sleutel van D-02
    // telt de groepen. Allebei staan ze hier, zodat de volgende lezer weet dat dit klopt.
    const blad = kiesLessenBlad(leesWerkmap(koenBytes()))!;
    const { regels } = leesLesRegels(blad.rijen);
    const uitkomst = groepenUitRegels(regels, []);
    expect(uitkomst.groepen).toHaveLength(10);
    expect(new Set(uitkomst.groepen.map((g) => g.naam)).size).toBe(7);
    expect(uitkomst.groepen.every((g) => g.coachNaam === 'Leemans Koen')).toBe(true);
    expect(uitkomst.groepen.every((g) => g.bestaand === null)).toBe(true);
  });

  it('maakt van "Groep 8" drie groepen met zes, vier en twee spelers en nul overlap', () => {
    const blad = kiesLessenBlad(leesWerkmap(koenBytes()))!;
    const { regels } = leesLesRegels(blad.rijen);
    const acht = groepenUitRegels(regels, []).groepen.filter((g) => g.naam === 'Groep 8');
    expect(acht.map((g) => [g.weekdag, g.beginuur, g.leerlingNamen.length])).toEqual([
      [3, 17, 6], [5, 17, 4], [5, 19, 2],
    ]);
    const alle = acht.flatMap((g) => g.leerlingNamen);
    // Nul overlap: twaalf regels, twaalf verschillende mensen. Matchen op de naam alleen zou
    // hier één groep van twaalf van maken — dat is waarom de sleutel de dag en het uur meetelt.
    expect(new Set(alle).size).toBe(12);
    expect(acht[0].seizoenVan).toBe('2026-09-09');
    expect(acht[0].seizoenTot).toBe('2027-06-23');
  });
});

describe('groepRosterVerschil', () => {
  it('noemt een groep zonder bestaande tegenhanger nieuw', () => {
    expect(groepRosterVerschil(null, ['u1', 'u2'])).toEqual({
      status: 'nieuw', toegevoegd: ['u1', 'u2'], verwijderd: [],
    });
  });

  it('noemt een gelijk roster ongewijzigd, ongeacht de volgorde', () => {
    expect(groepRosterVerschil(groepVan({ roster: ['u2', 'u1'] }), ['u1', 'u2'])).toEqual({
      status: 'ongewijzigd', toegevoegd: [], verwijderd: [],
    });
  });

  it('noemt precies wie erbij komt en wie eraf gaat', () => {
    expect(groepRosterVerschil(groepVan({ roster: ['u1', 'u2'] }), ['u2', 'u3'])).toEqual({
      status: 'bijgewerkt', toegevoegd: ['u3'], verwijderd: ['u1'],
    });
  });
});

// ---------------------------------------------------------------------------
// Spelers, trainers en banen (IMP-04)
// ---------------------------------------------------------------------------

/** Een lid van de club, met alleen het veld dat de test wil zeggen. */
function userVan(over: Partial<User> = {}): User {
  return { id: 'u1', name: 'Koen Leemans', email: 'koen@voorbeeld.be', role: 'player', ...over };
}

/** Een baan van de club, met alleen het veld dat de test wil zeggen. */
function baanVan(over: Partial<Court> = {}): Court {
  return { id: 'c1', name: 'Baan 1', number: 1, indoor: false, hourly_rate: 20, ...over };
}

describe('zoekTrainer', () => {
  const koen = userVan({ id: 'u-koen', name: 'Koen Leemans', role: 'coach' });

  it('vindt "Koen Leemans" als het bestand "Leemans Koen" schrijft', () => {
    expect(zoekTrainer([koen], 'Leemans Koen')).toBe(koen);
  });

  it('kijkt alleen naar trainers, niet naar spelers met dezelfde naam', () => {
    const speler = userVan({ id: 'u-speler', name: 'Koen Leemans', role: 'player' });
    expect(zoekTrainer([speler], 'Leemans Koen')).toBeNull();
    expect(zoekTrainer([speler, koen], 'Leemans Koen')).toBe(koen);
  });

  it('kiest niet tussen twee trainers die allebei passen', () => {
    const tweede = userVan({ id: 'u-2', name: 'Leemans Koen', role: 'coach' });
    expect(zoekTrainer([koen, tweede], 'Koen Leemans')).toBeNull();
  });

  it('vindt niemand bij een lege naam', () => {
    expect(zoekTrainer([koen], '  ')).toBeNull();
  });
});

describe('zoekBaan', () => {
  const banen = [baanVan(), baanVan({ id: 'c2', name: 'Terras', number: 2 })];

  it('vindt een baan op naam, ongeacht hoofdletters en spaties', () => {
    expect(zoekBaan(banen, ' baan 1 ')?.id).toBe('c1');
  });

  it('vindt een baan op nummer', () => {
    expect(zoekBaan(banen, '2')?.id).toBe('c2');
  });

  it('vindt niets bij een lege of onbekende waarde', () => {
    expect(zoekBaan(banen, '')).toBeNull();
    expect(zoekBaan(banen, 'Baan 7')).toBeNull();
    expect(zoekBaan(banen, '7')).toBeNull();
  });
});

describe('spelersUitRegels', () => {
  it('herkent een leerling die exact zo in de ledenlijst staat', () => {
    const antoine = userVan({ id: 'u-a', name: 'Antoine de Clippele' });
    const uitkomst = spelersUitRegels([regelVan({ leerling: 'Antoine de Clippele' })], [antoine]);
    expect(uitkomst.spelers).toEqual([{ naam: 'Antoine de Clippele', email: '', bestaand: antoine }]);
    expect(uitkomst.waarschuwingen).toEqual([]);
  });

  it('herkent "de Clippele Antoine" als de bestaande Antoine de Clippele', () => {
    const antoine = userVan({ id: 'u-a', name: 'Antoine de Clippele' });
    const uitkomst = spelersUitRegels([regelVan({ leerling: 'de Clippele Antoine' })], [antoine]);
    expect(uitkomst.spelers[0].bestaand).toBe(antoine);
  });

  it('zet een onbekende leerling met zijn genormaliseerde adres in het plan', () => {
    const uitkomst = spelersUitRegels(
      [regelVan({ leerling: 'Peferoen Astor', emailLeerling: '  Astor@Club.BE ' })],
      [],
    );
    expect(uitkomst.spelers).toEqual([
      { naam: 'Peferoen Astor', email: 'astor@club.be', bestaand: null },
    ]);
  });

  it('maakt van dezelfde onbekende leerling op honderd regels één nieuw lid', () => {
    const regels = Array.from({ length: 100 }, (_, i) => regelVan({
      regel: i + 2,
      leerling: i % 2 === 0 ? 'Peferoen Astor' : ' peferoen astor ',
    }));
    const uitkomst = spelersUitRegels(regels, []);
    expect(uitkomst.spelers).toHaveLength(1);
    expect(uitkomst.spelers[0].naam).toBe('Peferoen Astor');
  });

  it('neemt het eerste adres dat ingevuld is', () => {
    const uitkomst = spelersUitRegels([
      regelVan({ regel: 2, emailLeerling: '' }),
      regelVan({ regel: 3, emailLeerling: 'astor@club.be' }),
    ], []);
    expect(uitkomst.spelers[0].email).toBe('astor@club.be');
  });

  it('koppelt niets als twee leden op dezelfde naam passen, en meldt het', () => {
    const een = userVan({ id: 'u-1', name: 'Koen Leemans' });
    const twee = userVan({ id: 'u-2', name: 'Leemans Koen' });
    const uitkomst = spelersUitRegels([regelVan({ regel: 7, leerling: 'Koen Leemans' })], [een, twee]);
    // Niet in het plan: hem als nieuw lid opnemen zou een derde Koen Leemans opleveren, en dat
    // is erger dan hem overslaan met een melding waar de beheerder iets mee kan.
    expect(uitkomst.spelers).toEqual([]);
    expect(uitkomst.waarschuwingen).toHaveLength(1);
    expect(uitkomst.waarschuwingen[0].regel).toBe(7);
    expect(uitkomst.waarschuwingen[0].vars).toMatchObject({ naam: 'Koen Leemans' });
  });

  it('levert op koen.xlsx met een lege ledenlijst 42 nieuwe spelers zonder dubbels', () => {
    const blad = kiesLessenBlad(leesWerkmap(koenBytes()))!;
    const { regels } = leesLesRegels(blad.rijen);
    const uitkomst = spelersUitRegels(regels, []);
    expect(uitkomst.spelers).toHaveLength(42);
    expect(uitkomst.spelers.every((s) => s.bestaand === null)).toBe(true);
    expect(uitkomst.waarschuwingen).toEqual([]);
    expect(new Set(uitkomst.spelers.map((s) => s.naam)).size).toBe(42);
  });
});

describe('nieuwLidUitSpeler', () => {
  it('bouwt een speler zoals de ledenimport een lid bouwt', () => {
    const lid = nieuwLidUitSpeler({ naam: 'Peferoen Astor', email: 'astor@club.be', bestaand: null });
    expect(lid).toEqual({ name: 'Peferoen Astor', email: 'astor@club.be', role: 'player' });
    // Geen sleutel met `undefined` erin: dat is het verschil tussen "niet ingevuld" en
    // "leeggemaakt", precies zoals in lib/import-leden.ts.
    expect(Object.keys(lid).sort()).toEqual(['email', 'name', 'role']);
  });
});

describe('koppelingVoorGroep', () => {
  const [groep] = groepenUitRegels([regelVan({ coach: 'Leemans Koen', baan: 'Baan 1' })], []).groepen;
  const koen = userVan({ id: 'u-koen', name: 'Koen Leemans', role: 'coach' });

  it('vindt de trainer en de baan zonder één melding', () => {
    const koppeling = koppelingVoorGroep(groep, [koen], [baanVan()]);
    expect(koppeling.trainer).toBe(koen);
    expect(koppeling.baan?.id).toBe('c1');
    expect(koppeling.meldingen).toEqual([]);
  });

  it('meldt een onbekende trainer één keer per groep, met zijn naam erin', () => {
    const koppeling = koppelingVoorGroep(groep, [], [baanVan()]);
    expect(koppeling.trainer).toBeNull();
    expect(koppeling.meldingen).toHaveLength(1);
    expect(koppeling.meldingen[0].regel).toBe(groep.regels[0].regel);
    expect(koppeling.meldingen[0].vars).toMatchObject({ naam: 'Leemans Koen', groep: 'Groep 8' });
  });

  it('meldt een onbekende baan één keer per groep', () => {
    const koppeling = koppelingVoorGroep(groep, [koen], []);
    expect(koppeling.baan).toBeNull();
    expect(koppeling.meldingen).toHaveLength(1);
    expect(koppeling.meldingen[0].vars).toMatchObject({ waarde: 'Baan 1' });
  });

  it('meldt bij een lege Baan dat er geen baan opgegeven is en niet dat de naam fout is', () => {
    const [zonder] = groepenUitRegels([regelVan({ baan: '' })], []).groepen;
    const koppeling = koppelingVoorGroep(zonder, [koen], [baanVan()]);
    expect(koppeling.baan).toBeNull();
    expect(koppeling.meldingen).toHaveLength(1);
    expect(koppeling.meldingen[0].vars).toEqual({ groep: 'Groep 8' });
  });

  it('geeft op koen.xlsx twintig meldingen en niet veertienhonderd', () => {
    // Tien groepen × (geen trainersaccount + geen kolom Baan). Eén melding per groep is het
    // verschil tussen een droogloop en een muur: per regel zouden dit er 2796 zijn.
    const blad = kiesLessenBlad(leesWerkmap(koenBytes()))!;
    const { regels } = leesLesRegels(blad.rijen);
    const groepen = groepenUitRegels(regels, []).groepen;
    const meldingen = groepen.flatMap((g) => koppelingVoorGroep(g, [], []).meldingen);
    expect(groepen).toHaveLength(10);
    expect(meldingen).toHaveLength(20);
    expect(meldingen.filter((m) => m.vars?.naam === 'Leemans Koen')).toHaveLength(10);
  });

  it('maakt geen trainer aan als er geen is — de groep gaat door, de lessen niet', () => {
    const koppeling = koppelingVoorGroep(groep, [], []);
    expect(koppeling.trainer).toBeNull();
    expect(koppeling.baan).toBeNull();
    // De groep zelf blijft gewoon bestaan, mét haar roster: `LesGroep.coach_id` mag leeg zijn.
    expect(groep.leerlingNamen).toEqual(['Peferoen Astor']);
  });
});

// ---------------------------------------------------------------------------
// De lessen zelf (plan 05-06)
// ---------------------------------------------------------------------------

/** Een bestaande boeking van de club, met alleen het veld dat de test wil zeggen. */
function boekingVan(over: Partial<ImportBoeking> = {}): ImportBoeking {
  return {
    id: 'b1',
    group_id: 'g-8-woensdag',
    coach_id: 'u-koen',
    court_id: 'c1',
    start_time: new Date(2026, 8, 9, 17, 0).toISOString(),
    end_time: new Date(2026, 8, 9, 18, 0).toISOString(),
    status: 'confirmed',
    ...over,
  };
}

/** De trainer, de baan en het moment waar de rest van deze tests vanuit gaat. */
const KOEN = userVan({ id: 'u-koen', name: 'Koen Leemans', role: 'coach' });
const BAAN = baanVan();
const GEKOPPELD: GroepKoppeling = { trainer: KOEN, baan: BAAN, meldingen: [] };
/** Ruim vóór 9 september 2026: alles uit deze tests ligt dus in de toekomst. */
const NU = new Date(2026, 8, 1);

/** De ene groep die uit deze regels volgt. */
function groepUit(regels: LesRegel[], bestaande: LesGroep[] = []): GeplandeGroep {
  return groepenUitRegels(regels, bestaande).groepen[0];
}

describe('lesSleutel', () => {
  it('is een herkenningssleutel van groep, dag en beginuur', () => {
    expect(lesSleutel('g-8', '2026-09-09', 17, 0)).toBe('g-8|2026-09-09|17|0');
  });

  it('trekt zich niets aan van hoofdletters en spaties eromheen', () => {
    expect(lesSleutel(' G-8 ', '2026-09-09', 17, 0)).toBe(lesSleutel('g-8', '2026-09-09', 17, 0));
  });

  it('scheidt twee lessen van dezelfde groep op hetzelfde uur van een andere dag', () => {
    expect(lesSleutel('g-8', '2026-09-09', 17, 0)).not.toBe(lesSleutel('g-8', '2026-09-16', 17, 0));
  });
});

describe('lesduurVan', () => {
  it('neemt de clubinstelling', () => {
    expect(lesduurVan({ lesson_duration_minutes: 90 })).toBe(90);
  });

  it('duurt zestig minuten als de instelling er niet is', () => {
    expect(lesduurVan({})).toBe(60);
  });
});

describe('deelnemersVoorLes', () => {
  it('zet de eerste speler als betaler en de rest ernaast', () => {
    expect(deelnemersVoorLes(['a', 'b', 'c'])).toEqual({
      player_id: 'a',
      participant_ids: ['b', 'c'],
      payment_method: GROEPSLES_METHOD,
    });
  });

  it('laat een les met één speler zijn betaalwijze nog open', () => {
    expect(deelnemersVoorLes(['a'])).toEqual({
      player_id: 'a',
      participant_ids: [],
      payment_method: 'open',
    });
  });

  it('levert niets op zonder speler — een les zonder speler bestaat niet', () => {
    expect(deelnemersVoorLes([])).toBeNull();
  });
});

describe('lessenUitGroep', () => {
  it('plant één les op het lokale uur uit het bestand, een uur lang', () => {
    const groep = groepUit([regelVan({ uur: { uur: 14, minuut: 0 } })]);
    const uit = lessenUitGroep(groep, GEKOPPELD, [], [], 60, NU);
    expect(uit.nieuweLessen).toHaveLength(1);
    const les = uit.nieuweLessen[0];
    expect(les.start.getFullYear()).toBe(2026);
    expect(les.start.getMonth()).toBe(8);
    expect(les.start.getDate()).toBe(9);
    expect(les.start.getHours()).toBe(14);
    expect(les.eind.getHours()).toBe(15);
    expect(les.regel).toBe(2);
    expect(les.groep).toBe(groep);
  });

  it('maakt van anderhalf uur les ook anderhalf uur', () => {
    const groep = groepUit([regelVan({ uur: { uur: 17, minuut: 0 } })]);
    const [les] = lessenUitGroep(groep, GEKOPPELD, [], [], 90, NU).nieuweLessen;
    expect(les.eind.getHours()).toBe(18);
    expect(les.eind.getMinutes()).toBe(30);
  });

  it('maakt van zes regels van dezelfde les één les en geen zes', () => {
    const groep = groepUit([
      regelVan({ regel: 2, leerling: 'Peferoen Astor' }),
      regelVan({ regel: 3, leerling: 'Martens Clara' }),
      regelVan({ regel: 4, leerling: 'Bertrem Mila' }),
    ]);
    expect(lessenUitGroep(groep, GEKOPPELD, [], [], 60, NU).nieuweLessen).toHaveLength(1);
  });

  it('slaat een les in een clubvakantie over, met de naam van de vakantie erbij', () => {
    const groep = groepUit([regelVan()]);
    const herfst = { id: 'v1', naam: 'Herfstvakantie', van: '2026-09-07', tot: '2026-09-13' };
    const uit = lessenUitGroep(groep, GEKOPPELD, [], [herfst], 60, NU);
    expect(uit.nieuweLessen).toEqual([]);
    expect(uit.overgeslagen).toHaveLength(1);
    expect(uit.overgeslagen[0].reden).toBe('vakantie');
    expect(uit.overgeslagen[0].vakantie).toBe('Herfstvakantie');
  });

  it('meldt een les die botst met een bezette trainer en raakt de bestaande les niet aan', () => {
    const groep = groepUit([regelVan()]);
    const bezet = boekingVan({ id: 'b-ander', group_id: 'g-ander', court_id: 'c9' });
    const uit = lessenUitGroep(groep, GEKOPPELD, [bezet], [], 60, NU);
    expect(uit.nieuweLessen).toEqual([]);
    expect(uit.overgeslagen.map((o) => o.reden)).toEqual(['bezet']);
    expect(bezet.start_time).toBe(new Date(2026, 8, 9, 17, 0).toISOString());
  });

  it('meldt ook een les die botst met een bezette baan', () => {
    const groep = groepUit([regelVan()]);
    const bezet = boekingVan({ id: 'b-ander', group_id: 'g-ander', coach_id: 'u-sofie' });
    const uit = lessenUitGroep(groep, GEKOPPELD, [bezet], [], 60, NU);
    expect(uit.overgeslagen.map((o) => o.reden)).toEqual(['bezet']);
  });

  it('telt een les in een vakantie én in een bezet uur één keer, als vakantie', () => {
    const groep = groepUit([regelVan()]);
    const bezet = boekingVan({ id: 'b-ander', group_id: 'g-ander' });
    const herfst = { id: 'v1', naam: 'Herfstvakantie', van: '2026-09-07', tot: '2026-09-13' };
    const uit = lessenUitGroep(groep, GEKOPPELD, [bezet], [herfst], 60, NU);
    expect(uit.overgeslagen).toHaveLength(1);
    expect(uit.overgeslagen[0].reden).toBe('vakantie');
  });

  it('laat het bestand ook met zichzelf botsen: de tweede groep op hetzelfde uur gaat niet door', () => {
    const eerste = groepUit([regelVan({ groep: 'Groep 8' })]);
    const tweede = groepUit([regelVan({ regel: 20, groep: 'Groep 12', leerling: 'Bertrem Mila' })]);
    const uitEerste = lessenUitGroep(eerste, GEKOPPELD, [], [], 60, NU);
    expect(uitEerste.nieuweLessen).toHaveLength(1);
    const reeds = uitEerste.nieuweLessen.map((l) => alsBezet(l, GEKOPPELD));
    const uitTweede = lessenUitGroep(tweede, GEKOPPELD, reeds, [], 60, NU);
    expect(uitTweede.nieuweLessen).toEqual([]);
    expect(uitTweede.overgeslagen.map((o) => o.reden)).toEqual(['bezet']);
  });

  it('plant geen les zonder trainer, en meldt het één keer', () => {
    const groep = groepUit([regelVan({ baan: 'Baan 1' })]);
    const koppeling = koppelingVoorGroep(groep, [], [BAAN]);
    const uit = lessenUitGroep(groep, koppeling, [], [], 60, NU);
    expect(uit.nieuweLessen).toEqual([]);
    expect(uit.meldingen).toHaveLength(1);
    // De groep zelf blijft gewoon in het plan staan, mét haar roster.
    expect(groep.leerlingNamen).toEqual(['Peferoen Astor']);
  });

  it('plant geen les zonder baan, en meldt het één keer', () => {
    const groep = groepUit([regelVan()]);
    const koppeling = koppelingVoorGroep(groep, [KOEN], []);
    const uit = lessenUitGroep(groep, koppeling, [], [], 60, NU);
    expect(uit.nieuweLessen).toEqual([]);
    expect(uit.meldingen).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Herimport (plan 05-06, taak 2)
// ---------------------------------------------------------------------------

/** De lessen van een eerste import, zoals ze daarna als boekingen van de club terugkomen. */
function alsBoekingen(lessen: GeplandeLes[], groepId: string): ImportBoeking[] {
  return lessen.map((les, i) => ({
    id: `b-${i}`,
    group_id: groepId,
    coach_id: KOEN.id,
    court_id: BAAN.id,
    start_time: les.start.toISOString(),
    end_time: les.eind.toISOString(),
    status: 'confirmed',
  }));
}

describe('herimport', () => {
  const WEEK_1 = regelVan({ regel: 2 });
  const WEEK_2 = regelVan({ regel: 3, datum: { jaar: 2026, maand: 9, dag: 16 } });

  it('levert hetzelfde bestand een tweede keer nul nieuwe lessen op', () => {
    const eersteKeer = lessenUitGroep(groepUit([WEEK_1, WEEK_2]), GEKOPPELD, [], [], 60, NU);
    expect(eersteKeer.nieuweLessen).toHaveLength(2);

    // Na de eerste import kent de club de groep en staan haar twee lessen in de agenda.
    const club = groepVan();
    const boekingen = alsBoekingen(eersteKeer.nieuweLessen, club.id);
    const tweedeKeer = lessenUitGroep(
      groepUit([WEEK_1, WEEK_2], [club]), GEKOPPELD, boekingen, [], 60, NU,
    );

    expect(tweedeKeer.nieuweLessen).toEqual([]);
    expect(tweedeKeer.ongewijzigd).toEqual(['b-0', 'b-1']);
    expect(tweedeKeer.handmatigGewijzigd).toEqual([]);
    expect(tweedeKeer.verdwenenUitBestand).toEqual([]);
    expect(tweedeKeer.overgeslagen).toEqual([]);
  });

  it('meldt een met de hand verzette les en zet hem niet terug', () => {
    const club = groepVan();
    const verzet = boekingVan({
      id: 'b-verzet',
      start_time: new Date(2026, 8, 9, 19, 0).toISOString(),
      end_time: new Date(2026, 8, 9, 20, 0).toISOString(),
    });
    const uit = lessenUitGroep(groepUit([WEEK_1], [club]), GEKOPPELD, [verzet], [], 60, NU);

    expect(uit.nieuweLessen).toEqual([]);
    expect(uit.handmatigGewijzigd).toEqual([{
      regel: 2,
      groep: 'Groep 8',
      dag: '2026-09-09',
      bestaandeTijd: '19:00',
      tijdInBestand: '17:00',
      status: 'confirmed',
    }]);
    // De bestaande les blijft staan waar de beheerder hem zette.
    expect(verzet.start_time).toBe(new Date(2026, 8, 9, 19, 0).toISOString());
  });

  it('plant een afgezegde les niet opnieuw in — cancelled komt niet terug', () => {
    const club = groepVan();
    const afgezegd = boekingVan({ id: 'b-af', status: 'cancelled' });
    const uit = lessenUitGroep(groepUit([WEEK_1], [club]), GEKOPPELD, [afgezegd], [], 60, NU);

    expect(uit.nieuweLessen).toEqual([]);
    expect(uit.ongewijzigd).toEqual([]);
    expect(uit.handmatigGewijzigd).toHaveLength(1);
    expect(uit.handmatigGewijzigd[0].status).toBe('cancelled');
  });

  it('laat staan wat geweest is: een regel van vóór nu wordt geteld, niet ingepland', () => {
    const club = groepVan();
    const geweest = regelVan({ datum: { jaar: 2026, maand: 9, dag: 2 } });
    const les = boekingVan({
      id: 'b-geweest',
      start_time: new Date(2026, 8, 2, 17, 0).toISOString(),
      end_time: new Date(2026, 8, 2, 18, 0).toISOString(),
      status: 'completed',
    });
    const uit = lessenUitGroep(
      groepUit([geweest], [club]), GEKOPPELD, [les], [], 60, new Date(2026, 8, 10),
    );

    expect(uit.overgeslagen.map((o) => o.reden)).toEqual(['verleden']);
    expect(uit.nieuweLessen).toEqual([]);
    // De les van vorige week wordt niet aangeraakt: niet bijgewerkt, niet gemeld, niet verwijderd.
    expect(uit.ongewijzigd).toEqual([]);
    expect(uit.handmatigGewijzigd).toEqual([]);
    expect(uit.verdwenenUitBestand).toEqual([]);
  });

  it('meldt een komende les die niet meer in het bestand staat, en verwijdert hem niet', () => {
    const club = groepVan();
    const negen = boekingVan({ id: 'b-9' });
    const zestien = boekingVan({
      id: 'b-16',
      start_time: new Date(2026, 8, 16, 17, 0).toISOString(),
      end_time: new Date(2026, 8, 16, 18, 0).toISOString(),
    });
    const uit = lessenUitGroep(
      groepUit([WEEK_1], [club]), GEKOPPELD, [negen, zestien], [], 60, NU,
    );

    expect(uit.ongewijzigd).toEqual(['b-9']);
    expect(uit.verdwenenUitBestand).toEqual([
      { id: 'b-16', groep: 'Groep 8', dag: '2026-09-16', tijd: '17:00' },
    ]);
  });

  it('voert een speler af die niet meer in het bestand staat', () => {
    const club = groepVan({ roster: ['u-astor', 'u-clara'] });
    const verschil = groepRosterVerschil(club, ['u-astor']);
    expect(verschil.status).toBe('bijgewerkt');
    expect(verschil.verwijderd).toEqual(['u-clara']);
    expect(verschil.toegevoegd).toEqual([]);
  });
});

describe('groepWijzigingen', () => {
  it('meldt alleen het veld dat verandert', () => {
    const club = groepVan({ coach_id: 'u-koen', court_id: 'c1' });
    const groep = groepUit([regelVan({ typeLes: 'Kidstennis groen' })], [club]);
    expect(groepWijzigingen(club, groep, GEKOPPELD)).toEqual({ level: 'Kidstennis groen' });
  });

  it('meldt niets als er niets verandert', () => {
    const club = groepVan({ coach_id: 'u-koen', court_id: 'c1' });
    expect(groepWijzigingen(club, groepUit([regelVan()], [club]), GEKOPPELD)).toEqual({});
  });

  it('koppelt de trainer en de baan die de groep nog niet had', () => {
    const club = groepVan();
    const groep = groepUit([regelVan()], [club]);
    expect(groepWijzigingen(club, groep, GEKOPPELD)).toEqual({
      coach_id: 'u-koen',
      court_id: 'c1',
    });
  });

  it('werkt naam, weekdag en beginuur bij als de groep aan haar Groep-ID herkend werd', () => {
    // D-03: `Groep-ID` wint van de afgeleide sleutel, juist zodat een groep herkenbaar blijft als
    // haar naam of haar uur verandert. Dan hoort die verandering ook doorgevoerd te worden —
    // anders wordt de hernoeming netjes herkend en stilzwijgend weggegooid (IMP-07).
    const club = groepVan({ coach_id: 'u-koen', court_id: 'c1' });
    const groep = groepUit([regelVan({
      groepId: club.id,
      groep: 'Groep 8 gevorderden',
      datum: { jaar: 2026, maand: 9, dag: 11 }, // een vrijdag
      uur: { uur: 18, minuut: 0 },
    })], [club]);
    expect(groep.viaGroepId).toBe(true);
    expect(groepWijzigingen(club, groep, GEKOPPELD)).toEqual({
      name: 'Groep 8 gevorderden',
      weekday: 5,
      start_hour: 18,
    });
  });

  it('meldt naam, weekdag en beginuur niet bij een match op de sleutel', () => {
    // Daar vórmen die drie de sleutel, dus ze zijn per definitie gelijk. Zou de vergelijking ook
    // hier lopen, dan kostte het niets aan waarheid maar wel aan leesbaarheid — en dat is precies
    // waarom `groepWijzigingen` alleen echte verschillen meldt.
    const club = groepVan({ coach_id: 'u-koen', court_id: 'c1' });
    const groep = groepUit([regelVan({ typeLes: 'Kidstennis groen' })], [club]);
    expect(groep.viaGroepId).toBe(false);
    const wijzigingen = groepWijzigingen(club, groep, GEKOPPELD);
    expect(wijzigingen).toEqual({ level: 'Kidstennis groen' });
    expect(Object.keys(wijzigingen)).not.toContain('name');
    expect(Object.keys(wijzigingen)).not.toContain('weekday');
    expect(Object.keys(wijzigingen)).not.toContain('start_hour');
  });

  it('meldt niets bij een Groep-ID-match waarbij naam, dag en uur gelijk bleven', () => {
    // Het vlaggetje mag geen ruis maken: de export vult `Groep-ID` bij élke rij in, dus zonder
    // deze grens zou iedere herimport elke groep als "bijgewerkt" tonen.
    const club = groepVan({ coach_id: 'u-koen', court_id: 'c1' });
    const groep = groepUit([regelVan({ groepId: club.id })], [club]);
    expect(groep.viaGroepId).toBe(true);
    expect(groepWijzigingen(club, groep, GEKOPPELD)).toEqual({});
  });

  it('rekt het seizoen op en kort het nooit in', () => {
    const club = groepVan({
      coach_id: 'u-koen', court_id: 'c1', season_start: '2026-10-01', season_end: '2027-06-23',
    });
    const groep = groepUit([regelVan()], [club]);
    // Het bestand loopt van 9 september tot 9 september; het seizoen begint dus vroeger en
    // eindigt niet eerder.
    expect(groepWijzigingen(club, groep, GEKOPPELD)).toEqual({ season_start: '2026-09-09' });
  });
});

// ---------------------------------------------------------------------------
// Het hele plan (plan 05-06, taak 3)
// ---------------------------------------------------------------------------

/** De koprij die de plantests gebruiken: de vijf verplichte kolommen plus een baan. */
const KOP_MET_BAAN = ['Datum', 'Uur', 'Groep', 'Coach', 'Leerling', 'Baan'];

/** Eén rij van het bestand, in de vorm waarin een beheerder hem typt. */
function rij(datum: string, uur: string, groep: string, leerling: string): string[] {
  return [datum, uur, groep, 'Leemans Koen', leerling, 'Baan 1'];
}

describe('planImportLessen', () => {
  const RIJEN = [
    KOP_MET_BAAN,
    rij('09/09/2026', '17:00', 'Groep 8', 'Peferoen Astor'),
    rij('09/09/2026', '17:00', 'Groep 8', 'Martens Clara'),
    rij('16/09/2026', '17:00', 'Groep 8', 'Peferoen Astor'),
    rij('16/09/2026', '17:00', 'Groep 8', 'Martens Clara'),
  ];
  const plan = () => planImportLessen(RIJEN, [], [KOEN], [BAAN], [], {}, NU);

  it('geeft een plan met alles erin wat de droogloop moet tonen', () => {
    expect(Object.keys(plan()).sort()).toEqual([
      'dubbel', 'fouten', 'groepenBijgewerkt', 'groepenNieuw', 'groepenOngewijzigd',
      'handmatigGewijzigd', 'nietHerkend', 'nieuweLessen', 'ongewijzigdeLessen', 'overgeslagen',
      'regels', 'spelersNieuw', 'verdwenenUitBestand', 'waarschuwingen',
    ]);
  });

  it('toont de groep zoals het scherm hem nodig heeft, zonder terug naar de rijen te moeten', () => {
    const uit = plan();
    expect(uit.groepenNieuw).toHaveLength(1);
    expect(uit.groepenBijgewerkt).toEqual([]);
    expect(uit.groepenOngewijzigd).toEqual([]);
    expect(uit.groepenNieuw[0]).toMatchObject({
      naam: 'Groep 8',
      weekdag: 3,
      beginuur: 17,
      trainerNaam: 'Koen Leemans',
      aantalSpelers: 2,
      status: 'nieuw',
    });
  });

  it('plant twee lessen uit vier regels en noemt de twee nieuwe spelers', () => {
    const uit = plan();
    expect(uit.nieuweLessen).toHaveLength(2);
    expect(uit.spelersNieuw.map((s) => s.naam)).toEqual(['Peferoen Astor', 'Martens Clara']);
    expect(uit.fouten).toEqual([]);
    expect(uit.waarschuwingen).toEqual([]);
  });

  it('laat het bestand met zichzelf botsen: twee groepen op hetzelfde uur bij dezelfde trainer', () => {
    const uit = planImportLessen([
      KOP_MET_BAAN,
      rij('09/09/2026', '17:00', 'Groep 8', 'Peferoen Astor'),
      rij('09/09/2026', '17:00', 'Groep 12', 'Bertrem Mila'),
    ], [], [KOEN], [BAAN], [], {}, NU);

    expect(uit.groepenNieuw).toHaveLength(2);
    expect(uit.nieuweLessen).toHaveLength(1);
    expect(uit.overgeslagen.map((o) => o.reden)).toEqual(['bezet']);
  });

  it('neemt de lesduur uit de clubinstelling', () => {
    const uit = planImportLessen(RIJEN, [], [KOEN], [BAAN], [], { lesson_duration_minutes: 90 }, NU);
    expect(uit.nieuweLessen[0].eind.getHours()).toBe(18);
    expect(uit.nieuweLessen[0].eind.getMinutes()).toBe(30);
  });

  it('slaat de lessen over die in een clubvakantie vallen', () => {
    const uit = planImportLessen(RIJEN, [], [KOEN], [BAAN], [], {
      vakanties: [{ id: 'v1', naam: 'Herfstvakantie', van: '2026-09-14', tot: '2026-09-20' }],
    }, NU);
    expect(uit.nieuweLessen).toHaveLength(1);
    expect(uit.overgeslagen.map((o) => [o.reden, o.vakantie])).toEqual([['vakantie', 'Herfstvakantie']]);
  });

  it('verandert niets als hetzelfde bestand een tweede keer binnenkomt', () => {
    const club = groepVan({ coach_id: 'u-koen', court_id: 'c1', roster: ['u-astor', 'u-clara'] });
    const spelers = [
      KOEN,
      userVan({ id: 'u-astor', name: 'Astor Peferoen' }),
      userVan({ id: 'u-clara', name: 'Clara Martens' }),
    ];
    const eerste = planImportLessen(RIJEN, [club], spelers, [BAAN], [], {}, NU);
    const boekingen = alsBoekingen(eerste.nieuweLessen, club.id);

    const tweede = planImportLessen(RIJEN, [club], spelers, [BAAN], boekingen, {}, NU);
    expect(tweede.nieuweLessen).toEqual([]);
    expect(tweede.ongewijzigdeLessen).toHaveLength(2);
    expect(tweede.spelersNieuw).toEqual([]);
    expect(tweede.groepenOngewijzigd).toHaveLength(1);
    expect(tweede.groepenNieuw).toEqual([]);
    expect(tweede.handmatigGewijzigd).toEqual([]);
    expect(tweede.verdwenenUitBestand).toEqual([]);
  });

  it('keurt een leeg bestand en een koprij zonder verplichte kolom af', () => {
    expect(bestandAfgekeurdLessen(planImportLessen([], [], [], [], [], {}, NU))).toBe(true);
    const zonderCoach = planImportLessen([['Datum', 'Uur', 'Groep', 'Leerling']], [], [], [], [], {}, NU);
    expect(bestandAfgekeurdLessen(zonderCoach)).toBe(true);
  });

  it('keurt het bestand niet af zodra er één regel doorkwam', () => {
    expect(bestandAfgekeurdLessen(plan())).toBe(false);
  });
});

// De uurwissel. Een reeks die met "168 uur erbij" gebouwd wordt staat na de wissel een uur
// verkeerd, en dat merkt niemand — tot een ouder belt dat zijn kind een uur te vroeg voor een
// gesloten club stond. In België springt de klok in het seizoen 2026-2027 terug op 25 oktober
// 2026 en vooruit op 28 maart 2027; een les van 17:00 hoort op beide zijden van die twee
// zondagen om 17:00 te staan.
//
// Deze test bewijst alleen iets in een tijdzone die een wissel kent. Draait de suite in UTC,
// dan slaagt hij zonder iets aan te tonen — daarom wordt hij dan luid overgeslagen in plaats
// van stil te slagen.
const zomerOffset2026 = new Date(2026, 6, 1).getTimezoneOffset();
const winterOffset2026 = new Date(2026, 0, 1).getTimezoneOffset();
const kentEenWissel = zomerOffset2026 !== winterOffset2026;
if (!kentEenWissel) {
  console.warn(
    `LET OP: de tijdzone van deze machine (${Intl.DateTimeFormat().resolvedOptions().timeZone}) kent geen `
    + 'zomertijd. De zomer- en wintertijdtests van lib/import-trainingen worden overgeslagen en '
    + 'bewijzen hier dus niets — draai ze met TZ=Europe/Brussels voordat je hierop vertrouwt.',
  );
}
const alsErEenWisselIs = kentEenWissel ? it : it.skip;

describe('zomer- en wintertijd', () => {
  /** Elke woensdag van 1 oktober 2026 tot en met 30 april 2027, als regels van 17:00. */
  const woensdagen = (): LesRegel[] => {
    const regels: LesRegel[] = [];
    const laatste = new Date(2027, 3, 30).getTime();
    // Zeven dagen erbij in het dagveld, precies zoals lib/recurrence het doet.
    for (let i = 0; ; i++) {
      const d = new Date(2026, 9, 7 + i * 7);
      if (d.getTime() > laatste) break;
      regels.push(regelVan({
        regel: i + 2,
        datum: { jaar: d.getFullYear(), maand: d.getMonth() + 1, dag: d.getDate() },
        uur: { uur: 17, minuut: 0 },
      }));
    }
    return regels;
  };

  const lessen = () => lessenUitGroep(groepUit(woensdagen()), GEKOPPELD, [], [], 60, NU).nieuweLessen;

  alsErEenWisselIs('zet elke les van het seizoen op hetzelfde lokale uur', () => {
    const alle = lessen();
    expect(alle.length).toBe(30);
    expect(alle.every((l) => l.start.getHours() === 17)).toBe(true);
    expect(alle.every((l) => l.start.getDay() === 3)).toBe(true);
  });

  alsErEenWisselIs('staat rond beide wissels om 17:00 en niet om 16:00 of 18:00', () => {
    const opDag = new Map(lessen().map((l) => [dagSleutel(l.start), l]));
    // De woensdagen vóór en na 25 oktober 2026, en vóór en na 28 maart 2027.
    for (const dag of ['2026-10-21', '2026-10-28', '2027-03-24', '2027-03-31']) {
      const les = opDag.get(dag);
      expect(les).toBeDefined();
      expect(new Date(les!.start).getHours()).toBe(17);
      expect(new Date(les!.eind).getHours()).toBe(18);
    }
  });

  alsErEenWisselIs('houdt het lokale uur ook vast in de ISO-tekst die weggeschreven wordt', () => {
    const opDag = new Map(lessen().map((l) => [dagSleutel(l.start), l]));
    for (const dag of ['2026-10-21', '2026-10-28', '2027-03-24', '2027-03-31']) {
      const les = opDag.get(dag)!;
      expect(new Date(les.start.toISOString()).getHours()).toBe(17);
      expect(new Date(les.eind.toISOString()).getHours()).toBe(18);
    }
  });

  alsErEenWisselIs('zet alle lessen van Groep 8 op woensdag van koen.xlsx om 17:00', () => {
    // Het echte bestand loopt van 9 september 2026 tot 25 juni 2027 en overspant dus allebei de
    // wissels. Het heeft geen kolom Baan, dus er valt via het volledige plan niets in te
    // plannen (dat is de bedoeling, zie plan 05-05); de trainer en de baan worden hier dus
    // gekoppeld meegegeven, zodat de test over de datums gaat en niet over de koppeling.
    const blad = kiesLessenBlad(leesWerkmap(koenBytes()))!;
    const { regels } = leesLesRegels(blad.rijen);
    const groepen = groepenUitRegels(regels, []).groepen;
    const acht = groepen.find((g) => g.naam === 'Groep 8' && g.weekdag === 3 && g.beginuur === 17)!;
    const uit = lessenUitGroep(acht, GEKOPPELD, [], [], 60, NU);

    expect(uit.nieuweLessen.length).toBeGreaterThan(30);
    expect(uit.nieuweLessen.every((l) => l.start.getHours() === 17)).toBe(true);
    expect(uit.nieuweLessen.some((l) => l.start.getHours() === 16)).toBe(false);
    expect(uit.nieuweLessen.some((l) => l.start.getHours() === 18)).toBe(false);
    expect(uit.nieuweLessen.every((l) => l.start.getDay() === 3)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// koen.xlsx — de acceptatie van IMP-10 (plan 05-07)
//
// Dit is de zwaarste test van deze fase, en met opzet de enige die het échte bestand van de
// club van de eerste byte tot het volledige plan door de hele keten haalt: uitpakken en lezen
// (lib/xlsx-lezen), de koprij, de regels, de groepen, de spelers, de koppelingen en de lessen.
// Elke andere test hierboven neemt één van die lagen apart met verzonnen rijen ernaast; deze
// valt om zodra één ervan stilletjes een uur, een dag of een groep verschuift — ook als alle
// vijf de lagen afzonderlijk nog groen staan. Dat is precies het soort fout dat pas opvalt als
// een heel seizoen een uur te vroeg in de agenda van de club staat.
//
// De getallen hieronder zijn in de bytes van het bestand geteld. Wijkt er één af, dan is dat
// een bevinding over de import en niet over deze tabel: hem bijstellen om de test groen te
// krijgen maakt van een acceptatiebar een formaliteit.
// ---------------------------------------------------------------------------

/** Wat één groep uit het bestand hoort op te leveren. `weekdag`: 3 = woensdag, 5 = vrijdag. */
interface VerwachteGroep {
  naam: string;
  weekdag: number;
  beginuur: number;
  spelers: number;
  lesmomenten: number;
  niveau: string;
}

/**
 * De tien groepen van `koen.xlsx`, met zeven verschillende namen: "Groep 8" staat op drie
 * dag/uur-combinaties en "Groep 12" op twee, elk met andere spelers. Het nummer is een
 * administratief label dat de club hergebruikt, geen groep mensen — daarom telt de sleutel van
 * D-02 de weekdag en het beginuur mee.
 *
 * `Groep 12` van vrijdag 18:00 heeft `Type les` = `Privéles` én een gevulde `Groep`: dat is
 * hier een niveau-etiket en geen privéles in de zin van `.planning/IMPORT-SJABLOON.md` (dáár
 * gaat het over een lége `Groep`). Er hoort dus geen uitzondering op te staan.
 */
const KOEN_GROEPEN: VerwachteGroep[] = [
  { naam: 'Groep 4', weekdag: 3, beginuur: 14, spelers: 2, lesmomenten: 33, niveau: 'Duoles' },
  { naam: 'Groep 12', weekdag: 3, beginuur: 15, spelers: 4, lesmomenten: 33, niveau: 'Tienertennis geel' },
  { naam: 'Groep 13', weekdag: 3, beginuur: 16, spelers: 6, lesmomenten: 33, niveau: 'Oranje' },
  { naam: 'Groep 8', weekdag: 3, beginuur: 17, spelers: 6, lesmomenten: 33, niveau: 'Kidstennis oranje' },
  { naam: 'Groep 26', weekdag: 3, beginuur: 18, spelers: 4, lesmomenten: 33, niveau: 'Tienertennis geel' },
  { naam: 'Groep 31', weekdag: 5, beginuur: 16, spelers: 5, lesmomenten: 32, niveau: 'Tienertennis geel' },
  { naam: 'Groep 8', weekdag: 5, beginuur: 17, spelers: 4, lesmomenten: 32, niveau: 'Tienertennis geel' },
  { naam: 'Groep 12', weekdag: 5, beginuur: 18, spelers: 4, lesmomenten: 32, niveau: 'Privéles' },
  { naam: 'Groep 8', weekdag: 5, beginuur: 19, spelers: 2, lesmomenten: 32, niveau: 'Duoles' },
  { naam: 'Groep 3', weekdag: 5, beginuur: 20, spelers: 6, lesmomenten: 32, niveau: 'Volwassenen - (her)starters' },
];

/** Vijf woensdaggroepen × 33 plus vijf vrijdaggroepen × 32 = 325 lesmomenten. */
const KOEN_LESMOMENTEN = 325;

/** Het seizoen van het bestand, per weekdag: 9 sep 2026 t/m 23 jun 2027 op woensdag. */
const KOEN_SEIZOEN = new Map([
  [3, { van: '2026-09-09', tot: '2027-06-23' }],
  [5, { van: '2026-09-11', tot: '2027-06-25' }],
]);

/**
 * Het aantal verschillende lesmomenten van een groep: haar regels zijn één les × één leerling
 * (D-01), dus zes kinderen op woensdag 17:00 zijn zes regels en één moment. De sleutel is die
 * van de import zelf (`lesSleutel`) en geen nagebouwde tekst — een tweede telwijze zou een
 * verschil kunnen wegpoetsen dat de import wél maakt.
 */
function momentenVan(groep: GeplandeGroep): number {
  const momenten = groep.regels.map((r) => lesSleutel(
    groep.sleutel,
    dagSleutel(new Date(r.datum.jaar, r.datum.maand - 1, r.datum.dag)),
    r.uur.uur,
    r.uur.minuut,
  ));
  return new Set(momenten).size;
}

/** Op weekdag en daarna op beginuur, zodat een verschil de groep bij naam kan noemen. */
function opDagEnUur(a: VerwachteGroep, b: VerwachteGroep): number {
  return a.weekdag - b.weekdag || a.beginuur - b.beginuur;
}

describe('koen.xlsx — de acceptatie van IMP-10', () => {
  // Eén keer lezen en één keer plannen voor het hele blok. 1398 regels door twaalf tests halen
  // is twaalf keer hetzelfde werk; alle beweringen hieronder gaan over dít ene plan.
  const blad = kiesLessenBlad(leesWerkmap(koenBytes()))!;
  const LEGE_CLUB = planImportLessen(blad.rijen, [], [], [], [], {}, NU);

  it('leest alle 1398 regels zonder één fout en zonder ruis in de koprij', () => {
    expect(LEGE_CLUB.regels).toHaveLength(1398);
    expect(LEGE_CLUB.fouten).toEqual([]);
    // `Weekdag`, `Weeknr`, `Locatie` en `Indoor/Outdoor` staan in dit bestand en betekenen
    // niets voor de import. Ze horen genegeerd te worden en niet gemeld.
    expect(LEGE_CLUB.nietHerkend).toEqual([]);
    expect(LEGE_CLUB.dubbel).toEqual([]);
  });

  it('heeft geen kolom Baan en geen kolom Groep-ID — daar hangt de rest van dit blok aan', () => {
    expect(blad.rijen[0]).not.toContain('Baan');
    expect(blad.rijen[0]).not.toContain('Groep-ID');
  });

  it('levert tien nieuwe lesgroepen op, met zeven verschillende namen', () => {
    expect(LEGE_CLUB.groepenNieuw).toHaveLength(10);
    expect(LEGE_CLUB.groepenBijgewerkt).toEqual([]);
    expect(LEGE_CLUB.groepenOngewijzigd).toEqual([]);
    expect(new Set(LEGE_CLUB.groepenNieuw.map((g) => g.naam)).size).toBe(7);
  });

  it('geeft elke groep uit de tabel haar eigen dag, uur, roster, lesmomenten en niveau', () => {
    const werkelijk: VerwachteGroep[] = LEGE_CLUB.groepenNieuw.map((g) => ({
      naam: g.naam,
      weekdag: g.weekdag,
      beginuur: g.beginuur,
      spelers: g.aantalSpelers,
      lesmomenten: momentenVan(g.groep),
      niveau: g.groep.niveau,
    }));
    expect(werkelijk.sort(opDagEnUur)).toEqual([...KOEN_GROEPEN].sort(opDagEnUur));
  });

  it('telt 325 lesmomenten in het hele bestand', () => {
    const perGroep = LEGE_CLUB.groepenNieuw.reduce((som, g) => som + momentenVan(g.groep), 0);
    expect(perGroep).toBe(KOEN_LESMOMENTEN);
  });

  it('geeft elke groep het seizoen dat bij haar weekdag hoort', () => {
    for (const g of LEGE_CLUB.groepenNieuw) {
      const verwacht = KOEN_SEIZOEN.get(g.weekdag);
      expect(verwacht).toBeDefined();
      expect([g.naam, g.groep.seizoenVan, g.groep.seizoenTot])
        .toEqual([g.naam, verwacht!.van, verwacht!.tot]);
    }
  });

  it('kent 42 verschillende leerlingen, allemaal nieuw voor de club', () => {
    expect(LEGE_CLUB.spelersNieuw).toHaveLength(42);
    expect(new Set(LEGE_CLUB.spelersNieuw.map((s) => s.naam)).size).toBe(42);
  });

  it('houdt de drie groepen die "Groep 8" heten volledig uit elkaar', () => {
    const acht = LEGE_CLUB.groepenNieuw.filter((g) => g.naam === 'Groep 8');
    expect(acht.map((g) => [g.weekdag, g.beginuur, g.aantalSpelers]))
      .toEqual([[3, 17, 6], [5, 17, 4], [5, 19, 2]]);
    // Twaalf plaatsen, twaalf verschillende mensen: nul overlap. Matchen op de groepsnaam
    // alleen zou hier één groep van twaalf van maken.
    const samen = acht.flatMap((g) => g.roster);
    expect(samen).toHaveLength(12);
    expect(new Set(samen).size).toBe(12);
  });

  it('plant nul lessen in: er is geen trainersaccount en er is geen baan', () => {
    // `LesGroep.coach_id` mag leeg zijn — daarom komen de tien groepen er wél. `Booking.coach_id`
    // en `Booking.court_id` mogen dat niet, dus de lessen kunnen niet bestaan. Ook niets
    // overgeslagen: er valt niets over te slaan zolang er niets te plannen viel.
    expect(LEGE_CLUB.nieuweLessen).toEqual([]);
    expect(LEGE_CLUB.ongewijzigdeLessen).toEqual([]);
    expect(LEGE_CLUB.overgeslagen).toEqual([]);
    expect(LEGE_CLUB.handmatigGewijzigd).toEqual([]);
    expect(LEGE_CLUB.verdwenenUitBestand).toEqual([]);
  });

  it('meldt uitsluitend de trainer en de baan, één keer per groep', () => {
    const meldingen = LEGE_CLUB.waarschuwingen;
    // Tien groepen × twee ontbrekende schakels. Eén melding per regel zou er 2796 opleveren.
    expect(meldingen).toHaveLength(20);
    const overTrainer = meldingen.filter((m) => m.reden.includes('trainer'));
    const overBaan = meldingen.filter((m) => m.reden.includes('baan'));
    expect(overTrainer).toHaveLength(10);
    expect(overBaan).toHaveLength(10);
    // En niets anders: geen onbekende kop, geen naamgenoot, geen tweede niveau, geen tweede
    // coach. Deze bewering is de kern van IMP-10 — "de droogloop meldt precies die twee dingen".
    expect(meldingen.filter((m) => !overTrainer.includes(m) && !overBaan.includes(m))).toEqual([]);
    expect(new Set(overTrainer.map((m) => m.vars?.naam))).toEqual(new Set(['Leemans Koen']));
  });

  it('laat de trainermelding verdwijnen zodra Leemans Koen een account heeft', () => {
    // De trainer valt op te lossen zónder het bestand aan te raken: de kolom `Coach` staat er,
    // met de achternaam vooraan, en `zoekOpNaam` vindt daar "Koen Leemans" bij. De baan niet:
    // `koen.xlsx` heeft die kolom niet eens. Van de twee wegen die het plan aanbiedt kiezen we
    // daarom de meldingen als bewijs — een tweede opzet mét een `Baan`-kolom zou een verzonnen
    // bestand testen in plaats van het bestand waarvoor deze hele fase gebouwd is. Dat een baan
    // koppelen op het scherm gebeurt en niet in dit bestand, is precies wat de tien
    // overgebleven meldingen zeggen.
    const metTrainer = planImportLessen(blad.rijen, [], [KOEN], [], [], {}, NU);
    expect(metTrainer.waarschuwingen).toHaveLength(10);
    expect(metTrainer.waarschuwingen.every((m) => m.reden.includes('baan'))).toBe(true);
    expect(metTrainer.groepenNieuw.every((g) => g.trainer?.id === KOEN.id)).toBe(true);
    expect(metTrainer.groepenNieuw.every((g) => g.trainerNaam === 'Koen Leemans')).toBe(true);
    // Nog steeds nul lessen: de baan is de tweede ontbrekende schakel en de enige die over is.
    expect(metTrainer.nieuweLessen).toEqual([]);
    expect(metTrainer.spelersNieuw).toHaveLength(42);
  });
});

// ---------------------------------------------------------------------------
// koen.xlsx twee keer inlezen (IMP-06)
//
// IMP-06 is pas echt bewezen als het op 1398 regels en tien groepen gebeurt en niet op drie
// verzonnen rijen: het gaat over een bestand dat de club per ongeluk een tweede keer doorstuurt,
// en dat mag niets verdubbelen.
// ---------------------------------------------------------------------------

/** De club zoals ze eruitziet nadat een plan is weggeschreven: haar groepen en haar leden. */
interface Toestand {
  groepen: LesGroep[];
  users: User[];
}

/**
 * De toestand die de uitvoerder van plan 05-08 uit dit plan zou maken, hier met de hand
 * nagebouwd: elke nieuwe groep krijgt een verzonnen id, elke nieuwe speler ook, en de
 * plaatshouders in het rooster (`NIEUWE_SPELER`) worden door die ids vervangen.
 *
 * Met opzet met de hand en niet via die uitvoerder: die schrijft weg, en deze test moet puur
 * blijven — geen databank, geen netwerk, geen volgorde-afhankelijkheid. Het is dezelfde reden
 * waarom `planImportLessen` zelf puur is (D-10). De prijs is dat deze helper meeverandert als
 * het model verandert; de winst is dat IMP-06 te bewijzen valt zonder één verbinding.
 */
function toestandUitPlan(plan: ImportPlanLessen): Toestand {
  const users = plan.spelersNieuw.map((s, i) => userVan({
    id: `u-nieuw-${i}`, name: s.naam, email: s.email,
  }));
  const idVanPlaatshouder = new Map(
    plan.spelersNieuw.map((s, i) => [spelerSleutel(s), `u-nieuw-${i}`]),
  );
  const groepen = [
    ...plan.groepenNieuw, ...plan.groepenBijgewerkt, ...plan.groepenOngewijzigd,
  ].map((g, i): LesGroep => ({
    id: `g-nieuw-${i}`,
    name: g.naam,
    level: g.groep.niveau,
    weekday: g.weekdag,
    start_hour: g.beginuur,
    start_minute: g.beginminuut,
    // Geen `coach_id` en geen `court_id`: dit bestand levert die niet, en `LesGroep` laat ze
    // met opzet leeg zijn voor precies dit geval.
    season_start: g.groep.seizoenVan,
    season_end: g.groep.seizoenTot,
    roster: g.roster.map((id) => idVanPlaatshouder.get(id) ?? id),
    archived: false,
  }));
  return { groepen, users };
}

describe('koen.xlsx twee keer inlezen', () => {
  const blad = kiesLessenBlad(leesWerkmap(koenBytes()))!;
  const lees = (toestand: Toestand) => planImportLessen(
    blad.rijen, toestand.groepen, toestand.users, [], [], {}, NU,
  );

  const eerste = planImportLessen(blad.rijen, [], [], [], [], {}, NU);
  const naDeEerste = toestandUitPlan(eerste);
  const tweede = lees(naDeEerste);
  const derde = lees(naDeEerste);

  it('levert de eerste keer tien groepen en 42 spelers op', () => {
    expect(eerste.groepenNieuw).toHaveLength(10);
    expect(eerste.spelersNieuw).toHaveLength(42);
    expect(naDeEerste.groepen).toHaveLength(10);
    expect(naDeEerste.users).toHaveLength(42);
  });

  it('verdubbelt de tweede keer niets: nul nieuwe groepen, spelers en lessen', () => {
    expect(tweede.groepenNieuw).toEqual([]);
    expect(tweede.groepenBijgewerkt).toEqual([]);
    expect(tweede.spelersNieuw).toEqual([]);
    expect(tweede.nieuweLessen).toEqual([]);
  });

  it('herkent alle tien de groepen als ongewijzigd, elk met haar eigen bestaande groep', () => {
    expect(tweede.groepenOngewijzigd).toHaveLength(10);
    expect(tweede.groepenOngewijzigd.map((g) => g.groep.bestaand?.id).sort())
      .toEqual(naDeEerste.groepen.map((g) => g.id).sort());
    // Elk roster staat er nog voluit, met echte ids in plaats van plaatshouders.
    expect(tweede.groepenOngewijzigd.every((g) => g.roster.every((id) => id.startsWith('u-nieuw-'))))
      .toBe(true);
  });

  it('meldt de tweede keer nog steeds de trainer en de baan, en niets erbij', () => {
    // Die twee schakels lost een tweede inleesbeurt niet op — en dat hoort ook zo: de import
    // maakt geen trainer en geen baan aan (D-07).
    expect(tweede.waarschuwingen).toHaveLength(20);
    expect(tweede.fouten).toEqual([]);
  });

  it('geeft de derde keer exact hetzelfde antwoord als de tweede', () => {
    // Stabiel, en niet toevallig: was de tweede uitkomst een gevolg van iets wat de eerste
    // opbouwde, dan zou de derde ervan afwijken.
    expect(derde.groepenNieuw).toEqual([]);
    expect(derde.groepenOngewijzigd).toHaveLength(10);
    expect(derde.spelersNieuw).toEqual([]);
    expect(derde.nieuweLessen).toEqual([]);
    expect(derde.waarschuwingen).toEqual(tweede.waarschuwingen);
  });
});

// ---------------------------------------------------------------------------
// Heen en terug met de export van fase 4 (EXP-07, IMP-06, D-03)
//
// Dit blok gaat niet over Excel maar over een belofte: de club exporteert een seizoen, past er
// iets in aan, en leest het weer in — en dat mag niets verdubbelen. Zolang die lus niet echt
// gelopen is, is EXP-07 een belofte zonder dekking; een kop die aan één kant hernoemd wordt
// valt hier om en niet pas bij de beheerder.
// ---------------------------------------------------------------------------

/** De drie leerlingen van de groep waarmee dit blok heen en weer schrijft. */
const RONDRIT_SPELERS = [
  userVan({ id: 'u-astor', name: 'Peferoen Astor', email: 'astor@club.be' }),
  userVan({ id: 'u-clara', name: 'Martens Clara', email: 'clara@club.be' }),
  userVan({ id: 'u-mila', name: 'Bertrem Mila', email: 'mila@club.be' }),
];

const RONDRIT_GROEP = groepVan({
  id: 'g-rondrit',
  name: 'Groep 8',
  level: 'Kidstennis oranje',
  weekday: 3,
  start_hour: 17,
  coach_id: KOEN.id,
  court_id: BAAN.id,
  roster: RONDRIT_SPELERS.map((s) => s.id),
});

/**
 * Drie woensdagen van 17:00 tot 18:00, met lokale datumvelden gebouwd — nooit een ISO-tekst
 * ineen geknutseld. Zou hier UTC staan, dan zou deze test in een westelijke tijdzone een dag
 * opschuiven en de hele rondrit op een andere weekdag laten uitkomen.
 */
function rondritBoekingen(): Booking[] {
  return [9, 16, 23].map((dag, i): Booking => ({
    id: `b-rondrit-${i}`,
    player_id: RONDRIT_SPELERS[0].id,
    participant_ids: RONDRIT_SPELERS.slice(1).map((s) => s.id),
    coach_id: KOEN.id,
    court_id: BAAN.id,
    group_id: RONDRIT_GROEP.id,
    start_time: new Date(2026, 8, dag, 17, 0).toISOString(),
    end_time: new Date(2026, 8, dag, 18, 0).toISOString(),
    status: 'confirmed',
    payment_method: GROEPSLES_METHOD,
  }));
}

/** Wat de export schrijft, opnieuw gelezen: dezelfde weg als een beheerder met een bestand. */
function heenEnTerug(bookings: readonly Booking[], groepen: readonly LesGroep[]): string[][] {
  const blad = bladLessen(bookings, opzoektabellen([...RONDRIT_SPELERS, KOEN], [BAAN], groepen));
  const gelezen = kiesLessenBlad(leesWerkmap(buildXlsx(blad)));
  if (!gelezen) throw new Error('de export leverde geen leesbaar blad op');
  return gelezen.rijen;
}

describe('heen en terug met de export van fase 4', () => {
  const rijen = heenEnTerug(rondritBoekingen(), [RONDRIT_GROEP]);

  it('schrijft een blad dat de eigen lezer weer opent, met de zestien koppen', () => {
    expect(rijen[0]).toEqual(KOP_EXPORT);
    expect(rijen).toHaveLength(1 + 3 * 3);
  });

  it('leest de groep ongewijzigd terug: dag, uur, niveau, trainer, baan en het volledige roster', () => {
    const plan = planImportLessen(
      rijen, [RONDRIT_GROEP], [...RONDRIT_SPELERS, KOEN], [BAAN], rondritBoekingen(), {}, NU,
    );
    expect(plan.fouten).toEqual([]);
    expect(plan.nietHerkend).toEqual([]);
    expect(plan.waarschuwingen).toEqual([]);
    expect(plan.groepenNieuw).toEqual([]);
    expect(plan.groepenOngewijzigd).toHaveLength(1);

    const terug = plan.groepenOngewijzigd[0];
    expect(terug.groep.bestaand?.id).toBe(RONDRIT_GROEP.id);
    expect(terug).toMatchObject({
      naam: 'Groep 8', weekdag: 3, beginuur: 17, aantalSpelers: 3, trainerNaam: 'Koen Leemans',
    });
    expect(terug.groep.niveau).toBe('Kidstennis oranje');
    expect(terug.trainer?.id).toBe(KOEN.id);
    expect(terug.baan?.id).toBe(BAAN.id);
    expect([...terug.roster].sort()).toEqual([...RONDRIT_GROEP.roster].sort());
  });

  it('verdubbelt de drie lessen niet: ze staan er al en blijven ongewijzigd', () => {
    const plan = planImportLessen(
      rijen, [RONDRIT_GROEP], [...RONDRIT_SPELERS, KOEN], [BAAN], rondritBoekingen(), {}, NU,
    );
    expect(plan.nieuweLessen).toEqual([]);
    expect(plan.ongewijzigdeLessen).toHaveLength(3);
    expect(plan.spelersNieuw).toEqual([]);
    expect(plan.handmatigGewijzigd).toEqual([]);
    expect(plan.verdwenenUitBestand).toEqual([]);
  });

  it('herkent de groep aan haar Groep-ID, ook als iemand de naam in het bestand veranderde', () => {
    // D-03: het `Groep-ID` dat de export invult wint van de afgeleide sleutel. Zonder die kolom
    // zou een hernoemde groep een tweede groep worden — de halve club verdubbeld.
    const kolom = rijen[0].indexOf('Groep');
    const hernoemd = rijen.map((rij, i) => (i === 0 ? rij : rij.map(
      (cel, k) => (k === kolom ? 'Groep 8 gevorderden' : cel),
    )));
    const plan = planImportLessen(
      hernoemd, [RONDRIT_GROEP], [...RONDRIT_SPELERS, KOEN], [BAAN], rondritBoekingen(), {}, NU,
    );

    expect(plan.groepenNieuw).toEqual([]);
    const alle = [...plan.groepenBijgewerkt, ...plan.groepenOngewijzigd];
    expect(alle).toHaveLength(1);
    expect(alle[0].groep.bestaand?.id).toBe(RONDRIT_GROEP.id);
    // De nieuwe naam staat wél in het plan — het scherm toont hem dus.
    expect(alle[0].naam).toBe('Groep 8 gevorderden');
    // En de hernoeming wordt ook echt doorgevoerd: bij een match op `Groep-ID` mág de naam
    // verschillen, dus hoort ze bij de wijzigingen. Zou hier `ongewijzigd` staan, dan was IMP-07
    // een lege belofte — herkend, en toch de oude naam gehouden.
    expect(alle[0].status).toBe('bijgewerkt');
    expect(alle[0].wijzigingen).toEqual({ name: 'Groep 8 gevorderden' });
    expect(plan.groepenBijgewerkt).toHaveLength(1);
    expect(plan.groepenOngewijzigd).toEqual([]);
    // De lessen blijven staan waar ze staan: een hernoeming raakt de agenda niet, en de drie
    // bestaande lessen worden ook niet verdubbeld.
    expect(plan.nieuweLessen).toEqual([]);
    expect(plan.ongewijzigdeLessen).toHaveLength(3);
  });

  it('werkt het uur bij, maar verzet de lessen van het seizoen niet stilzwijgend mee', () => {
    // Verandert het beginuur van een groep, dan raakt dat haar al ingeplande lessen. De app heeft
    // daar `planGroepWijziging` (lib/lesgroepen) voor, en die wordt hier bewust NIET aangeroepen:
    // een import mag geen seizoen lessen verzetten als bijwerking van het lezen van een bestand.
    // De import meldt het gevolg en laat de beslissing aan de beheerder — precies zoals ze ook
    // niets verwijdert wat uit het bestand verdween.
    const kolom = rijen[0].indexOf('Uur');
    const verzet = rijen.map((rij, i) => (i === 0 ? rij : rij.map(
      (cel, k) => (k === kolom ? '18:00' : cel),
    )));
    const plan = planImportLessen(
      verzet, [RONDRIT_GROEP], [...RONDRIT_SPELERS, KOEN], [BAAN], rondritBoekingen(), {}, NU,
    );

    expect(plan.groepenNieuw).toEqual([]);
    expect(plan.groepenBijgewerkt).toHaveLength(1);
    expect(plan.groepenBijgewerkt[0].wijzigingen).toEqual({ start_hour: 18 });

    // Geen enkele les wordt verzet en er komt er ook geen tweede naast: de drie lessen die er om
    // 17:00 staan komen als handmatige wijziging terug, met beide tijden erbij.
    expect(plan.nieuweLessen).toEqual([]);
    expect(plan.handmatigGewijzigd).toHaveLength(3);
    expect(plan.handmatigGewijzigd.map((h) => h.bestaandeTijd)).toEqual(['17:00', '17:00', '17:00']);
  });

  it('maakt van een privéles uit de export geen lesgroep', () => {
    // De export schrijft bij een les zonder groep `Groep` leeg en `Type les` = `Privéles`
    // (D-08). Die lege `Groep` is het teken: hier hoort geen lesgroep te ontstaan.
    const prive: Booking = {
      id: 'b-prive',
      player_id: RONDRIT_SPELERS[0].id,
      coach_id: KOEN.id,
      court_id: BAAN.id,
      start_time: new Date(2026, 8, 10, 19, 0).toISOString(),
      end_time: new Date(2026, 8, 10, 20, 0).toISOString(),
      status: 'confirmed',
      payment_method: GROEPSLES_METHOD,
    };
    const priveRijen = heenEnTerug([prive], []);
    const kop = priveRijen[0];
    expect(priveRijen[1][kop.indexOf('Type les')]).toBe('Privéles');
    expect(priveRijen[1][kop.indexOf('Groep')]).toBe('');

    const plan = planImportLessen(priveRijen, [], [...RONDRIT_SPELERS, KOEN], [BAAN], [], {}, NU);
    expect(plan.regels).toHaveLength(1);
    expect(plan.groepenNieuw).toEqual([]);
    expect(plan.groepenBijgewerkt).toEqual([]);
    expect(plan.groepenOngewijzigd).toEqual([]);
    expect(plan.nieuweLessen).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Van plan naar rijen (plan 05-08, taak 1)
//
// Hier houdt het rekenwerk op en begint het wegschrijven — maar nog steeds zonder databank.
// `bouwImportWijziging` zet het goedgekeurde plan om in de exacte rijen die de provider straks
// in één opslag wegschrijft. De ids komen als parameter binnen, zodat de uitkomst hier te
// voorspellen valt en de test niet hoeft te raden wat `newId` verzint.
// ---------------------------------------------------------------------------

/** De koprij met alles erin wat een lesgroep nodig heeft, `Type les` incluis: dat wordt haar niveau. */
const KOP_VOLLEDIG = ['Datum', 'Uur', 'Type les', 'Groep', 'Coach', 'Leerling', 'Baan'];

/** Eén rij met een niveau erbij; zonder `Type les` heeft een groep geen niveau en weigert `lesGroepFout` haar. */
function volleRij(
  datum: string, uur: string, groep: string, leerling: string,
  over: { niveau?: string; coach?: string; baan?: string } = {},
): string[] {
  return [
    datum, uur, over.niveau ?? 'Kidstennis oranje', groep,
    over.coach ?? 'Leemans Koen', leerling, over.baan ?? 'Baan 1',
  ];
}

/**
 * Een teller per voorvoegsel: `u-1`, `u-2`, `lg-1`, `b-1`. Dat is precies waarom
 * `bouwImportWijziging` zijn ids als parameter krijgt — met `newId` erin zou geen enkele
 * bewering hieronder te schrijven zijn.
 */
function teller(): (voorvoegsel: string) => string {
  const standen = new Map<string, number>();
  return (voorvoegsel) => {
    const volgende = (standen.get(voorvoegsel) ?? 0) + 1;
    standen.set(voorvoegsel, volgende);
    return `${voorvoegsel}-${volgende}`;
  };
}

describe('overgeslagenPerReden', () => {
  const les = (reden: 'vakantie' | 'bezet' | 'verleden'): OvergeslagenLes => ({
    sleutel: `s-${reden}`, start: NU, reden, regel: 2,
  });

  it('telt nul op elke reden als er niets is overgeslagen', () => {
    expect(overgeslagenPerReden({ overgeslagen: [] }))
      .toEqual({ vakantie: 0, bezet: 0, verleden: 0 });
  });

  it('telt per reden, zodat het scherm aantallen kan tonen in plaats van regels', () => {
    expect(overgeslagenPerReden({
      overgeslagen: [les('vakantie'), les('bezet'), les('vakantie'), les('verleden')],
    })).toEqual({ vakantie: 2, bezet: 1, verleden: 1 });
  });
});

describe('geweigerdeNieuweGroepen', () => {
  const RIJEN = [
    KOP_VOLLEDIG,
    volleRij('09/09/2026', '17:00', 'Groep 8', 'Peferoen Astor'),
    volleRij('09/09/2026', '17:00', 'Groep 8', 'Martens Clara'),
  ];

  it('geeft niets terug als elke nieuwe groep aangemaakt kan worden', () => {
    expect(geweigerdeNieuweGroepen(planImportLessen(RIJEN, [], [KOEN], [BAAN], [], {}, NU)))
      .toEqual([]);
  });

  it('meldt de groep waarvan de trainer nog geen account heeft, met naam en regelnummer', () => {
    // Precies het geval van `koen.xlsx`: de coach staat op elke regel, maar de club heeft geen
    // account voor hem. `lesGroepFout` eist een `coach_id`, dus deze groep komt er niet.
    const geweigerd = geweigerdeNieuweGroepen(
      planImportLessen(RIJEN, [], [], [BAAN], [], {}, NU),
    );
    expect(geweigerd).toHaveLength(1);
    expect(geweigerd[0].inPlan.naam).toBe('Groep 8');
    expect(geweigerd[0].fout.regel).toBe(2);
    expect(geweigerd[0].fout.vars).toMatchObject({ groep: 'Groep 8' });
  });

  it('zegt hetzelfde als wat de uitvoerder straks weigert — één bron, geen twee verhalen', () => {
    // De droogloop toont deze zinnen vóór het wegschrijven en `bouwImportWijziging` gebruikt
    // ze erna. Lopen ze uiteen, dan belooft het scherm iets anders dan er gebeurt (D-10).
    const plan = planImportLessen(RIJEN, [], [], [BAAN], [], {}, NU);
    expect(bouwImportWijziging(plan, teller()).fouten)
      .toEqual(geweigerdeNieuweGroepen(plan).map((g) => g.fout));
  });
});

describe('bouwImportWijziging', () => {
  const RIJEN_NIEUW = [
    KOP_VOLLEDIG,
    volleRij('09/09/2026', '17:00', 'Groep 8', 'Peferoen Astor'),
    volleRij('09/09/2026', '17:00', 'Groep 8', 'Martens Clara'),
    volleRij('16/09/2026', '17:00', 'Groep 8', 'Peferoen Astor'),
    volleRij('16/09/2026', '17:00', 'Groep 8', 'Martens Clara'),
  ];
  const planNieuw = () => planImportLessen(RIJEN_NIEUW, [], [KOEN], [BAAN], [], {}, NU);

  it('geeft vier lijsten met rijen plus wat er niet doorging', () => {
    const uit = bouwImportWijziging(planNieuw(), teller());
    expect(Object.keys(uit).sort()).toEqual([
      'fouten', 'gewijzigdeGroepen', 'nieuweBoekingen', 'nieuweGroepen', 'nieuweUsers',
    ]);
    expect(uit.fouten).toEqual([]);
  });

  it('maakt van elke onbekende leerling één lid, met een voorspelbaar id en zonder lege sleutels', () => {
    const uit = bouwImportWijziging(planNieuw(), teller());
    expect(uit.nieuweUsers).toEqual([
      { id: 'u-1', name: 'Peferoen Astor', email: '', role: 'player' },
      { id: 'u-2', name: 'Martens Clara', email: '', role: 'player' },
    ]);
  });

  it('maakt de groep aan met haar trainer, haar baan, haar seizoen en haar rooster van echte ids', () => {
    const uit = bouwImportWijziging(planNieuw(), teller());
    expect(uit.nieuweGroepen).toEqual([{
      id: 'lg-1',
      name: 'Groep 8',
      level: 'Kidstennis oranje',
      weekday: 3,
      start_hour: 17,
      start_minute: 0,
      coach_id: KOEN.id,
      court_id: BAAN.id,
      season_start: '2026-09-09',
      season_end: '2026-09-16',
      roster: ['u-1', 'u-2'],
      archived: false,
    }]);
    expect(uit.gewijzigdeGroepen).toEqual([]);
  });

  it('hangt de lessen aan het id van díé groep en aan de ids van haar spelers', () => {
    const uit = bouwImportWijziging(planNieuw(), teller());
    expect(uit.nieuweBoekingen).toHaveLength(2);
    expect(uit.nieuweBoekingen[0]).toEqual({
      id: 'b-1',
      group_id: 'lg-1',
      player_id: 'u-1',
      participant_ids: ['u-2'],
      coach_id: KOEN.id,
      court_id: BAAN.id,
      start_time: new Date(2026, 8, 9, 17, 0).toISOString(),
      end_time: new Date(2026, 8, 9, 18, 0).toISOString(),
      status: 'confirmed',
      payment_method: GROEPSLES_METHOD,
    });
    expect(uit.nieuweBoekingen[1].id).toBe('b-2');
    expect(uit.nieuweBoekingen[1].start_time).toBe(new Date(2026, 8, 16, 17, 0).toISOString());
  });

  it('laat geen enkele plaatshouder van een nieuwe speler achter', () => {
    const uit = bouwImportWijziging(planNieuw(), teller());
    const ids = [
      ...uit.nieuweGroepen.flatMap((g) => g.roster),
      ...uit.nieuweBoekingen.flatMap((b) => [b.player_id, ...(b.participant_ids ?? [])]),
    ];
    expect(ids.filter((id) => id.startsWith(NIEUWE_SPELER))).toEqual([]);
  });

  it('geeft twee keer op dezelfde invoer twee keer exact dezelfde rijen', () => {
    expect(bouwImportWijziging(planNieuw(), teller()))
      .toEqual(bouwImportWijziging(planNieuw(), teller()));
  });

  it('geeft een les met één speler geen groepsbetaalwijze maar laat hem open', () => {
    const uit = bouwImportWijziging(planImportLessen([
      KOP_VOLLEDIG,
      volleRij('09/09/2026', '18:00', 'Groep 4', 'Peferoen Astor', { niveau: 'Privéles' }),
    ], [], [KOEN], [BAAN], [], {}, NU), teller());

    expect(uit.nieuweBoekingen).toHaveLength(1);
    expect(uit.nieuweBoekingen[0].payment_method).toBe('open');
    expect(uit.nieuweBoekingen[0].player_id).toBe('u-1');
    // Geen lege sleutel: de betaler staat nooit óók in `participant_ids`, en een leeg lijstje
    // is het verschil tussen "niet ingevuld" en "leeggemaakt" (dezelfde regel als import-leden).
    expect('participant_ids' in uit.nieuweBoekingen[0]).toBe(false);
  });

  it('weigert een groep die lesGroepFout niet doorstaat, en schrijft dan ook haar lessen niet weg', () => {
    // Geen trainer in de ledenlijst: `koppelingVoorGroep` vindt er geen, de groep krijgt dus
    // geen `coach_id`, en dat is precies waar `addLesGroep` haar op zou weigeren. Beter hier
    // dan halverwege de opslag.
    const uit = bouwImportWijziging(
      planImportLessen(RIJEN_NIEUW, [], [], [BAAN], [], {}, NU), teller(),
    );
    expect(uit.nieuweGroepen).toEqual([]);
    expect(uit.nieuweBoekingen).toEqual([]);
    expect(uit.fouten).toHaveLength(1);
    expect(uit.fouten[0].vars).toMatchObject({ groep: 'Groep 8' });
    // De spelers gaan wél door: die staan los van de groep en zijn bij een volgende inleesbeurt
    // gewoon herkend. Dat is de volgorde die een halve import herstelbaar houdt (D-21).
    expect(uit.nieuweUsers).toHaveLength(2);
  });

  it('schrijft geen les weg waarvan de baan in het plan ontbreekt', () => {
    // De uitvoerder rekent niets opnieuw uit: hij past toe wat het plan zei. Zegt het plan dat
    // deze groep geen baan heeft, dan is er geen `Booking.court_id` en bestaat de les niet.
    const plan = planNieuw();
    plan.groepenNieuw[0].baan = null;
    const uit = bouwImportWijziging(plan, teller());
    expect(uit.nieuweGroepen).toHaveLength(1);
    expect(uit.nieuweGroepen[0].court_id).toBeUndefined();
    expect(uit.nieuweBoekingen).toEqual([]);
    expect(uit.fouten).toHaveLength(1);
  });

  it('werkt een bestaande groep bij in plaats van haar opnieuw aan te maken', () => {
    const astor = userVan({ id: 'u-astor', name: 'Astor Peferoen' });
    const club = groepVan({
      id: 'g-8', coach_id: KOEN.id, court_id: BAAN.id, level: 'Oranje', roster: ['u-astor'],
    });
    const plan = planImportLessen(RIJEN_NIEUW, [club], [KOEN, astor], [BAAN], [], {}, NU);
    expect(plan.groepenBijgewerkt).toHaveLength(1);

    const uit = bouwImportWijziging(plan, teller());
    expect(uit.nieuweGroepen).toEqual([]);
    expect(uit.nieuweUsers.map((u) => u.name)).toEqual(['Martens Clara']);
    expect(uit.gewijzigdeGroepen).toEqual([{
      id: 'g-8',
      patch: { level: 'Kidstennis oranje', roster: ['u-astor', 'u-1'] },
    }]);
    // De lessen van de bijgewerkte groep hangen aan het id dat de club al kende.
    expect(uit.nieuweBoekingen.map((b) => b.group_id)).toEqual(['g-8', 'g-8']);
  });

  it('schrijft niets weg voor een groep die niet verandert', () => {
    const spelers = [
      userVan({ id: 'u-astor', name: 'Astor Peferoen' }),
      userVan({ id: 'u-clara', name: 'Clara Martens' }),
    ];
    const club = groepVan({
      id: 'g-8', coach_id: KOEN.id, court_id: BAAN.id, roster: ['u-astor', 'u-clara'],
    });
    const eerste = bouwImportWijziging(
      planImportLessen(RIJEN_NIEUW, [club], [KOEN, ...spelers], [BAAN], [], {}, NU), teller(),
    );
    const boekingen: ImportBoeking[] = eerste.nieuweBoekingen.map((b) => ({
      id: b.id,
      group_id: b.group_id,
      coach_id: b.coach_id,
      court_id: b.court_id,
      start_time: b.start_time,
      end_time: b.end_time,
      status: b.status,
    }));

    const tweede = bouwImportWijziging(planImportLessen(
      RIJEN_NIEUW, [club], [KOEN, ...spelers], [BAAN], boekingen, {}, NU,
    ), teller());
    expect(tweede.nieuweUsers).toEqual([]);
    expect(tweede.nieuweGroepen).toEqual([]);
    expect(tweede.gewijzigdeGroepen).toEqual([]);
    expect(tweede.nieuweBoekingen).toEqual([]);
    expect(tweede.fouten).toEqual([]);
  });

  it('verwijdert nooit iets: een les die uit het bestand verdween blijft een melding', () => {
    const spelers = [
      userVan({ id: 'u-astor', name: 'Astor Peferoen' }),
      userVan({ id: 'u-clara', name: 'Clara Martens' }),
    ];
    const club = groepVan({
      id: 'g-8', coach_id: KOEN.id, court_id: BAAN.id, roster: ['u-astor', 'u-clara'],
    });
    // De club heeft een les op 23 september; het bestand kent alleen 9 en 16 september.
    const weg: ImportBoeking = boekingVan({
      id: 'b-weg',
      group_id: 'g-8',
      start_time: new Date(2026, 8, 23, 17, 0).toISOString(),
      end_time: new Date(2026, 8, 23, 18, 0).toISOString(),
    });
    const plan = planImportLessen(RIJEN_NIEUW, [club], [KOEN, ...spelers], [BAAN], [weg], {}, NU);
    expect(plan.verdwenenUitBestand.map((v) => v.id)).toEqual(['b-weg']);

    const uit = bouwImportWijziging(plan, teller());
    // Er is geen lijst met te verwijderen rijen, en dat is geen omissie maar de afspraak:
    // een les die uit het bestand valt wordt gemeld, nooit gewist.
    expect(Object.keys(uit)).not.toContain('verwijderdeBoekingen');
    // De twee lessen die het bestand wél kent komen erbij; de les van 23 september wordt
    // nergens genoemd, ook niet om hem weg te halen.
    expect(uit.nieuweBoekingen.map((b) => b.start_time)).toEqual([
      new Date(2026, 8, 9, 17, 0).toISOString(),
      new Date(2026, 8, 16, 17, 0).toISOString(),
    ]);
    expect(uit.nieuweBoekingen.map((b) => b.id)).not.toContain('b-weg');
  });
});
