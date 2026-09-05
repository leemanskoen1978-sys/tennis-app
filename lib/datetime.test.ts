// De ISO-strings hier staan bewust zonder tijdzone ("2026-08-18T09:00:00"): die worden als
// lokale tijd gelezen, precies zoals de app de start- en eindtijd van een les opslaat. Met
// een Z erachter zou de test van de tijdzone van de machine afhangen.

import {
  formatDay, formatTime, formatTimeRange, formatDayTime, formatDayTimeRange,
  isoWeeknummer, UNKNOWN_DAY, UNKNOWN_TIME,
} from './datetime';

describe('formatDay', () => {
  it('zet de weekdag voor de dag en de maand', () => {
    expect(formatDay('2026-08-18T09:00:00')).toBe('di 18 aug');
  });

  it('geeft iets leesbaars bij een onbruikbare datum', () => {
    expect(formatDay('geen datum')).toBe(UNKNOWN_DAY);
  });
});

describe('formatTime', () => {
  it('toont een ochtenduur met twee cijfers en zonder seconden', () => {
    expect(formatTime('2026-08-18T09:00:00')).toBe('09:00');
  });

  it('toont een avonduur in 24 uur', () => {
    expect(formatTime('2026-08-18T20:05:00')).toBe('20:05');
  });

  it('geeft iets leesbaars bij een onbruikbare datum', () => {
    expect(formatTime('')).toBe(UNKNOWN_TIME);
  });
});

describe('formatTimeRange', () => {
  it('verbindt begin en einde, ook als het tijdvak over het uur loopt', () => {
    expect(formatTimeRange('2026-08-18T09:30:00', '2026-08-18T10:30:00')).toBe('09:30–10:30');
  });
});

describe('formatDayTime', () => {
  it('zet dag en beginuur achter elkaar', () => {
    expect(formatDayTime('2026-08-18T09:00:00')).toBe('di 18 aug · 09:00');
  });

  it('geeft iets leesbaars bij een onbruikbare datum', () => {
    expect(formatDayTime('nooit')).toBe(UNKNOWN_DAY);
  });
});

describe('formatDayTimeRange', () => {
  it('toont dag en tijdvak in één regel', () => {
    expect(formatDayTimeRange('2026-08-18T09:00:00', '2026-08-18T10:00:00'))
      .toBe('di 18 aug · 09:00–10:00');
  });

  it('toont een tijdvak dat over het uur loopt', () => {
    expect(formatDayTimeRange('2026-08-18T18:45:00', '2026-08-18T19:45:00'))
      .toBe('di 18 aug · 18:45–19:45');
  });

  it('geeft iets leesbaars bij een onbruikbare datum', () => {
    expect(formatDayTimeRange('Invalid', 'Invalid')).toBe(UNKNOWN_DAY);
  });
});

describe('isoWeeknummer', () => {
  it('geeft het weeknummer van een gewone dag midden in het jaar', () => {
    expect(isoWeeknummer('2026-08-18T09:00:00')).toBe(34);
  });

  it('rekent 1 januari 2027 bij week 53 van 2026, want die week begint in december', () => {
    expect(isoWeeknummer('2027-01-01T09:00:00')).toBe(53);
  });

  it('rekent 31 december 2025 bij week 1 van 2026, want die week loopt door in januari', () => {
    expect(isoWeeknummer('2025-12-31T20:00:00')).toBe(1);
  });

  it('rekent 31 december 2020 nog bij week 53 van datzelfde jaar', () => {
    expect(isoWeeknummer('2020-12-31T09:00:00')).toBe(53);
  });

  it('zet 4 januari in elk jaar in week 1', () => {
    expect(isoWeeknummer('2024-01-04T09:00:00')).toBe(1);
    expect(isoWeeknummer('2025-01-04T09:00:00')).toBe(1);
    expect(isoWeeknummer('2026-01-04T09:00:00')).toBe(1);
    expect(isoWeeknummer('2027-01-04T09:00:00')).toBe(1);
  });

  it('houdt maandag en zondag in dezelfde week', () => {
    expect(isoWeeknummer('2026-08-17T09:00:00')).toBe(34);
    expect(isoWeeknummer('2026-08-23T21:00:00')).toBe(34);
  });

  it('legt een les van 23 uur niet in de week ervoor', () => {
    expect(isoWeeknummer('2026-08-23T23:30:00')).toBe(34);
  });

  it('neemt ook een Date aan', () => {
    expect(isoWeeknummer(new Date(2026, 7, 18))).toBe(34);
  });

  it('geeft null bij een onbruikbare datum, en werpt niets', () => {
    expect(isoWeeknummer('geen datum')).toBeNull();
    expect(isoWeeknummer('')).toBeNull();
  });
});
