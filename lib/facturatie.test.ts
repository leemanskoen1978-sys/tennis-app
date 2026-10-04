import {
  magFactureren, schoon, sleutelVan, rond2, plusDagen, MAANDNAMEN, urenVan,
  type Factuurles,
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
    sleutel: 'GANTOISE|DUOLES - GROEP 4|WO 09/09/2026 14:00 - 15:00',
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
});

describe('rond2', () => {
  it('rondt af op twee decimalen', () => {
    expect(rond2(1.005)).toBe(1.01);
    expect(rond2(33 * 1.5)).toBe(49.5);
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
});
