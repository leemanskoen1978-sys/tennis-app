// De ISO-strings hier staan bewust zonder tijdzone ("2026-08-18T09:00:00"): die worden als
// lokale tijd gelezen, precies zoals de app de start- en eindtijd van een les opslaat. Met
// een Z erachter zou de test van de tijdzone van de machine afhangen.

import {
  formatDay, formatTime, formatTimeRange, formatDayTime, formatDayTimeRange,
  UNKNOWN_DAY, UNKNOWN_TIME,
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
