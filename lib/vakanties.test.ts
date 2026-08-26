import type { Vakantie } from './types';
import {
  dagSleutel, isLesdag, parseDag, sorteerVakanties, vakantieDagen, vakantieFout, vakantieOp,
  vakantieOpDag, vakantieOpMoment, vakantiePeriode,
} from './vakanties';

const herfst: Vakantie = { id: 'v1', naam: 'Herfstvakantie', van: '2026-11-02', tot: '2026-11-08' };
const wapenstilstand: Vakantie = { id: 'v2', naam: 'Wapenstilstand', van: '2026-11-11', tot: '2026-11-11' };
const kerst: Vakantie = { id: 'v3', naam: 'Kerstvakantie', van: '2026-12-21', tot: '2027-01-03' };
const alle = [kerst, wapenstilstand, herfst];

describe('dagSleutel', () => {
  it('schrijft een dag als jjjj-mm-dd, met nullen ervoor', () => {
    expect(dagSleutel(new Date(2026, 10, 2))).toBe('2026-11-02');
    expect(dagSleutel(new Date(2027, 0, 3))).toBe('2027-01-03');
  });

  it('kijkt naar de dag op de klok en niet naar UTC', () => {
    // Een les van 's avonds laat hoort bij de dag zoals je hem ziet.
    expect(dagSleutel(new Date(2026, 10, 2, 23, 30))).toBe('2026-11-02');
  });
});

describe('parseDag', () => {
  it('leest een geldige dag', () => {
    expect(parseDag('2026-11-02')?.getDate()).toBe(2);
  });

  it('weigert een dag die niet bestaat in plaats van hem door te rollen', () => {
    expect(parseDag('2026-11-31')).toBeNull();
    expect(parseDag('2026-02-30')).toBeNull();
  });

  it('weigert een andere schrijfwijze', () => {
    expect(parseDag('02/11/2026')).toBeNull();
    expect(parseDag('')).toBeNull();
  });
});

describe('vakantieOpDag', () => {
  it('vindt een dag middenin', () => {
    expect(vakantieOpDag(alle, '2026-11-05')?.naam).toBe('Herfstvakantie');
  });

  it('telt allebei de grenzen mee', () => {
    expect(vakantieOpDag(alle, '2026-11-02')?.id).toBe('v1');
    expect(vakantieOpDag(alle, '2026-11-08')?.id).toBe('v1');
  });

  it('laat de dag ervoor en erna vrij', () => {
    expect(vakantieOpDag(alle, '2026-11-01')).toBeNull();
    expect(vakantieOpDag(alle, '2026-11-09')).toBeNull();
  });

  it('werkt over een jaargrens heen', () => {
    expect(vakantieOpDag(alle, '2026-12-31')?.id).toBe('v3');
    expect(vakantieOpDag(alle, '2027-01-01')?.id).toBe('v3');
    expect(vakantieOpDag(alle, '2027-01-04')).toBeNull();
  });

  it('vindt een vakantie van één dag', () => {
    expect(vakantieOpDag(alle, '2026-11-11')?.naam).toBe('Wapenstilstand');
  });

  it('leest een omgekeerd ingevulde periode als het tijdvak ertussen', () => {
    const omgekeerd: Vakantie = { id: 'x', naam: 'Omgekeerd', van: '2026-11-08', tot: '2026-11-02' };
    expect(vakantieOpDag([omgekeerd], '2026-11-05')?.id).toBe('x');
  });

  it('slaat een kapotte periode over in plaats van alles tegen te houden', () => {
    const kapot: Vakantie = { id: 'x', naam: 'Kapot', van: 'geen datum', tot: '2026-11-02' };
    expect(vakantieOpDag([kapot], '2026-11-02')).toBeNull();
  });

  it('geeft null zonder vakanties', () => {
    expect(vakantieOpDag([], '2026-11-05')).toBeNull();
  });
});

describe('vakantieOp en vakantieOpMoment', () => {
  it('lezen een Date en een lesbegin', () => {
    expect(vakantieOp(alle, new Date(2026, 10, 5))?.id).toBe('v1');
    expect(vakantieOpMoment(alle, new Date(2026, 10, 5, 18, 0).toISOString())?.id).toBe('v1');
  });

  it('laten een kapot tijdstip met rust', () => {
    expect(vakantieOpMoment(alle, 'geen datum')).toBeNull();
  });
});

describe('isLesdag', () => {
  it('is waar buiten elke vakantie', () => {
    expect(isLesdag(alle, new Date(2026, 10, 9))).toBe(true);
    expect(isLesdag(alle, new Date(2026, 10, 11))).toBe(false);
  });
});

describe('sorteerVakanties', () => {
  it('zet ze op begindag en laat het kapotte vallen', () => {
    const kapot: Vakantie = { id: 'x', naam: 'Kapot', van: '2026-13-01', tot: '2026-13-02' };
    expect(sorteerVakanties([...alle, kapot]).map((v) => v.id)).toEqual(['v1', 'v2', 'v3']);
  });
});

describe('vakantieFout', () => {
  it('vraagt om een naam', () => {
    expect(vakantieFout('  ', '2026-11-02', '2026-11-08')).not.toBeNull();
  });

  it('vraagt om twee bruikbare dagen', () => {
    expect(vakantieFout('Herfst', '2026-11-02', 'later')).not.toBeNull();
  });

  it('zwijgt als het klopt', () => {
    expect(vakantieFout('Herfst', '2026-11-02', '2026-11-08')).toBeNull();
  });
});

describe('vakantiePeriode', () => {
  it('schrijft de maand één keer binnen dezelfde maand', () => {
    expect(vakantiePeriode(herfst)).toBe('2 – 8 nov 2026');
  });

  it('schrijft één dag als één dag', () => {
    expect(vakantiePeriode(wapenstilstand)).toBe('11 nov 2026');
  });

  it('zet er twee jaartallen bij over een jaargrens', () => {
    expect(vakantiePeriode(kerst)).toBe('21 dec 2026 – 3 jan 2027');
  });
});

describe('vakantieDagen', () => {
  it('telt beide grenzen mee', () => {
    expect(vakantieDagen(herfst)).toBe(7);
    expect(vakantieDagen(wapenstilstand)).toBe(1);
    expect(vakantieDagen(kerst)).toBe(14);
  });
});
