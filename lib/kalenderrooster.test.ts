import {
  beginmaand, maandLabel, maandRooster, verschuifMaand, zelfdeDag,
} from './kalenderrooster';

/** De dagnummers van een rooster, met `null` voor een leeg vakje. Leest als het scherm. */
const nummers = (rijen: Array<Array<Date | null>>): Array<Array<number | null>> =>
  rijen.map((rij) => rij.map((d) => (d === null ? null : d.getDate())));

describe('maandRooster', () => {
  it('zet september 2026 met maandag vooraan', () => {
    // 1 september 2026 is een dinsdag, dus één leeg vakje ervoor. September heeft 30 dagen.
    expect(nummers(maandRooster({ jaar: 2026, maand: 8 }))).toEqual([
      [null, 1, 2, 3, 4, 5, 6],
      [7, 8, 9, 10, 11, 12, 13],
      [14, 15, 16, 17, 18, 19, 20],
      [21, 22, 23, 24, 25, 26, 27],
      [28, 29, 30, null, null, null, null],
    ]);
  });

  it('zet een maand die op maandag begint zonder lege vakjes vooraan', () => {
    // 1 februari 2027 is een maandag.
    const rijen = maandRooster({ jaar: 2027, maand: 1 });
    expect(rijen[0][0]?.getDate()).toBe(1);
    expect(rijen[0]).toHaveLength(7);
  });

  it('zet een maand die op zondag begint met zes lege vakjes vooraan', () => {
    // 1 november 2026 is een zondag: met maandag vooraan staat hij helemaal achteraan.
    expect(nummers(maandRooster({ jaar: 2026, maand: 10 }))[0])
      .toEqual([null, null, null, null, null, null, 1]);
  });

  it('kent de schrikkeldag', () => {
    const dagen = maandRooster({ jaar: 2028, maand: 1 }).flat().filter((d) => d !== null);
    expect(dagen).toHaveLength(29);
    expect(dagen[28]?.getDate()).toBe(29);
  });

  it('geeft 28 dagen voor februari in een gewoon jaar', () => {
    expect(maandRooster({ jaar: 2027, maand: 1 }).flat().filter((d) => d !== null))
      .toHaveLength(28);
  });

  it('maakt rijen van precies zeven vakjes', () => {
    for (let maand = 0; maand < 12; maand++) {
      for (const rij of maandRooster({ jaar: 2027, maand })) {
        expect(rij).toHaveLength(7);
      }
    }
  });

  it('bevat elke dag van de maand precies één keer, op volgorde', () => {
    const dagen = maandRooster({ jaar: 2027, maand: 6 }).flat().filter((d) => d !== null);
    expect(dagen.map((d) => d.getDate())).toEqual(
      Array.from({ length: 31 }, (_, i) => i + 1),
    );
  });

  it('vult geen zesde rij aan die niets zou tonen', () => {
    // Februari 2027 begint op maandag en heeft 28 dagen: precies vier volle rijen.
    expect(maandRooster({ jaar: 2027, maand: 1 })).toHaveLength(4);
  });
});

describe('verschuifMaand', () => {
  it('gaat een maand vooruit en achteruit', () => {
    expect(verschuifMaand({ jaar: 2026, maand: 8 }, 1)).toEqual({ jaar: 2026, maand: 9 });
    expect(verschuifMaand({ jaar: 2026, maand: 8 }, -1)).toEqual({ jaar: 2026, maand: 7 });
  });

  it('gaat over de jaarwissel heen', () => {
    expect(verschuifMaand({ jaar: 2026, maand: 11 }, 1)).toEqual({ jaar: 2027, maand: 0 });
    expect(verschuifMaand({ jaar: 2027, maand: 0 }, -1)).toEqual({ jaar: 2026, maand: 11 });
  });

  it('struikelt niet over een maand die korter is dan de vorige', () => {
    // `setMonth` op 31 januari geeft 3 maart, want de 31e februari bestaat niet. Hier wordt
    // alleen met jaar en maand gerekend, dus dat kan niet gebeuren.
    expect(verschuifMaand({ jaar: 2027, maand: 0 }, 1)).toEqual({ jaar: 2027, maand: 1 });
  });

  it('gaat meerdere jaren terug zonder een negatieve maand op te leveren', () => {
    expect(verschuifMaand({ jaar: 2026, maand: 2 }, -15)).toEqual({ jaar: 2024, maand: 11 });
  });
});

describe('beginmaand', () => {
  const vandaag = new Date(2026, 8, 6);

  it('opent op de maand van vandaag als het veld leeg is', () => {
    expect(beginmaand('', vandaag)).toEqual({ jaar: 2026, maand: 8 });
  });

  it('opent op de maand die er al staat', () => {
    expect(beginmaand('15/06/2027', vandaag)).toEqual({ jaar: 2027, maand: 5 });
  });

  it('valt terug op vandaag bij een half getypte datum', () => {
    // "09/" is iemand die nog bezig is. Hem naar januari van het jaar 9 sturen is erger dan
    // hem bij vandaag te laten beginnen.
    expect(beginmaand('09/', vandaag)).toEqual({ jaar: 2026, maand: 8 });
    expect(beginmaand('onzin', vandaag)).toEqual({ jaar: 2026, maand: 8 });
  });

  it('leest ook de jjjj-mm-dd-vorm, want parseDayInput doet dat', () => {
    expect(beginmaand('2027-06-15', vandaag)).toEqual({ jaar: 2027, maand: 5 });
  });
});

describe('zelfdeDag', () => {
  it('vergelijkt op de kalenderdag en niet op de klok', () => {
    expect(zelfdeDag(new Date(2026, 8, 6, 8, 0), new Date(2026, 8, 6, 23, 30))).toBe(true);
  });

  it('zegt nee bij een andere dag, maand of jaar', () => {
    expect(zelfdeDag(new Date(2026, 8, 6), new Date(2026, 8, 7))).toBe(false);
    expect(zelfdeDag(new Date(2026, 8, 6), new Date(2026, 9, 6))).toBe(false);
    expect(zelfdeDag(new Date(2026, 8, 6), new Date(2027, 8, 6))).toBe(false);
  });

  it('zegt nee zodra er een leeg vakje in het spel is', () => {
    expect(zelfdeDag(null, new Date(2026, 8, 6))).toBe(false);
    expect(zelfdeDag(new Date(2026, 8, 6), null)).toBe(false);
    expect(zelfdeDag(null, null)).toBe(false);
  });
});

describe('maandLabel', () => {
  it('schrijft de maand voluit met het jaar erbij', () => {
    expect(maandLabel({ jaar: 2026, maand: 8 })).toBe('september 2026');
    expect(maandLabel({ jaar: 2027, maand: 0 })).toBe('januari 2027');
  });
});
