import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { GROEPSLES_METHOD } from './beurtenkaart';
import { bladLessen, opzoektabellen } from './export-trainingen';
import {
  alsBezet, baanUitCellen, bestandAfgekeurdLessen, bestandsperiode, bouwImportWijziging,
  deelnemersVoorLes, geweigerdeNieuweGroepen, groepenUitRegels, importWaarschuwingen,
  ingrijpendeWijzigingen, overgeslagenPerReden,
  groepRosterVerschil, kiesLessenBlad, koppelingVoorGroep, leesDatumCel, leesKopregelLessen,
  leesLesRegels, leesUurCel, lesduurVan, lesSleutel, lessenUitGroep, nieuwLidUitSpeler,
  seizoenUitSettings, demoAdres, spelersUitRegels as leesSpelers,
  trainerwisselVoorGroep,
  NIEUWE_SPELER, planImportLessen, spelerSleutel,
  groepWijzigingen, spelersUitRegels, voorbeeldTrainingenXlsx, zoekBaan, zoekTrainer,
  type Bestandsperiode, type GeplandeGroep, type GeplandeLes, type GroepKoppeling,
  type ImportBoeking, type ImportPlanLessen, type IngrijpendeWijzigingen, type LesRegel,
  type OvergeslagenLes,
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
    // `Indoor/Outdoor` is de tiende kolom en telt als tweede baankolom: de club draagt haar
    // terreinnummer daarin. `Locatie` blijft genegeerd.
    expect(kop.kolommen).toEqual({
      datum: 0, uur: 3, typeLes: 4, groep: 5, coach: 6, leerling: 7, baanAlt: 9,
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

// ---------------------------------------------------------------------------
// Het nagemaakte bestand uit lib/__fixtures__, dat wél in de repository staat.
//
// `koen.xlsx` mag hier niet komen (echte kindernamen, publieke repo). Zonder bestand zou de
// hele weg van bytes tot lesplan op CI ongedekt blijven. Dit kleine, verzonnen bestand is uit
// koen.xlsx afgeleid, houdt diens Excel-eigenaardigheden vast en draait altijd. Het bewijst de
// machinerie; koen.xlsx bewijst het hele seizoen, en alleen waar het bestand staat.
// ---------------------------------------------------------------------------

const VOORBEELD_PAD = join(__dirname, '__fixtures__', 'lessen-voorbeeld.xlsx');

function voorbeeldBytes(): Uint8Array {
  const rauw = readFileSync(VOORBEELD_PAD);
  return new Uint8Array(rauw.buffer, rauw.byteOffset, rauw.byteLength);
}

// ---------------------------------------------------------------------------
// Het echte bestand is er niet altijd.
//
// `koen.xlsx` staat bewust in .gitignore en zit dus niet in de repository: deze repo is
// publiek en het bestand bevat de echte namen van 42 kinderen van de club. Commit het niet
// en haal het niet uit .gitignore, hoe handig dat voor de build ook lijkt.
//
// Zonder dat bestand valt er niets te bewijzen. De tests die het lezen worden dan luid
// overgeslagen -- niet stil geslaagd, en ook niet de hele suite laten ontploffen (wat op CI
// gebeurde toen ze het bestand blind inlazen).
// ---------------------------------------------------------------------------
const KOEN_PAD = join(__dirname, '..', 'koen.xlsx');
const heeftKoen = existsSync(KOEN_PAD);
if (!heeftKoen) {
  console.warn(
    `LET OP: ${KOEN_PAD} ontbreekt -- het staat bewust in .gitignore omdat deze repository `
    + 'publiek is en het bestand de namen van echte leerlingen bevat. De tests van '
    + 'lib/import-trainingen die dat bestand lezen worden overgeslagen en bewijzen in deze '
    + 'draaibeurt dus niets.',
  );
}
const alsKoenErIs = heeftKoen ? it : it.skip;

function koenBytes(): Uint8Array {
  const rauw = readFileSync(KOEN_PAD);
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

  it('leest de baan uit de kolom Indoor/Outdoor, behalve als daar het woord zelf staat', () => {
    const uitkomst = leesLesRegels([
      [...KOP_MINIMAAL, 'Indoor/Outdoor'],
      ['09/09/2026', '15:00', 'Groep 4', 'Koen', 'Antoine', '3'],
      ['09/09/2026', '15:00', 'Groep 4', 'Koen', 'Lotte', 'Indoor'],
    ]);
    expect(uitkomst.fouten).toEqual([]);
    expect(uitkomst.nietHerkend).toEqual([]);
    expect(uitkomst.regels.map((r) => r.baan)).toEqual(['3', '']);
  });

  it('laat de kolom Baan winnen van Indoor/Outdoor, en valt erop terug als Baan leeg is', () => {
    const uitkomst = leesLesRegels([
      [...KOP_MINIMAAL, 'Baan', 'Indoor/Outdoor'],
      ['09/09/2026', '15:00', 'Groep 4', 'Koen', 'Antoine', 'Baan 2', 'Indoor'],
      ['09/09/2026', '15:00', 'Groep 4', 'Koen', 'Lotte', '', '5'],
    ]);
    expect(uitkomst.dubbel).toEqual([]);
    expect(uitkomst.regels.map((r) => r.baan)).toEqual(['Baan 2', '5']);
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

  alsKoenErIs('leest de 1398 regels van koen.xlsx zonder één fout', () => {
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
  it('voegt regels met dezelfde dag, hetzelfde uur en dezelfde baan samen tot één groep', () => {
    const uitkomst = groepenUitRegels([
      regelVan({ regel: 2, leerling: 'Peferoen Astor' }),
      regelVan({ regel: 3, leerling: 'Martens Clara' }),
      regelVan({ regel: 4, datum: { jaar: 2026, maand: 9, dag: 16 }, leerling: 'Peferoen Astor' }),
    ], [], []);
    expect(uitkomst.groepen).toHaveLength(1);
    expect(uitkomst.groepen[0].leerlingNamen).toEqual(['Peferoen Astor', 'Martens Clara']);
    expect(uitkomst.groepen[0].regels).toHaveLength(3);
    expect(uitkomst.waarschuwingen).toEqual([]);
  });

  it('gebruikt de sleutel van lib/lesgroepen en geen eigen versie', () => {
    const [groep] = groepenUitRegels([regelVan()], [], []).groepen;
    expect(groep.sleutel).toBe(groepSleutel({ weekday: 3, start_hour: 17, court_id: undefined }));
    expect(groep.weekdag).toBe(3);
    expect(groep.beginuur).toBe(17);
    expect(groep.beginminuut).toBe(0);
  });

  it('scheidt hetzelfde label op een andere dag of een ander uur in twee groepen', () => {
    const uitkomst = groepenUitRegels([
      regelVan({ regel: 2, leerling: 'Peferoen Astor' }),
      regelVan({ regel: 3, datum: { jaar: 2026, maand: 9, dag: 11 }, leerling: 'Bertrem Mila' }),
      regelVan({ regel: 4, datum: { jaar: 2026, maand: 9, dag: 11 }, uur: { uur: 19, minuut: 0 }, leerling: 'Malcolm Eric' }),
    ], [], []);
    expect(uitkomst.groepen).toHaveLength(3);
    expect(uitkomst.groepen.map((g) => g.leerlingNamen)).toEqual([
      ['Peferoen Astor'], ['Bertrem Mila'], ['Malcolm Eric'],
    ]);
  });

  it('voegt twee verschillende waarden in Groep op hetzelfde moment samen tot één groep', () => {
    // De kern van deze fase. `Groep` komt bij deze club uit het Tennis Vlaanderen-systeem en is
    // een administratief label; hetzelfde moment is hetzelfde uur op dezelfde baan, en dus
    // dezelfde groep.
    const uitkomst = groepenUitRegels([
      regelVan({ regel: 2, groep: 'Groep 8', leerling: 'Peferoen Astor' }),
      regelVan({ regel: 3, groep: 'Groep 12', leerling: 'Martens Clara' }),
    ], [], []);
    expect(uitkomst.groepen).toHaveLength(1);
    expect(uitkomst.groepen[0].leerlingNamen).toEqual(['Peferoen Astor', 'Martens Clara']);
    expect(uitkomst.waarschuwingen).toEqual([]);
  });

  it('noemt een nieuwe groep naar haar moment, met de baan erachter als die er is', () => {
    const zonder = groepenUitRegels([regelVan({ groep: 'Groep 8' })], [], []).groepen[0];
    expect(zonder.naam).toBe('Woensdag 17:00');

    const opDrie = groepenUitRegels([regelVan({ baan: '3' })], [], []).groepen[0];
    expect(opDrie.naam).toBe('Woensdag 17:00 — baan 3');

    const center = groepenUitRegels([regelVan({ baan: 'Centercourt' })], [], []).groepen[0];
    expect(center.naam).toBe('Woensdag 17:00 — Centercourt');
  });

  it('toont in de naam de echte begintijd, ook al telt de minuut niet mee in de sleutel', () => {
    const [groep] = groepenUitRegels([regelVan({ uur: { uur: 17, minuut: 30 } })], [], []).groepen;
    expect(groep.naam).toBe('Woensdag 17:30');
  });

  it('laat een bestaande groep haar eigen naam houden, wat de kolom Groep ook zegt', () => {
    // D-05: een herimport zonder `Groep-ID` overschrijft nooit een naam die de beheerder zelf
    // op het groepsscherm gaf.
    const bestaand = groepVan({ name: 'De woensdagploeg' });
    const [groep] = groepenUitRegels([regelVan({ groep: 'Groep 99' })], [bestaand], []).groepen;
    expect(groep.bestaand).toBe(bestaand);
    expect(groep.naam).toBe('De woensdagploeg');
  });

  it('laat de kolom Groep wél de naam bepalen bij een Groep-ID', () => {
    const bestaand = groepVan({ id: 'g-42', name: 'De woensdagploeg' });
    const [groep] = groepenUitRegels(
      [regelVan({ groepId: 'g-42', groep: 'De gevorderden' })], [bestaand], [],
    ).groepen;
    expect(groep.viaGroepId).toBe(true);
    expect(groep.naam).toBe('De gevorderden');
  });

  it('scheidt hetzelfde moment op twee banen, met één zin erover en niet één per regel', () => {
    const banen = [baanVan(), baanVan({ id: 'c2', name: 'Baan 2', number: 2 })];
    const uitkomst = groepenUitRegels([
      regelVan({ regel: 2, baan: 'Baan 1', leerling: 'Peferoen Astor' }),
      regelVan({ regel: 3, baan: 'Baan 2', leerling: 'Martens Clara' }),
      regelVan({ regel: 4, baan: 'Baan 2', leerling: 'Bertrem Mila' }),
    ], [], banen);

    expect(uitkomst.groepen).toHaveLength(2);
    expect(uitkomst.groepen.map((g) => g.naam))
      .toEqual(['Woensdag 17:00 — Baan 1', 'Woensdag 17:00 — Baan 2']);
    expect(uitkomst.waarschuwingen).toHaveLength(1);
    expect(uitkomst.waarschuwingen[0].reden).toContain('meer dan één baan');
    expect(uitkomst.waarschuwingen[0].vars).toEqual({ dag: 'Woensdag', uur: '17:00' });
  });

  it('maakt van een regel zonder groep geen groep — dat is een privéles', () => {
    const uitkomst = groepenUitRegels([regelVan({ groep: '' }), regelVan({ regel: 3, groep: '   ' })], [], []);
    expect(uitkomst.groepen).toEqual([]);
    expect(uitkomst.waarschuwingen).toEqual([]);
  });

  it('neemt de vroegste en de laatste datum als seizoen', () => {
    const [groep] = groepenUitRegels([
      regelVan({ regel: 2, datum: { jaar: 2026, maand: 10, dag: 7 } }),
      regelVan({ regel: 3, datum: { jaar: 2026, maand: 9, dag: 9 } }),
      regelVan({ regel: 4, datum: { jaar: 2027, maand: 6, dag: 23 } }),
    ], [], []).groepen;
    expect(groep.seizoenVan).toBe('2026-09-09');
    expect(groep.seizoenTot).toBe('2027-06-23');
  });

  it('kiest bij twee lessoorten de meest voorkomende en meldt beide waarden', () => {
    const uitkomst = groepenUitRegels([
      regelVan({ regel: 2, typeLes: 'Oranje' }),
      regelVan({ regel: 3, typeLes: 'Groen' }),
      regelVan({ regel: 4, typeLes: 'Oranje' }),
    ], [], []);
    expect(uitkomst.groepen[0].niveau).toBe('Oranje');
    expect(uitkomst.waarschuwingen).toHaveLength(1);
    expect(uitkomst.waarschuwingen[0].regel).toBe(3);
    expect(uitkomst.waarschuwingen[0].vars).toMatchObject({ gekozen: 'Oranje', andere: 'Groen' });
  });

  it('meldt niets over een lege Type les — een lege cel is geen tweede lessoort', () => {
    const uitkomst = groepenUitRegels([
      regelVan({ regel: 2, typeLes: 'Oranje' }),
      regelVan({ regel: 3, typeLes: '' }),
    ], [], []);
    expect(uitkomst.groepen[0].niveau).toBe('Oranje');
    expect(uitkomst.waarschuwingen).toEqual([]);
  });

  it('kiest bij twee coaches de meest voorkomende en meldt het', () => {
    const uitkomst = groepenUitRegels([
      regelVan({ regel: 2, coach: 'Leemans Koen' }),
      regelVan({ regel: 3, coach: 'Maes Sofie' }),
      regelVan({ regel: 4, coach: 'Leemans Koen' }),
    ], [], []);
    expect(uitkomst.groepen[0].coachNaam).toBe('Leemans Koen');
    expect(uitkomst.waarschuwingen).toHaveLength(1);
    expect(uitkomst.waarschuwingen[0].regel).toBe(3);
    expect(uitkomst.waarschuwingen[0].vars).toMatchObject({ gekozen: 'Leemans Koen', andere: 'Maes Sofie' });
  });

  it('herkent een bestaande groep op de sleutel', () => {
    const bestaand = groepVan();
    const [groep] = groepenUitRegels([regelVan()], [bestaand], []).groepen;
    expect(groep.bestaand).toBe(bestaand);
  });

  it('laat een Groep-ID winnen van de sleutel, ook als naam en uur veranderd zijn', () => {
    const bestaand = groepVan({ id: 'g-42' });
    const uitkomst = groepenUitRegels([
      regelVan({ regel: 2, groepId: 'g-42', groep: 'Groep 9', uur: { uur: 18, minuut: 0 } }),
      regelVan({ regel: 3, groepId: 'g-42', groep: 'Groep 9', uur: { uur: 18, minuut: 0 }, leerling: 'Martens Clara' }),
    ], [bestaand], []);
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
    ], [bestaand], []);
    expect(uitkomst.groepen).toHaveLength(1);
    expect(uitkomst.groepen[0].leerlingNamen).toEqual(['Peferoen Astor', 'Martens Clara']);
  });

  it('valt terug op de sleutel bij een Groep-ID dat de club niet kent, met één waarschuwing', () => {
    const uitkomst = groepenUitRegels([
      regelVan({ regel: 2, groepId: 'van-vorig-seizoen' }),
      regelVan({ regel: 3, groepId: 'van-vorig-seizoen', leerling: 'Martens Clara' }),
    ], [groepVan()], []);
    expect(uitkomst.groepen).toHaveLength(1);
    expect(uitkomst.groepen[0].sleutel).toBe(groepSleutel({ weekday: 3, start_hour: 17, court_id: undefined }));
    expect(uitkomst.waarschuwingen).toHaveLength(1);
    expect(uitkomst.waarschuwingen[0].regel).toBe(2);
    expect(uitkomst.waarschuwingen[0].vars).toMatchObject({ waarde: 'van-vorig-seizoen' });
  });

  it('herkent een gearchiveerde groep niet — archiveren was een bewuste daad', () => {
    const uitkomst = groepenUitRegels([regelVan()], [groepVan({ archived: true })], []);
    expect(uitkomst.groepen[0].bestaand).toBeNull();
  });

  it('herkent ook een gearchiveerde groep niet op haar Groep-ID', () => {
    const uitkomst = groepenUitRegels([regelVan({ groepId: 'g-8-woensdag' })], [groepVan({ archived: true })], []);
    expect(uitkomst.groepen[0].bestaand).toBeNull();
    expect(uitkomst.waarschuwingen).toHaveLength(1);
  });

  alsKoenErIs('levert op koen.xlsx tien groepen met tien namen, elk naar haar eigen moment', () => {
    // Tien momenten, dus tien groepen en tien namen. De kolom `Groep` van dit bestand kent er
    // maar zeven verschillende, want "Groep 8" staat op drie momenten en "Groep 12" op twee —
    // en juist daarom doet die kolom niet meer mee aan het benoemen.
    const blad = kiesLessenBlad(leesWerkmap(koenBytes()))!;
    const { regels } = leesLesRegels(blad.rijen);
    const uitkomst = groepenUitRegels(regels, [], []);
    expect(uitkomst.groepen).toHaveLength(10);
    const namen = uitkomst.groepen.map((g) => g.naam);
    expect(new Set(namen).size).toBe(10);
    expect(namen.filter((n) => n.startsWith('Groep '))).toEqual([]);
    expect(namen).toContain('Woensdag 17:00');
    expect(uitkomst.groepen.every((g) => g.coachNaam === 'Leemans Koen')).toBe(true);
    expect(uitkomst.groepen.every((g) => g.bestaand === null)).toBe(true);
  });

  alsKoenErIs('houdt de drie momenten die "Groep 8" heetten uit elkaar: zes, vier en twee spelers', () => {
    // Dit was de test die bewees dat de naam mét dag en uur drie groepen opleverde. Hij bewijst
    // nu hetzelfde over dag en uur alléén: de club heeft hier één administratief label op drie
    // momenten met twaalf verschillende mensen en nul overlap gezet. Zouden die drie samenvallen,
    // dan zat er één groep van twaalf in de app.
    const blad = kiesLessenBlad(leesWerkmap(koenBytes()))!;
    const { regels } = leesLesRegels(blad.rijen);
    const alle = groepenUitRegels(regels, [], []).groepen;
    const momenten: Array<[number, number]> = [[3, 17], [5, 17], [5, 19]];
    const acht = momenten.map(([weekdag, beginuur]) =>
      alle.find((g) => g.weekdag === weekdag && g.beginuur === beginuur)!);

    expect(acht.map((g) => [g.weekdag, g.beginuur, g.leerlingNamen.length])).toEqual([
      [3, 17, 6], [5, 17, 4], [5, 19, 2],
    ]);
    expect(acht.map((g) => g.naam))
      .toEqual(['Woensdag 17:00', 'Vrijdag 17:00', 'Vrijdag 19:00']);
    expect(new Set(acht.flatMap((g) => g.leerlingNamen)).size).toBe(12);
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

  alsKoenErIs('levert op koen.xlsx met een lege ledenlijst 42 nieuwe spelers zonder dubbels', () => {
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
  const [groep] = groepenUitRegels([regelVan({ coach: 'Leemans Koen', baan: 'Baan 1' })], [], []).groepen;
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
    expect(koppeling.meldingen[0].vars)
      .toMatchObject({ naam: 'Leemans Koen', groep: 'Woensdag 17:00 — Baan 1' });
  });

  it('meldt een onbekende baan één keer per groep', () => {
    const koppeling = koppelingVoorGroep(groep, [koen], []);
    expect(koppeling.baan).toBeNull();
    expect(koppeling.meldingen).toHaveLength(1);
    expect(koppeling.meldingen[0].vars).toMatchObject({ waarde: 'Baan 1' });
  });

  it('meldt bij een lege Baan dat er geen baan opgegeven is en niet dat de naam fout is', () => {
    const [zonder] = groepenUitRegels([regelVan({ baan: '' })], [], []).groepen;
    const koppeling = koppelingVoorGroep(zonder, [koen], [baanVan()]);
    expect(koppeling.baan).toBeNull();
    expect(koppeling.meldingen).toHaveLength(1);
    expect(koppeling.meldingen[0].vars).toEqual({ groep: 'Woensdag 17:00' });
  });

  alsKoenErIs('geeft op koen.xlsx twintig meldingen en niet veertienhonderd', () => {
    // Tien groepen × (geen trainersaccount + geen kolom Baan). Eén melding per groep is het
    // verschil tussen een droogloop en een muur: per regel zouden dit er 2796 zijn.
    const blad = kiesLessenBlad(leesWerkmap(koenBytes()))!;
    const { regels } = leesLesRegels(blad.rijen);
    const groepen = groepenUitRegels(regels, [], []).groepen;
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
/** Een tweede terrein: sinds de sleutel de baan meetelt is dat het enige dat twee groepen op hetzelfde uur uit elkaar houdt. */
const BAAN_2 = baanVan({ id: 'c2', name: 'Baan 2', number: 2 });
/** Een tweede trainer, voor de rondrit waarin een trainerswissel géén nieuwe groep mag worden. */
const SOFIE = userVan({ id: 'u-sofie', name: 'Sofie Maes', role: 'coach' });
const GEKOPPELD: GroepKoppeling = { trainer: KOEN, baan: BAAN, meldingen: [] };
/** De ledenlijst waarin `lessenUitGroep` de naam van de vórige trainer opzoekt. */
const LEDEN = [KOEN, SOFIE];
/** Voor een groep die (nog) geen baan heeft: dan hoort er ook geen `court_id` in de wijzigingen. */
const ZONDER_BAAN: GroepKoppeling = { trainer: KOEN, baan: null, meldingen: [] };
/** Ruim vóór 9 september 2026: alles uit deze tests ligt dus in de toekomst. */
const NU = new Date(2026, 8, 1);

/** De ene groep die uit deze regels volgt. */
function groepUit(
  regels: LesRegel[], bestaande: LesGroep[] = [], courts: Court[] = [],
): GeplandeGroep {
  return groepenUitRegels(regels, bestaande, courts).groepen[0];
}

/** Een regel op baan 1, zodat haar sleutel bij een bestaande groep met `court_id: 'c1'` past. */
function opBaanEen(over: Partial<LesRegel> = {}): LesRegel {
  return regelVan({ baan: 'Baan 1', ...over });
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

describe('spelers zonder e-mailkolom', () => {
  const zonderMail = (naam: string, regel: number) => ({
    regel, leerling: naam, emailLeerling: '',
  });

  it('geeft elk nieuw lid een eigen adres, zodat de unieke sleutel niet botst', () => {
    const { spelers } = leesSpelers(
      [zonderMail('Jan Jansen', 2), zonderMail('Piet Peeters', 3), zonderMail('Marie Maes', 4)],
      [],
    );
    const adressen = spelers.map((sp) => sp.email);
    expect(new Set(adressen).size).toBe(3);
    expect(adressen.every((a) => a.endsWith('@example.com'))).toBe(true);
  });

  it('verzint geen adres voor een leerling die de club al kent', () => {
    const { spelers } = leesSpelers(
      [zonderMail('Jan Jansen', 2)],
      [{ id: 'u1', name: 'Jan Jansen', email: 'jan@echt.be', role: 'player' }],
    );
    expect(spelers[0].bestaand?.id).toBe('u1');
    expect(spelers[0].email).toBe('');
  });

  it('botst niet met een adres dat de club al kent', () => {
    const { spelers } = leesSpelers(
      [zonderMail('Jan Jansen', 2)],
      [{ id: 'u1', name: 'Iemand Anders', email: 'jan.jansen@example.com', role: 'player' }],
    );
    expect(spelers[0].bestaand).toBeNull();
    expect(spelers[0].email).toBe('jan.jansen2@example.com');
  });

  it('houdt het adres uit het bestand als dat er wél is', () => {
    const { spelers } = leesSpelers(
      [{ regel: 2, leerling: 'Jan Jansen', emailLeerling: 'jan@echt.be' }],
      [],
    );
    expect(spelers[0].email).toBe('jan@echt.be');
  });
});

describe('seizoenUitSettings', () => {
  it('leest het seizoen uit de clubinstellingen', () => {
    expect(seizoenUitSettings({ season_start: '2026-09-07', season_end: '2027-06-30' }))
      .toEqual({ van: '2026-09-07', tot: '2027-06-30' });
  });

  it('geeft null als het seizoen niet ingesteld is', () => {
    expect(seizoenUitSettings({})).toBeNull();
  });

  it('geeft null bij een half seizoen: een datum zonder de andere is geen periode', () => {
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
    const uit = lessenUitGroep(groep, GEKOPPELD, LEDEN, [], [], 60, NU);
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
    const [les] = lessenUitGroep(groep, GEKOPPELD, LEDEN, [], [], 90, NU).nieuweLessen;
    expect(les.eind.getHours()).toBe(18);
    expect(les.eind.getMinutes()).toBe(30);
  });

  it('maakt van zes regels van dezelfde les één les en geen zes', () => {
    const groep = groepUit([
      regelVan({ regel: 2, leerling: 'Peferoen Astor' }),
      regelVan({ regel: 3, leerling: 'Martens Clara' }),
      regelVan({ regel: 4, leerling: 'Bertrem Mila' }),
    ]);
    expect(lessenUitGroep(groep, GEKOPPELD, LEDEN, [], [], 60, NU).nieuweLessen).toHaveLength(1);
  });

  it('slaat een les in een clubvakantie over, met de naam van de vakantie erbij', () => {
    const groep = groepUit([regelVan()]);
    const herfst = { id: 'v1', naam: 'Herfstvakantie', van: '2026-09-07', tot: '2026-09-13' };
    const uit = lessenUitGroep(groep, GEKOPPELD, LEDEN, [], [herfst], 60, NU);
    expect(uit.nieuweLessen).toEqual([]);
    expect(uit.overgeslagen).toHaveLength(1);
    expect(uit.overgeslagen[0].reden).toBe('vakantie');
    expect(uit.overgeslagen[0].vakantie).toBe('Herfstvakantie');
  });

  // Een overlap blokkeert nooit en waarschuwt altijd. Beide helften horen bewezen: de les
  // wordt ingepland ÉN de botsing staat gemeld. Dit is de melding die het kleutertennis van
  // deze club draagt — op vijf momenten staan twee of drie groepen samen op Terrein 7, en
  // zolang een botsing de les tegenhield plande de import juist die vijf niet in.
  it('plant een les die botst met een bezette trainer gewoon in, en meldt de botsing', () => {
    const groep = groepUit([regelVan()]);
    const bezet = boekingVan({ id: 'b-ander', group_id: 'g-ander', court_id: 'c9' });
    const uit = lessenUitGroep(groep, GEKOPPELD, LEDEN, [bezet], [], 60, NU);
    // De les IS ingepland.
    expect(uit.nieuweLessen).toHaveLength(1);
    expect(uit.overgeslagen).toEqual([]);
    // En de botsing IS gemeld, met de les waarmee het botst en de groep die erbij komt.
    expect(uit.botsingen).toHaveLength(1);
    expect(uit.botsingen[0].conflict.id).toBe('b-ander');
    expect(uit.botsingen[0].groep).toBe(groep.naam);
    // De bestaande les blijft precies staan waar hij staat; de import overschrijft nooit.
    expect(bezet.start_time).toBe(new Date(2026, 8, 9, 17, 0).toISOString());
  });

  it('plant ook bij een bezette baan in, en meldt het', () => {
    const groep = groepUit([regelVan()]);
    const bezet = boekingVan({ id: 'b-ander', group_id: 'g-ander', coach_id: 'u-sofie' });
    const uit = lessenUitGroep(groep, GEKOPPELD, LEDEN, [bezet], [], 60, NU);
    expect(uit.nieuweLessen).toHaveLength(1);
    expect(uit.overgeslagen).toEqual([]);
    expect(uit.botsingen.map((b) => b.conflict.id)).toEqual(['b-ander']);
    // De trainer en de baan waarvoor de botsing gevonden werd komen mee, zodat het scherm
    // "Terrein 7" of de naam van de trainer kan zeggen in plaats van een id.
    expect(uit.botsingen[0].courtId).toBe(GEKOPPELD.baan?.id);
    expect(uit.botsingen[0].coachId).toBe(GEKOPPELD.trainer?.id);
  });

  it('telt een les in een vakantie én in een bezet uur één keer, als vakantie', () => {
    const groep = groepUit([regelVan()]);
    const bezet = boekingVan({ id: 'b-ander', group_id: 'g-ander' });
    const herfst = { id: 'v1', naam: 'Herfstvakantie', van: '2026-09-07', tot: '2026-09-13' };
    const uit = lessenUitGroep(groep, GEKOPPELD, LEDEN, [bezet], [herfst], 60, NU);
    // DE GRENS VAN DEZE FASE: de vakantie blokkeert nog steeds. Alleen de overlapregel is
    // verzacht, en de les gaat dus níét door — is de club dicht, dan doet de botsing er niet
    // meer toe en wordt ze ook niet apart gemeld.
    expect(uit.overgeslagen).toHaveLength(1);
    expect(uit.overgeslagen[0].reden).toBe('vakantie');
    expect(uit.nieuweLessen).toEqual([]);
    expect(uit.botsingen).toEqual([]);
  });

  it('laat het bestand met zichzelf botsen: de tweede groep gaat door én wordt gemeld', () => {
    // Precies het geval van deze club: twee groepen in hetzelfde bestand op hetzelfde uur en
    // dezelfde baan. Ze komen er allebei, en de tweede meldt zich.
    const eerste = groepUit([regelVan({ groep: 'Groep 8' })]);
    const tweede = groepUit([regelVan({ regel: 20, groep: 'Groep 12', leerling: 'Bertrem Mila' })]);
    const uitEerste = lessenUitGroep(eerste, GEKOPPELD, LEDEN, [], [], 60, NU);
    expect(uitEerste.nieuweLessen).toHaveLength(1);
    expect(uitEerste.botsingen).toEqual([]);
    const reeds = uitEerste.nieuweLessen.map((l) => alsBezet(l, GEKOPPELD));
    const uitTweede = lessenUitGroep(tweede, GEKOPPELD, LEDEN, reeds, [], 60, NU);
    expect(uitTweede.nieuweLessen).toHaveLength(1);
    expect(uitTweede.overgeslagen).toEqual([]);
    expect(uitTweede.botsingen).toHaveLength(1);
    expect(uitTweede.botsingen[0].conflict.id).toBe(reeds[0].id);
  });

  it('plant geen les zonder trainer, en meldt het één keer', () => {
    const groep = groepUit([regelVan({ baan: 'Baan 1' })]);
    const koppeling = koppelingVoorGroep(groep, [], [BAAN]);
    const uit = lessenUitGroep(groep, koppeling, LEDEN, [], [], 60, NU);
    expect(uit.nieuweLessen).toEqual([]);
    expect(uit.meldingen).toHaveLength(1);
    // De groep zelf blijft gewoon in het plan staan, mét haar roster.
    expect(groep.leerlingNamen).toEqual(['Peferoen Astor']);
  });

  it('plant geen les zonder baan, en meldt het één keer', () => {
    const groep = groepUit([regelVan()]);
    const koppeling = koppelingVoorGroep(groep, [KOEN], []);
    const uit = lessenUitGroep(groep, koppeling, LEDEN, [], [], 60, NU);
    expect(uit.nieuweLessen).toEqual([]);
    expect(uit.meldingen).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// De trainerwissel (plan 05.1-03, taak 1)
//
// Het scenario waar deze fase om begon: dezelfde lijst, trainer X wordt trainer Y in de kolom
// `Coach`. De groep wordt op haar moment herkend, en haar komende lessen horen mee te gaan.
// ---------------------------------------------------------------------------

describe('trainerwisselVoorGroep', () => {
  /** De groep zoals de club haar kent: woensdag 17:00 op baan 1, met Sofie als trainer. */
  const CLUB = groepVan({ coach_id: SOFIE.id, court_id: BAAN.id });

  /** Diezelfde groep zoals het bestand haar aanlevert, met Koen in de kolom `Coach`. */
  function uitBestand(): GeplandeGroep {
    return groepUit([opBaanEen()], [CLUB], [BAAN]);
  }

  /** Drie komende lessen van die groep, alle drie nog op de oude trainer. */
  function opSofie(): ImportBoeking[] {
    return [9, 16, 23].map((dag, i) => boekingVan({
      id: `b-${i}`,
      group_id: CLUB.id,
      coach_id: SOFIE.id,
      start_time: new Date(2026, 8, dag, 17, 0).toISOString(),
      end_time: new Date(2026, 8, dag, 18, 0).toISOString(),
    }));
  }

  it('geeft de drie komende lessen aan de nieuwe trainer, met hun aantal en hun ids erbij', () => {
    expect(trainerwisselVoorGroep(uitBestand(), GEKOPPELD, opSofie(), LEDEN)).toEqual({
      groep: 'Groep 8',
      van: 'Sofie Maes',
      naar: 'Koen Leemans',
      trainerId: KOEN.id,
      aantal: 3,
      boekingIds: ['b-0', 'b-1', 'b-2'],
    });
  });

  it('geeft niets terug als het bestand dezelfde trainer noemt als die er al staat', () => {
    const zelfde = opSofie().map((b) => ({ ...b, coach_id: KOEN.id }));
    expect(trainerwisselVoorGroep(uitBestand(), GEKOPPELD, zelfde, LEDEN)).toBeNull();
  });

  it('wisselt ook een oude trainer zonder account, en laat zijn naam dan leeg', () => {
    // `van` is er om te tonen. Kent de club dat account niet meer, dan is er niets te tonen —
    // maar de lessen staan er wél en horen gewoon hun nieuwe trainer te krijgen.
    const wissel = trainerwisselVoorGroep(uitBestand(), GEKOPPELD, opSofie(), [KOEN]);
    expect(wissel?.van).toBe('');
    expect(wissel?.aantal).toBe(3);
  });

  it('geeft niets terug voor een nieuwe groep: er is nog niets om bij te werken', () => {
    const nieuw = groepUit([opBaanEen()], [], [BAAN]);
    expect(nieuw.bestaand).toBeNull();
    expect(trainerwisselVoorGroep(nieuw, GEKOPPELD, opSofie(), LEDEN)).toBeNull();
  });

  it('verzint geen trainer als de club de coach uit het bestand niet kent', () => {
    const koppeling = koppelingVoorGroep(uitBestand(), [], [BAAN]);
    expect(koppeling.trainer).toBeNull();
    expect(trainerwisselVoorGroep(uitBestand(), koppeling, opSofie(), LEDEN)).toBeNull();
  });

  it('laat een afgezegde komende les met rust: die krijgt geen nieuwe trainer', () => {
    const metAfzegging = opSofie().map((b) => (
      b.id === 'b-1' ? { ...b, status: 'cancelled' as const } : b
    ));
    const wissel = trainerwisselVoorGroep(uitBestand(), GEKOPPELD, metAfzegging, LEDEN);
    expect(wissel?.aantal).toBe(2);
    expect(wissel?.boekingIds).toEqual(['b-0', 'b-2']);
  });

  it('laat de lessen van vóór nu buiten de wissel: wat geweest is, blijft van wie het gaf', () => {
    // De lijst komt uit `groupBookingsFrom(..., nu)` en kan het verleden dus niet eens zien.
    const geweest = boekingVan({
      id: 'b-geweest',
      group_id: CLUB.id,
      coach_id: SOFIE.id,
      start_time: new Date(2026, 8, 2, 17, 0).toISOString(),
      end_time: new Date(2026, 8, 2, 18, 0).toISOString(),
      status: 'completed',
    });
    const uit = lessenUitGroep(
      uitBestand(), GEKOPPELD, LEDEN, [geweest, ...opSofie()], [], 60, new Date(2026, 8, 10),
    );
    expect(uit.trainerwissel?.boekingIds).toEqual(['b-1', 'b-2']);
    expect(uit.trainerwissel?.aantal).toBe(2);
  });

  it('geeft een groep zónder baan haar nieuwe trainer wél, ook al plant ze niets in', () => {
    // Zonder baan gaat er geen enkele nieuwe les door — maar de lessen die er al staan bestaan
    // gewoon, en die horen mee te wisselen.
    const uit = lessenUitGroep(uitBestand(), ZONDER_BAAN, LEDEN, opSofie(), [], 60, NU);
    expect(uit.nieuweLessen).toEqual([]);
    expect(uit.trainerwissel?.aantal).toBe(3);
    expect(uit.trainerwissel?.trainerId).toBe(KOEN.id);
  });

  it('legt de wissel in het plan, zodat de droogloop het aantal vooraf kan tonen', () => {
    const plan = planImportLessen(
      [KOP_VOLLEDIG, volleRij('09/09/2026', '17:00', 'Groep 8', 'Peferoen Astor')],
      [CLUB], [KOEN, SOFIE, userVan({ id: 'u-astor', name: 'Peferoen Astor' })], [BAAN],
      opSofie(), {}, NU,
    );
    expect(plan.trainerwissels).toHaveLength(1);
    expect(plan.trainerwissels[0]).toMatchObject({
      van: 'Sofie Maes', naar: 'Koen Leemans', aantal: 3,
    });
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
    const eersteKeer = lessenUitGroep(groepUit([WEEK_1, WEEK_2]), GEKOPPELD, LEDEN, [], [], 60, NU);
    expect(eersteKeer.nieuweLessen).toHaveLength(2);

    // Na de eerste import kent de club de groep en staan haar twee lessen in de agenda.
    const club = groepVan();
    const boekingen = alsBoekingen(eersteKeer.nieuweLessen, club.id);
    const tweedeKeer = lessenUitGroep(
      groepUit([WEEK_1, WEEK_2], [club]), GEKOPPELD, LEDEN, boekingen, [], 60, NU,
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
    const uit = lessenUitGroep(groepUit([WEEK_1], [club]), GEKOPPELD, LEDEN, [verzet], [], 60, NU);

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
    const uit = lessenUitGroep(groepUit([WEEK_1], [club]), GEKOPPELD, LEDEN, [afgezegd], [], 60, NU);

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
      groepUit([geweest], [club]), GEKOPPELD, LEDEN, [les], [], 60, new Date(2026, 8, 10),
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
      groepUit([WEEK_1], [club]), GEKOPPELD, LEDEN, [negen, zestien], [], 60, NU,
    );

    expect(uit.ongewijzigd).toEqual(['b-9']);
    expect(uit.verdwenenUitBestand).toEqual([
      { id: 'b-16', groep: 'Groep 8', dag: '2026-09-16', tijd: '17:00' },
    ]);
  });

  it('geeft een afgezegde komende les geen nieuwe trainer', () => {
    // Een afgezegde les wordt nooit meer gegeven; er is dus ook geen trainer voor nodig. Zou ze
    // hier meegaan, dan veranderde er iets aan een les die niet doorgaat.
    const club = groepVan({ coach_id: SOFIE.id });
    const afgezegd = boekingVan({ id: 'b-af', coach_id: SOFIE.id, status: 'cancelled' });
    const uit = lessenUitGroep(
      groepUit([WEEK_1], [club]), GEKOPPELD, LEDEN, [afgezegd], [], 60, NU,
    );
    expect(uit.trainerwissel).toBeNull();
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
    // Mét baan, want de baan zit sinds deze fase in de sleutel: zonder haar zou deze groep niet
    // op de bestaande herkend worden en zou de test iets anders bewijzen dan ze zegt.
    const groep = groepUit([opBaanEen({ typeLes: 'Kidstennis groen' })], [club], [BAAN]);
    expect(groep.bestaand).toBe(club);
    expect(groepWijzigingen(club, groep, GEKOPPELD)).toEqual({ level: 'Kidstennis groen' });
  });

  it('meldt niets als er niets verandert', () => {
    const club = groepVan({ coach_id: 'u-koen', court_id: 'c1' });
    const groep = groepUit([opBaanEen()], [club], [BAAN]);
    expect(groepWijzigingen(club, groep, GEKOPPELD)).toEqual({});
  });

  it('laat de bestaande naam staan bij een sleutelmatch, en meldt er niets over', () => {
    // D-05, van beide kanten. `groepenUitRegels` neemt de naam van de bestaande groep over —
    // de kolom `Groep` zegt hier iets heel anders — en `groepWijzigingen` heeft er dus niets
    // over te melden. Zo overleeft een naam die de beheerder zelf gaf elke herimport.
    const club = groepVan({ name: 'De woensdagploeg', coach_id: 'u-koen' });
    const groep = groepUit([regelVan({ groep: 'Groep 99' })], [club]);
    expect(groep.bestaand).toBe(club);
    expect(groep.viaGroepId).toBe(false);
    expect(groep.naam).toBe('De woensdagploeg');
    expect(groepWijzigingen(club, groep, ZONDER_BAAN)).toEqual({});
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
    const groep = groepUit([opBaanEen({ typeLes: 'Kidstennis groen' })], [club], [BAAN]);
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
    const groep = groepUit([opBaanEen()], [club], [BAAN]);
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
      'botsingen', 'dubbel', 'fouten', 'groepenBijgewerkt', 'groepenNieuw', 'groepenOngewijzigd',
      'handmatigGewijzigd', 'nietHerkend', 'nieuweLessen', 'ongewijzigdeLessen', 'overgeslagen',
      'regels', 'spelersNieuw', 'trainerwissels', 'verdwenenUitBestand', 'waarschuwingen',
    ]);
  });

  it('toont de groep zoals het scherm hem nodig heeft, zonder terug naar de rijen te moeten', () => {
    const uit = plan();
    expect(uit.groepenNieuw).toHaveLength(1);
    expect(uit.groepenBijgewerkt).toEqual([]);
    expect(uit.groepenOngewijzigd).toEqual([]);
    expect(uit.groepenNieuw[0]).toMatchObject({
      // Geen 'Groep 8' meer: de kolom `Groep` benoemt niet, het moment doet dat. `Baan 1` is
      // geen getal, dus hij komt ongewijzigd achter het em-streepje.
      naam: 'Woensdag 17:00 — Baan 1',
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
    // Twee groepen op hetzelfde uur zijn sinds deze fase twee groepen op twee bánen: dezelfde
    // dag, hetzelfde uur en dezelfde baan is per definitie één groep. Twee namen in de kolom
    // `Groep` maken geen verschil meer, twee terreinen wel.
    const uit = planImportLessen([
      KOP_MET_BAAN,
      ['09/09/2026', '17:00', 'Groep 8', 'Leemans Koen', 'Peferoen Astor', 'Baan 1'],
      ['09/09/2026', '17:00', 'Groep 12', 'Leemans Koen', 'Bertrem Mila', 'Baan 2'],
    ], [], [KOEN], [BAAN, BAAN_2], [], {}, NU);

    expect(uit.groepenNieuw).toHaveLength(2);
    expect(uit.groepenNieuw.map((g) => g.naam))
      .toEqual(['Woensdag 17:00 — Baan 1', 'Woensdag 17:00 — Baan 2']);
    // Allebei de lessen gaan door. Dat dezelfde trainer op twee banen tegelijk staat is bij
    // deze club geen fout maar de gewone gang van zaken — op Terrein 7 draait Devries Ann
    // blauw en rood naast elkaar. Vroeger verdween de tweede les hier stilzwijgend.
    expect(uit.nieuweLessen).toHaveLength(2);
    expect(uit.overgeslagen).toEqual([]);
    // Maar stil gebeurt het niet: de tweede meldt zich, met de eerste erbij.
    expect(uit.botsingen).toHaveLength(1);
    expect(uit.botsingen[0].groep).toBe('Woensdag 17:00 — Baan 2');
    expect(uit.botsingen[0].conflict.coach_id).toBe('u-koen');
    // En de splitsing gebeurt niet stil: één zin over dat ene moment.
    expect(uit.waarschuwingen.filter((w) => w.reden.includes('meer dan één baan'))).toHaveLength(1);
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
    // De vakantie blokkeert nog steeds wél: alleen de overlapregel is verzacht.
    expect(uit.nieuweLessen).toHaveLength(1);
    expect(uit.overgeslagen.map((o) => [o.reden, o.vakantie])).toEqual([['vakantie', 'Herfstvakantie']]);
    expect(uit.botsingen).toEqual([]);
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
// Groep 8 komt uit het echte bestand: die test heeft de wissel en `koen.xlsx` nodig.
const alsErEenWisselEnKoenIs = kentEenWissel && heeftKoen ? it : it.skip;

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

  const lessen = () => lessenUitGroep(groepUit(woensdagen()), GEKOPPELD, LEDEN, [], [], 60, NU).nieuweLessen;

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

  alsErEenWisselEnKoenIs('zet alle lessen van Groep 8 op woensdag van koen.xlsx om 17:00', () => {
    // Het echte bestand loopt van 9 september 2026 tot 25 juni 2027 en overspant dus allebei de
    // wissels. Het heeft geen kolom Baan, dus er valt via het volledige plan niets in te
    // plannen (dat is de bedoeling, zie plan 05-05); de trainer en de baan worden hier dus
    // gekoppeld meegegeven, zodat de test over de datums gaat en niet over de koppeling.
    const blad = kiesLessenBlad(leesWerkmap(koenBytes()))!;
    const { regels } = leesLesRegels(blad.rijen);
    const groepen = groepenUitRegels(regels, [], []).groepen;
    const acht = groepen.find((g) => g.weekdag === 3 && g.beginuur === 17)!;
    const uit = lessenUitGroep(acht, GEKOPPELD, LEDEN, [], [], 60, NU);

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
 * De tien groepen van `koen.xlsx`, elk genoemd naar haar moment. In de kolom `Groep` van dit
 * bestand staan maar zeven verschillende waarden: "Groep 8" staat op drie dag/uur-combinaties en
 * "Groep 12" op twee, elk met andere spelers. Het nummer is een administratief label dat de club
 * hergebruikt, geen groep mensen — daarom doet die kolom niet mee aan de sleutel en niet aan de
 * naam, en heet elke groep hier naar de weekdag en het uur waarop ze lesheeft.
 *
 * Dit bestand heeft geen bruikbare baan (de kolom `Indoor/Outdoor` zegt overal "Indoor"), dus er
 * staat geen terrein achter de namen.
 *
 * `Groep 12` van vrijdag 18:00 heeft `Type les` = `Privéles` én een gevulde `Groep`: dat is
 * hier een niveau-etiket en geen privéles in de zin van `.planning/IMPORT-SJABLOON.md` (dáár
 * gaat het over een lége `Groep`). Er hoort dus geen uitzondering op te staan.
 */
const KOEN_GROEPEN: VerwachteGroep[] = [
  { naam: 'Woensdag 14:00', weekdag: 3, beginuur: 14, spelers: 2, lesmomenten: 33, niveau: 'Duoles' },
  { naam: 'Woensdag 15:00', weekdag: 3, beginuur: 15, spelers: 4, lesmomenten: 33, niveau: 'Tienertennis geel' },
  { naam: 'Woensdag 16:00', weekdag: 3, beginuur: 16, spelers: 6, lesmomenten: 33, niveau: 'Oranje' },
  { naam: 'Woensdag 17:00', weekdag: 3, beginuur: 17, spelers: 6, lesmomenten: 33, niveau: 'Kidstennis oranje' },
  { naam: 'Woensdag 18:00', weekdag: 3, beginuur: 18, spelers: 4, lesmomenten: 33, niveau: 'Tienertennis geel' },
  { naam: 'Vrijdag 16:00', weekdag: 5, beginuur: 16, spelers: 5, lesmomenten: 32, niveau: 'Tienertennis geel' },
  { naam: 'Vrijdag 17:00', weekdag: 5, beginuur: 17, spelers: 4, lesmomenten: 32, niveau: 'Tienertennis geel' },
  { naam: 'Vrijdag 18:00', weekdag: 5, beginuur: 18, spelers: 4, lesmomenten: 32, niveau: 'Privéles' },
  { naam: 'Vrijdag 19:00', weekdag: 5, beginuur: 19, spelers: 2, lesmomenten: 32, niveau: 'Duoles' },
  { naam: 'Vrijdag 20:00', weekdag: 5, beginuur: 20, spelers: 6, lesmomenten: 32, niveau: 'Volwassenen - (her)starters' },
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
  // Zonder het echte bestand valt er niets te plannen. Elke test in dit blok is dan
  // overgeslagen, dus deze plaatshouders worden nooit aangeraakt.
  const GEEN_PLAN = null as unknown as ReturnType<typeof planImportLessen>;
  const blad = (heeftKoen ? kiesLessenBlad(leesWerkmap(koenBytes())) : null)!;
  const LEGE_CLUB = heeftKoen ? planImportLessen(blad.rijen, [], [], [], [], {}, NU) : GEEN_PLAN;

  alsKoenErIs('leest alle 1398 regels zonder één fout en zonder ruis in de koprij', () => {
    expect(LEGE_CLUB.regels).toHaveLength(1398);
    expect(LEGE_CLUB.fouten).toEqual([]);
    // `Weekdag`, `Weeknr`, `Locatie` en `Indoor/Outdoor` staan in dit bestand en betekenen
    // niets voor de import. Ze horen genegeerd te worden en niet gemeld.
    expect(LEGE_CLUB.nietHerkend).toEqual([]);
    expect(LEGE_CLUB.dubbel).toEqual([]);
  });

  alsKoenErIs('heeft geen kolom Baan en geen Groep-ID, en in Indoor/Outdoor staat geen terrein', () => {
    expect(blad.rijen[0]).not.toContain('Baan');
    expect(blad.rijen[0]).not.toContain('Groep-ID');
    // De kolom `Indoor/Outdoor` staat er wél, en telt sinds IMP-15 als tweede baankolom. Maar
    // op alle 1398 regels staat er het woord `Indoor` in en geen terreinnummer, dus levert ze
    // geen enkele baan op. Dát is precies de reden dat dit blok verderop nul lessen verwacht:
    // geen baan, geen boeking.
    expect(blad.rijen[0]).toContain('Indoor/Outdoor');
    expect(LEGE_CLUB.regels).toHaveLength(1398);
    expect(LEGE_CLUB.regels.every((r) => r.baan === '')).toBe(true);
  });

  alsKoenErIs('levert tien nieuwe lesgroepen op, met tien verschillende namen', () => {
    expect(LEGE_CLUB.groepenNieuw).toHaveLength(10);
    expect(LEGE_CLUB.groepenBijgewerkt).toEqual([]);
    expect(LEGE_CLUB.groepenOngewijzigd).toEqual([]);
    const namen = LEGE_CLUB.groepenNieuw.map((g) => g.naam);
    expect(new Set(namen).size).toBe(10);
    // Geen enkele naam komt nog uit de kolom `Groep` van dit bestand.
    expect(namen.filter((n) => n.startsWith('Groep '))).toEqual([]);
  });

  alsKoenErIs('houdt zich aan de belofte van deze fase: tien groepen, 42 spelers, dezelfde rosters', () => {
    // Hard constraint 7 van de fase, letterlijk. Alleen de namen veranderden; als hier een ander
    // getal beweegt is dat een bevinding over de import en niet over deze test.
    expect(LEGE_CLUB.groepenNieuw).toHaveLength(10);
    expect(LEGE_CLUB.spelersNieuw).toHaveLength(42);
    // 43 plaatsen in tien rosters, 42 verschillende mensen: één leerling zit in twee groepen.
    const plaatsen = LEGE_CLUB.groepenNieuw.flatMap((g) => g.roster);
    expect(plaatsen).toHaveLength(43);
    expect(new Set(plaatsen).size).toBe(42);
    const woensdag17 = LEGE_CLUB.groepenNieuw
      .find((g) => g.weekdag === 3 && g.beginuur === 17)!;
    expect(woensdag17.naam).toBe('Woensdag 17:00');
    expect(woensdag17.aantalSpelers).toBe(6);
    expect(woensdag17.groep.regels[0].groep).toBe('Groep 8');
  });

  alsKoenErIs('geeft elke groep uit de tabel haar eigen dag, uur, roster, lesmomenten en niveau', () => {
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

  alsKoenErIs('telt 325 lesmomenten in het hele bestand', () => {
    const perGroep = LEGE_CLUB.groepenNieuw.reduce((som, g) => som + momentenVan(g.groep), 0);
    expect(perGroep).toBe(KOEN_LESMOMENTEN);
  });

  alsKoenErIs('geeft elke groep het seizoen dat bij haar weekdag hoort', () => {
    for (const g of LEGE_CLUB.groepenNieuw) {
      const verwacht = KOEN_SEIZOEN.get(g.weekdag);
      expect(verwacht).toBeDefined();
      expect([g.naam, g.groep.seizoenVan, g.groep.seizoenTot])
        .toEqual([g.naam, verwacht!.van, verwacht!.tot]);
    }
  });

  alsKoenErIs('kent 42 verschillende leerlingen, allemaal nieuw voor de club', () => {
    expect(LEGE_CLUB.spelersNieuw).toHaveLength(42);
    expect(new Set(LEGE_CLUB.spelersNieuw.map((s) => s.naam)).size).toBe(42);
  });

  alsKoenErIs('houdt de drie momenten die "Groep 8" heetten volledig uit elkaar', () => {
    const acht = ([[3, 17], [5, 17], [5, 19]] as Array<[number, number]>).map(([dag, uur]) =>
      LEGE_CLUB.groepenNieuw.find((g) => g.weekdag === dag && g.beginuur === uur)!);
    expect(acht.map((g) => [g.weekdag, g.beginuur, g.aantalSpelers]))
      .toEqual([[3, 17, 6], [5, 17, 4], [5, 19, 2]]);
    expect(acht.map((g) => g.naam))
      .toEqual(['Woensdag 17:00', 'Vrijdag 17:00', 'Vrijdag 19:00']);
    // In het bestand heten ze alle drie "Groep 8"; twaalf plaatsen, twaalf verschillende mensen,
    // nul overlap. Op die naam matchen zou hier één groep van twaalf van maken.
    expect(new Set(acht.map((g) => g.groep.regels[0].groep))).toEqual(new Set(['Groep 8']));
    const samen = acht.flatMap((g) => g.roster);
    expect(samen).toHaveLength(12);
    expect(new Set(samen).size).toBe(12);
  });

  alsKoenErIs('plant nul lessen in: er is geen trainersaccount en er is geen baan', () => {
    // `LesGroep.coach_id` mag leeg zijn — daarom komen de tien groepen er wél. `Booking.coach_id`
    // en `Booking.court_id` mogen dat niet, dus de lessen kunnen niet bestaan. Ook niets
    // overgeslagen: er valt niets over te slaan zolang er niets te plannen viel.
    expect(LEGE_CLUB.nieuweLessen).toEqual([]);
    expect(LEGE_CLUB.ongewijzigdeLessen).toEqual([]);
    expect(LEGE_CLUB.overgeslagen).toEqual([]);
    expect(LEGE_CLUB.handmatigGewijzigd).toEqual([]);
    expect(LEGE_CLUB.verdwenenUitBestand).toEqual([]);
  });

  alsKoenErIs('meldt uitsluitend de trainer en de baan, één keer per groep', () => {
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

  alsKoenErIs('laat de trainermelding verdwijnen zodra Leemans Koen een account heeft', () => {
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
  // Zonder het echte bestand valt er niets te plannen. Elke test in dit blok is dan
  // overgeslagen, dus deze plaatshouders worden nooit aangeraakt.
  const GEEN_PLAN = null as unknown as ReturnType<typeof planImportLessen>;
  const blad = (heeftKoen ? kiesLessenBlad(leesWerkmap(koenBytes())) : null)!;
  const lees = (toestand: Toestand) => planImportLessen(
    blad.rijen, toestand.groepen, toestand.users, [], [], {}, NU,
  );

  const eerste = heeftKoen ? planImportLessen(blad.rijen, [], [], [], [], {}, NU) : GEEN_PLAN;
  const naDeEerste = heeftKoen ? toestandUitPlan(eerste) : (null as unknown as Toestand);
  const tweede = heeftKoen ? lees(naDeEerste) : GEEN_PLAN;
  const derde = heeftKoen ? lees(naDeEerste) : GEEN_PLAN;

  alsKoenErIs('levert de eerste keer tien groepen en 42 spelers op', () => {
    expect(eerste.groepenNieuw).toHaveLength(10);
    expect(eerste.spelersNieuw).toHaveLength(42);
    expect(naDeEerste.groepen).toHaveLength(10);
    expect(naDeEerste.users).toHaveLength(42);
  });

  alsKoenErIs('verdubbelt de tweede keer niets: nul nieuwe groepen, spelers en lessen', () => {
    expect(tweede.groepenNieuw).toEqual([]);
    expect(tweede.groepenBijgewerkt).toEqual([]);
    expect(tweede.spelersNieuw).toEqual([]);
    expect(tweede.nieuweLessen).toEqual([]);
  });

  alsKoenErIs('herkent alle tien de groepen als ongewijzigd, elk met haar eigen bestaande groep', () => {
    expect(tweede.groepenOngewijzigd).toHaveLength(10);
    expect(tweede.groepenOngewijzigd.map((g) => g.groep.bestaand?.id).sort())
      .toEqual(naDeEerste.groepen.map((g) => g.id).sort());
    // Elk roster staat er nog voluit, met echte ids in plaats van plaatshouders.
    expect(tweede.groepenOngewijzigd.every((g) => g.roster.every((id) => id.startsWith('u-nieuw-'))))
      .toBe(true);
  });

  alsKoenErIs('meldt de tweede keer nog steeds de trainer en de baan, en niets erbij', () => {
    // Die twee schakels lost een tweede inleesbeurt niet op — en dat hoort ook zo: de import
    // maakt geen trainer en geen baan aan (D-07).
    expect(tweede.waarschuwingen).toHaveLength(20);
    expect(tweede.fouten).toEqual([]);
  });

  alsKoenErIs('geeft de derde keer exact hetzelfde antwoord als de tweede', () => {
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

  it('laat met een Groep-ID naam, dag, uur, trainer en baan alle vijf wijzigen op dezelfde groep', () => {
    // Succescriterium 4 van de ROADMAP, en de reden dat deze fase bestaat. De club verzet een
    // groep naar een andere dag, een ander uur, een andere trainer en een ander terrein, en
    // hernoemt haar erbij. Met `Groep-ID` erbij is dat één groep die vijf dingen wijzigt — geen
    // tweede groep naast de eerste, en al helemaal geen halve club verdubbeld.
    const kop = rijen[0];
    const kolom = (naam: string) => kop.indexOf(naam);
    const anders = rijen.map((rij, i) => {
      if (i === 0) return rij;
      const datum = leesDatumCel(rij[kolom('Datum')])!;
      // Twee dagen later: woensdag wordt vrijdag, met lokale datumvelden gebouwd.
      const naar = new Date(datum.jaar, datum.maand - 1, datum.dag + 2);
      const dd = String(naar.getDate()).padStart(2, '0');
      const mm = String(naar.getMonth() + 1).padStart(2, '0');
      return rij.map((cel, k) => {
        if (k === kolom('Datum')) return `${dd}/${mm}/${naar.getFullYear()}`;
        if (k === kolom('Uur')) return '18:00';
        if (k === kolom('Groep')) return 'De gevorderden';
        if (k === kolom('Coach')) return 'Maes Sofie';
        if (k === kolom('Baan')) return BAAN_2.name;
        return cel;
      });
    });

    const plan = planImportLessen(
      anders, [RONDRIT_GROEP], [...RONDRIT_SPELERS, KOEN, SOFIE], [BAAN, BAAN_2],
      rondritBoekingen(), {}, NU,
    );

    expect(plan.groepenNieuw).toEqual([]);
    expect(plan.groepenOngewijzigd).toEqual([]);
    expect(plan.groepenBijgewerkt).toHaveLength(1);
    const bij = plan.groepenBijgewerkt[0];
    expect(bij.groep.bestaand?.id).toBe(RONDRIT_GROEP.id);
    expect(bij.groep.viaGroepId).toBe(true);
    expect(bij.wijzigingen).toEqual({
      name: 'De gevorderden',
      weekday: 5,
      start_hour: 18,
      coach_id: SOFIE.id,
      court_id: BAAN_2.id,
    });
    // Het roster blijft van dezelfde drie mensen: een wissel is een wijziging, geen verhuizing.
    expect([...bij.roster].sort()).toEqual([...RONDRIT_GROEP.roster].sort());
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
// Het scenario van de gebruiker (plan 05.1-03, taak 3)
//
// Dezelfde lijst, trainer X wordt trainer Y in de kolom `Coach`. Van bestand tot boeking, met de
// twee grenzen erbij die deze fase belooft: het verleden verandert niet, en wie de les werkelijk
// gaf blijft van hem.
// ---------------------------------------------------------------------------

/** De derde persoon: hij gaf één les in de plaats van de vaste trainer. */
const JAN = userVan({ id: 'u-jan', name: 'Jan Vervoort', role: 'coach' });

describe('dezelfde lijst, een andere coach', () => {
  /**
   * De agenda van de club: de drie komende lessen van de rondrit plus twee die al gegeven zijn.
   * Alle vijf op Koen, en op twee ervan staat Jan als degene die de les werkelijk gaf.
   */
  function agendaVanDeClub(): Booking[] {
    const komend = rondritBoekingen().map((b) => (
      b.id === 'b-rondrit-1' ? { ...b, taught_by_id: JAN.id } : b
    ));
    const geweest = [19, 26].map((dag, i): Booking => ({
      id: `b-geweest-${i}`,
      player_id: RONDRIT_SPELERS[0].id,
      participant_ids: RONDRIT_SPELERS.slice(1).map((s) => s.id),
      coach_id: KOEN.id,
      court_id: BAAN.id,
      group_id: RONDRIT_GROEP.id,
      start_time: new Date(2026, 7, dag, 17, 0).toISOString(),
      end_time: new Date(2026, 7, dag, 18, 0).toISOString(),
      status: 'completed',
      payment_method: GROEPSLES_METHOD,
      ...(dag === 26 ? { taught_by_id: JAN.id } : {}),
    }));
    return [...geweest, ...komend];
  }

  /** Precies hetzelfde blad, met alleen de kolom `Coach` vervangen door de tweede trainer. */
  function metSofieAlsCoach(): string[][] {
    const rijen = heenEnTerug(rondritBoekingen(), [RONDRIT_GROEP]);
    const kolom = rijen[0].indexOf('Coach');
    return rijen.map((rij, i) => (i === 0 ? rij : rij.map(
      (cel, k) => (k === kolom ? 'Maes Sofie' : cel),
    )));
  }

  const LEDENLIJST = [...RONDRIT_SPELERS, KOEN, SOFIE, JAN];
  const planMetSofie = () => planImportLessen(
    metSofieAlsCoach(), [RONDRIT_GROEP], LEDENLIJST, [BAAN], agendaVanDeClub(), {}, NU,
  );

  it('meldt één trainerwissel, met het aantal komende lessen erbij', () => {
    // Het aantal staat in het plan en dus vóór het wegschrijven: de droogloop kan het tonen en de
    // beheerder bevestigt het, in plaats van het achteraf te ontdekken (D-10).
    const plan = planMetSofie();
    expect(plan.trainerwissels).toHaveLength(1);
    expect(plan.trainerwissels[0]).toEqual({
      groep: 'Groep 8',
      van: 'Koen Leemans',
      naar: 'Sofie Maes',
      trainerId: SOFIE.id,
      aantal: 3,
      boekingIds: ['b-rondrit-0', 'b-rondrit-1', 'b-rondrit-2'],
    });
  });

  it('maakt er geen tweede groep van: een andere coach is een wijziging', () => {
    // Dit is de bug van fase 5 die deze fase wegneemt. Toen zat de trainer in de sleutel van een
    // lesgroep, dus was dezelfde groep met een andere coach ineens een nieuwe groep — de halve
    // club verdubbeld. Nu is de trainer een eigenschap van de groep, en verandert er één veld.
    const plan = planMetSofie();
    expect(plan.groepenNieuw).toEqual([]);
    expect(plan.groepenBijgewerkt).toHaveLength(1);
    expect(plan.groepenBijgewerkt[0].groep.bestaand?.id).toBe(RONDRIT_GROEP.id);
    expect(plan.groepenBijgewerkt[0].wijzigingen).toEqual({ coach_id: SOFIE.id });
  });

  it('schrijft precies die drie boekingen weg, en geen enkele uit het verleden', () => {
    const uit = bouwImportWijziging(planMetSofie(), teller(), { ingrijpend: true });
    expect(uit.gewijzigdeBoekingen).toEqual([
      { id: 'b-rondrit-0', patch: { coach_id: SOFIE.id } },
      { id: 'b-rondrit-1', patch: { coach_id: SOFIE.id } },
      { id: 'b-rondrit-2', patch: { coach_id: SOFIE.id } },
    ]);
    // De twee lessen van augustus staan er niet bij, en er komt ook geen les bij.
    expect(uit.gewijzigdeBoekingen.map((b) => b.id).filter((id) => id.startsWith('b-geweest')))
      .toEqual([]);
    expect(uit.nieuweBoekingen).toEqual([]);
  });

  it('laat wie de les gaf van hem, en het verleden zoals het was', () => {
    const uit = bouwImportWijziging(planMetSofie(), teller(), { ingrijpend: true });
    const patches = new Map(uit.gewijzigdeBoekingen.map((b) => [b.id, b.patch]));
    // Toegepast zoals de provider het doet: spreiden en de patch erover, nooit vervangen.
    const na = agendaVanDeClub().map((b) => {
      const patch = patches.get(b.id);
      return patch === undefined ? b : { ...b, ...patch };
    });
    const bij = (id: string) => na.find((b) => b.id === id)!;

    // De les die Jan gaf is nu van Sofie als vaste trainer, maar Jan blijft degene die hem gaf —
    // en dus degene die ervoor betaald wordt (lib/lesgever).
    expect(bij('b-rondrit-1').coach_id).toBe(SOFIE.id);
    expect(bij('b-rondrit-1').taught_by_id).toBe(JAN.id);
    // De twee lessen van augustus zijn niet aangeraakt: dezelfde trainer, dezelfde tijd,
    // dezelfde status, en ook daar staat Jan nog waar hij stond.
    expect(bij('b-geweest-0')).toEqual(agendaVanDeClub()[0]);
    expect(bij('b-geweest-1')).toEqual(agendaVanDeClub()[1]);
    expect(bij('b-geweest-1').coach_id).toBe(KOEN.id);
    expect(bij('b-geweest-1').taught_by_id).toBe(JAN.id);
  });

  it('wisselt niet nog een keer: dezelfde beurt erna levert nul wissels op', () => {
    const uit = bouwImportWijziging(planMetSofie(), teller(), { ingrijpend: true });
    const patches = new Map(uit.gewijzigdeBoekingen.map((b) => [b.id, b.patch]));
    const groepPatch = uit.gewijzigdeGroepen.find((g) => g.id === RONDRIT_GROEP.id)?.patch ?? {};
    const na = agendaVanDeClub().map((b) => {
      const patch = patches.get(b.id);
      return patch === undefined ? b : { ...b, ...patch };
    });

    const tweedeKeer = planImportLessen(
      metSofieAlsCoach(), [{ ...RONDRIT_GROEP, ...groepPatch }], LEDENLIJST, [BAAN], na, {}, NU,
    );
    expect(tweedeKeer.trainerwissels).toEqual([]);
    expect(bouwImportWijziging(tweedeKeer, teller(), { ingrijpend: true }).gewijzigdeBoekingen).toEqual([]);
    // En er verdubbelt nog steeds niets.
    expect(tweedeKeer.nieuweLessen).toEqual([]);
    expect(tweedeKeer.groepenNieuw).toEqual([]);
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
  // `bezet` is hier geen reden meer: een overlap slaat geen les meer over, ze meldt zich in
  // `plan.botsingen`. Wat overblijft zijn de twee redenen die écht blokkeren.
  const les = (reden: 'vakantie' | 'verleden'): OvergeslagenLes => ({
    sleutel: `s-${reden}`, start: NU, reden, regel: 2,
  });

  it('telt nul op elke reden als er niets is overgeslagen', () => {
    expect(overgeslagenPerReden({ overgeslagen: [] }))
      .toEqual({ vakantie: 0, verleden: 0 });
  });

  it('telt per reden, zodat het scherm aantallen kan tonen in plaats van regels', () => {
    expect(overgeslagenPerReden({
      overgeslagen: [les('vakantie'), les('verleden'), les('vakantie'), les('verleden')],
    })).toEqual({ vakantie: 2, verleden: 2 });
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
    expect(geweigerd[0].inPlan.naam).toBe('Woensdag 17:00 — Baan 1');
    expect(geweigerd[0].fout.regel).toBe(2);
    expect(geweigerd[0].fout.vars).toMatchObject({ groep: 'Woensdag 17:00 — Baan 1' });
  });

  it('zegt hetzelfde als wat de uitvoerder straks weigert — één bron, geen twee verhalen', () => {
    // De droogloop toont deze zinnen vóór het wegschrijven en `bouwImportWijziging` gebruikt
    // ze erna. Lopen ze uiteen, dan belooft het scherm iets anders dan er gebeurt (D-10).
    const plan = planImportLessen(RIJEN, [], [], [BAAN], [], {}, NU);
    expect(bouwImportWijziging(plan, teller(), { ingrijpend: true }).fouten)
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

  it('geeft vijf lijsten met rijen plus wat er niet doorging', () => {
    const uit = bouwImportWijziging(planNieuw(), teller(), { ingrijpend: true });
    expect(Object.keys(uit).sort()).toEqual([
      'fouten', 'gewijzigdeBoekingen', 'gewijzigdeGroepen', 'nieuweBoekingen', 'nieuweGroepen',
      'nieuweUsers',
    ]);
    expect(uit.fouten).toEqual([]);
  });

  it('maakt van elke onbekende leerling één lid, met een voorspelbaar id en zonder lege sleutels', () => {
    const uit = bouwImportWijziging(planNieuw(), teller(), { ingrijpend: true });
    // Het adres is verzonnen omdat dit bestand er geen geeft. Tot 6 september 2026 stond hier
    // `email: ''`, en dat had de import op de tweede leerling laten stranden: `users.email` is
    // `unique not null`. Zie `demoAdres`.
    expect(uit.nieuweUsers).toEqual([
      { id: 'u-1', name: 'Peferoen Astor', email: 'peferoen.astor@example.com', role: 'player' },
      { id: 'u-2', name: 'Martens Clara', email: 'martens.clara@example.com', role: 'player' },
    ]);
  });

  it('maakt de groep aan met haar trainer, haar baan, haar seizoen en haar rooster van echte ids', () => {
    const uit = bouwImportWijziging(planNieuw(), teller(), { ingrijpend: true });
    expect(uit.nieuweGroepen).toEqual([{
      id: 'lg-1',
      // De naam van een nieuwe groep komt van haar moment en niet uit de kolom `Groep`.
      name: 'Woensdag 17:00 — Baan 1',
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
    const uit = bouwImportWijziging(planNieuw(), teller(), { ingrijpend: true });
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
    const uit = bouwImportWijziging(planNieuw(), teller(), { ingrijpend: true });
    const ids = [
      ...uit.nieuweGroepen.flatMap((g) => g.roster),
      ...uit.nieuweBoekingen.flatMap((b) => [b.player_id, ...(b.participant_ids ?? [])]),
    ];
    expect(ids.filter((id) => id.startsWith(NIEUWE_SPELER))).toEqual([]);
  });

  it('geeft twee keer op dezelfde invoer twee keer exact dezelfde rijen', () => {
    expect(bouwImportWijziging(planNieuw(), teller(), { ingrijpend: true }))
      .toEqual(bouwImportWijziging(planNieuw(), teller(), { ingrijpend: true }));
  });

  it('geeft een les met één speler geen groepsbetaalwijze maar laat hem open', () => {
    const uit = bouwImportWijziging(planImportLessen([
      KOP_VOLLEDIG,
      volleRij('09/09/2026', '18:00', 'Groep 4', 'Peferoen Astor', { niveau: 'Privéles' }),
    ], [], [KOEN], [BAAN], [], {}, NU), teller(), { ingrijpend: true });

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
      planImportLessen(RIJEN_NIEUW, [], [], [BAAN], [], {}, NU), teller(), { ingrijpend: true },
    );
    expect(uit.nieuweGroepen).toEqual([]);
    expect(uit.nieuweBoekingen).toEqual([]);
    expect(uit.fouten).toHaveLength(1);
    expect(uit.fouten[0].vars).toMatchObject({ groep: 'Woensdag 17:00 — Baan 1' });
    // De spelers gaan wél door: die staan los van de groep en zijn bij een volgende inleesbeurt
    // gewoon herkend. Dat is de volgorde die een halve import herstelbaar houdt (D-21).
    expect(uit.nieuweUsers).toHaveLength(2);
  });

  it('schrijft geen les weg waarvan de baan in het plan ontbreekt', () => {
    // De uitvoerder rekent niets opnieuw uit: hij past toe wat het plan zei. Zegt het plan dat
    // deze groep geen baan heeft, dan is er geen `Booking.court_id` en bestaat de les niet.
    const plan = planNieuw();
    plan.groepenNieuw[0].baan = null;
    const uit = bouwImportWijziging(plan, teller(), { ingrijpend: true });
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

    const uit = bouwImportWijziging(plan, teller(), { ingrijpend: true });
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
      planImportLessen(RIJEN_NIEUW, [club], [KOEN, ...spelers], [BAAN], [], {}, NU), teller(), { ingrijpend: true },
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
    ), teller(), { ingrijpend: true });
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

    const uit = bouwImportWijziging(plan, teller(), { ingrijpend: true });
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

  // -------------------------------------------------------------------------
  // De trainerwissel wegschrijven (plan 05.1-03, taak 2)
  // -------------------------------------------------------------------------

  /** De groep zoals de club haar kent: dezelfde woensdag op baan 1, maar met Sofie ervoor. */
  const OP_SOFIE = groepVan({
    id: 'g-8', coach_id: SOFIE.id, court_id: BAAN.id, roster: ['u-astor', 'u-clara'],
  });
  const LEERLINGEN = [
    userVan({ id: 'u-astor', name: 'Peferoen Astor' }),
    userVan({ id: 'u-clara', name: 'Martens Clara' }),
  ];
  /** Drie komende lessen van die groep, alle drie op Sofie. */
  function boekingenVanSofie(): ImportBoeking[] {
    return [9, 16, 23].map((dag, i) => boekingVan({
      id: `b-sofie-${i}`,
      group_id: OP_SOFIE.id,
      coach_id: SOFIE.id,
      start_time: new Date(2026, 8, dag, 17, 0).toISOString(),
      end_time: new Date(2026, 8, dag, 18, 0).toISOString(),
    }));
  }
  const planWissel = () => planImportLessen(
    RIJEN_NIEUW, [OP_SOFIE], [KOEN, SOFIE, ...LEERLINGEN], [BAAN], boekingenVanSofie(), {}, NU,
  );

  it('schrijft de trainerwissel weg als één smalle patch per komende les', () => {
    const uit = bouwImportWijziging(planWissel(), teller(), { ingrijpend: true });
    expect(uit.gewijzigdeBoekingen).toEqual([
      { id: 'b-sofie-0', patch: { coach_id: KOEN.id } },
      { id: 'b-sofie-1', patch: { coach_id: KOEN.id } },
      { id: 'b-sofie-2', patch: { coach_id: KOEN.id } },
    ]);
  });

  it('zet niets anders dan de trainer in een patch — geen tijd, geen baan, geen status', () => {
    // De belofte van deze fase in één bewering: een les die iemand anders gaf blijft van hem, en
    // wat er al stond blijft staan. Daarom is de patch getypeerd als `{ coach_id: string }` en
    // niets breders; hier wordt bewezen dat er ook echt niets anders in zit.
    for (const { patch } of bouwImportWijziging(planWissel(), teller(), { ingrijpend: true }).gewijzigdeBoekingen) {
      expect(Object.keys(patch)).toEqual(['coach_id']);
    }
  });

  it('geeft twee keer dezelfde wissel twee keer exact dezelfde patches', () => {
    expect(bouwImportWijziging(planWissel(), teller(), { ingrijpend: true }).gewijzigdeBoekingen)
      .toEqual(bouwImportWijziging(planWissel(), teller(), { ingrijpend: true }).gewijzigdeBoekingen);
  });

  it('laat de lijst leeg als er niets wisselt', () => {
    expect(bouwImportWijziging(planNieuw(), teller(), { ingrijpend: true }).gewijzigdeBoekingen).toEqual([]);
  });

  it('telt de bijgewerkte lessen los van de nieuwe: de drie wisselen, er komt er geen bij', () => {
    const uit = bouwImportWijziging(planWissel(), teller(), { ingrijpend: true });
    expect(uit.gewijzigdeBoekingen).toHaveLength(3);
    expect(uit.nieuweBoekingen).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // De keuze: wat wegneemt of omzet wordt apart bevestigd (plan 05.1-05, taak 2)
  // -------------------------------------------------------------------------

  /**
   * De groep zoals de club haar in januari maakte: Sofie ervoor, en Tom erbij gezet. Het
   * bestand van september kent Sofie noch Tom — het noemt Koen, Astor en Clara. Precies de
   * vergissing van D-18, in twee bewegingen: een trainer terug, en een kind eruit.
   */
  const NA_JANUARI = groepVan({
    id: 'g-8', coach_id: SOFIE.id, court_id: BAAN.id, roster: ['u-astor', 'u-tom'],
  });
  function boekingenNaJanuari(): ImportBoeking[] {
    return [9, 16, 23].map((dag, i) => boekingVan({
      id: `b-jan-${i}`,
      group_id: 'g-8',
      coach_id: SOFIE.id,
      start_time: new Date(2026, 8, dag, 17, 0).toISOString(),
      end_time: new Date(2026, 8, dag, 18, 0).toISOString(),
    }));
  }
  const planTerug = () => planImportLessen(
    RIJEN_NIEUW,
    [NA_JANUARI],
    [KOEN, SOFIE, userVan({ id: 'u-astor', name: 'Peferoen Astor' }),
      userVan({ id: 'u-tom', name: 'Peeters Tom' })],
    [BAAN],
    boekingenNaJanuari(),
    {},
    NU,
  );

  it('doet met de bevestiging erbij precies wat de droogloop aankondigde', () => {
    const uit = bouwImportWijziging(planTerug(), teller(), { ingrijpend: true });
    expect(uit.gewijzigdeBoekingen).toEqual([
      { id: 'b-jan-0', patch: { coach_id: KOEN.id } },
      { id: 'b-jan-1', patch: { coach_id: KOEN.id } },
      { id: 'b-jan-2', patch: { coach_id: KOEN.id } },
    ]);
    expect(uit.gewijzigdeGroepen[0].patch.roster).toEqual(['u-astor', 'u-1']);
  });

  it('laat zonder die bevestiging geen enkele bestaande les van trainer wisselen', () => {
    expect(bouwImportWijziging(planTerug(), teller(), { ingrijpend: false }).gewijzigdeBoekingen)
      .toEqual([]);
  });

  it('laat zonder die bevestiging de speler staan die het bestand niet meer kent', () => {
    const uit = bouwImportWijziging(planTerug(), teller(), { ingrijpend: false });
    const roster = uit.gewijzigdeGroepen[0].patch.roster;
    // Tom blijft, want hem eruit halen is wegnemen; Clara komt er wél bij, want erbij komen
    // is nooit ingrijpend en wordt nooit geremd.
    expect(roster).toContain('u-tom');
    expect(roster).toContain('u-1');
    expect(roster).toContain('u-astor');
  });

  it('remt verder niets: nieuwe groepen, nieuwe spelers en nieuwe lessen komen er onverkort bij', () => {
    const metRem = bouwImportWijziging(planNieuw(), teller(), { ingrijpend: false });
    const zonderRem = bouwImportWijziging(planNieuw(), teller(), { ingrijpend: true });
    expect(metRem.nieuweUsers).toEqual(zonderRem.nieuweUsers);
    expect(metRem.nieuweGroepen).toEqual(zonderRem.nieuweGroepen);
    expect(metRem.nieuweBoekingen).toEqual(zonderRem.nieuweBoekingen);
    expect(metRem.nieuweUsers).toHaveLength(2);
    expect(metRem.nieuweGroepen).toHaveLength(1);
    expect(metRem.nieuweBoekingen).toHaveLength(2);
  });

  it('levert voor een groep die alleen iemand kwijtraakt een patch op die niets wegneemt', () => {
    const club = groepVan({
      id: 'g-8', coach_id: KOEN.id, court_id: BAAN.id, roster: ['u-astor', 'u-clara', 'u-tom'],
    });
    const leden = [
      KOEN,
      userVan({ id: 'u-astor', name: 'Peferoen Astor' }),
      userVan({ id: 'u-clara', name: 'Martens Clara' }),
      userVan({ id: 'u-tom', name: 'Peeters Tom' }),
    ];
    const plan = planImportLessen(RIJEN_NIEUW, [club], leden, [BAAN], [], {}, NU);
    expect(plan.groepenBijgewerkt).toHaveLength(1);

    const uit = bouwImportWijziging(plan, teller(), { ingrijpend: false });
    expect(uit.gewijzigdeGroepen).toEqual([{ id: 'g-8', patch: { roster: club.roster } }]);
  });

  it('geeft twee keer dezelfde invoer met dezelfde keuze twee keer exact dezelfde rijen', () => {
    expect(bouwImportWijziging(planTerug(), teller(), { ingrijpend: true }))
      .toEqual(bouwImportWijziging(planTerug(), teller(), { ingrijpend: true }));
    expect(bouwImportWijziging(planTerug(), teller(), { ingrijpend: false }))
      .toEqual(bouwImportWijziging(planTerug(), teller(), { ingrijpend: false }));
  });
});

// ---------------------------------------------------------------------------
// De rem op de vergissing (plan 05.1-05, taak 1)
//
// Drie afleidingen over een klaar plan, in de geest van `overgeslagenPerReden`: ze rekenen
// niets opnieuw uit en het scherm toont ze alleen. `nu` komt overal als parameter binnen,
// zodat geen enkele bewering hieronder van de klok van de machine afhangt.
// ---------------------------------------------------------------------------

describe('bestandsperiode', () => {
  /** Een bestand dat over een heel seizoen loopt: 9 september 2026 tot en met 25 juni 2027. */
  const SEIZOEN = [
    regelVan({ datum: { jaar: 2026, maand: 9, dag: 9 } }),
    regelVan({ datum: { jaar: 2027, maand: 1, dag: 13 } }),
    regelVan({ datum: { jaar: 2027, maand: 6, dag: 25 } }),
  ];

  it('geeft de vroegste en de laatste dag van het bestand als dagsleutel', () => {
    const periode = bestandsperiode(SEIZOEN, new Date(2027, 0, 1));
    expect(periode?.van).toBe('2026-09-09');
    expect(periode?.tot).toBe('2027-06-25');
  });

  it('geeft halverwege het seizoen ongeveer veertig procent verleden', () => {
    // 9 september 2026 tot 1 januari 2027 is 114 dagen van de 290; dat is 0,39.
    expect(bestandsperiode(SEIZOEN, new Date(2027, 0, 1))?.aandeelGeweest).toBeCloseTo(0.39, 2);
  });

  it('vindt de vroegste en de laatste dag ook als het bestand niet op volgorde staat', () => {
    const doorelkaar = [SEIZOEN[2], SEIZOEN[0], SEIZOEN[1]];
    expect(bestandsperiode(doorelkaar, new Date(2027, 0, 1)))
      .toEqual(bestandsperiode(SEIZOEN, new Date(2027, 0, 1)));
  });

  it('geeft een gelezen op een dag ná de laatste les alles-is-geweest', () => {
    expect(bestandsperiode(SEIZOEN, new Date(2027, 5, 26))?.aandeelGeweest).toBe(1);
  });

  it('geeft een gelezen op een dag vóór de eerste les niets-is-geweest', () => {
    expect(bestandsperiode(SEIZOEN, new Date(2026, 7, 31))?.aandeelGeweest).toBe(0);
  });

  it('deelt niet door nul als het bestand over één dag gaat: vóór die dag nul', () => {
    const eenDag = [regelVan({ datum: { jaar: 2026, maand: 9, dag: 9 } })];
    const periode = bestandsperiode(eenDag, new Date(2026, 8, 8));
    expect(periode).toEqual({ van: '2026-09-09', tot: '2026-09-09', aandeelGeweest: 0 });
  });

  it('deelt niet door nul als het bestand over één dag gaat: erna één', () => {
    const eenDag = [regelVan({ datum: { jaar: 2026, maand: 9, dag: 9 } })];
    expect(bestandsperiode(eenDag, new Date(2026, 8, 10))?.aandeelGeweest).toBe(1);
  });

  it('geeft null zonder regels: er is dan geen periode om iets over te zeggen', () => {
    expect(bestandsperiode([], new Date(2027, 0, 1))).toBeNull();
  });
});

// De groep zoals de club haar kent en de leerlingen erbij; de rijen hieronder noemen Koen.
const ASTOR = userVan({ id: 'u-astor', name: 'Peferoen Astor' });
const CLARA = userVan({ id: 'u-clara', name: 'Martens Clara' });
const TOM = userVan({ id: 'u-tom', name: 'Peeters Tom' });

const RIJEN_TWEE_WEKEN = [
  KOP_VOLLEDIG,
  volleRij('09/09/2026', '17:00', 'Groep 8', 'Peferoen Astor'),
  volleRij('09/09/2026', '17:00', 'Groep 8', 'Martens Clara'),
  volleRij('16/09/2026', '17:00', 'Groep 8', 'Peferoen Astor'),
  volleRij('16/09/2026', '17:00', 'Groep 8', 'Martens Clara'),
];

describe('ingrijpendeWijzigingen', () => {
  /** Drie komende lessen van de woensdaggroep, alle drie op Sofie; het bestand zegt Koen. */
  function driekeerSofie(): ImportBoeking[] {
    return [9, 16, 23].map((dag, i) => boekingVan({
      id: `b-sofie-${i}`,
      group_id: 'g-8',
      coach_id: SOFIE.id,
      start_time: new Date(2026, 8, dag, 17, 0).toISOString(),
      end_time: new Date(2026, 8, dag, 18, 0).toISOString(),
    }));
  }

  it('draagt de trainerwissel ongewijzigd door, met het aantal lessen erbij', () => {
    const club = groepVan({
      id: 'g-8', coach_id: SOFIE.id, court_id: BAAN.id, roster: ['u-astor', 'u-clara'],
    });
    const plan = planImportLessen(
      RIJEN_TWEE_WEKEN, [club], [KOEN, SOFIE, ASTOR, CLARA], [BAAN], driekeerSofie(), {}, NU,
    );
    const ingrijpend = ingrijpendeWijzigingen(plan, [KOEN, SOFIE, ASTOR, CLARA]);
    expect(ingrijpend.trainerwissels).toEqual(plan.trainerwissels);
    expect(ingrijpend.aantalLessen).toBe(3);
  });

  it('noemt de groep en de naam van de speler die uit het roster zou vallen', () => {
    const club = groepVan({
      id: 'g-8', coach_id: KOEN.id, court_id: BAAN.id, roster: ['u-astor', 'u-clara', 'u-tom'],
    });
    const plan = planImportLessen(
      RIJEN_TWEE_WEKEN, [club], [KOEN, ASTOR, CLARA, TOM], [BAAN], [], {}, NU,
    );
    const ingrijpend = ingrijpendeWijzigingen(plan, [KOEN, ASTOR, CLARA, TOM]);
    expect(ingrijpend.spelersEruit).toEqual([
      { groep: plan.groepenBijgewerkt[0].naam, namen: ['Peeters Tom'], ids: ['u-tom'] },
    ]);
  });

  it('levert niets op als er alleen iemand bíj komt: erbij komen neemt niets weg', () => {
    const club = groepVan({
      id: 'g-8', coach_id: KOEN.id, court_id: BAAN.id, roster: ['u-astor'],
    });
    const plan = planImportLessen(RIJEN_TWEE_WEKEN, [club], [KOEN, ASTOR], [BAAN], [], {}, NU);
    expect(plan.groepenBijgewerkt).toHaveLength(1);
    const ingrijpend = ingrijpendeWijzigingen(plan, [KOEN, ASTOR]);
    expect(ingrijpend.spelersEruit).toEqual([]);
    expect(ingrijpend.aantalLessen).toBe(0);
  });

  it('levert bij een nieuwe groep nooit iets op: er is nog niets om terug te draaien', () => {
    const plan = planImportLessen(RIJEN_TWEE_WEKEN, [], [KOEN], [BAAN], [], {}, NU);
    expect(plan.groepenNieuw).toHaveLength(1);
    const ingrijpend = ingrijpendeWijzigingen(plan, [KOEN]);
    expect(ingrijpend).toEqual({ trainerwissels: [], spelersEruit: [], aantalLessen: 0 });
  });

  it('is leeg herkenbaar aan nul lessen en nul vertrekkers', () => {
    const plan = planImportLessen(RIJEN_TWEE_WEKEN, [], [KOEN], [BAAN], [], {}, NU);
    const ingrijpend = ingrijpendeWijzigingen(plan, [KOEN]);
    expect(ingrijpend.aantalLessen === 0 && ingrijpend.spelersEruit.length === 0).toBe(true);
  });

  it('telt een les die uit het bestand verdween niet mee: dat is een melding, geen opdracht', () => {
    const club = groepVan({
      id: 'g-8', coach_id: KOEN.id, court_id: BAAN.id, roster: ['u-astor', 'u-clara'],
    });
    const weg = boekingVan({
      id: 'b-weg',
      group_id: 'g-8',
      start_time: new Date(2026, 8, 23, 17, 0).toISOString(),
      end_time: new Date(2026, 8, 23, 18, 0).toISOString(),
    });
    const plan = planImportLessen(
      RIJEN_TWEE_WEKEN, [club], [KOEN, ASTOR, CLARA], [BAAN], [weg], {}, NU,
    );
    expect(plan.verdwenenUitBestand.map((v) => v.id)).toEqual(['b-weg']);
    expect(ingrijpendeWijzigingen(plan, [KOEN, ASTOR, CLARA]))
      .toEqual({ trainerwissels: [], spelersEruit: [], aantalLessen: 0 });
  });
});

describe('importWaarschuwingen', () => {
  const LEEG: IngrijpendeWijzigingen = { trainerwissels: [], spelersEruit: [], aantalLessen: 0 };
  const IETS: IngrijpendeWijzigingen = {
    trainerwissels: [],
    spelersEruit: [{ groep: 'Woensdag 17:00 — Baan 1', namen: ['Peeters Tom'], ids: ['u-tom'] }],
    aantalLessen: 0,
  };
  const VERLEDEN: Bestandsperiode = {
    van: '2026-09-09', tot: '2027-06-25', aandeelGeweest: 0.6,
  };
  const TOEKOMST: Bestandsperiode = {
    van: '2026-09-09', tot: '2027-06-25', aandeelGeweest: 0,
  };
  const VORIGE_KEER = '2026-11-04T09:30:00.000Z';

  it('waarschuwt met de periode en een afgerond percentage als het grootste deel geweest is', () => {
    const [waarschuwing] = importWaarschuwingen(VERLEDEN, LEEG, {});
    expect(waarschuwing.soort).toBe('verleden');
    expect(waarschuwing.vars).toEqual({ van: '2026-09-09', tot: '2027-06-25', percentage: 60 });
    // De zin blijft een zin met plaatshouders, precies zoals `ImportFoutLessen.reden`.
    expect(waarschuwing.reden).toContain('{percentage}');
  });

  it('waarschuwt niet over het verleden als het bestand nog moet beginnen', () => {
    expect(importWaarschuwingen(TOEKOMST, LEEG, {})).toEqual([]);
  });

  it('waarschuwt niet over het verleden zonder periode', () => {
    expect(importWaarschuwingen(null, LEEG, {})).toEqual([]);
  });

  it('meldt de vorige import als dit bestand iets zou terugdraaien, met de datum erbij', () => {
    const soorten = importWaarschuwingen(TOEKOMST, IETS, {
      laatste_trainingen_import: VORIGE_KEER,
    });
    expect(soorten.map((w) => w.soort)).toEqual(['sindsdien-gewijzigd']);
    expect(soorten[0].vars).toEqual({ datum: dagSleutel(new Date(VORIGE_KEER)) });
  });

  it('meldt niets over een vorige import die er nooit was', () => {
    expect(importWaarschuwingen(TOEKOMST, IETS, {})).toEqual([]);
  });

  it('meldt niets als er wél eerder ingelezen is maar dit bestand niets terugdraait', () => {
    // Bewijs en geen vermoeden: er is geen wijzigingslogboek, dus "er is sindsdien iets in de
    // app veranderd" valt niet uit een datum af te leiden. De melding hangt aan wat dit
    // bestand werkelijk zou terugdraaien.
    expect(importWaarschuwingen(TOEKOMST, LEEG, { laatste_trainingen_import: VORIGE_KEER }))
      .toEqual([]);
  });

  it('geeft allebei de waarschuwingen als allebei de redenen gelden', () => {
    const soorten = importWaarschuwingen(VERLEDEN, IETS, {
      laatste_trainingen_import: VORIGE_KEER,
    }).map((w) => w.soort);
    expect(soorten).toEqual(['verleden', 'sindsdien-gewijzigd']);
  });
});
// ---------------------------------------------------------------------------
// lessen-voorbeeld.xlsx — dezelfde weg als koen.xlsx, maar met verzonnen mensen
// ---------------------------------------------------------------------------

describe('lessen-voorbeeld.xlsx — van bytes tot lesplan', () => {
  const blad = kiesLessenBlad(leesWerkmap(voorbeeldBytes()))!;
  const LEGE_CLUB = planImportLessen(blad.rijen, [], [], [], [], {}, NU);

  it('vindt het lessenblad en leest de acht regels zonder fout of ruis', () => {
    expect(blad.naam).toBe('Sheet1');
    expect(LEGE_CLUB.regels).toHaveLength(8);
    expect(LEGE_CLUB.fouten).toEqual([]);
    // `Weekdag`, `Weeknr`, `Locatie` en `Indoor/Outdoor` horen genegeerd te worden, niet gemeld.
    expect(LEGE_CLUB.nietHerkend).toEqual([]);
    expect(LEGE_CLUB.dubbel).toEqual([]);
  });

  it('heeft dezelfde kolommen als het echte bestand, dus dit bewijst ook de kopregellezer', () => {
    expect(blad.rijen[0]).toEqual([
      'Datum', 'Weekdag', 'Weeknr', 'Uur', 'Type les', 'Groep', 'Coach', 'Leerling', 'Locatie',
      'Indoor/Outdoor',
    ]);
    expect(blad.rijen[0]).not.toContain('Baan');
    expect(blad.rijen[0]).not.toContain('Groep-ID');
  });

  it('maakt twee groepen, elk genoemd naar haar eigen moment', () => {
    expect(LEGE_CLUB.groepenNieuw).toHaveLength(2);
    expect(LEGE_CLUB.groepenNieuw.map((g) => g.naam)).toEqual(['Woensdag 14:00', 'Vrijdag 17:00']);
    // De uurbreuk 0.58333333333333337 hoort 14:00 te worden en niet 13:00.
    expect(LEGE_CLUB.groepenNieuw.map((g) => g.weekdag)).toEqual([3, 5]);
    expect(LEGE_CLUB.groepenNieuw.map((g) => g.beginuur)).toEqual([14, 17]);
    expect(LEGE_CLUB.groepenNieuw.map((g) => g.roster.length)).toEqual([3, 2]);
  });

  it('kent vijf verschillende leerlingen, allemaal nieuw voor de club', () => {
    expect(LEGE_CLUB.spelersNieuw).toHaveLength(5);
    expect(new Set(LEGE_CLUB.spelersNieuw.map((s) => s.naam)).size).toBe(5);
  });

  it('plant nul lessen in: er is geen trainersaccount en er is geen baan', () => {
    // Net als bij koen.xlsx staat in `Indoor/Outdoor` het woord `Indoor` en geen terreinnummer,
    // dus levert die kolom geen baan op. Geen baan, geen boeking (D-07).
    expect(LEGE_CLUB.nieuweLessen).toEqual([]);
  });

  it('meldt uitsluitend de trainer en de baan, één keer per groep', () => {
    expect(LEGE_CLUB.waarschuwingen).toHaveLength(4);
    expect(LEGE_CLUB.waarschuwingen.filter((w) => w.reden.includes('trainer'))).toHaveLength(2);
    expect(LEGE_CLUB.waarschuwingen.filter((w) => w.reden.includes('baan'))).toHaveLength(2);
  });

  it('verdubbelt niets als je hetzelfde bestand een tweede keer inleest', () => {
    const na = toestandUitPlan(LEGE_CLUB);
    const tweede = planImportLessen(blad.rijen, na.groepen, na.users, [], [], {}, NU);
    expect(tweede.groepenNieuw).toEqual([]);
    expect(tweede.spelersNieuw).toEqual([]);
    expect(tweede.nieuweLessen).toEqual([]);
    expect(tweede.groepenOngewijzigd).toHaveLength(2);
  });
});
