import { lessenVoorZiekmelding, openZiekmeldingen, ziekmeldingFout, zoektVervanger } from './ziekmelding';
import type { Booking, SickLeave, Vakantie } from './types';

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

/** Een les op een lokale dag en een lokaal uur — nooit een handgeschreven Z-string. */
const lokaal = (jaar: number, maand: number, dag: number, uur: number): string =>
  new Date(jaar, maand - 1, dag, uur, 0).toISOString();

const les0: Booking = {
  id: 'b-1', player_id: 'p-1', coach_id: 'c-1', court_id: 'court-1',
  start_time: lokaal(2027, 3, 3, 10), end_time: lokaal(2027, 3, 3, 11),
  status: 'confirmed', payment_method: 'open',
};

const les = (id: string, start: string, patch: Partial<Booking> = {}): Booking =>
  ({ ...les0, id, start_time: start, ...patch });

describe('zoektVervanger', () => {
  it('zegt ja voor een les van de zieke trainer zonder vervanger', () => {
    expect(zoektVervanger(les('b-1', lokaal(2027, 3, 3, 10)), [basis])).toBe(true);
  });

  it('zegt nee zodra er een vervanger op staat', () => {
    const geregeld = les('b-1', lokaal(2027, 3, 3, 10), { taught_by_id: 'c-2' });
    expect(zoektVervanger(geregeld, [basis])).toBe(false);
  });

  it('zegt nee voor een afgezegde les', () => {
    const weg = les('b-1', lokaal(2027, 3, 3, 10), { status: 'cancelled' });
    expect(zoektVervanger(weg, [basis])).toBe(false);
  });

  it('zegt nee zodra de ziekmelding is ingetrokken', () => {
    // VERV-10 in één regel: er is niets teruggezet, het antwoord is gewoon veranderd.
    const ingetrokken = ziek({ retracted_at: '2027-03-02T08:00:00.000Z' });
    expect(zoektVervanger(les('b-1', lokaal(2027, 3, 3, 10)), [ingetrokken])).toBe(false);
  });

  it('zegt nee voor de les van een andere trainer in dezelfde periode', () => {
    const anders = les('b-1', lokaal(2027, 3, 3, 10), { coach_id: 'c-9' });
    expect(zoektVervanger(anders, [basis])).toBe(false);
  });

  it('zegt nee voor een les buiten de periode, aan beide kanten', () => {
    expect(zoektVervanger(les('b-1', lokaal(2027, 2, 28, 10)), [basis])).toBe(false);
    expect(zoektVervanger(les('b-2', lokaal(2027, 3, 6, 10)), [basis])).toBe(false);
  });

  it('telt de van-dag en de tot-dag zelf mee', () => {
    expect(zoektVervanger(les('b-1', lokaal(2027, 3, 1, 10)), [basis])).toBe(true);
    expect(zoektVervanger(les('b-2', lokaal(2027, 3, 5, 10)), [basis])).toBe(true);
  });

  it('telt ook een les laat op de laatste ziektedag mee', () => {
    // Om 23:00 lokaal staat de UTC-dag al een dag verder: wie hier de ISO-tekst afknipt,
    // laat die les stil buiten de werklijst vallen.
    expect(zoektVervanger(les('b-1', lokaal(2027, 3, 5, 23)), [basis])).toBe(true);
  });

  it('zegt nee als er helemaal geen ziekmelding is', () => {
    expect(zoektVervanger(les('b-1', lokaal(2027, 3, 3, 10)), [])).toBe(false);
  });
});

