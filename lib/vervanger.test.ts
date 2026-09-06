import { kanVervangen, planMassaVervanging, vervangersVoor } from './vervanger';
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

describe('geen kandidaat valt stil weg', () => {
  const zieke = trainer({ id: 'jan', name: 'Jan' });
  const vrije = trainer({ id: 'piet', name: 'Piet' });
  const bezette = trainer({ id: 'ann', name: 'Ann' });
  const vroege = trainer({ id: 'lore', name: 'Lore', working_hours: { start: '09:00', end: '12:00' } });
  const kandidaten = [zieke, vrije, bezette, vroege];

  const wereld = {
    lessen: [les({ coach_id: 'ann' })],
    open: [ziek({ coach_id: 'jan' })],
  };

  const lijst = (): VervangerUitkomst[] =>
    vervangersVoor(kandidaten, slot, wereld.lessen, [], wereld.open, CLUB_EINDE);

  it('geeft er even veel terug als er kandidaten in gingen', () => {
    expect(lijst()).toHaveLength(kandidaten.length);
  });

  it('elke trainer staat er precies één keer in, in de volgorde van de invoer', () => {
    expect(lijst().map((u) => u.coach.id)).toEqual(['jan', 'piet', 'ann', 'lore']);
  });

  it('wie niet kan staat er met zijn eigen reden bij', () => {
    expect(lijst().map((u) => u.reden)).toEqual(['zelf_ziek', 'kan', 'eigen_les', 'buiten_uren']);
  });

  it('voegt niets toe en laat niets weg ten opzichte van kanVervangen', () => {
    const los = kandidaten.map((k) =>
      kanVervangen(k, slot, wereld.lessen, [], wereld.open, CLUB_EINDE));
    expect(lijst()).toEqual(los);
  });

  it('een lege kandidatenlijst geeft een lege uitkomst', () => {
    expect(vervangersVoor([], slot, wereld.lessen, [], wereld.open, CLUB_EINDE)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Alle openstaande lessen in één keer aan één collega
// ---------------------------------------------------------------------------

describe('planMassaVervanging', () => {
  /** Drie lessen van de zieke collega op dinsdag: 15:00, 16:00 en 17:00. */
  const drieUren = [
    { id: 'b-15', start_time: moment(6, 15), end_time: moment(6, 16) },
    { id: 'b-16', start_time: moment(6, 16), end_time: moment(6, 17) },
    { id: 'b-17', start_time: moment(6, 17), end_time: moment(6, 18) },
  ];

  it('geeft twee lege lijsten voor een lege lijst lessen', () => {
    expect(planMassaVervanging(trainer(), [], [], [], [], CLUB_EINDE))
      .toEqual({ toewijzen: [], overgeslagen: [] });
  });

  it('wijst alles toe aan een collega die alles kan', () => {
    const uit = planMassaVervanging(trainer(), drieUren, [], [], [], CLUB_EINDE);
    expect(uit.toewijzen).toEqual(['b-15', 'b-16', 'b-17']);
    expect(uit.overgeslagen).toEqual([]);
  });

  it('slaat alles over als de collega zelf ziek is, met de reden erbij', () => {
    const uit = planMassaVervanging(
      trainer({ id: 'bart', name: 'Bart' }), drieUren, [], [],
      [ziek({ coach_id: 'bart' })], CLUB_EINDE,
    );
    expect(uit.toewijzen).toEqual([]);
    expect(uit.overgeslagen.map((o) => o.id)).toEqual(['b-15', 'b-16', 'b-17']);
    expect(new Set(uit.overgeslagen.map((o) => o.reden))).toEqual(new Set(['zelf_ziek']));
  });

  it('geeft hem wat hij kan en laat de rest openstaan', () => {
    // Hij geeft om 16:00 zelf al les; de andere twee uren zijn vrij.
    const eigenLes = les({ id: 'eigen', coach_id: 'bart', start_time: moment(6, 16), end_time: moment(6, 17) });
    const uit = planMassaVervanging(
      trainer({ id: 'bart', name: 'Bart' }), drieUren, [eigenLes], [], [], CLUB_EINDE,
    );
    expect(uit.toewijzen).toEqual(['b-15', 'b-17']);
    expect(uit.overgeslagen).toHaveLength(1);
    expect(uit.overgeslagen[0].id).toBe('b-16');
  });

  it('geeft dezelfde reden als kanVervangen, zonder tweede formulering', () => {
    const uit = planMassaVervanging(
      trainer({ id: 'bart', name: 'Bart' }), [drieUren[0]], [], [vakantie()], [], CLUB_EINDE,
    );
    const los = kanVervangen(
      trainer({ id: 'bart', name: 'Bart' }), slot, [], [vakantie()], [], CLUB_EINDE,
    );
    expect(uit.overgeslagen[0].reden).toBe(los.reden);
  });

  it('wijst drie lessen op hetzelfde uur alle drie toe', () => {
    // Het kleutertennis op Terrein 7: de zieke collega draaide drie groepen tegelijk. Zou deze
    // functie oplopend rekenen, dan heette de vervanger na de eerste les bezet en kreeg hij er
    // één van de drie — terwijl zijn collega ze alle drie zelf gaf.
    const tegelijk = [
      { id: 'wit', start_time: moment(6, 15), end_time: moment(6, 16) },
      { id: 'blauw', start_time: moment(6, 15), end_time: moment(6, 16) },
      { id: 'rood', start_time: moment(6, 15), end_time: moment(6, 16) },
    ];
    const uit = planMassaVervanging(trainer(), tegelijk, [], [], [], CLUB_EINDE);
    expect(uit.toewijzen).toEqual(['wit', 'blauw', 'rood']);
    expect(uit.overgeslagen).toEqual([]);
  });

  it('houdt de volgorde van de lessen aan zoals ze binnenkwamen', () => {
    const omgekeerd = [drieUren[2], drieUren[0], drieUren[1]];
    const uit = planMassaVervanging(trainer(), omgekeerd, [], [], [], CLUB_EINDE);
    expect(uit.toewijzen).toEqual(['b-17', 'b-15', 'b-16']);
  });
});
