import {
  leesRol, leesUurtarief, leesKopregel, LEDEN_KOPPEN, planImport, voorbeeldLedenCsv,
} from './import-leden';
import { parseCsv } from './csv';
import type { User } from './types';

describe('leesRol', () => {
  it('vertaalt de Nederlandse rolnamen naar wat de databank kent', () => {
    expect(leesRol('speler')).toBe('player');
    expect(leesRol('trainer')).toBe('coach');
    expect(leesRol('ouder')).toBe('parent');
  });

  it('trekt zich niets aan van hoofdletters en spaties', () => {
    expect(leesRol('  Trainer ')).toBe('coach');
  });

  it('neemt de Engelse namen ook aan, want zo staat het in een export', () => {
    expect(leesRol('coach')).toBe('coach');
  });

  it('maakt van een lege cel een speler — dat is verreweg het vaakst waar', () => {
    expect(leesRol('')).toBe('player');
    expect(leesRol('   ')).toBe('player');
  });

  it('weigert een rol die niet bestaat, in plaats van er speler van te maken', () => {
    expect(leesRol('hoofdtrainer')).toBeNull();
  });

  it('trapt niet in prototype-namen als "constructor" of "__proto__"', () => {
    expect(leesRol('constructor')).toBeNull();
    expect(leesRol('__proto__')).toBeNull();
  });
});

describe('leesUurtarief', () => {
  it('leest een bedrag met een komma, want zo schrijft Excel het hier', () => {
    expect(leesUurtarief('45,50')).toBe(45.5);
  });

  it('leest een bedrag met een punt ook', () => {
    expect(leesUurtarief('45.50')).toBe(45.5);
  });

  it('laat een euroteken en spaties weg', () => {
    expect(leesUurtarief(' € 45 ')).toBe(45);
  });

  it('geeft undefined bij een lege cel — geen tarief is iets anders dan nul', () => {
    expect(leesUurtarief('')).toBeUndefined();
  });

  it('weigert wat geen getal is', () => {
    expect(leesUurtarief('veel')).toBeNull();
  });

  it('laat nul gewoon nul zijn — dat is een geldig tarief', () => {
    expect(leesUurtarief('0')).toBe(0);
  });

  it('weigert een negatief bedrag, in plaats van de club geld te laten toeleggen', () => {
    expect(leesUurtarief('-45')).toBeNull();
  });

  it('rondt af op centen, net als de rest van de app', () => {
    expect(leesUurtarief('12,999')).toBe(13);
  });
});

