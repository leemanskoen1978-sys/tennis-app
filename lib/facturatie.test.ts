import { readFileSync } from 'fs';
import { join } from 'path';
import { leesPlaktekst } from './facturatie-plak';
import {
  magFactureren, schoon, sleutelVan, rond2, plusDagen, MAANDNAMEN, urenVan,
  urenPerClub, urenUitApp, onbekendeClubs,
  type Factuurles, type Klant, type AppBoeking,
} from './facturatie';

/** Een geplakte les met alleen de velden die de test nodig heeft ingevuld. */
function les(velden: Partial<Factuurles>): Factuurles {
  return {
    id: 'l1',
    bron: 'geplakt',
    club_tekst: 'GANTOISE',
    aanbod: '',
    doelgroep: '',
    groep: 'Duoles - Groep 4',
    dag_uur: 'wo 09/09/2026 14:00 - 15:00',
    trainer: 'Leemans Koen',
    status: '',
    datum: '2026-09-09',
    uren: 1,
    uren_handmatig: null,
    actief: true,
    naam_prive: '',
    type_prive: '',
    sleutel: sleutelVan('GANTOISE', 'Duoles - Groep 4', 'wo 09/09/2026 14:00 - 15:00'),
    ...velden,
  };
}

describe('magFactureren', () => {
  it('laat het adres van Koen door, in elke schrijfwijze', () => {
    expect(magFactureren('leemanskoen@telenet.be')).toBe(true);
    expect(magFactureren('  Leemanskoen@Telenet.BE ')).toBe(true);
  });

  it('houdt elk ander adres tegen', () => {
    expect(magFactureren('trainer@trainer.be')).toBe(false);
    expect(magFactureren('')).toBe(false);
    expect(magFactureren(null)).toBe(false);
    expect(magFactureren(undefined)).toBe(false);
  });
});

describe('schoon', () => {
  it('haalt spaties aan de randen weg en knijpt dubbele spaties samen', () => {
    expect(schoon('  T.C.   RACSO ')).toBe('T.C. RACSO');
  });

  it('negeert hoofdletters', () => {
    expect(schoon('t.c. racso')).toBe('T.C. RACSO');
  });

  it('behandelt een tab als een spatie — zo komt tekst uit Excel binnen', () => {
    expect(schoon('T.C.\tRACSO')).toBe('T.C. RACSO');
  });
});

describe('sleutelVan', () => {
  it('maakt dezelfde sleutel van dezelfde les, hoe hij ook getypt staat', () => {
    expect(sleutelVan(' gantoise ', 'Duoles - Groep 4', 'wo 09/09/2026 14:00 - 15:00'))
      .toBe(sleutelVan('GANTOISE', 'DUOLES - GROEP 4', 'WO 09/09/2026 14:00 - 15:00'));
  });

  it('houdt twee verschillende groepen uit elkaar', () => {
    expect(sleutelVan('GANTOISE', 'Groep 4', 'wo 09/09/2026 14:00 - 15:00'))
      .not.toBe(sleutelVan('GANTOISE', 'Groep 5', 'wo 09/09/2026 14:00 - 15:00'));
  });

  it('botst niet als een veld zelf een scheidingsteken bevat', () => {
    expect(sleutelVan('A|B', 'C', 'D')).not.toBe(sleutelVan('A', 'B|C', 'D'));
  });
});

describe('rond2', () => {
  it('rondt af op twee decimalen', () => {
    expect(rond2(1.005)).toBe(1.01);
    expect(rond2(33 * 1.5)).toBe(49.5);
  });

  it('rondt een half naar boven, ook waar het binaire getal er net onder ligt', () => {
    expect(rond2(35.855)).toBe(35.86);
    expect(rond2(5.015)).toBe(5.02);
  });

  it('laat een bedrag dat al klopt met rust', () => {
    expect(rond2(248)).toBe(248);
    expect(rond2(31 * 8)).toBe(248);
  });

  it('rondt een negatief half getal van nul weg', () => {
    expect(rond2(-1.005)).toBe(-1.01);
  });
});

