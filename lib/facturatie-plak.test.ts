import { leesPlaktekst, verwerkPlak, type GeplakteLes } from './facturatie-plak';
import { sleutelVan, type Factuurles } from './facturatie';

const KOP = [
  'Club', 'Aanbod', 'Doelgroep', 'Groep', 'Dag + uur', 'Trainer',
  'Aanwezigh.', 'Uur/locatie gewijzigd?', 'Status', 'Bedrag',
].join('\n');

/** Eén regel zoals hij uit het clubsysteem komt: velden gescheiden door tabs. */
function regel(club: string, groep: string, dagUur: string): string {
  return [club, 'Tennis - Jaarcyclus 2026 - 2027', 'Duoles', groep, dagUur,
    'Leemans Koen', '0/2', 'Nee', 'Te bevestigen', '0 €', ''].join('\t');
}

describe('leesPlaktekst', () => {
  it('leest een gewone regel', () => {
    const uit = leesPlaktekst(regel('GANTOISE', 'Duoles - Groep 4', 'wo 09/09/2026 14:00 - 15:00'));
    expect(uit.overgeslagen).toEqual([]);
    expect(uit.lessen).toHaveLength(1);
    expect(uit.lessen[0]).toMatchObject({
      club_tekst: 'GANTOISE',
      groep: 'Duoles - Groep 4',
      dag_uur: 'wo 09/09/2026 14:00 - 15:00',
      trainer: 'Leemans Koen',
      status: 'Te bevestigen',
      datum: '2026-09-09',
      uren: 1,
    });
  });

  it('slaat de koprij over zonder hem te melden', () => {
    const uit = leesPlaktekst(`${KOP}\n${regel('GANTOISE', 'G4', 'wo 09/09/2026 14:00 - 15:00')}`);
    expect(uit.lessen).toHaveLength(1);
    expect(uit.overgeslagen).toEqual([]);
  });

  it('slaat de koprij ook over als hij met tabs op één regel staat', () => {
    const koprij = KOP.split('\n').join('\t');
    const uit = leesPlaktekst(`${koprij}\n${regel('GANTOISE', 'G4', 'wo 09/09/2026 14:00 - 15:00')}`);
    expect(uit.lessen).toHaveLength(1);
    expect(uit.overgeslagen).toEqual([]);
  });

  it('rekent anderhalf uur uit een les van 14:00 tot 15:30', () => {
    const uit = leesPlaktekst(regel('GANTOISE', 'G4', 'wo 09/09/2026 14:00 - 15:30'));
    expect(uit.lessen[0].uren).toBe(1.5);
  });

  it('meldt een eindtijd die niet na de begintijd ligt', () => {
    const uit = leesPlaktekst(regel('GANTOISE', 'G4', 'wo 09/09/2026 15:00 - 14:00'));
    expect(uit.lessen).toEqual([]);
    expect(uit.overgeslagen).toHaveLength(1);
    expect(uit.overgeslagen[0].reden).toBe('de eindtijd ligt niet na de begintijd');
  });

  it('meldt een dag die niet bestaat', () => {
    const uit = leesPlaktekst(regel('GANTOISE', 'G4', 'wo 31/09/2026 14:00 - 15:00'));
    expect(uit.lessen).toEqual([]);
    expect(uit.overgeslagen[0].reden).toBe('die dag bestaat niet');
  });

  it('meldt een regel met te weinig velden', () => {
    const uit = leesPlaktekst('GANTOISE\tDuoles\two 09/09/2026 14:00 - 15:00');
    expect(uit.lessen).toEqual([]);
    expect(uit.overgeslagen[0].reden).toBe('minder dan vijf velden');
  });

  it('meldt een regel waarvan het vijfde veld geen dag en uur is', () => {
    const uit = leesPlaktekst(['A', 'B', 'C', 'D', 'ergens volgende week', 'F'].join('\t'));
    expect(uit.lessen).toEqual([]);
    expect(uit.overgeslagen[0].reden).toBe('geen leesbaar dag- en uurveld');
  });

  it('telt lege regels niet als overgeslagen', () => {
    const uit = leesPlaktekst(`\n   \n${regel('GANTOISE', 'G4', 'wo 09/09/2026 14:00 - 15:00')}\n\n`);
    expect(uit.lessen).toHaveLength(1);
    expect(uit.overgeslagen).toEqual([]);
  });

  it('leest regels die met \\r\\n gescheiden zijn', () => {
    const twee = [
      regel('GANTOISE', 'G4', 'wo 09/09/2026 14:00 - 15:00'),
      regel('T.C. RACSO', 'G36', 'za 03/10/2026 12:00 - 13:00'),
    ].join('\r\n');
    expect(leesPlaktekst(twee).lessen).toHaveLength(2);
  });

  it('geeft elke les een sleutel uit club, groep en dag/uur', () => {
    const uit = leesPlaktekst(regel('GANTOISE', 'Duoles - Groep 4', 'wo 09/09/2026 14:00 - 15:00'));
    expect(uit.lessen[0].sleutel)
      .toBe(sleutelVan('GANTOISE', 'Duoles - Groep 4', 'wo 09/09/2026 14:00 - 15:00'));
  });
});

describe('verwerkPlak', () => {
  function geplakt(groep: string, dagUur: string): GeplakteLes {
    return leesPlaktekst(regel('GANTOISE', groep, dagUur)).lessen[0];
  }

  it('noemt alles nieuw als er nog niets staat', () => {
    const uit = verwerkPlak([], [geplakt('G4', 'wo 09/09/2026 14:00 - 15:00')]);
    expect(uit.nieuw).toHaveLength(1);
    expect(uit.bekend).toBe(0);
  });

  it('herkent een les die al in de databank staat', () => {
    const les = geplakt('G4', 'wo 09/09/2026 14:00 - 15:00');
    const bestaand: Factuurles[] = [{
      ...les, id: 'x', uren_handmatig: null, actief: true, naam_prive: '', type_prive: '',
    }];
    const uit = verwerkPlak(bestaand, [les]);
    expect(uit.nieuw).toEqual([]);
    expect(uit.bekend).toBe(1);
  });

  it('herkent een geschrapte les ook als bekend, zodat schrappen blijft gelden', () => {
    const les = geplakt('G4', 'wo 09/09/2026 14:00 - 15:00');
    const bestaand: Factuurles[] = [{
      ...les, id: 'x', uren_handmatig: null, actief: false, naam_prive: '', type_prive: '',
    }];
    expect(verwerkPlak(bestaand, [les]).nieuw).toEqual([]);
  });

  it('houdt een dubbel binnen dezelfde plakbeurt tegen', () => {
    const les = geplakt('G4', 'wo 09/09/2026 14:00 - 15:00');
    const uit = verwerkPlak([], [les, les]);
    expect(uit.nieuw).toHaveLength(1);
    expect(uit.bekend).toBe(1);
  });
});