describe('intrekken', () => {
  it('raakt geen enkele boeking aan en laat een geregelde les met rust', () => {
    const open = les('b-open', lokaal(2027, 3, 3, 10));
    const geregeld = les('b-geregeld', lokaal(2027, 3, 4, 10), { taught_by_id: 'c-2' });
    const lijst = [open, geregeld];
    const voor = lijst.map((b) => ({ ...b }));

    // Zolang de melding open staat: de ene zoekt, de andere is al geregeld.
    expect(zoektVervanger(open, [basis])).toBe(true);
    expect(zoektVervanger(geregeld, [basis])).toBe(false);

    // Ingetrokken: geen van beide zoekt nog iets — en de vervanger van de tweede blijft
    // staan, want die afspraak is gemaakt.
    const ingetrokken = ziek({ retracted_at: '2027-03-02T08:00:00.000Z' });
    expect(zoektVervanger(open, [ingetrokken])).toBe(false);
    expect(zoektVervanger(geregeld, [ingetrokken])).toBe(false);
    expect(geregeld.taught_by_id).toBe('c-2');
    expect(lijst).toEqual(voor);
  });
});

describe('één les uit een reeks', () => {
  it('staat los van de rest van de reeks', () => {
    const een = les('r-1', lokaal(2027, 3, 2, 10), { series_id: 'reeks-1' });
    const twee = les('r-2', lokaal(2027, 3, 3, 10), { series_id: 'reeks-1', taught_by_id: 'c-2' });
    const drie = les('r-3', lokaal(2027, 3, 4, 10), { series_id: 'reeks-1' });
    expect([een, twee, drie].map((b) => zoektVervanger(b, [basis]))).toEqual([true, false, true]);
  });
});

const geenVakanties: Vakantie[] = [];

describe('lessenVoorZiekmelding', () => {
  it('geeft de lessen binnen de periode, op tijd gesorteerd', () => {
    const laat = les('b-laat', lokaal(2027, 3, 4, 10));
    const vroeg = les('b-vroeg', lokaal(2027, 3, 2, 10));
    const uitkomst = lessenVoorZiekmelding([laat, vroeg], basis, geenVakanties);
    expect(uitkomst.map((b) => b.id)).toEqual(['b-vroeg', 'b-laat']);
  });

  it('telt de van-dag en de tot-dag mee en laat de dagen ernaast weg', () => {
    const lijst = [
      les('b-voor', lokaal(2027, 2, 28, 10)),
      les('b-van', lokaal(2027, 3, 1, 10)),
      les('b-tot', lokaal(2027, 3, 5, 10)),
      les('b-na', lokaal(2027, 3, 6, 10)),
    ];
    expect(lessenVoorZiekmelding(lijst, basis, geenVakanties).map((b) => b.id))
      .toEqual(['b-van', 'b-tot']);
  });

  it('laat de lessen van een andere trainer weg', () => {
    const lijst = [les('b-1', lokaal(2027, 3, 2, 10)), les('b-2', lokaal(2027, 3, 2, 11), { coach_id: 'c-9' })];
    expect(lessenVoorZiekmelding(lijst, basis, geenVakanties).map((b) => b.id)).toEqual(['b-1']);
  });

  it('laat een afgezegde les weg — die raakt niemand meer', () => {
    const lijst = [les('b-1', lokaal(2027, 3, 2, 10), { status: 'cancelled' })];
    expect(lessenVoorZiekmelding(lijst, basis, geenVakanties)).toEqual([]);
  });

  it('laat een les in een clubvakantie weg — die wordt toch niet gegeven', () => {
    const vakanties: Vakantie[] = [{ id: 'v-1', naam: 'Krokus', van: '2027-03-02', tot: '2027-03-03' }];
    const lijst = [les('b-1', lokaal(2027, 3, 2, 10)), les('b-2', lokaal(2027, 3, 4, 10))];
    expect(lessenVoorZiekmelding(lijst, basis, vakanties).map((b) => b.id)).toEqual(['b-2']);
  });

  it('houdt een les waar al een vervanger op staat in de lijst', () => {
    // De beheerder moet die rij zien om te weten dat hij al geregeld is; het scherm toont
    // hem als opgelost, deze functie verzwijgt hem niet.
    const lijst = [les('b-1', lokaal(2027, 3, 2, 10), { taught_by_id: 'c-2' })];
    expect(lessenVoorZiekmelding(lijst, basis, geenVakanties).map((b) => b.id)).toEqual(['b-1']);
  });

  it('laat de meegegeven lijst ongemoeid', () => {
    const lijst = [les('b-laat', lokaal(2027, 3, 4, 10)), les('b-vroeg', lokaal(2027, 3, 2, 10))];
    const voor = lijst.map((b) => ({ ...b }));
    lessenVoorZiekmelding(lijst, basis, geenVakanties);
    expect(lijst).toEqual(voor);
    expect(lijst.map((b) => b.id)).toEqual(['b-laat', 'b-vroeg']);
  });

  it('geeft de volle boeking terug, met baan en groep erin', () => {
    const groepsles = les('b-1', lokaal(2027, 3, 2, 10), { group_id: 'g-1', participant_ids: ['p-2', 'p-3'] });
    expect(lessenVoorZiekmelding([groepsles], basis, geenVakanties)).toEqual([groepsles]);
  });
});

