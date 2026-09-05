import { kanVervangen } from './vervanger';
import type { VervangerKandidaat, VervangerSlot, VervangerUitkomst } from './vervanger';
import type { OpenZiekmelding } from './ziekmelding';
import type { Booking, Vakantie } from './types';

// Alle gevallen draaien om één en dezelfde les: dinsdag 6 oktober 2026, van 15:00 tot 16:00.
// De tijdstippen worden opgebouwd uit lokale dag-, uur- en minuutvelden, nooit uit een
// UTC-tekst — anders bewijst de test iets over een ander uur dan de club bedoelt.
const moment = (dag: number, uur: number, minuut = 0): string =>
  new Date(2026, 9, dag, uur, minuut).toISOString();

const slot: VervangerSlot = { start_time: moment(6, 15), end_time: moment(6, 16) };

/** De clubtijd die het scherm meegeeft; hier ruim, zodat alleen de trainer de grens zet. */
const CLUB_EINDE = '22:00';

const trainer = (patch: Partial<VervangerKandidaat> = {}): VervangerKandidaat => ({
  id: 'jan',
  name: 'Jan',
  working_hours: { start: '09:00', end: '22:00' },
  ...patch,
});

const les = (patch: Partial<Booking> = {}): Booking => ({
  id: 'b1',
  player_id: 'p1',
  coach_id: 'jan',
  court_id: 'baan-1',
  start_time: moment(6, 15, 30),
  end_time: moment(6, 16, 30),
  status: 'confirmed',
  payment_method: 'open',
  ...patch,
});

const ziek = (patch: Partial<OpenZiekmelding> = {}): OpenZiekmelding => ({
  coach_id: 'jan',
  van: '2026-10-05',
  tot: '2026-10-09',
  ...patch,
});

const vakantie = (patch: Partial<Vakantie> = {}): Vakantie => ({
  id: 'v1',
  naam: 'Herfstvakantie',
  van: '2026-10-05',
  tot: '2026-10-11',
  ...patch,
});

/** De wereld eromheen; alles wat niet genoemd wordt is leeg. */
interface Wereld {
  lessen?: Booking[];
  vakanties?: Vakantie[];
  open?: OpenZiekmelding[];
  clubEinde?: string;
}

const uitkomst = (k: VervangerKandidaat, w: Wereld = {}): VervangerUitkomst =>
  kanVervangen(k, slot, w.lessen ?? [], w.vakanties ?? [], w.open ?? [], w.clubEinde ?? CLUB_EINDE);

const redenVan = (k: VervangerKandidaat, w: Wereld = {}): string => uitkomst(k, w).reden;

describe('kan', () => {
  it('geeft de trainer met zijn naam terug als niets hem tegenhoudt', () => {
    expect(uitkomst(trainer())).toEqual({
      coach: { id: 'jan', name: 'Jan' },
      reden: 'kan',
    });
  });

  it('valt terug op de clubtijd als de trainer zelf niets invulde', () => {
    expect(redenVan(trainer({ working_hours: undefined }))).toBe('kan');
  });
});

describe('zelf_ziek', () => {
  it('een open ziekmelding die de lesdag dekt houdt hem tegen', () => {
    expect(redenVan(trainer(), { open: [ziek()] })).toBe('zelf_ziek');
  });

  it('de laatste ziektedag telt mee', () => {
    expect(redenVan(trainer(), { open: [ziek({ van: '2026-10-01', tot: '2026-10-06' })] }))
      .toBe('zelf_ziek');
  });

  it('een omgekeerd ingevulde periode wordt gelezen als de dagen ertussen', () => {
    expect(redenVan(trainer(), { open: [ziek({ van: '2026-10-09', tot: '2026-10-05' })] }))
      .toBe('zelf_ziek');
  });

  it('een ingetrokken ziekmelding houdt niemand tegen', () => {
    const ingetrokken = ziek({ retracted_at: '2026-10-04T08:00:00.000Z' });
    expect(redenVan(trainer(), { open: [ingetrokken] })).toBe('kan');
  });

  it('de ziekmelding van een collega raakt hem niet', () => {
    expect(redenVan(trainer(), { open: [ziek({ coach_id: 'piet' })] })).toBe('kan');
  });
});

