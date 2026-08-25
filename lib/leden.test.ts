import type {
  Beurtenkaart, Booking, Lesson, Memo, OuderKind, PlayerGoal, StudentProgress, User,
} from './types';
import {
  beheerders, gevolgenVanVerwijderen, heeftGevolgen, ledenLijst, magVinkjeWeg,
  rolWisselBezwaar, zonderLid,
} from './leden';

const koen: User = { id: 'koen', email: 'k@x.be', name: 'Koen', role: 'coach', is_admin: true };
const lies: User = { id: 'lies', email: 'l@x.be', name: 'Lies', role: 'coach' };
const mathis: User = { id: 'p1', email: 'm@x.be', name: 'Mathis', role: 'player' };
const anna: User = { id: 'p2', email: 'a@x.be', name: 'Anna', role: 'player' };

function leeg() {
  return {
    users: [] as User[],
    bookings: [] as Booking[],
    progress: [] as StudentProgress[],
    beurtenkaarten: [] as Beurtenkaart[],
    goals: [] as PlayerGoal[],
    lessons: [] as Lesson[],
    relaties: [] as OuderKind[],
    memos: [] as Memo[],
  };
}

function les(over: Partial<Booking> = {}): Booking {
  return {
    id: 'b1', player_id: 'p1', coach_id: 'koen', court_id: 'c1',
    start_time: '2026-08-26T09:00:00.000Z', end_time: '2026-08-26T10:00:00.000Z',
    status: 'confirmed', payment_method: 'open', ...over,
  };
}

describe('ledenLijst', () => {
  it('zet de trainers bovenaan en sorteert daarbinnen op naam', () => {
    expect(ledenLijst([anna, koen, mathis, lies]).map((u) => u.id))
      .toEqual(['koen', 'lies', 'p2', 'p1']);
  });

  it('zoekt op naam en op e-mailadres, hoofdletters maken niet uit', () => {
    expect(ledenLijst([koen, mathis], 'MAT').map((u) => u.id)).toEqual(['p1']);
    expect(ledenLijst([koen, mathis], 'k@x').map((u) => u.id)).toEqual(['koen']);
  });

  it('geeft alles terug bij een lege zoekterm', () => {
    expect(ledenLijst([koen, mathis], '   ')).toHaveLength(2);
  });

  it('laat de lijst die binnenkwam met rust', () => {
    const lijst = [anna, koen];
    ledenLijst(lijst);
    expect(lijst.map((u) => u.id)).toEqual(['p2', 'koen']);
  });
});

describe('beheerders', () => {
  it('telt alleen wie het vinkje heeft', () => {
    expect(beheerders([koen, lies, mathis]).map((u) => u.id)).toEqual(['koen']);
  });
});

describe('magVinkjeWeg', () => {
  it('houdt de laatste beheerder tegen: anders zit de club buiten haar eigen deur', () => {
    expect(magVinkjeWeg([koen, lies, mathis], 'koen')).toBe(false);
  });

  it('laat het toe zodra er een tweede beheerder is', () => {
    expect(magVinkjeWeg([koen, { ...lies, is_admin: true }], 'koen')).toBe(true);
  });

  it('bemoeit zich niet met iemand die het vinkje toch niet heeft', () => {
    expect(magVinkjeWeg([koen, lies], 'lies')).toBe(true);
  });
});

describe('rolWisselBezwaar', () => {
  it('laat een speler zonder meer trainer worden', () => {
    expect(rolWisselBezwaar(mathis, 'coach', [les()])).toBeNull();
  });

  it('houdt een trainer met lessen op zijn naam tegen', () => {
    const bezwaar = rolWisselBezwaar(koen, 'player', [les(), les({ id: 'b2' })]);
    expect(bezwaar).toContain('Koen');
    expect(bezwaar).toContain('2');
  });

  it('laat een trainer zonder lessen wel speler worden', () => {
    expect(rolWisselBezwaar(lies, 'player', [les()])).toBeNull();
  });

  it('zegt niets als de rol niet verandert', () => {
    expect(rolWisselBezwaar(koen, 'coach', [les()])).toBeNull();
  });
});

describe('gevolgenVanVerwijderen', () => {
  const store = {
    ...leeg(),
    users: [koen, mathis, anna],
    bookings: [
      les(),
      les({ id: 'b2', player_id: 'p2', participant_ids: ['p1'] }),
      les({ id: 'b3', player_id: 'p2', coach_id: 'lies' }),
    ],
    beurtenkaarten: [{ id: 'k1', player_id: 'p1', total_sessions: 10, created_at: '', uses: [] }],
    relaties: [{ id: 'r1', parent_id: 'papa', child_id: 'p1', status: 'approved' as const }],
  };

  it('telt de lessen waarin hij speelt, meespeelt of lesgeeft', () => {
    expect(gevolgenVanVerwijderen(store, 'p1').lessen).toBe(2);
    expect(gevolgenVanVerwijderen(store, 'koen').lessen).toBe(2);
  });

  it('telt zijn kaarten en zijn koppelingen', () => {
    const g = gevolgenVanVerwijderen(store, 'p1');
    expect(g.kaarten).toBe(1);
    expect(g.koppelingen).toBe(1);
  });

  it('geeft nul terug voor een lid zonder geschiedenis', () => {
    const g = gevolgenVanVerwijderen(store, 'niemand');
    expect(heeftGevolgen(g)).toBe(false);
  });
});

describe('zonderLid', () => {
  const store = {
    ...leeg(),
    users: [koen, mathis, anna],
    bookings: [
      les(),
      les({ id: 'b2', player_id: 'p2', participant_ids: ['p1', 'p3'] }),
      les({ id: 'b3', player_id: 'p2', coach_id: 'lies' }),
    ],
    beurtenkaarten: [{ id: 'k1', player_id: 'p1', total_sessions: 10, created_at: '', uses: [] }],
    relaties: [{ id: 'r1', parent_id: 'papa', child_id: 'p1', status: 'approved' as const }],
  };

  it('haalt het lid zelf weg', () => {
    expect(zonderLid(store, 'p1').users.map((u) => u.id)).toEqual(['koen', 'p2']);
  });

  it('neemt zijn eigen lessen mee en laat die van anderen staan', () => {
    expect(zonderLid(store, 'p1').bookings.map((b) => b.id)).toEqual(['b2', 'b3']);
  });

  it('neemt ook de lessen mee die hij gaf', () => {
    expect(zonderLid(store, 'koen').bookings.map((b) => b.id)).toEqual(['b3']);
  });

  it('haalt hem uit de groepslessen van anderen — dat doet de databank niet zelf', () => {
    const na = zonderLid(store, 'p1');
    expect(na.bookings.find((b) => b.id === 'b2')?.participant_ids).toEqual(['p3']);
  });

  it('laat een groepsles waar hij niet in stond helemaal ongemoeid', () => {
    const na = zonderLid(store, 'p1');
    expect(na.bookings.find((b) => b.id === 'b3')).toBe(store.bookings[2]);
  });

  it('neemt zijn kaarten en zijn koppelingen mee', () => {
    const na = zonderLid(store, 'p1');
    expect(na.beurtenkaarten).toHaveLength(0);
    expect(na.relaties).toHaveLength(0);
  });

  it('laat de oude opslag ongemoeid', () => {
    zonderLid(store, 'p1');
    expect(store.users).toHaveLength(3);
    expect(store.bookings[1].participant_ids).toEqual(['p1', 'p3']);
  });
});
