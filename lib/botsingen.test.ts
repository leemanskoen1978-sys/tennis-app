// Dezelfde tijdzone als de rest van de lessentests: de club staat in Brussel, en een zin die
// een uur noemt hoort dat uur lokaal te noemen.
process.env.TZ = 'Europe/Brussels';

import { botsingRegels, botsingSoort, botsingTekst, type BotsingNamen } from './botsingen';
import type { BezetBoeking } from './recurrence';

function iso(dag: number, uur: number): string {
  return new Date(2026, 8, dag, uur, 0, 0, 0).toISOString();
}

/** Een bestaande les van trainer `u-ann` op terrein `c7`, woensdag 9 september 14:00–15:00. */
function les(over: Partial<BezetBoeking> = {}): BezetBoeking {
  return {
    id: 'blauw-gr1', coach_id: 'u-ann', court_id: 'c7',
    start_time: iso(9, 14), end_time: iso(9, 15), status: 'confirmed', ...over,
  };
}

// De echte namen van het geval waarvoor deze module bestaat: het kleutertennis op Terrein 7.
const NAMEN: BotsingNamen = {
  trainers: [{ id: 'u-ann', name: 'Devries Ann' }, { id: 'u-lasoen', name: 'Lasoen Bart' }],
  banen: [{ id: 'c7', name: 'Terrein 7' }, { id: 'c8', name: 'Terrein 8' }],
};

/** Dezelfde botsing, maar de club kent die trainer en dat terrein niet meer. */
const NAMEN_LEEG: BotsingNamen = { trainers: [], banen: [] };

describe('botsingSoort', () => {
  it('noemt het een trainerbotsing als alleen de trainer samenvalt', () => {
    expect(botsingSoort(les({ court_id: 'c8' }), { coachId: 'u-ann', courtId: 'c7' }))
      .toBe('trainer');
  });

  it('noemt het een baanbotsing als alleen de baan samenvalt', () => {
    expect(botsingSoort(les({ coach_id: 'u-lasoen' }), { coachId: 'u-ann', courtId: 'c7' }))
      .toBe('baan');
  });

  it('noemt het allebei als trainer én baan samenvallen', () => {
    // Dit is het echte geval: Devries Ann draait blauw en rood naast elkaar op Terrein 7.
    expect(botsingSoort(les(), { coachId: 'u-ann', courtId: 'c7' })).toBe('beide');
  });

  it('is een trainerbotsing zodra er geen baan gevraagd is', () => {
    // Zo stelt het reeksscherm de vraag: de baan staat daar nog niet vast.
    expect(botsingSoort(les(), { coachId: 'u-ann' })).toBe('trainer');
  });

  it('laat niets weg als geen van beide blijkt te passen', () => {
    // Kan niet gebeuren met een boeking die echt uit `botstMet` komt; als het toch gebeurt is
    // de volledige melding het eerlijkste antwoord, en niet de helft.
    expect(botsingSoort(les({ coach_id: 'u-x', court_id: 'c9' }), { coachId: 'u-ann', courtId: 'c7' }))
      .toBe('beide');
  });
});

describe('botsingTekst', () => {
  it('noemt de trainer en het uur van de bestaande les', () => {
    expect(botsingTekst(les({ court_id: 'c8' }), { coachId: 'u-ann', courtId: 'c7' }, NAMEN))
      .toBe('Devries Ann geeft dan al een andere les op wo 09 sep · 14:00–15:00.');
  });

  it('noemt het terrein als de botsing daar zit', () => {
    expect(botsingTekst(les({ coach_id: 'u-lasoen' }), { coachId: 'u-ann', courtId: 'c7' }, NAMEN))
      .toBe('Terrein 7: daar staat al een les op wo 09 sep · 14:00–15:00.');
  });

  it('noemt allebei als de trainer én het terrein samenvallen', () => {
    expect(botsingTekst(les(), { coachId: 'u-ann', courtId: 'c7' }, NAMEN))
      .toBe('Devries Ann staat dan al op Terrein 7, op wo 09 sep · 14:00–15:00.');
  });

  it('gebruikt het uur van de bestaande les en niet dat van de nieuwe', () => {
    // Bij het kleutertennis vallen ze samen, maar een les van 60 minuten over een les van 30
    // heen is juist het geval waar de beheerder dat verschil wil zien.
    const kort = les({ start_time: iso(9, 14), end_time: iso(9, 14) });
    expect(botsingTekst(kort, { coachId: 'u-ann' }, NAMEN)).toContain('14:00–14:00');
  });

  it('valt terug op een omschrijving als de naam niet te vinden is', () => {
    // Een trainer die uit de club verdween mag geen leeg vakje in de melding achterlaten.
    expect(botsingTekst(les({ court_id: 'c8' }), { coachId: 'u-ann', courtId: 'c7' }, NAMEN_LEEG))
      .toContain('een andere trainer');
    expect(botsingTekst(les({ coach_id: 'u-lasoen' }), { coachId: 'u-ann', courtId: 'c7' }, NAMEN_LEEG))
      .toContain('een ander terrein');
  });

  it('werkt zonder namenlijst, zonder te gooien', () => {
    expect(botsingTekst(les(), { coachId: 'u-ann', courtId: 'c7' })).toContain('wo 09 sep');
  });
});


describe('botsingRegels', () => {
  const vraag = { coachId: 'u-ann', courtId: 'c7' };

  it('geeft niets terug als er niets botst', () => {
    expect(botsingRegels([], vraag, NAMEN)).toEqual([]);
  });

  it('ontdubbelt op de andere les: twaalf weken met dezelfde buurgroep is één regel', () => {
    const twaalf = Array.from({ length: 12 }, () => ({ conflict: les() }));
    expect(botsingRegels(twaalf, vraag, NAMEN)).toHaveLength(1);
  });

  it('houdt twee verschillende buurlessen apart, in de volgorde waarin ze binnenkwamen', () => {
    const regels = botsingRegels([
      { conflict: les({ id: 'blauw', coach_id: 'u-lasoen' }) },
      { conflict: les({ id: 'rood', court_id: 'c8' }) },
    ], vraag, NAMEN);
    expect(regels).toEqual([
      'Terrein 7: daar staat al een les op wo 09 sep · 14:00–15:00.',
      'Devries Ann geeft dan al een andere les op wo 09 sep · 14:00–15:00.',
    ]);
  });
});
