import {
  gemiddeldePerSoort, voortgangPerMaand, voortgangSamenvatting,
} from './voortgangverloop';
import type { StudentProgress, TrainingType } from './types';

/** Een notitie op een dag, met of zonder score. */
let teller = 0;
const notitie = (
  jaar: number,
  maand: number,
  dag: number,
  rating?: number,
  over: Partial<StudentProgress> = {},
): StudentProgress => ({
  id: `p${teller += 1}`,
  student_id: 'mathis',
  coach_id: 'ann',
  training_type: 'techniek',
  rating,
  created_at: new Date(jaar, maand, dag, 12, 0, 0).toISOString(),
  ...over,
});

/** September 2026 is de laatste maand van de reeks in deze tests. */
const tot = new Date(2026, 8, 15);

describe('voortgangPerMaand', () => {
  it('geeft één punt per maand, oudste eerst', () => {
    const reeks = voortgangPerMaand([], 'mathis', tot, 6);
    expect(reeks).toHaveLength(6);
    expect(reeks[0].label).toBe('apr');
    expect(reeks[5].label).toBe('sep');
  });

  it('rekent het gemiddelde van de scores in een maand', () => {
    const reeks = voortgangPerMaand(
      [notitie(2026, 8, 1, 4), notitie(2026, 8, 9, 5)],
      'mathis', tot, 3,
    );
    expect(reeks[2].gemiddelde).toBe(4.5);
    expect(reeks[2].aantal).toBe(2);
  });

  it('rondt af op één cijfer na de komma', () => {
    // Twee cijfers zouden een nauwkeurigheid suggereren die vijf sterren niet hebben.
    const reeks = voortgangPerMaand(
      [notitie(2026, 8, 1, 4), notitie(2026, 8, 2, 4), notitie(2026, 8, 3, 5)],
      'mathis', tot, 1,
    );
    expect(reeks[0].gemiddelde).toBe(4.3);
  });

  it('houdt een lege maand in de reeks, met null en niet met nul', () => {
    // Een score is één tot vijf, dus nul bestaat niet. Een gat is zelf informatie: in juli
    // lag alles stil.
    const reeks = voortgangPerMaand([notitie(2026, 8, 1, 4)], 'mathis', tot, 3);
    expect(reeks[0].gemiddelde).toBeNull();
    expect(reeks[0].aantal).toBe(0);
    expect(reeks[2].gemiddelde).toBe(4);
  });

  it('telt een notitie zonder score niet mee', () => {
    // "Huiswerk meegegeven" is geen nul; die als nul meerekenen trekt de lijn omlaag om een
    // reden die niets met tennis te maken heeft.
    const reeks = voortgangPerMaand(
      [notitie(2026, 8, 1, 4), notitie(2026, 8, 2, undefined)],
      'mathis', tot, 1,
    );
    expect(reeks[0].aantal).toBe(1);
    expect(reeks[0].gemiddelde).toBe(4);
  });

  it('negeert een score buiten de sterren', () => {
    const reeks = voortgangPerMaand(
      [notitie(2026, 8, 1, 0), notitie(2026, 8, 2, 9)],
      'mathis', tot, 1,
    );
    expect(reeks[0].aantal).toBe(0);
  });

  it('kijkt alleen naar deze speler', () => {
    const reeks = voortgangPerMaand(
      [notitie(2026, 8, 1, 5, { student_id: 'nova' })],
      'mathis', tot, 1,
    );
    expect(reeks[0].aantal).toBe(0);
  });

  it('laat notities buiten de reeks weg', () => {
    const reeks = voortgangPerMaand([notitie(2025, 8, 1, 5)], 'mathis', tot, 3);
    expect(reeks.every((p) => p.aantal === 0)).toBe(true);
  });

  it('loopt over de jaargrens heen', () => {
    const januari = new Date(2027, 0, 20);
    const reeks = voortgangPerMaand([notitie(2026, 11, 5, 3)], 'mathis', januari, 3);
    expect(reeks[0].label).toBe('nov');
    expect(reeks[1].label).toBe('dec');
    expect(reeks[1].year).toBe(2026);
    expect(reeks[1].gemiddelde).toBe(3);
    expect(reeks[2].year).toBe(2027);
  });

  it('laat een notitie zonder leesbare datum vallen', () => {
    const kapot = notitie(2026, 8, 1, 5, { created_at: 'geen datum' });
    const zonder = notitie(2026, 8, 1, 5, { created_at: undefined });
    expect(voortgangPerMaand([kapot, zonder], 'mathis', tot, 1)[0].aantal).toBe(0);
  });
});

