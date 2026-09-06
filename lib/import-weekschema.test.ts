import {
  isWeekschema, leesKopregelWeekschema, leesLijstCel, leesUurReeksCel, leesWeekdagCel,
  leesWeekRegels, weekSleutels,
} from './import-weekschema';

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

const basis = {
  weekdag: 3, beginuur: 14, terreinen: ['Terrein 7'], groep: 'Blauw 1',
};

describe('weekSleutels', () => {
  it('gebruikt weekdag, uur en terrein als er niets botst', () => {
    expect(weekSleutels([
      { ...basis },
      { ...basis, weekdag: 6, groep: 'Rood 1' },
    ])).toEqual(['3|14|terrein 7', '6|14|terrein 7']);
  });

  it('zet de groepsnaam erbij zodra twee regels op dezelfde sleutel vallen', () => {
    expect(weekSleutels([
      { ...basis, groep: 'Blauw 1' },
      { ...basis, groep: 'Rood 3' },
    ])).toEqual(['3|14|terrein 7|blauw 1', '3|14|terrein 7|rood 3']);
  });

  it('laat de groepen zonder botsing ongemoeid als het ergens anders wél botst', () => {
    const sleutels = weekSleutels([
      { ...basis, groep: 'Blauw 1' },
      { ...basis, groep: 'Rood 3' },
      { ...basis, weekdag: 5, terreinen: ['Terrein 8'], groep: 'Tieners 2' },
    ]);
    expect(sleutels[2]).toBe('5|14|terrein 8');
  });

  it('gebruikt alleen het eerste terrein, want daar komt de groep te staan', () => {
    expect(weekSleutels([{ ...basis, terreinen: ['Terrein 10', 'Terrein 11'], groep: 'Wit 1' }]))
      .toEqual(['3|14|terrein 10']);
  });

  it('kan zonder terrein', () => {
    expect(weekSleutels([{ ...basis, terreinen: [] }])).toEqual(['3|14|']);
  });

  it('houdt twee regels die op alles gelijk zijn toch uit elkaar', () => {
    const sleutels = weekSleutels([{ ...basis }, { ...basis }]);
    expect(sleutels[0]).not.toBe(sleutels[1]);
  });
});
