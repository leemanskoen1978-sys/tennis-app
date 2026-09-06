import { readFileSync } from 'fs';
import { join } from 'path';

import {
  bestandAfgekeurdLessen, kiesLessenBlad, leesDatumCel, leesKopregelLessen, leesLesRegels,
  leesUurCel, voorbeeldTrainingenXlsx,
} from './import-trainingen';
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
