import { verzetPlan, type TeVerzettenLes, type VerzetContext } from './verzetten';
import type { BezetBoeking } from './recurrence';
import type { Vakantie } from './types';

/** 'HH:MM' op 9 september 2026 (een woensdag), als ISO op de klok van hier. */
const op = (dag: number, uur: number, minuut = 0): string =>
  new Date(2026, 8, dag, uur, minuut, 0, 0).toISOString();

const les: TeVerzettenLes = {
  id: 'b1',
  coach_id: 'ann',
  court_id: 'c7',
  start_time: op(9, 14),
  end_time: op(9, 15),
};

const leeg: VerzetContext = { bookings: [], vakanties: [] };

/** De uren van een geplande les terug op de klok van hier, om ze leesbaar te vergelijken. */
const klok = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

describe('verzetPlan', () => {
  it('schuift de les naar het nieuwe moment', () => {
    const uit = verzetPlan(les, { dag: '2026-09-10', beginuur: '16:00' }, leeg);
    expect(uit.ok).toBe(true);
    if (!uit.ok) return;
    expect(klok(uit.patch.start_time)).toBe('10/9 16:00');
  });

  it('houdt de lesduur aan en rekent hem niet opnieuw uit', () => {
    // Een les van negentig minuten blijft negentig minuten, ook als de club op zestig staat:
    // die duur is ooit bewust zo gezet.
    const lang: TeVerzettenLes = { ...les, start_time: op(9, 16), end_time: op(9, 17, 30) };
    const uit = verzetPlan(lang, { dag: '2026-09-10', beginuur: '09:00' }, leeg);
    expect(uit.ok).toBe(true);
    if (!uit.ok) return;
    expect(klok(uit.patch.start_time)).toBe('10/9 09:00');
    expect(klok(uit.patch.end_time)).toBe('10/9 10:30');
  });

  it('laat de baan met rust als er geen andere gekozen is', () => {
    const uit = verzetPlan(les, { dag: '2026-09-10', beginuur: '16:00' }, leeg);
    expect(uit.ok).toBe(true);
    if (!uit.ok) return;
    // Geen `court_id` in de patch: wat niet verandert, hoort er niet in te staan.
    expect('court_id' in uit.patch).toBe(false);
  });

  it('neemt de nieuwe baan mee als die wél gekozen is', () => {
    // Dit is de regenbaan: hetzelfde uur, binnen in plaats van buiten.
    const uit = verzetPlan(les, { dag: '2026-09-09', beginuur: '14:00', courtId: 'c1' }, leeg);
    expect(uit.ok).toBe(true);
    if (!uit.ok) return;
    expect(uit.patch.court_id).toBe('c1');
    expect(uit.ongewijzigd).toBe(false);
  });

  it('ziet dat er niets verandert', () => {
    const uit = verzetPlan(les, { dag: '2026-09-09', beginuur: '14:00' }, leeg);
    expect(uit.ok).toBe(true);
    if (!uit.ok) return;
    expect(uit.ongewijzigd).toBe(true);
  });

  it('weigert een dag waarop de club dicht is', () => {
    // De vakantie weigert wél, anders dan een botsing: dat de club dicht is, is geen afweging.
    const vakanties: Vakantie[] = [
      { id: 'v1', naam: 'Herfstvakantie', van: '2026-09-10', tot: '2026-09-12' },
    ];
    const uit = verzetPlan(les, { dag: '2026-09-10', beginuur: '16:00' }, { ...leeg, vakanties });
    expect(uit.ok).toBe(false);
    if (uit.ok) return;
    expect(uit.reden).toContain('Herfstvakantie');
  });

  it('weigert een onbestaande dag', () => {
    // 30 februari mag niet stilletjes naar maart doorrollen.
    const uit = verzetPlan(les, { dag: '2026-02-30', beginuur: '16:00' }, leeg);
    expect(uit.ok).toBe(false);
  });

  it('weigert een onleesbaar uur', () => {
    expect(verzetPlan(les, { dag: '2026-09-10', beginuur: 'kwart over' }, leeg).ok).toBe(false);
    expect(verzetPlan(les, { dag: '2026-09-10', beginuur: '25:00' }, leeg).ok).toBe(false);
  });

  it('weigert een les met onleesbare tijden', () => {
    // Zonder leesbare tijden is de duur niet te bewaren, en een verzonnen duur is erger dan
    // een les die blijft staan waar hij stond.
    const kapot: TeVerzettenLes = { ...les, end_time: 'geen datum' };
    expect(verzetPlan(kapot, { dag: '2026-09-10', beginuur: '16:00' }, leeg).ok).toBe(false);
  });

  it('waarschuwt voor een botsing maar houdt niets tegen', () => {
    // Sinds 6 september 2026 blokkeert een overlap nooit: op Terrein 7 draaien blauw en rood
    // naast elkaar met dezelfde trainer, en dat is gewoon goed.
    const bezet: BezetBoeking[] = [{
      id: 'b2', coach_id: 'ann', court_id: 'c7',
      start_time: op(10, 16), end_time: op(10, 17), status: 'confirmed',
    }];
    const uit = verzetPlan(les, { dag: '2026-09-10', beginuur: '16:00' }, { ...leeg, bookings: bezet });
    expect(uit.ok).toBe(true);
    if (!uit.ok) return;
    expect(uit.botsing?.id).toBe('b2');
  });

  it('botst niet met zichzelf', () => {
    // De les staat nog op zijn oude moment in de lijst; zonder dit gaf élke verzetting een
    // waarschuwing over de les die je aan het verzetten bent.
    const zichzelf: BezetBoeking[] = [{
      id: 'b1', coach_id: 'ann', court_id: 'c7',
      start_time: op(9, 14), end_time: op(9, 15), status: 'confirmed',
    }];
    const uit = verzetPlan(les, { dag: '2026-09-09', beginuur: '14:30' }, { ...leeg, bookings: zichzelf });
    expect(uit.ok).toBe(true);
    if (!uit.ok) return;
    expect(uit.botsing).toBeNull();
  });

  it('telt een geannuleerde les niet als botsing', () => {
    const bezet: BezetBoeking[] = [{
      id: 'b2', coach_id: 'ann', court_id: 'c7',
      start_time: op(10, 16), end_time: op(10, 17), status: 'cancelled',
    }];
    const uit = verzetPlan(les, { dag: '2026-09-10', beginuur: '16:00' }, { ...leeg, bookings: bezet });
    expect(uit.ok).toBe(true);
    if (!uit.ok) return;
    expect(uit.botsing).toBeNull();
  });
});
