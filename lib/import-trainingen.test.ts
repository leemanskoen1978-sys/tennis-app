import { readFileSync } from 'fs';
import { join } from 'path';

import { GROEPSLES_METHOD } from './beurtenkaart';
import {
  alsBezet, bestandAfgekeurdLessen, deelnemersVoorLes, groepenUitRegels, groepRosterVerschil,
  kiesLessenBlad, koppelingVoorGroep, leesDatumCel, leesKopregelLessen,
  leesLesRegels, leesUurCel, lesduurVan, lesSleutel, lessenUitGroep, nieuwLidUitSpeler,
  spelersUitRegels, voorbeeldTrainingenXlsx, zoekBaan, zoekTrainer,
  type GeplandeGroep, type GroepKoppeling, type ImportBoeking, type LesRegel,
} from './import-trainingen';
import { groepSleutel } from './lesgroepen';
import type { Court, LesGroep, User } from './types';
import { datumNaarSerie } from './xlsx';
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
    const herfst = { naam: 'Herfstvakantie', van: '2026-09-07', tot: '2026-09-13' };
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
    const herfst = { naam: 'Herfstvakantie', van: '2026-09-07', tot: '2026-09-13' };
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
    const groep = groepUit([regelVan()]);
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
