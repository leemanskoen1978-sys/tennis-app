import {
  groepenUitWeekRegels, isWeekschema, leesKopregelWeekschema, leesLijstCel, leesUurReeksCel,
  leesWeekdagCel, leesWeekRegels, spelerRegelsUitWeek, weekSleutels, type WeekRegel,
} from './import-weekschema';
import { spelersUitRegels } from './import-trainingen';
import { groepSleutel } from './lesgroepen';
import { kiesLessenBlad, planImportLessen } from './import-trainingen';
import { buildXlsx, type XlsxCel } from './xlsx';
import { leesWerkmap } from './xlsx-lezen';
import type { Court, LesGroep } from './types';

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

describe('leesUurReeksCel', () => {
  it('leest begin, einde en de duur ertussen', () => {
    expect(leesUurReeksCel('16:00 - 17:00')).toEqual({ uur: 16, minuut: 0, duurMinuten: 60 });
  });

  it('leest de twee afwijkende duren van de club', () => {
    expect(leesUurReeksCel('09:00 - 09:30')).toEqual({ uur: 9, minuut: 0, duurMinuten: 30 });
    expect(leesUurReeksCel('19:00 - 20:30')).toEqual({ uur: 19, minuut: 0, duurMinuten: 90 });
  });

  it('trekt zich niets aan van de spaties en het soort streepje', () => {
    expect(leesUurReeksCel('16:00-17:00')?.duurMinuten).toBe(60);
    expect(leesUurReeksCel('16:00 – 17:00')?.duurMinuten).toBe(60);
    expect(leesUurReeksCel('  16.00 tot 17.00  ')?.duurMinuten).toBe(60);
  });

  it('leest een half uur begintijd mee', () => {
    expect(leesUurReeksCel('17:30 - 18:30')).toEqual({ uur: 17, minuut: 30, duurMinuten: 60 });
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

describe('leesLijstCel', () => {
  it('splitst op komma en haalt de spaties eraf', () => {
    expect(leesLijstCel('Devries Ann, Lasoen Bart')).toEqual(['Devries Ann', 'Lasoen Bart']);
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

// ---------------------------------------------------------------------------
// De koprij en de formaatkeuze
// ---------------------------------------------------------------------------

const KOP = ['Doelgroep', 'Groep', 'Weekdag', 'Uur', 'Terrein(en)', 'Trainer(s)', 'Speler(s)'];

describe('leesKopregelWeekschema', () => {
  it('wijst de zeven kolommen aan', () => {
    expect(leesKopregelWeekschema(KOP).kolommen).toEqual({
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
    expect(leesKopregelWeekschema([...KOP, 'Groep']).dubbel).toEqual(['Groep']);
  });

  it('meldt een kop die niemand kent, zonder erover te vallen', () => {
    const uitkomst = leesKopregelWeekschema([...KOP, 'Opmerking']);
    expect(uitkomst.nietHerkend).toEqual(['Opmerking']);
    expect(uitkomst.kolommen).not.toBeNull();
  });
});

describe('isWeekschema', () => {
  it('herkent de clublijst', () => {
    expect(isWeekschema(KOP)).toBe(true);
  });

  it('herkent het sjabloon van de app niet als weekschema', () => {
    expect(isWeekschema(['Datum', 'Uur', 'Groep', 'Coach', 'Leerling'])).toBe(false);
  });

  it('kiest de datum boven de weekdag: koen.xlsx heeft ze allebei', () => {
    // Het echte bestand van de club in het eerste formaat heeft een kolom `Weekdag` staan naast
    // `Weeknr`, `Locatie` en `Indoor/Outdoor`. Op de weekdag kiezen stuurde het naar de
    // verkeerde lezer en liet alle 1398 regels verdwijnen.
    expect(isWeekschema(
      ['Datum', 'Weekdag', 'Weeknr', 'Uur', 'Groep', 'Coach', 'Leerling', 'Indoor/Outdoor'],
    )).toBe(false);
  });

  it('is geen weekschema zonder Weekdag, ook al staat Speler(s) er', () => {
    expect(isWeekschema(['Groep', 'Uur', 'Speler(s)'])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Van rijen naar regels
// ---------------------------------------------------------------------------

const rij = (
  doelgroep: string, groep: string, dag: string, uur: string,
  terrein: string, trainer: string, spelers: string,
): string[] => [doelgroep, groep, dag, uur, terrein, trainer, spelers];

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

  it('meldt een regel zonder trainer', () => {
    const uit = leesWeekRegels([
      KOP,
      rij('Kidstennis rood', 'Rood - Groep 3', 'woensdag', '14:00 - 15:00',
        'Terrein 7', '', 'Jan Jansen'),
    ]);
    expect(uit.regels).toEqual([]);
    expect(uit.fouten).toHaveLength(1);
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

// ---------------------------------------------------------------------------
// De sleutel
// ---------------------------------------------------------------------------

const basis = { weekdag: 3, beginuur: 14, baanSleutel: 'c7', groep: 'Blauw 1' };

describe('weekSleutels', () => {
  it('gebruikt weekdag, uur en baan als er niets botst', () => {
    expect(weekSleutels([
      { ...basis },
      { ...basis, weekdag: 6, groep: 'Rood 1' },
    ])).toEqual(['3|14|c7', '6|14|c7']);
  });

  it('staat in dezelfde vorm als groepSleutel, zodat de twee kanten elkaar vinden', () => {
    expect(weekSleutels([{ ...basis }])[0]).toBe(groepSleutel({
      weekday: 3, start_hour: 14, court_id: 'c7',
    }));
  });

  it('zet de groepsnaam erbij zodra twee regels op dezelfde sleutel vallen', () => {
    expect(weekSleutels([
      { ...basis, groep: 'Blauw 1' },
      { ...basis, groep: 'Rood 3' },
    ])).toEqual(['3|14|c7|blauw 1', '3|14|c7|rood 3']);
  });

  it('laat de groepen zonder botsing ongemoeid als het ergens anders wél botst', () => {
    const sleutels = weekSleutels([
      { ...basis, groep: 'Blauw 1' },
      { ...basis, groep: 'Rood 3' },
      { ...basis, weekdag: 5, baanSleutel: 'c8', groep: 'Tieners 2' },
    ]);
    expect(sleutels[2]).toBe('5|14|c8');
  });

  it('kan zonder baan', () => {
    expect(weekSleutels([{ ...basis, baanSleutel: '' }])).toEqual(['3|14|']);
  });

  it('houdt twee regels die op alles gelijk zijn toch uit elkaar', () => {
    const sleutels = weekSleutels([{ ...basis }, { ...basis }]);
    expect(sleutels[0]).not.toBe(sleutels[1]);
  });
});

// ---------------------------------------------------------------------------
// Van regels naar geplande groepen
// ---------------------------------------------------------------------------

const SEIZOEN = { van: '2026-09-07', tot: '2027-06-30' };
/** Een kort seizoen, zodat het aantal lessen in een test te overzien blijft. */
const SETTINGS_KORT = {
  lesson_duration_minutes: 60,
  vakanties: [],
  season_start: '2026-09-07',
  season_end: '2026-09-30',
};
const BANEN7 = [
  { id: 'c7', name: 'Terrein 7', number: 7, hourly_rate: 60 },
  { id: 'c8', name: 'Terrein 8', number: 8, hourly_rate: 60 },
  { id: 'c10', name: 'Terrein 10', number: 10, hourly_rate: 60 },
  { id: 'c11', name: 'Terrein 11', number: 11, hourly_rate: 60 },
] as unknown as Court[];
const BANEN = [
  { id: 'c7', name: 'Terrein 7', number: 7, hourly_rate: 60 },
  { id: 'c8', name: 'Terrein 8', number: 8, hourly_rate: 60 },
] as unknown as Court[];

const weekRegel = (over: Partial<WeekRegel> = {}): WeekRegel => ({
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
  ...over,
});

const lesGroep = (over: Partial<LesGroep> = {}): LesGroep => ({
  id: 'g1',
  name: 'Blauw - Groep 1',
  level: 'Kidstennis blauw',
  weekday: 3,
  start_hour: 14,
  start_minute: 0,
  court_id: 'c7',
  season_start: '2026-09-07',
  season_end: '2027-06-30',
  roster: [],
  archived: false,
  ...over,
});

describe('groepenUitWeekRegels', () => {
  it('maakt van één regel één groep', () => {
    const { groepen } = groepenUitWeekRegels([weekRegel()], [], BANEN, SEIZOEN);
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
      [weekRegel({ terreinen: ['Terrein 10', 'Terrein 11'] })], [], BANEN, SEIZOEN,
    );
    expect(groepen[0].baanNaam).toBe('Terrein 10');
    expect(waarschuwingen.some((w) => w.regel === 2)).toBe(true);
  });

  it('neemt de eerste trainer en meldt de rest', () => {
    const { groepen, waarschuwingen } = groepenUitWeekRegels(
      [weekRegel({ trainers: ['Devries Ann', 'Lasoen Bart'] })], [], BANEN, SEIZOEN,
    );
    expect(groepen[0].coachNaam).toBe('Devries Ann');
    expect(waarschuwingen.some((w) => w.regel === 2)).toBe(true);
  });

  it('maakt een groep zonder spelers aan, met een leeg rooster en zonder waarschuwing', () => {
    const { groepen, waarschuwingen } = groepenUitWeekRegels(
      [weekRegel({ spelers: [] })], [], BANEN, SEIZOEN,
    );
    expect(groepen[0].leerlingNamen).toEqual([]);
    expect(waarschuwingen).toEqual([]);
  });

  it('herkent een bestaande groep op weekdag, uur en baan', () => {
    const { groepen } = groepenUitWeekRegels([weekRegel()], [lesGroep()], BANEN, SEIZOEN);
    expect(groepen[0].bestaand?.id).toBe('g1');
  });

  it('herkent een gearchiveerde groep niet: archiveren was een bewuste daad', () => {
    const { groepen } = groepenUitWeekRegels(
      [weekRegel()], [lesGroep({ archived: true })], BANEN, SEIZOEN,
    );
    expect(groepen[0].bestaand).toBeNull();
  });

  it('houdt twee groepen op hetzelfde terrein en uur uit elkaar via hun naam', () => {
    const { groepen } = groepenUitWeekRegels(
      [weekRegel({ groep: 'Blauw - Groep 1' }), weekRegel({ regel: 3, groep: 'Rood - Groep 3' })],
      [], BANEN, SEIZOEN,
    );
    expect(groepen).toHaveLength(2);
    expect(groepen[0].sleutel).not.toBe(groepen[1].sleutel);
  });

  it('vindt allebei de botsende groepen terug als ze al bestaan', () => {
    const bestaand = [
      lesGroep({ id: 'g1', name: 'Blauw - Groep 1' }),
      lesGroep({ id: 'g2', name: 'Rood - Groep 3' }),
    ];
    const { groepen } = groepenUitWeekRegels(
      [weekRegel({ groep: 'Blauw - Groep 1' }), weekRegel({ regel: 3, groep: 'Rood - Groep 3' })],
      bestaand, BANEN, SEIZOEN,
    );
    expect(groepen.map((g) => g.bestaand?.id)).toEqual(['g1', 'g2']);
  });

  it('meldt een terrein dat de club niet kent', () => {
    const { groepen, waarschuwingen } = groepenUitWeekRegels(
      [weekRegel({ terreinen: ['Terrein 99'] })], [], BANEN, SEIZOEN,
    );
    expect(groepen[0].baanNaam).toBe('Terrein 99');
    expect(waarschuwingen.some((w) => w.regel === 2)).toBe(true);
  });

  it('laat duurMinuten leeg als de cel geen einde gaf', () => {
    const { groepen } = groepenUitWeekRegels(
      [weekRegel({ duurMinuten: null })], [], BANEN, SEIZOEN,
    );
    expect(groepen[0].duurMinuten).toBeNull();
  });

  it('verzint een naam uit het moment als de kolom Groep leeg is', () => {
    const { groepen } = groepenUitWeekRegels([weekRegel({ groep: '' })], [], BANEN, SEIZOEN);
    expect(groepen[0].naam).toBe('Woensdag 14:00 — Terrein 7');
  });
});

describe('spelerRegelsUitWeek', () => {
  it('maakt van de spelers per groep één lijst voor spelersUitRegels', () => {
    expect(spelerRegelsUitWeek([
      weekRegel({ regel: 2, spelers: ['Jan Jansen', 'Piet Peeters'] }),
      weekRegel({ regel: 3, spelers: ['Jan Jansen'] }),
    ])).toEqual([
      { regel: 2, leerling: 'Jan Jansen', emailLeerling: '' },
      { regel: 2, leerling: 'Piet Peeters', emailLeerling: '' },
      { regel: 3, leerling: 'Jan Jansen', emailLeerling: '' },
    ]);
  });

  it('levert samen met spelersUitRegels één speler per unieke naam', () => {
    const { spelers } = spelersUitRegels(spelerRegelsUitWeek([
      weekRegel({ regel: 2, spelers: ['Jan Jansen', 'Piet Peeters'] }),
      weekRegel({ regel: 3, spelers: ['jan jansen'] }),
    ]), []);
    expect(spelers.map((s) => s.naam)).toEqual(['Jan Jansen', 'Piet Peeters']);
  });
});

// ---------------------------------------------------------------------------
// Van bytes tot lesplan — het hele pad, zoals het scherm het aflegt
//
// Het echte bestand van de club staat NIET in deze repository en hoort daar niet: die is
// publiek en er staan 550 echte namen in. Dit blad wordt hier opgebouwd met verzonnen namen en
// dekt de gevallen die er in de echte lijst toe doen: de drie groepen die op woensdag 14:00
// samen op Terrein 7 staan, een regel met twee terreinen, een regel met twee trainers, een
// regel zonder spelers, een les van 30 minuten en een van 90.
// ---------------------------------------------------------------------------

describe('weekschema — van bytes tot lesplan', () => {
  const tekstRij = (waarden: string[]): XlsxCel[] =>
    waarden.map((waarde) => ({ soort: 'tekst', waarde }));

  const BLAD: string[][] = [
    ['Kidstennis wit', 'Wit/Multimove Gr1', 'woensdag', '14:00 - 15:00', 'Terrein 7', 'Aerts Lien', 'Jan Jansen, Piet Peeters'],
    ['Kidstennis blauw', 'Blauw Gr1', 'woensdag', '14:00 - 15:00', 'Terrein 7', 'Baeten Nore', 'Marie Maes'],
    ['Kidstennis rood', 'Rood Gr3', 'woensdag', '14:00 - 15:00', 'Terrein 7', 'Baeten Nore', 'Tuur Torfs'],
    ['Kidstennis oranje', 'Oranje Gr1', 'donderdag', '16:00 - 17:00', 'Terrein 8', 'Aerts Lien', 'Lore Loos'],
    ['Kidstennis groen', 'Groen Gr1', 'vrijdag', '17:00 - 18:00', 'Terrein 10, Terrein 11', 'Aerts Lien', 'Stan Stas'],
    ['Tienertennis', 'Tieners Gr1', 'vrijdag', '18:00 - 19:00', 'Terrein 8', 'Aerts Lien, Baeten Nore', 'Ella Elst'],
    ['Tienertennis', 'Tieners Gr2', 'zaterdag', '09:00 - 09:30', 'Terrein 8', 'Aerts Lien', 'Sam Somers'],
    ['Groepslessen voor volwassenen', 'Volw Gr1', 'zaterdag', '10:00 - 11:30', 'Terrein 8', 'Baeten Nore', 'Rik Roos'],
    ['Groepslessen voor (her)starters', 'Herstart Gr1', 'zaterdag', '12:00 - 13:00', 'Terrein 8', 'Aerts Lien', ''],
  ];

  const bytes = buildXlsx({ naam: 'Sheet1', koppen: KOP, rijen: BLAD.map(tekstRij) });
  const blad = kiesLessenBlad(leesWerkmap(bytes));
  const gelezen = leesWeekRegels(blad?.rijen ?? []);

  it('leest het blad van kop tot staart zonder één fout', () => {
    expect(gelezen.fouten).toEqual([]);
    expect(gelezen.nietHerkend).toEqual([]);
    expect(gelezen.regels).toHaveLength(9);
  });

  it('leest de drie duren die de club echt gebruikt', () => {
    const duren = gelezen.regels.map((r) => r.duurMinuten);
    expect(duren.filter((d) => d === 60)).toHaveLength(7);
    expect(duren.filter((d) => d === 30)).toHaveLength(1);
    expect(duren.filter((d) => d === 90)).toHaveLength(1);
  });

  it('geeft de drie groepen op Terrein 7 elk hun eigen sleutel', () => {
    const { groepen } = groepenUitWeekRegels(gelezen.regels, [], BANEN7, SEIZOEN);
    const opWoensdag = groepen.filter((g) => g.weekdag === 3 && g.beginuur === 14);
    expect(opWoensdag).toHaveLength(3);
    expect(new Set(opWoensdag.map((g) => g.sleutel)).size).toBe(3);
  });

  it('plant alles in, met de botsingen op Terrein 7 gemeld en niet geweigerd', () => {
    const plan = planImportLessen(
      blad?.rijen ?? [], [], [], BANEN7, [], SETTINGS_KORT, new Date(2026, 8, 6),
    );
    expect(plan.fouten).toEqual([]);
    // Negen groepen, en twee trainers die de club nog niet kende.
    expect(plan.groepenNieuw).toHaveLength(9);
    expect(plan.trainersNieuw.map((tr) => tr.naam).sort()).toEqual(['Aerts Lien', 'Baeten Nore']);
    // Negen unieke spelers; de groep zonder spelers levert er geen.
    expect(plan.spelersNieuw).toHaveLength(9);
    // Elke speler een eigen adres — anders strandt het wegschrijven op users.email.
    const adressen = plan.spelersNieuw.map((sp) => sp.email);
    expect(new Set(adressen).size).toBe(adressen.length);
    // De drie groepen op Terrein 7 overlappen elkaar en dat mag: melden, niet blokkeren.
    expect(plan.botsingen.length).toBeGreaterThan(0);
    expect(plan.nieuweLessen.length).toBeGreaterThan(0);
  });

  it('maakt geen les voor de groep zonder spelers, en de groep zelf wél', () => {
    const plan = planImportLessen(
      blad?.rijen ?? [], [], [], BANEN7, [], SETTINGS_KORT, new Date(2026, 8, 6),
    );
    const leeg = plan.groepenNieuw.find((g) => g.naam === 'Herstart Gr1');
    expect(leeg).toBeDefined();
    expect(leeg?.roster).toEqual([]);
  });

  it('bevat geen enkele naam uit de echte clublijst', () => {
    const tekst = Buffer.from(bytes).toString('latin1');
    for (const naam of ['Devries', 'Lasoen']) {
      expect(tekst).not.toContain(naam);
    }
  });
});