describe('plusDagen', () => {
  it('telt vijftien dagen op bij een factuurdatum', () => {
    expect(plusDagen('2026-10-01', 15)).toBe('2026-10-16');
  });

  it('gaat over de maandgrens', () => {
    expect(plusDagen('2026-10-25', 15)).toBe('2026-11-09');
  });

  it('gaat over de jaargrens', () => {
    expect(plusDagen('2026-12-28', 15)).toBe('2027-01-12');
  });

  it('kan ook achteruit', () => {
    expect(plusDagen('2026-01-03', -5)).toBe('2025-12-29');
  });
});

describe('MAANDNAMEN', () => {
  it('begint bij januari en eindigt bij december', () => {
    expect(MAANDNAMEN).toHaveLength(12);
    expect(MAANDNAMEN[0]).toBe('Januari');
    expect(MAANDNAMEN[8]).toBe('September');
    expect(MAANDNAMEN[11]).toBe('December');
  });
});

describe('urenVan', () => {
  it('neemt de gerekende uren als er niets met de hand gezet is', () => {
    expect(urenVan(les({ uren: 1.5 }))).toBe(1.5);
  });

  it('laat een handmatig getal voorgaan, ook als dat nul is', () => {
    expect(urenVan(les({ uren: 1, uren_handmatig: 0.5 }))).toBe(0.5);
    expect(urenVan(les({ uren: 1, uren_handmatig: 0 }))).toBe(0);
  });

  it('geeft nul als er niets gerekend is en niets gezet', () => {
    expect(urenVan(les({ uren: 0, uren_handmatig: null }))).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// De echte lijst uit het clubsysteem. Zie lib/__fixtures__/LEESMIJ.md.
// ---------------------------------------------------------------------------

const PLAKTEKST = readFileSync(
  join(__dirname, '__fixtures__', 'facturatie-plaktekst.txt'),
  'utf-8',
);

/** De 69 lessen uit het voorbeeldbestand, als rijen zoals ze in de databank staan. */
function voorbeeldLessen(): Factuurles[] {
  return leesPlaktekst(PLAKTEKST).lessen.map((l, i) => ({
    ...l,
    id: `l${i}`,
    uren_handmatig: null,
    actief: true,
    naam_prive: '',
    type_prive: '',
  }));
}

function klant(velden: Partial<Klant>): Klant {
  return {
    id: 'k1',
    klantnaam: 'VZW Racso',
    adres: 'Graaf Wickmanstraat 16',
    postcode_gemeente: '9070 Destelbergen',
    btw_nummer: 'BE0418482744',
    uurtarief: 31,
    korte_naam: 'Racso',
    naam_in_lijst: 'T.C. RACSO',
    btw_percentage: 0,
    bron_voorkeur: 'geplakt',
    volgorde: 2,
    ...velden,
  };
}

const GANTOISE = klant({
  id: 'k0', klantnaam: 'VZW Gantoise', uurtarief: 33, korte_naam: 'Gantoise',
  naam_in_lijst: 'GANTOISE', bron_voorkeur: 'app', volgorde: 1,
});
const RACSO = klant({});

describe('urenPerClub', () => {
  it('leest het voorbeeldbestand uit zonder overgeslagen regels', () => {
    const gelezen = leesPlaktekst(PLAKTEKST);
    expect(gelezen.overgeslagen).toEqual([]);
    expect(gelezen.lessen).toHaveLength(69);
  });

  it('geeft Gantoise 35 uur in september 2026 — het getal uit facturen.xlsx', () => {
    const uit = urenPerClub(voorbeeldLessen(), [GANTOISE, RACSO], 9, 2026);
    expect(uit.find((r) => r.klant.id === 'k0')?.urenGeplakt).toBe(35);
  });

  it('geeft Racso 0 uur in september en 9 uur in oktober 2026', () => {
    const lessen = voorbeeldLessen();
    expect(urenPerClub(lessen, [RACSO], 9, 2026)[0].urenGeplakt).toBe(0);
    expect(urenPerClub(lessen, [RACSO], 10, 2026)[0].urenGeplakt).toBe(9);
  });

  it('geeft Gantoise 25 uur in oktober 2026', () => {
    expect(urenPerClub(voorbeeldLessen(), [GANTOISE], 10, 2026)[0].urenGeplakt).toBe(25);
  });

  it('matcht de clubnaam ongeacht hoofdletters en dubbele spaties', () => {
    const soepel = klant({ naam_in_lijst: '  t.c.   racso ' });
    expect(urenPerClub(voorbeeldLessen(), [soepel], 10, 2026)[0].urenGeplakt).toBe(9);
  });

  it('matcht NIET op een deel van de naam — "RACSO" is niet "T.C. RACSO"', () => {
    const fout = klant({ naam_in_lijst: 'RACSO' });
    expect(urenPerClub(voorbeeldLessen(), [fout], 10, 2026)[0].urenGeplakt).toBe(0);
  });

  it('laat een geschrapte les wegvallen', () => {
    const lessen = voorbeeldLessen();
    const eerste = lessen.findIndex((l) => l.datum.startsWith('2026-09'));
    lessen[eerste] = { ...lessen[eerste], actief: false };
    expect(urenPerClub(lessen, [GANTOISE], 9, 2026)[0].urenGeplakt).toBe(34);
  });

  it('laat handmatige uren voorgaan', () => {
    const lessen = voorbeeldLessen();
    const eerste = lessen.findIndex((l) => l.datum.startsWith('2026-09'));
    lessen[eerste] = { ...lessen[eerste], uren_handmatig: 0.5 };
    expect(urenPerClub(lessen, [GANTOISE], 9, 2026)[0].urenGeplakt).toBe(34.5);
  });

  it('telt privélessen apart, op de korte naam van de klant', () => {
    const lessen: Factuurles[] = [...voorbeeldLessen(), {
      id: 'p1', bron: 'prive', club_tekst: 'Racso', aanbod: '', doelgroep: '', groep: '',
      dag_uur: '', trainer: '', status: '', datum: '2026-10-05', uren: 1,
      uren_handmatig: null, actief: true, naam_prive: 'Stan', type_prive: 'sponsor',
      sleutel: 'p1',
    }];
    const uit = urenPerClub(lessen, [RACSO], 10, 2026)[0];
    expect(uit.urenGeplakt).toBe(9);
    expect(uit.urenPrive).toBe(1);
  });

  it('houdt de volgorde van de klanten aan', () => {
    const uit = urenPerClub(voorbeeldLessen(), [RACSO, GANTOISE], 10, 2026);
    expect(uit.map((r) => r.klant.id)).toEqual(['k0', 'k1']);
  });

  it('laat bij gelijke volgorde de binnengekomen volgorde staan', () => {
    const a = klant({ id: 'a', volgorde: 1 });
    const b = klant({ id: 'b', volgorde: 1 });
    expect(urenPerClub([], [a, b], 10, 2026).map((r) => r.klant.id)).toEqual(['a', 'b']);
    expect(urenPerClub([], [b, a], 10, 2026).map((r) => r.klant.id)).toEqual(['b', 'a']);
  });

  it('telt een les op de eerste en op de laatste dag van de maand mee', () => {
    const lessen = voorbeeldLessen().slice(0, 1).map((l, i) => ({
      ...l, id: `r${i}`, club_tekst: 'T.C. RACSO', datum: '2026-09-01',
    }));
    lessen.push({ ...lessen[0], id: 'r-laatst', datum: '2026-09-30', sleutel: 'r-laatst' });
    expect(urenPerClub(lessen, [RACSO], 9, 2026)[0].urenGeplakt).toBe(2);
  });

  it('negeert een klant waarvan de naam in de lijst nog niet ingevuld is', () => {
    // Zo maakt het instellingenscherm een nieuwe club aan: alle velden leeg.
    const nieuw = klant({ id: 'leeg', naam_in_lijst: '', korte_naam: '' });
    const blanco = voorbeeldLessen().slice(0, 1).map((l) => ({ ...l, club_tekst: '' }));
    expect(urenPerClub(blanco, [nieuw], 9, 2026)[0].urenGeplakt).toBe(0);
  });

  it('telt dezelfde lessen bij twee klanten met dezelfde naam — het scherm waarschuwt', () => {
    const tweeling = klant({ id: 'k2', naam_in_lijst: 'T.C. RACSO', volgorde: 3 });
    const uit = urenPerClub(voorbeeldLessen(), [RACSO, tweeling], 10, 2026);
    expect(uit.map((r) => r.urenGeplakt)).toEqual([9, 9]);
  });
});

describe('onbekendeClubs', () => {
  it('meldt de clubs die bij geen enkele klant uitkomen', () => {
    expect(onbekendeClubs(voorbeeldLessen(), [GANTOISE], 10, 2026))
      .toEqual([{ naam: 'T.C. RACSO', aantal: 9 }]);
  });

  it('zwijgt als elke club gekend is', () => {
    expect(onbekendeClubs(voorbeeldLessen(), [GANTOISE, RACSO], 10, 2026)).toEqual([]);
  });

  it('kijkt alleen naar de gevraagde maand', () => {
    expect(onbekendeClubs(voorbeeldLessen(), [GANTOISE], 9, 2026)).toEqual([]);
  });

  it('meldt een lege clubnaam in plaats van hem te verzwijgen', () => {
    const nieuw = klant({ id: 'leeg', naam_in_lijst: '' });
    const blanco = voorbeeldLessen().slice(0, 1).map((l) => ({ ...l, club_tekst: '' }));
    expect(onbekendeClubs(blanco, [nieuw], 9, 2026)).toEqual([{ naam: '(leeg)', aantal: 1 }]);
  });
});

describe('urenUitApp', () => {
  function boeking(velden: Partial<AppBoeking>): AppBoeking {
    return {
      coach_id: 'koen',
      start_time: '2026-09-09T14:00:00.000Z',
      end_time: '2026-09-09T15:00:00.000Z',
      status: 'confirmed',
      ...velden,
    };
  }

  it('telt de lessen van de gevraagde trainer in de gevraagde maand', () => {
    expect(urenUitApp([boeking({}), boeking({})], 'koen', 9, 2026)).toBe(2);
  });

  it('telt een les van anderhalf uur als 1,50', () => {
    const lang = boeking({ end_time: '2026-09-09T15:30:00.000Z' });
    expect(urenUitApp([lang], 'koen', 9, 2026)).toBe(1.5);
  });

  it('telt een les van een andere trainer niet mee', () => {
    expect(urenUitApp([boeking({ coach_id: 'ann' })], 'koen', 9, 2026)).toBe(0);
  });

  it('telt een les mee die hij van een collega overnam', () => {
    const overgenomen = boeking({ coach_id: 'ann', taught_by_id: 'koen' });
    expect(urenUitApp([overgenomen], 'koen', 9, 2026)).toBe(1);
  });

  it('telt een les niet mee die hij liet overnemen', () => {
    const afgestaan = boeking({ coach_id: 'koen', taught_by_id: 'ann' });
    expect(urenUitApp([afgestaan], 'koen', 9, 2026)).toBe(0);
  });

  it('telt een afgezegde les niet mee', () => {
    expect(urenUitApp([boeking({ status: 'cancelled' })], 'koen', 9, 2026)).toBe(0);
  });

  it('telt een les uit een andere maand niet mee', () => {
    const okt = boeking({
      start_time: '2026-10-07T14:00:00.000Z', end_time: '2026-10-07T15:00:00.000Z',
    });
    expect(urenUitApp([okt], 'koen', 9, 2026)).toBe(0);
  });

  it('slikt een boeking met een onleesbaar tijdstip in plaats van NaN terug te geven', () => {
    expect(urenUitApp([boeking({ end_time: 'later' })], 'koen', 9, 2026)).toBe(0);
  });

  it('rekent een les die over middernacht de maand uit loopt bij de maand van de start', () => {
    const overMiddernacht = boeking({
      start_time: new Date(2026, 8, 30, 23, 30).toISOString(),
      end_time: new Date(2026, 9, 1, 0, 30).toISOString(),
    });
    expect(urenUitApp([overMiddernacht], 'koen', 9, 2026)).toBe(1);
    expect(urenUitApp([overMiddernacht], 'koen', 10, 2026)).toBe(0);
  });
});
