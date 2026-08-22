import { opgeruimd, zonderWeggeklikt } from './weggeklikt';
import type { Booking } from './types';

const les = (id: string): Booking => ({
  id,
  player_id: 'p1',
  coach_id: 'koen',
  court_id: 'c1',
  start_time: '2026-08-25T17:00:00.000Z',
  end_time: '2026-08-25T18:00:00.000Z',
  status: 'cancelled',
  payment_method: 'open',
});

describe('zonderWeggeklikt', () => {
  it('laat alles staan als er niets is weggeklikt', () => {
    expect(zonderWeggeklikt([les('a'), les('b')], []).map((b) => b.id)).toEqual(['a', 'b']);
  });

  it('haalt eruit wat is weggeklikt', () => {
    expect(zonderWeggeklikt([les('a'), les('b')], ['a']).map((b) => b.id)).toEqual(['b']);
  });

  it('trekt zich niets aan van een id dat niet meer bestaat', () => {
    expect(zonderWeggeklikt([les('a')], ['weg', 'a']).map((b) => b.id)).toEqual([]);
  });
});

describe('opgeruimd', () => {
  it('bewaart alleen wat nog in de lijst staat', () => {
    // Anders groeit de lijst met weggeklikte berichten eindeloos: elk bericht dat na een
    // week vanzelf verdwijnt, zou zijn id er voor altijd in achterlaten.
    expect(opgeruimd(['a', 'oud'], [les('a')])).toEqual(['a']);
  });

  it('is leeg als er niets meer te tonen valt', () => {
    expect(opgeruimd(['a', 'b'], [])).toEqual([]);
  });

  it('verzint niets bij', () => {
    expect(opgeruimd([], [les('a')])).toEqual([]);
  });
});
