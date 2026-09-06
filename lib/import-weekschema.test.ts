import { leesLijstCel, leesUurReeksCel, leesWeekdagCel } from './import-weekschema';

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
