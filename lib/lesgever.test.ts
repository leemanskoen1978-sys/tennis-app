import { lesgeverId } from './lesgever';
import type { Booking, User } from './types';

const trainerVast: User = {
  id: 'u-vast', name: 'Vaste Trainer', role: 'coach', hourly_rate: 20, email: 'v@x.be',
};
const trainerVervanger: User = {
  id: 'u-vervanger', name: 'Vervanger', role: 'coach', hourly_rate: 30, email: 'w@x.be',
};

const les = (patch: Partial<Booking> = {}): Booking => ({
  id: 'b-1', player_id: 'p-1', coach_id: trainerVast.id, court_id: 'c-1',
  start_time: '2026-09-10T10:00:00.000Z', end_time: '2026-09-10T11:00:00.000Z',
  status: 'confirmed', payment_method: 'cash', ...patch,
});

describe('lesgeverId', () => {
  it('geeft de vaste trainer als er geen vervanger ingevuld is', () => {
    // Leeg betekent "de vaste trainer gaf hem zelf": zonder die regel zou elke bestaande
    // les zonder lesgever uit het loon vallen op de dag dat het veld erbij kwam.
    expect(lesgeverId(les())).toBe(trainerVast.id);
  });

  it('geeft de vervanger zodra die ingevuld is', () => {
    expect(lesgeverId(les({ taught_by_id: trainerVervanger.id }))).toBe(trainerVervanger.id);
  });

  it('laat coach_id ongemoeid — de les blijft van de vaste trainer', () => {
    // De vraag "wie gaf hem" mag het antwoord op "van wie is hij" nooit overschrijven:
    // anders verdwijnt de les uit de agenda en het rooster van de vaste trainer.
    const vervangen = les({ taught_by_id: trainerVervanger.id });
    const kopie = { ...vervangen };
    lesgeverId(vervangen);
    expect(vervangen).toEqual(kopie);
    expect(vervangen.coach_id).toBe(trainerVast.id);
  });
});