describe('leesKopregel', () => {
  it('vindt de kolommen ongeacht volgorde en hoofdletters', () => {
    expect(leesKopregel(['Email', 'NAAM'])).toStrictEqual({
      kolommen: { naam: 1, email: 0 },
      nietHerkend: [],
      dubbel: [],
    });
  });

  it('neemt de gangbare andere schrijfwijzen aan', () => {
    expect(leesKopregel(['naam', 'e-mail', 'gsm'])).toStrictEqual({
      kolommen: { naam: 0, email: 1, telefoon: 2 },
      nietHerkend: [],
      dubbel: [],
    });
  });

  it('neemt schrijfwijzen met een spatie erin ook aan', () => {
    expect(leesKopregel(['naam', 'E mail', 'Uur tarief', 'Telefoon nummer'])).toStrictEqual({
      kolommen: { naam: 0, email: 1, uurtarief: 2, telefoon: 3 },
      nietHerkend: [],
      dubbel: [],
    });
  });

  it('neemt de Belgische schrijfwijze "e-mailadres" ook aan', () => {
    expect(leesKopregel(['naam', 'E-mailadres'])).toStrictEqual({
      kolommen: { naam: 0, email: 1 },
      nietHerkend: [],
      dubbel: [],
    });
  });

  it('geeft kolommen: null als een verplichte kolom ontbreekt, maar behoudt wat wél gezien is', () => {
    expect(leesKopregel(['naam', 'telefoon'])).toStrictEqual({
      kolommen: null,
      nietHerkend: [],
      dubbel: [],
    });
    expect(leesKopregel(['email'])).toStrictEqual({
      kolommen: null,
      nietHerkend: [],
      dubbel: [],
    });
  });

  it('geeft de niet-herkende koppen ook mee als de verplichte kolom ontbreekt — juist dan is het nuttig', () => {
    expect(leesKopregel(['Naam', 'E-mailadres', 'Tarief/uur'])).toStrictEqual({
      // 'E-mailadres' is met punt 1 een herkende schrijfwijze geworden, dus dit voorbeeld
      // ontbreekt hier niet aan email — de kernvraag is dat nietHerkend niet verdwijnt.
      kolommen: { naam: 0, email: 1 },
      nietHerkend: ['Tarief/uur'],
      dubbel: [],
    });
    expect(leesKopregel(['Naam', 'Tarief/uur'])).toStrictEqual({
      kolommen: null,
      nietHerkend: ['Tarief/uur'],
      dubbel: [],
    });
  });

  it('laat de eerste kolom winnen als een naam dubbel voorkomt, en meldt de tweede apart', () => {
    expect(leesKopregel(['naam', 'email', 'e-mail'])).toStrictEqual({
      kolommen: { naam: 0, email: 1 },
      nietHerkend: [],
      dubbel: ['e-mail'],
    });
  });

  it('stoort zich niet aan een lege kop', () => {
    expect(leesKopregel(['naam', '', 'email'])).toStrictEqual({
      kolommen: { naam: 0, email: 2 },
      nietHerkend: [],
      dubbel: [],
    });
  });

  it('kent de koppen van het voorbeeldbestand allemaal', () => {
    expect(leesKopregel([...LEDEN_KOPPEN])).toStrictEqual({
      kolommen: { naam: 0, email: 1, rol: 2, telefoon: 3, uurtarief: 4 },
      nietHerkend: [],
      dubbel: [],
    });
  });

  it('geeft een niet-herkende kop terug zoals hij in het bestand staat, buitenste spaties eraf', () => {
    expect(leesKopregel(['naam', 'email', '  Tarief/uur  '])).toStrictEqual({
      kolommen: { naam: 0, email: 1 },
      nietHerkend: ['Tarief/uur'],
      dubbel: [],
    });
  });

  it('telt een lege kop niet mee als niet-herkend', () => {
    expect(leesKopregel(['naam', 'email', '', '  '])).toStrictEqual({
      kolommen: { naam: 0, email: 1 },
      nietHerkend: [],
      dubbel: [],
    });
  });
});

const lid = (id: string, email: string, extra: Partial<User> = {}): User => ({
  id, name: 'Bestaand', email, role: 'player', ...extra,
});

const kop = ['naam', 'email', 'rol', 'telefoon', 'uurtarief'];

