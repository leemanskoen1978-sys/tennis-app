import {
  MAX_MEMO_MS, MIN_MEMO_MS, heeftMemo, memoDuur, memoNaarNotitie, opnameDeugt,
  resterend, uitTeWerken,
} from './memo';
import type { Memo } from './types';

const memo = (id: string, over: Partial<Memo> = {}): Memo => ({
  id,
  student_id: 'mathis',
  coach_id: 'koen',
  booking_id: 'b1',
  audio_uri: 'data:audio/webm;base64,AAAA',
  duration_ms: 8000,
  created_at: '2026-08-25T17:12:00.000Z',
  ...over,
});

describe('opnameDeugt', () => {
  it('gooit een misgreep weg en bewaart een echte opname', () => {
    expect(opnameDeugt(0)).toBe(false);
    expect(opnameDeugt(MIN_MEMO_MS - 1)).toBe(false);
    expect(opnameDeugt(MIN_MEMO_MS)).toBe(true);
    expect(opnameDeugt(8000)).toBe(true);
  });

  it('vertrouwt geen onzin die uit een teller kan komen', () => {
    expect(opnameDeugt(Number.NaN)).toBe(false);
    expect(opnameDeugt(-5000)).toBe(false);
  });
});

describe('memoDuur', () => {
  it('zegt hoe lang hij duurt, zoals een speler het toont', () => {
    expect(memoDuur(8000)).toBe('0:08');
    expect(memoDuur(65_000)).toBe('1:05');
    expect(memoDuur(0)).toBe('0:00');
  });

  it('rondt naar beneden af: 1,9 seconde is nog geen twee', () => {
    expect(memoDuur(1900)).toBe('0:01');
  });
});

describe('resterend', () => {
  it('zwijgt zolang het einde nog niet in zicht is', () => {
    expect(resterend(0)).toBeNull();
    expect(resterend(30_000)).toBeNull();
  });

  it('telt af zodra het einde nadert', () => {
    expect(resterend(50_000)).toBe(10);
    expect(resterend(55_000)).toBe(5);
  });

  it('gaat nooit onder nul', () => {
    expect(resterend(MAX_MEMO_MS + 3000)).toBe(0);
  });
});

describe('uitTeWerken', () => {
  it('geeft alleen de memos van deze trainer', () => {
    const lijst = [memo('m1'), memo('m2', { coach_id: 'sanne' })];
    expect(uitTeWerken(lijst, 'koen').map((m) => m.id)).toEqual(['m1']);
  });

  it('zet de oudste bovenaan, want die vergeet je het snelst', () => {
    const lijst = [
      memo('nieuw', { created_at: '2026-08-25T18:14:00.000Z' }),
      memo('oud', { created_at: '2026-08-25T17:12:00.000Z' }),
      memo('midden', { created_at: '2026-08-25T17:31:00.000Z' }),
    ];
    expect(uitTeWerken(lijst, 'koen').map((m) => m.id)).toEqual(['oud', 'midden', 'nieuw']);
  });

  it('is leeg als er niets ligt', () => {
    expect(uitTeWerken([], 'koen')).toEqual([]);
  });
});

describe('heeftMemo', () => {
  const lijst = [memo('m1', { student_id: 'mathis', booking_id: 'b1' })];

  it('kent het vinkje toe aan de juiste speler in de juiste les', () => {
    expect(heeftMemo(lijst, 'b1', 'mathis')).toBe(true);
  });

  it('kijkt niet naar een andere speler of een andere les', () => {
    expect(heeftMemo(lijst, 'b1', 'lotte')).toBe(false);
    expect(heeftMemo(lijst, 'b2', 'mathis')).toBe(false);
  });

  it('rekent een memo zonder les nergens mee', () => {
    expect(heeftMemo([memo('m2', { booking_id: undefined })], 'b1', 'mathis')).toBe(false);
  });
});

describe('memoNaarNotitie', () => {
  it('geeft de speler, de opname en het tijdstip van de opname mee', () => {
    expect(memoNaarNotitie(memo('m1'))).toEqual({
      student_id: 'mathis',
      voice_memo_uri: 'data:audio/webm;base64,AAAA',
      created_at: '2026-08-25T17:12:00.000Z',
    });
  });
});