describe('afwijkende_periode', () => {
  it('een periode zonder uren betekent: die weken geeft hij geen les', () => {
    const k = trainer({
      booking_periods: [{ id: 'p1', naam: 'Cursus', van: '2026-10-05', tot: '2026-10-09' }],
    });
    expect(redenVan(k)).toBe('afwijkende_periode');
  });

  it('een periode met andere uren waar de les buiten valt, is de periode en niet zijn gewone uren', () => {
    const k = trainer({
      booking_periods: [{
        id: 'p1', van: '2026-10-05', tot: '2026-10-09', uren: { start: '09:00', end: '12:00' },
      }],
    });
    expect(redenVan(k)).toBe('afwijkende_periode');
  });

  it('valt de les binnen de uren van de periode, dan kan hij gewoon', () => {
    const k = trainer({
      booking_periods: [{
        id: 'p1', van: '2026-10-05', tot: '2026-10-09', uren: { start: '14:00', end: '18:00' },
      }],
    });
    expect(redenVan(k)).toBe('kan');
  });

  it('een periode die de lesdag niet dekt verandert niets', () => {
    const k = trainer({
      booking_periods: [{ id: 'p1', van: '2026-11-01', tot: '2026-11-08' }],
    });
    expect(redenVan(k)).toBe('kan');
  });
});

describe('buiten_uren', () => {
  it('de les valt buiten zijn eigen boekingstijd', () => {
    expect(redenVan(trainer({ working_hours: { start: '09:00', end: '12:00' } })))
      .toBe('buiten_uren');
  });

  it('hij werkt niet op dinsdag', () => {
    expect(redenVan(trainer({ working_days: [1, 3, 5] }))).toBe('buiten_uren');
  });

  it('een lege lijst werkdagen betekent elke dag', () => {
    expect(redenVan(trainer({ working_days: [] }))).toBe('kan');
  });

  it('dinsdag staat er wel bij', () => {
    expect(redenVan(trainer({ working_days: [2, 4] }))).toBe('kan');
  });
});

describe('clubvakantie', () => {
  it('de club is die dag dicht', () => {
    expect(redenVan(trainer(), { vakanties: [vakantie()] })).toBe('clubvakantie');
  });

  it('een vakantie in een andere week raakt deze les niet', () => {
    expect(redenVan(trainer(), { vakanties: [vakantie({ van: '2026-12-21', tot: '2027-01-04' })] }))
      .toBe('kan');
  });
});

describe('eigen_les', () => {
  it('hij geeft op dat moment zelf al les', () => {
    expect(redenVan(trainer(), { lessen: [les()] })).toBe('eigen_les');
  });

  it('een les die er precies op aansluit botst niet', () => {
    expect(redenVan(trainer(), { lessen: [les({ start_time: moment(6, 16), end_time: moment(6, 17) })] }))
      .toBe('kan');
  });

  it('een afgezegde les houdt niets bezet', () => {
    expect(redenVan(trainer(), { lessen: [les({ status: 'cancelled' })] })).toBe('kan');
  });

  it('de les van een collega op hetzelfde uur raakt hem niet', () => {
    expect(redenVan(trainer(), { lessen: [les({ coach_id: 'piet' })] })).toBe('kan');
  });
});

describe('de volgorde ligt vast', () => {
  it('zelf ziek wint van een eigen les', () => {
    expect(redenVan(trainer(), { open: [ziek()], lessen: [les()] })).toBe('zelf_ziek');
  });

  it('een afwijkende periode wint van een clubvakantie', () => {
    const k = trainer({
      booking_periods: [{ id: 'p1', van: '2026-10-05', tot: '2026-10-09' }],
    });
    expect(redenVan(k, { vakanties: [vakantie()] })).toBe('afwijkende_periode');
  });

  it('een clubvakantie wint van een eigen les', () => {
    expect(redenVan(trainer(), { vakanties: [vakantie()], lessen: [les()] })).toBe('clubvakantie');
  });

  it('dezelfde invoer geeft altijd dezelfde reden', () => {
    const k = trainer({ working_hours: { start: '09:00', end: '12:00' } });
    const w = { open: [ziek({ coach_id: 'piet' })], lessen: [les()], vakanties: [vakantie()] };
    expect(redenVan(k, w)).toBe(redenVan(k, w));
  });
});