describe('de zieke trainer stond alleen als vervanger', () => {
  it('neemt de les mee waar hij als vervanger op staat', () => {
    // D-15: de les is van een collega, maar hij zou hem geven — en dat kan hij niet.
    const vanCollega = les('b-1', lokaal(2027, 3, 2, 10), { coach_id: 'c-9', taught_by_id: 'c-1' });
    expect(lessenVoorZiekmelding([vanCollega], basis, geenVakanties).map((b) => b.id)).toEqual(['b-1']);
  });

  it('laat de les van een collega met een andere vervanger wel weg', () => {
    const vanCollega = les('b-1', lokaal(2027, 3, 2, 10), { coach_id: 'c-9', taught_by_id: 'c-8' });
    expect(lessenVoorZiekmelding([vanCollega], basis, geenVakanties)).toEqual([]);
  });
});

// De uurwissel: in België springt de klok vooruit op de laatste zondag van maart
// (2027-03-28) en terug op de laatste zondag van oktober (2027-10-31). Een les van 20:00 hoort
// daarna nog steeds om 20:00 te staan, en geen dag te verschuiven.
const winterOffset = new Date(2027, 0, 15).getTimezoneOffset();
const zomerOffset = new Date(2027, 6, 15).getTimezoneOffset();
const heeftZomertijd = winterOffset !== zomerOffset;
if (!heeftZomertijd) {
  console.warn(
    `LET OP: de tijdzone van deze machine (${Intl.DateTimeFormat().resolvedOptions().timeZone}) kent geen ` +
    'zomertijd. De zomertijdtests van lib/ziekmelding worden overgeslagen en bewijzen hier dus niets — ' +
    'draai ze op een machine met TZ=Europe/Brussels voordat je hierop vertrouwt.',
  );
}
const alsErZomertijdIs = heeftZomertijd ? it : it.skip;

describe('zomertijd', () => {
  alsErZomertijdIs('vindt de les na de lentewissel, nog steeds om 20:00', () => {
    const ziekte = ziek({ van: '2027-03-25', tot: '2027-04-01' });
    const ervoor = les('b-voor', lokaal(2027, 3, 23, 20));
    const erna = les('b-na', lokaal(2027, 3, 30, 20));
    const uitkomst = lessenVoorZiekmelding([ervoor, erna], ziekte, geenVakanties);
    expect(uitkomst.map((b) => b.id)).toEqual(['b-na']);
    expect(new Date(uitkomst[0].start_time).getHours()).toBe(20);
  });

  alsErZomertijdIs('vindt de les na de herfstwissel, nog steeds om 20:00', () => {
    const ziekte = ziek({ van: '2027-10-28', tot: '2027-11-03' });
    const ervoor = les('b-voor', lokaal(2027, 10, 26, 20));
    const erna = les('b-na', lokaal(2027, 11, 2, 20));
    const uitkomst = lessenVoorZiekmelding([ervoor, erna], ziekte, geenVakanties);
    expect(uitkomst.map((b) => b.id)).toEqual(['b-na']);
    expect(new Date(uitkomst[0].start_time).getHours()).toBe(20);
  });
});
