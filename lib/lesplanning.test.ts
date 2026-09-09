import { geldtVoor, lesplanningFout, materiaalVoor } from './lesplanning';
import type { Booking, Lesplanning, Lesson } from './types';

describe('lesplanningFout', () => {
  it('klaagt als er geen materiaal gekozen is', () => {
    expect(lesplanningFout('', 'c-1', '', '2027-03-01', '2027-03-14')).not.toBeNull();
    expect(lesplanningFout('   ', 'c-1', '', '2027-03-01', '2027-03-14')).not.toBeNull();
  });

  it('klaagt als er geen trainer én geen groep gekozen is', () => {
    // Beide leeg zou "de hele club" betekenen, en dat bedoelt niemand met een leeg formulier.
    expect(lesplanningFout('l-1', '', '', '2027-03-01', '2027-03-14')).not.toBeNull();
  });

  it('klaagt over een half getypte of onbestaande datum in plaats van te crashen', () => {
    // Dit wordt gelezen terwijl iemand nog aan het typen is: "01/03" is nog niet af.
    expect(lesplanningFout('l-1', 'c-1', '', '01/03', '2027-03-14')).not.toBeNull();
    expect(lesplanningFout('l-1', 'c-1', '', '2027-03-01', '')).not.toBeNull();
    expect(lesplanningFout('l-1', 'c-1', '', '2027-02-30', '2027-03-14')).not.toBeNull();
  });

  it('weigert een periode die eindigt voor ze begint', () => {
    // Stil omdraaien kostte de eigenaar op 6 september 2026 een lege werklijst zonder uitleg;
    // `ziekmeldingFout` en `lesGroepFout` weigeren precies dezelfde vergissing.
    expect(lesplanningFout('l-1', 'c-1', '', '2027-03-14', '2027-03-01')).not.toBeNull();
  });

  it('geeft null voor een trainer, een groep, of beide', () => {
    expect(lesplanningFout('l-1', 'c-1', '', '2027-03-01', '2027-03-14')).toBeNull();
    expect(lesplanningFout('l-1', '', 'g-1', '2027-03-01', '2027-03-14')).toBeNull();
    expect(lesplanningFout('l-1', 'c-1', 'g-1', '2027-03-01', '2027-03-14')).toBeNull();
  });

  it('geeft null voor één enkele dag', () => {
    expect(lesplanningFout('l-1', 'c-1', '', '2027-03-01', '2027-03-01')).toBeNull();
  });
});

const basisPlanning: Lesplanning = {
  id: 'p-1', lesson_id: 'l-1', coach_id: 'c-1',
  van: '2027-03-01', tot: '2027-03-14',
  created_at: '2027-02-20T09:00:00.000Z',
};

/** Een doorsturing met een afwijking erop, zoals `ziek` in lib/ziekmelding.test. */
const planning = (patch: Partial<Lesplanning> = {}): Lesplanning => ({ ...basisPlanning, ...patch });

const basisLes: Booking = {
  id: 'b-1', player_id: 's-1', coach_id: 'c-1', court_id: 'baan-1',
  start_time: '2027-03-03T17:00:00.000Z', end_time: '2027-03-03T18:00:00.000Z',
  status: 'confirmed', payment_method: 'open',
};

const les = (patch: Partial<Booking> = {}): Booking => ({ ...basisLes, ...patch });