describe('planImport', () => {
  it('zet een onbekend adres bij de nieuwe leden', () => {
    const plan = planImport([kop, ['Jonas Peeters', 'jonas@club.be', 'speler', '0470123456', '']], []);
    expect(plan.fouten).toEqual([]);
    expect(plan.bijgewerkt).toEqual([]);
    expect(plan.nieuw).toEqual([
      { name: 'Jonas Peeters', email: 'jonas@club.be', role: 'player', phone: '0470123456' },
    ]);
  });

  it('neemt het uurtarief mee bij een trainer', () => {
    const plan = planImport([kop, ['Sofie Maes', 'sofie@club.be', 'trainer', '', '45']], []);
    expect(plan.nieuw[0]).toEqual({
      name: 'Sofie Maes', email: 'sofie@club.be', role: 'coach', hourly_rate: 45,
    });
  });

  it('herkent een bestaand lid op adres, ongeacht hoofdletters', () => {
    const bestaande = [lid('u1', 'jonas@club.be')];
    const plan = planImport([kop, ['Jonas Peeters', 'JONAS@club.be', 'speler', '0470', '']], bestaande);
    expect(plan.nieuw).toEqual([]);
    expect(plan.bijgewerkt).toEqual([
      { bestaand: bestaande[0], wijzigingen: { name: 'Jonas Peeters', phone: '0470' } },
    ]);
  });

  it('laat een bestaand lid dat niets nieuws meebrengt helemaal met rust', () => {
    const bestaande = [lid('u1', 'jonas@club.be', { name: 'Jonas', phone: '0470' })];
    const plan = planImport([kop, ['Jonas', 'jonas@club.be', 'speler', '0470', '']], bestaande);
    expect(plan.bijgewerkt).toEqual([]);
    expect(plan.nieuw).toEqual([]);
    expect(plan.fouten).toEqual([]);
  });

  it('overschrijft een ingevuld veld niet met een lege cel', () => {
    const bestaande = [lid('u1', 'jonas@club.be', { name: 'Jonas', phone: '0470' })];
    const plan = planImport([kop, ['Jonas', 'jonas@club.be', '', '', '']], bestaande);
    expect(plan.bijgewerkt).toEqual([]);
  });

  it('weigert een regel waarvan de rol niet klopt met wat de club al weet', () => {
    const bestaande = [lid('u1', 'jonas@club.be')];
    const plan = planImport([kop, ['Jonas', 'jonas@club.be', 'trainer', '', '']], bestaande);
    expect(plan.bijgewerkt).toEqual([]);
    expect(plan.fouten).toEqual([
      { regel: 2, reden: 'Staat al in de club met een andere rol; dat wijzig je in Beheer.' },
    ]);
  });

  it('weigert een regel zonder naam of met een adres dat er geen is', () => {
    const plan = planImport([
      kop,
      ['', 'leeg@club.be', '', '', ''],
      ['Zonder adres', '', '', '', ''],
      ['Krom adres', 'jonas apenstaartje club', '', '', ''],
    ], []);
    expect(plan.nieuw).toEqual([]);
    expect(plan.fouten).toEqual([
      { regel: 2, reden: 'Geen naam ingevuld.' },
      { regel: 3, reden: 'Geen e-mailadres ingevuld.' },
      { regel: 4, reden: 'Dit is geen geldig e-mailadres.' },
    ]);
  });

  it('weigert een onbekende rol en een onleesbaar tarief, met de regel erbij', () => {
    const plan = planImport([
      kop,
      ['Jonas', 'jonas@club.be', 'hoofdtrainer', '', ''],
      ['Sofie', 'sofie@club.be', 'trainer', '', 'veel'],
    ], []);
    expect(plan.nieuw).toEqual([]);
    expect(plan.fouten).toEqual([
      { regel: 2, reden: 'Onbekende rol "hoofdtrainer". Kies speler, trainer of ouder.' },
      { regel: 3, reden: 'Het uurtarief "veel" is geen geldig bedrag.' },
    ]);
  });

  it('weigert een negatief uurtarief, want dan legt de club geld toe', () => {
    const plan = planImport([kop, ['Sofie', 'sofie@club.be', 'trainer', '', '-45']], []);
    expect(plan.nieuw).toEqual([]);
    expect(plan.fouten).toEqual([
      { regel: 2, reden: 'Het uurtarief "-45" is geen geldig bedrag.' },
    ]);
  });

  it('geeft door welke kolomkoppen het niet herkende', () => {
    const plan = planImport([
      ['naam', 'email', 'Tarief/uur'],
      ['Jonas', 'jonas@club.be', '45'],
    ], []);
    // De regel zelf gaat gewoon door; alleen die ene kolom komt niet mee.
    expect(plan.nieuw).toHaveLength(1);
    expect(plan.nieuw[0].hourly_rate).toBeUndefined();
    expect(plan.nietHerkend).toEqual(['Tarief/uur']);
  });

  it('houdt het tweede voorkomen van hetzelfde adres tegen', () => {
    const plan = planImport([
      kop,
      ['Jonas', 'jonas@club.be', '', '', ''],
      ['Jonas P', 'JONAS@club.be', '', '', ''],
    ], []);
    expect(plan.nieuw).toHaveLength(1);
    expect(plan.fouten).toEqual([
      { regel: 3, reden: 'Dit adres staat eerder in het bestand, op regel 2.' },
    ]);
  });

  it('houdt de goede regels over als er een foute tussen zit', () => {
    const plan = planImport([
      kop,
      ['Jonas', 'jonas@club.be', '', '', ''],
      ['Krom', '', '', '', ''],
      ['Sofie', 'sofie@club.be', '', '', ''],
    ], []);
    expect(plan.nieuw).toHaveLength(2);
    expect(plan.fouten).toHaveLength(1);
  });

  it('slaat een volledig lege regel stil over — een scheidingsregel is geen vergissing', () => {
    const plan = planImport([
      kop,
      ['Jonas', 'jonas@club.be', '', '', ''],
      ['', '', '', '', ''],
      ['Sofie', 'sofie@club.be', '', '', ''],
    ], []);
    expect(plan.nieuw).toHaveLength(2);
    expect(plan.fouten).toEqual([]);
  });

  it('geeft het regelnummer van de trainer, ook als er een lege regel voor stond', () => {
    // De lege regel op regel 3 mag het foutnummer van de kromme rij erna niet naar
    // beneden schuiven: dat zou naar de verkeerde regel in Excel wijzen.
    const plan = planImport([
      kop,
      ['Jonas', 'jonas@club.be', '', '', ''],
      ['', '', '', '', ''],
      ['Zonder adres', '', '', '', ''],
    ], []);
    expect(plan.fouten).toEqual([
      { regel: 4, reden: 'Geen e-mailadres ingevuld.' },
    ]);
  });

  it('zegt het als de kopregel een verplichte kolom mist', () => {
    const plan = planImport([['naam', 'telefoon'], ['Jonas', '0470']], []);
    expect(plan.nieuw).toEqual([]);
    expect(plan.fouten).toEqual([
      { regel: 1, reden: 'De kopregel mist de kolom "naam" of "email".' },
    ]);
  });

  it('houdt de niet-herkende koppen vast juist als de kopregel niet deugt', () => {
    // "E-mailadres" kent de import wél; "Tarief/uur" niet. Zou dit lijstje hier wegvallen,
    // dan leest de trainer "kolom email ontbreekt" zonder te zien wat er dan wél stond.
    const plan = planImport([['Naam', 'Rijksregisternummer', 'Tarief/uur'], ['Jonas', '', '']], []);
    expect(plan.fouten).toEqual([
      { regel: 1, reden: 'De kopregel mist de kolom "naam" of "email".' },
    ]);
    expect(plan.nietHerkend).toEqual(['Rijksregisternummer', 'Tarief/uur']);
  });

  it('zegt het als het bestand leeg is', () => {
    expect(planImport([], []).fouten).toEqual([
      { regel: 1, reden: 'Dit bestand is leeg.' },
    ]);
  });

  it('ziet een naam die alleen in hoofdletters verschilt niet als een wijziging', () => {
    const bestaande = [lid('u1', 'jonas@club.be', { name: 'Jonas Peeters' })];
    const plan = planImport([kop, ['JONAS PEETERS', 'jonas@club.be', 'speler', '', '']], bestaande);
    expect(plan.bijgewerkt).toEqual([]);
  });

  it('ziet twee schrijfwijzen van hetzelfde telefoonnummer niet als een wijziging', () => {
    const bestaande = [lid('u1', 'jonas@club.be', { phone: '0470123456' })];
    const plan = planImport(
      [kop, ['Bestaand', 'jonas@club.be', 'speler', '0470 12 34 56', '']],
      bestaande,
    );
    expect(plan.bijgewerkt).toEqual([]);
  });

  it('waarschuwt voor een nieuw lid met dezelfde naam als een bestaand lid, maar weigert het niet', () => {
    const bestaande = [lid('u1', 'jonas1@club.be', { name: 'Jonas Peeters' })];
    const plan = planImport(
      [kop, ['Jonas Peeters', 'jonas2@club.be', 'speler', '', '']],
      bestaande,
    );
    expect(plan.nieuw).toEqual([
      { name: 'Jonas Peeters', email: 'jonas2@club.be', role: 'player' },
    ]);
    expect(plan.fouten).toEqual([]);
    expect(plan.waarschuwingen).toEqual([
      { regel: 2, reden: 'Er staat al een lid met deze naam; kijk even of dit niet dezelfde persoon is.' },
    ]);
  });

  it('weigert een adres dat in de club dubbel voorkomt, in plaats van er stilletjes één te kiezen', () => {
    const bestaande = [
      lid('u1', 'jonas@club.be', { name: 'Jonas Eén' }),
      lid('u2', 'jonas@club.be', { name: 'Jonas Twee' }),
    ];
    const plan = planImport([kop, ['Jonas', 'jonas@club.be', 'speler', '', '']], bestaande);
    expect(plan.nieuw).toEqual([]);
    expect(plan.bijgewerkt).toEqual([]);
    expect(plan.fouten).toEqual([
      { regel: 2, reden: 'Er staan twee leden met dit adres in de club; los dat eerst op in Beheer.' },
    ]);
  });

  it('neemt een uurtarief niet mee bij een speler, en waarschuwt dat het wegvalt', () => {
    const plan = planImport([kop, ['Jonas', 'jonas@club.be', 'speler', '', '45']], []);
    expect(plan.nieuw).toEqual([
      { name: 'Jonas', email: 'jonas@club.be', role: 'player' },
    ]);
    expect(plan.waarschuwingen).toEqual([
      { regel: 2, reden: 'Een uurtarief hoort bij een trainer; voor een speler laat ik het weg.' },
    ]);
  });

  it('schrijft het adres van een nieuw lid genormaliseerd weg, niet zoals het bestand het typte', () => {
    const plan = planImport([kop, ['Jonas', 'JONAS@Club.be', 'speler', '', '']], []);
    expect(plan.nieuw[0].email).toBe('jonas@club.be');
  });

  it('reserveert een adres niet voor een rij die zelf al afgekeurd werd', () => {
    // De eerste rij strandt op de rol en telt dus niet als "dit adres is al gezien" —
    // de tweede rij met hetzelfde adres komt daardoor gewoon door als nieuw.
    const plan = planImport([
      kop,
      ['Jonas', 'jonas@club.be', 'hoofdtrainer', '', ''],
      ['Jonas', 'jonas@club.be', 'speler', '', ''],
    ], []);
    expect(plan.fouten).toHaveLength(1);
    expect(plan.nieuw).toEqual([
      { name: 'Jonas', email: 'jonas@club.be', role: 'player' },
    ]);
  });

  it('werkt het tarief van een bestaande trainer bij, ook zonder kolom rol', () => {
    // Geen kolom `rol` betekent niet "dit zijn spelers" — de rol van wie er al is telt,
    // niet wat een ontbrekende rolcel toevallig oplevert.
    const bestaande = [
      lid('u1', 'sofie@club.be', { name: 'Sofie Maes', role: 'coach', hourly_rate: 40 }),
      lid('u2', 'tom@club.be', { name: 'Tom Jans', role: 'coach', hourly_rate: 40 }),
    ];
    const plan = planImport([
      ['naam', 'email', 'uurtarief'],
      ['Sofie Maes', 'sofie@club.be', '50'],
      ['Tom Jans', 'tom@club.be', '55'],
    ], bestaande);
    expect(plan.fouten).toEqual([]);
    expect(plan.waarschuwingen).toEqual([]);
    expect(plan.bijgewerkt).toEqual([
      { bestaand: bestaande[0], wijzigingen: { hourly_rate: 50 } },
      { bestaand: bestaande[1], wijzigingen: { hourly_rate: 55 } },
    ]);
  });

  it('werkt het tarief van een bestaande trainer bij bij een lege rolcel', () => {
    const bestaande = [lid('u1', 'sofie@club.be', { name: 'Sofie Maes', role: 'coach', hourly_rate: 40 })];
    const plan = planImport([kop, ['Sofie Maes', 'sofie@club.be', '', '', '50']], bestaande);
    expect(plan.waarschuwingen).toEqual([]);
    expect(plan.bijgewerkt).toEqual([
      { bestaand: bestaande[0], wijzigingen: { hourly_rate: 50 } },
    ]);
  });

  it('geeft geen tariefwaarschuwing bij een rij die toch al wordt afgekeurd', () => {
    const bestaande = [
      lid('u1', 'x@club.be', { name: 'Iemand' }),
      lid('u2', 'x@club.be', { name: 'Iemand Anders' }),
    ];
    const plan = planImport([kop, ['A', 'x@club.be', 'speler', '', '45']], bestaande);
    expect(plan.fouten).toEqual([
      { regel: 2, reden: 'Er staan twee leden met dit adres in de club; los dat eerst op in Beheer.' },
    ]);
    expect(plan.waarschuwingen).toEqual([]);
  });

  it('waarschuwt bij twee nieuwe rijen met dezelfde naam in hetzelfde bestand', () => {
    const plan = planImport([
      kop,
      ['Jonas Peeters', 'jonas1@club.be', 'speler', '', ''],
      ['Jonas Peeters', 'jonas2@club.be', 'speler', '', ''],
    ], []);
    expect(plan.nieuw).toHaveLength(2);
    expect(plan.fouten).toEqual([]);
    expect(plan.waarschuwingen).toEqual([
      { regel: 3, reden: 'Er staat al een lid met deze naam; kijk even of dit niet dezelfde persoon is.' },
    ]);
  });
});

describe('voorbeeldLedenCsv', () => {
  it('levert een bestand op dat de import zelf zonder klachten leest', () => {
    const plan = planImport(parseCsv(voorbeeldLedenCsv()), []);
    expect(plan.fouten).toEqual([]);
    expect(plan.nieuw).toHaveLength(2);
  });

  it('toont een speler en een trainer, zodat beide vormen te zien zijn', () => {
    const plan = planImport(parseCsv(voorbeeldLedenCsv()), []);
    expect(plan.nieuw.map((u) => u.role)).toEqual(['player', 'coach']);
  });
});