describe('voortgangSamenvatting', () => {
  it('zegt niets als er nergens een score staat', () => {
    const uit = voortgangSamenvatting(voortgangPerMaand([], 'mathis', tot, 6));
    expect(uit).toEqual({ gemiddelde: null, aantal: 0, verschil: null });
  });

  it('weegt op het aantal notities en niet op de maanden', () => {
    // Drie notities van 2 in juli en één van 5 in september: het gemiddelde hoort bij 2,75 te
    // liggen en niet bij 3,5 (het gemiddelde van de maandgemiddelden).
    const reeks = voortgangPerMaand([
      notitie(2026, 6, 1, 2), notitie(2026, 6, 2, 2), notitie(2026, 6, 3, 2),
      notitie(2026, 8, 1, 5),
    ], 'mathis', tot, 3);
    expect(voortgangSamenvatting(reeks).gemiddelde).toBe(2.8);
    expect(voortgangSamenvatting(reeks).aantal).toBe(4);
  });

  it('geeft het verschil tussen de eerste en de laatste maand mét scores', () => {
    // Niet tussen de eerste en de laatste maand van de reeks: een lege juli mag het verloop
    // niet bepalen van een speler die pas in augustus begon.
    const reeks = voortgangPerMaand(
      [notitie(2026, 7, 1, 3), notitie(2026, 8, 1, 4)],
      'mathis', tot, 6,
    );
    expect(voortgangSamenvatting(reeks).verschil).toBe(1);
  });

  it('geeft geen verschil bij scores in maar één maand', () => {
    // Met één maand valt er geen verloop te zien, en dan hoort er ook geen pijl te staan.
    const reeks = voortgangPerMaand(
      [notitie(2026, 8, 1, 3), notitie(2026, 8, 2, 5)],
      'mathis', tot, 6,
    );
    expect(voortgangSamenvatting(reeks).verschil).toBeNull();
    expect(voortgangSamenvatting(reeks).gemiddelde).toBe(4);
  });

  it('geeft een negatief verschil als het minder gaat', () => {
    const reeks = voortgangPerMaand(
      [notitie(2026, 7, 1, 4), notitie(2026, 8, 1, 3)],
      'mathis', tot, 6,
    );
    expect(voortgangSamenvatting(reeks).verschil).toBe(-1);
  });
});

describe('gemiddeldePerSoort', () => {
  const soort = (s: TrainingType, rating: number): StudentProgress =>
    notitie(2026, 8, 1, rating, { training_type: s });

  it('rekent per soort en zet de hoogste bovenaan', () => {
    const uit = gemiddeldePerSoort([
      soort('techniek', 4), soort('techniek', 4),
      soort('fysiek', 2),
    ], 'mathis');
    expect(uit).toEqual([
      { soort: 'techniek', aantal: 2, gemiddelde: 4 },
      { soort: 'fysiek', aantal: 1, gemiddelde: 2 },
    ]);
  });

  it('laat een soort zonder score weg', () => {
    // Een lege regel "mentaal: —" vult het scherm zonder iets te zeggen.
    const uit = gemiddeldePerSoort([soort('techniek', 4), notitie(2026, 8, 2, undefined, {
      training_type: 'mentaal',
    })], 'mathis');
    expect(uit.map((s) => s.soort)).toEqual(['techniek']);
  });

  it('zet bij een gelijke score de meest genoteerde eerst', () => {
    const uit = gemiddeldePerSoort([
      soort('mentaal', 3),
      soort('tactiek', 3), soort('tactiek', 3),
    ], 'mathis');
    expect(uit[0].soort).toBe('tactiek');
  });

  it('kijkt alleen naar deze speler', () => {
    const uit = gemiddeldePerSoort(
      [notitie(2026, 8, 1, 5, { student_id: 'nova' })],
      'mathis',
    );
    expect(uit).toEqual([]);
  });
});