describe('geldtVoor', () => {
  it('geldt binnen de periode en op beide grensdagen', () => {
    expect(geldtVoor(planning(), les())).toBe(true);
    expect(geldtVoor(planning(), les({
      start_time: '2027-03-01T17:00:00.000Z', end_time: '2027-03-01T18:00:00.000Z',
    }))).toBe(true);
    expect(geldtVoor(planning(), les({
      start_time: '2027-03-14T17:00:00.000Z', end_time: '2027-03-14T18:00:00.000Z',
    }))).toBe(true);
  });

  it('geldt niet ervoor en niet erna', () => {
    expect(geldtVoor(planning(), les({
      start_time: '2027-02-28T17:00:00.000Z', end_time: '2027-02-28T18:00:00.000Z',
    }))).toBe(false);
    expect(geldtVoor(planning(), les({
      start_time: '2027-03-15T17:00:00.000Z', end_time: '2027-03-15T18:00:00.000Z',
    }))).toBe(false);
  });

  it('geldt niet voor de les van een andere trainer', () => {
    expect(geldtVoor(planning(), les({ coach_id: 'c-2' }))).toBe(false);
  });

  it('kijkt alleen naar de groep als er alleen een groep staat', () => {
    const perGroep = planning({ coach_id: undefined, group_id: 'g-1' });
    expect(geldtVoor(perGroep, les({ coach_id: 'c-9', group_id: 'g-1' }))).toBe(true);
    expect(geldtVoor(perGroep, les({ coach_id: 'c-1', group_id: 'g-2' }))).toBe(false);
    expect(geldtVoor(perGroep, les({ coach_id: 'c-1' }))).toBe(false);
  });

  it('eist bij beide dat ze beide kloppen', () => {
    const beide = planning({ group_id: 'g-1' });
    expect(geldtVoor(beide, les({ group_id: 'g-1' }))).toBe(true);
    expect(geldtVoor(beide, les({ group_id: 'g-2' }))).toBe(false);
    expect(geldtVoor(beide, les({ coach_id: 'c-2', group_id: 'g-1' }))).toBe(false);
  });

  it('blijft gelden voor een les die een vervanger overneemt', () => {
    // `taught_by_id` doet hier met opzet niet mee: het blijft de les van die trainer en van die
    // groep, dus hoort er hetzelfde materiaal bij. Zou dit `lesgeverId` vergelijken, dan
    // verdwijnt de instructie precies wanneer er iemand inspringt.
    expect(geldtVoor(planning(), les({ taught_by_id: 'c-9' }))).toBe(true);
  });

  it('leest de lokale dag en niet de UTC-datum', () => {
    // Een avondles op de laatste dag: in UTC schuift 23:00 lokaal naar de volgende dag, en dan
    // zou deze les stil buiten de periode vallen.
    const avond = les({
      start_time: '2027-03-14T22:30:00.000Z', end_time: '2027-03-14T23:30:00.000Z',
    });
    expect(geldtVoor(planning(), avond)).toBe(true);
  });

  it('geldt niet bij een onleesbare begintijd in plaats van te crashen', () => {
    expect(geldtVoor(planning(), les({ start_time: 'geen datum' }))).toBe(false);
  });
});

describe('materiaalVoor', () => {
  const training = (id: string, title: string): Lesson => ({
    id, title, uploaded_by: 'c-1',
  });

  const materiaal: Lesson[] = [
    training('l-1', 'Training 4'),
    training('l-2', 'Training 5'),
    training('l-3', 'Training 6'),
  ];

  it('geeft een lege lijst als er niets geldt', () => {
    expect(materiaalVoor(les(), [], materiaal)).toEqual([]);
    expect(materiaalVoor(les({ coach_id: 'c-9' }), [planning()], materiaal)).toEqual([]);
  });

  it('geeft het materiaal van de enige treffer', () => {
    expect(materiaalVoor(les(), [planning()], materiaal).map((l) => l.title))
      .toEqual(['Training 4']);
  });

  it('laat niets weg als er twee dingen gelden, bijzonderste eerst', () => {
    // De beheerder heeft ze beide ingevuld; een instructie die de app stil verbergt is een
    // instructie die niet gegeven is. Zelfde afspraak als `vervangersVoor` in lib/vervanger.
    const perTrainer = planning({ id: 'p-trainer', lesson_id: 'l-1' });
    const perGroep = planning({ id: 'p-groep', lesson_id: 'l-2', coach_id: undefined, group_id: 'g-1' });
    const perBeide = planning({ id: 'p-beide', lesson_id: 'l-3', group_id: 'g-1' });
    const uit = materiaalVoor(les({ group_id: 'g-1' }), [perTrainer, perGroep, perBeide], materiaal);
    expect(uit.map((l) => l.title)).toEqual(['Training 6', 'Training 5', 'Training 4']);
  });

  it('laat een planning weg waarvan het materiaal niet meer bestaat', () => {
    // De databank ruimt dit op met `on delete cascade`; dit is het vangnet voor de opslag in de
    // app, die tussen twee ophaalronden even uit de pas kan lopen.
    expect(materiaalVoor(les(), [planning({ lesson_id: 'l-weg' })], materiaal)).toEqual([]);
  });
});
