import { openZiekmeldingen, ziekmeldingFout } from './ziekmelding';
import type { SickLeave } from './types';

const basis: SickLeave = {
  id: 'z-1', coach_id: 'c-1', van: '2027-03-01', tot: '2027-03-05',
  created_at: '2027-02-28T09:00:00.000Z',
};

/** Een ziekmelding met een afwijking erop, zoals `week` in lib/series.test. */
const ziek = (patch: Partial<SickLeave> = {}): SickLeave => ({ ...basis, ...patch });

describe('ziekmeldingFout', () => {
  it('klaagt als er geen trainer gekozen is', () => {
    expect(ziekmeldingFout('', '2027-03-01', '2027-03-05')).not.toBeNull();
    expect(ziekmeldingFout('   ', '2027-03-01', '2027-03-05')).not.toBeNull();
  });

  it('klaagt over een half getypte datum in plaats van te crashen', () => {
    // Dit wordt gelezen terwijl iemand nog aan het typen is: "01/03" is nog niet af.
    expect(ziekmeldingFout('c-1', '01/03', '2027-03-05')).not.toBeNull();
    expect(ziekmeldingFout('c-1', '2027-03-01', '')).not.toBeNull();
    expect(ziekmeldingFout('c-1', '2027-02-30', '2027-03-05')).not.toBeNull();
  });

  it('geeft null voor een volledig ingevulde periode', () => {
    expect(ziekmeldingFout('c-1', '2027-03-01', '2027-03-05')).toBeNull();
  });

  it('geeft null voor één enkele ziektedag', () => {
    expect(ziekmeldingFout('c-1', '2027-03-01', '2027-03-01')).toBeNull();
  });

  it('laat een omgekeerd ingevulde periode staan', () => {
    // Dezelfde afspraak als `vakantieOpDag`: wie van en tot omdraait bedoelt de dagen
    // ertussen, en daarover klagen helpt niemand vooruit.
    expect(ziekmeldingFout('c-1', '2027-03-05', '2027-03-01')).toBeNull();
  });
});

describe('openZiekmeldingen', () => {
  it('geeft een lege lijst terug voor een lege lijst', () => {
    expect(openZiekmeldingen([])).toEqual([]);
  });

  it('laat elke ingetrokken melding weg en houdt de rest op volgorde', () => {
    const a = ziek({ id: 'z-a' });
    const b = ziek({ id: 'z-b', retracted_at: '2027-03-02T08:00:00.000Z' });
    const c = ziek({ id: 'z-c' });
    expect(openZiekmeldingen([a, b, c]).map((z) => z.id)).toEqual(['z-a', 'z-c']);
  });

  it('laat de meegegeven lijst zelf ongemoeid', () => {
    const lijst = [ziek({ id: 'z-a' }), ziek({ id: 'z-b', retracted_at: '2027-03-02T08:00:00.000Z' })];
    const kopie = lijst.map((z) => ({ ...z }));
    openZiekmeldingen(lijst);
    expect(lijst).toEqual(kopie);
  });
});
