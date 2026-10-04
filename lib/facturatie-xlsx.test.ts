import { factuurBlad, extraLessenBlad, factuurWerkmap, factuurBestandsnaam } from './facturatie-xlsx';
import { factuurUit, standaardKlanten, standaardLeverancier, type Factuur } from './facturatie';
import { type XlsxVrijeCel } from './xlsx';

const LEVERANCIER = standaardLeverancier('lev-1');
const [, RACSO] = standaardKlanten(['k-1', 'k-2']);

function factuur(extra: Partial<Factuur> = {}): Factuur {
  return {
    ...factuurUit({
      id: 'f1',
      klant: RACSO,
      uren: 8,
      vrijeLijnen: [],
      extraLessen: [],
      factuurnr: 'NG-0007',
      factuurdatum: '2026-10-01',
      omschrijving: 'Tennislessen September 2026',
      maand: 9,
      jaar: 2026,
      aangemaakt: '2026-10-01T09:00:00.000Z',
    }),
    ...extra,
  };
}

/** De twee extra lessen die Racso op dit moment heeft. */
const EXTRA = [
  { datum: '2026-09-07', naam: 'Stan', type: 'sponsor', uren: 1 },
  { datum: '2026-09-14', naam: 'Veerle', type: 'sponsor', uren: 1 },
];

/** De cel op die plaats, of undefined. */
function cel(cellen: readonly XlsxVrijeCel[], ref: string): XlsxVrijeCel | undefined {
  return cellen.find((c) => c.ref === ref);
}

describe('factuurBlad', () => {
  it('zet mijn gegevens linksboven', () => {
    const { cellen } = factuurBlad(factuur(), LEVERANCIER);
    expect(cel(cellen, 'B6')?.cel).toEqual({ soort: 'tekst', waarde: 'Sport4fun' });
    expect(cel(cellen, 'B8')?.cel).toEqual({ soort: 'tekst', waarde: 'BE0647703840' });
    expect(cel(cellen, 'B9')?.cel).toEqual({ soort: 'tekst', waarde: 'BE90143103210832' });
    expect(cel(cellen, 'B10')?.cel).toEqual({ soort: 'tekst', waarde: 'GEBA BE BB' });
  });

  it('zet het factuurnummer en de twee datums rechtsboven', () => {
    const { cellen } = factuurBlad(factuur(), LEVERANCIER);
    expect(cel(cellen, 'H8')?.cel).toEqual({ soort: 'tekst', waarde: 'NG-0007' });
    expect(cel(cellen, 'H7')?.cel).toEqual({ soort: 'datum', waarde: new Date(2026, 9, 1) });
    expect(cel(cellen, 'H9')?.cel).toEqual({ soort: 'datum', waarde: new Date(2026, 9, 16) });
  });

  it('zet de klant eronder, met het opschrift bij het BTW-nummer', () => {
    const { cellen } = factuurBlad(factuur(), LEVERANCIER);
    expect(cel(cellen, 'A17')?.cel).toEqual({ soort: 'tekst', waarde: 'VZW Racso' });
    expect(cel(cellen, 'A18')?.cel).toEqual({ soort: 'tekst', waarde: 'Graaf Wickmanstraat 16' });
    expect(cel(cellen, 'A19')?.cel).toEqual({ soort: 'tekst', waarde: '9070 Destelbergen' });
    expect(cel(cellen, 'A20')?.cel).toEqual({ soort: 'tekst', waarde: 'BTW nummer: BE0418482744' });
  });

  it('laat de regel met het BTW-nummer leeg als de klant er geen heeft', () => {
    const { cellen } = factuurBlad(factuur({ klant_btw: '' }), LEVERANCIER);
    expect(cel(cellen, 'A20')?.cel).toEqual({ soort: 'tekst', waarde: '' });
  });

  it('zet de urenlijn op rij 24, met de bedragen als getal', () => {
    const { cellen } = factuurBlad(factuur(), LEVERANCIER);
    expect(cel(cellen, 'A23')?.cel).toEqual({ soort: 'tekst', waarde: 'Tennislessen September 2026' });
    expect(cel(cellen, 'F24')?.cel).toEqual({ soort: 'getal', waarde: 8 });
    expect(cel(cellen, 'G24')?.cel).toEqual({ soort: 'tekst', waarde: 'uren' });
    expect(cel(cellen, 'H24')?.cel).toEqual({ soort: 'geld', waarde: 31 });
    expect(cel(cellen, 'I24')?.cel).toEqual({ soort: 'geld', waarde: 248 });
  });

  it('zet de totalen onder de laatste lijn', () => {
    const { cellen } = factuurBlad(factuur(), LEVERANCIER);
    expect(cel(cellen, 'G25')?.cel).toEqual({ soort: 'tekst', waarde: 'netto:' });
    expect(cel(cellen, 'I25')?.cel).toEqual({ soort: 'geld', waarde: 248 });
    expect(cel(cellen, 'I26')?.cel).toEqual({ soort: 'getal', waarde: 0 });
    expect(cel(cellen, 'I27')?.cel).toEqual({ soort: 'geld', waarde: 0 });
    expect(cel(cellen, 'H30')?.cel).toEqual({ soort: 'tekst', waarde: 'Te Betalen:' });
    expect(cel(cellen, 'I30')?.cel).toEqual({ soort: 'geld', waarde: 248 });
  });

  it('schuift de totalen op als er vrije lijnen zijn', () => {
    const met = factuur({
      vrije_lijnen: [
        { omschrijving: 'Verplaatsing', aantal: 2, eenheid: 'stuk', tarief: 12.5 },
        { omschrijving: 'Materiaal', aantal: 1, eenheid: 'stuk', tarief: 40 },
      ],
      netto: 313,
      totaal: 313,
    });
    const { cellen } = factuurBlad(met, LEVERANCIER);
    expect(cel(cellen, 'A25')?.cel).toEqual({ soort: 'tekst', waarde: 'Verplaatsing' });
    expect(cel(cellen, 'I25')?.cel).toEqual({ soort: 'geld', waarde: 25 });
    expect(cel(cellen, 'A26')?.cel).toEqual({ soort: 'tekst', waarde: 'Materiaal' });
    expect(cel(cellen, 'G27')?.cel).toEqual({ soort: 'tekst', waarde: 'netto:' });
    expect(cel(cellen, 'I27')?.cel).toEqual({ soort: 'geld', waarde: 313 });
  });

  it('zet de twee BTW-voetnoten en de twee opmerkingen erbij', () => {
    const { cellen } = factuurBlad(factuur(), LEVERANCIER);
    expect(cel(cellen, 'A26')?.cel).toEqual({
      soort: 'tekst',
      waarde: 'Artikel 44.2.3 vrijstelling btw exploitatie lichamelijke ontwikkeling',
    });
    expect(cel(cellen, 'A27')?.cel).toEqual({ soort: 'tekst', waarde: 'kleine onderneming' });
    expect(cel(cellen, 'A29')?.cel).toEqual({ soort: 'tekst', waarde: 'AANVULLENDE OPMERKINGEN' });
    expect((cel(cellen, 'A30')?.cel as { waarde: string }).waarde)
      .toContain('te storten op rekening: BE90143103210832');
    expect(cel(cellen, 'A32')?.cel).toEqual({
      soort: 'tekst',
      waarde: '2. Gelieve het factuur# te vermelden als mededeling',
    });
  });

  it('voegt de lange regels samen zodat ze niet achter de bedragen lopen', () => {
    const blad = factuurBlad(factuur(), LEVERANCIER);
    expect(blad.samengevoegd).toContain('A23:E23');
    expect(blad.samengevoegd).toContain('A30:F30');
  });

  it('bevat geen enkele formule — een bewaarde factuur hoort niet te herrekenen', () => {
    const blad = factuurBlad(factuur(), LEVERANCIER);
    const teksten = blad.cellen
      .map((c) => (c.cel.soort === 'tekst' ? c.cel.waarde : ''))
      .join(' ');
    expect(teksten).not.toContain('=');
  });

});

describe('extraLessenBlad', () => {
  it('heet "Extra lessen"', () => {
    expect(extraLessenBlad(factuur({ extra_lessen: EXTRA })).naam).toBe('Extra lessen');
  });

  it('zet de kop en de regel met klant, maand en factuurnummer bovenaan', () => {
    const { cellen } = extraLessenBlad(factuur({ extra_lessen: EXTRA }));
    expect(cel(cellen, 'A1')?.cel).toEqual({ soort: 'tekst', waarde: 'EXTRA LESSEN' });
    expect(cel(cellen, 'A2')?.cel).toEqual({
      soort: 'tekst',
      waarde: 'VZW Racso · September 2026 · factuur NG-0007',
    });
  });

  it('zet de kolomkoppen op rij 4 en de eerste les op rij 5', () => {
    const { cellen } = extraLessenBlad(factuur({ extra_lessen: EXTRA }));
    expect(cel(cellen, 'A4')?.cel).toEqual({ soort: 'tekst', waarde: 'Datum' });
    expect(cel(cellen, 'B4')?.cel).toEqual({ soort: 'tekst', waarde: 'Naam' });
    expect(cel(cellen, 'C4')?.cel).toEqual({ soort: 'tekst', waarde: 'Type' });
    expect(cel(cellen, 'D4')?.cel).toEqual({ soort: 'tekst', waarde: 'Uren' });
    expect(cel(cellen, 'A5')?.cel).toEqual({ soort: 'datum', waarde: new Date(2026, 8, 7) });
    expect(cel(cellen, 'B5')?.cel).toEqual({ soort: 'tekst', waarde: 'Stan' });
    expect(cel(cellen, 'C5')?.cel).toEqual({ soort: 'tekst', waarde: 'sponsor' });
    expect(cel(cellen, 'D5')?.cel).toEqual({ soort: 'getal', waarde: 1 });
  });

  it('zet de lessen op datum, oudste eerst', () => {
    const omgekeerd = [EXTRA[1], EXTRA[0]];
    const { cellen } = extraLessenBlad(factuur({ extra_lessen: omgekeerd }));
    expect(cel(cellen, 'B5')?.cel).toEqual({ soort: 'tekst', waarde: 'Stan' });
    expect(cel(cellen, 'B6')?.cel).toEqual({ soort: 'tekst', waarde: 'Veerle' });
  });

  it('sluit af met een totaalrij die optelt', () => {
    const { cellen } = extraLessenBlad(factuur({ extra_lessen: EXTRA }));
    expect(cel(cellen, 'C7')?.cel).toEqual({ soort: 'tekst', waarde: 'Totaal' });
    expect(cel(cellen, 'D7')?.cel).toEqual({ soort: 'getal', waarde: 2 });
  });

  it('bestaat ook als er geen extra lessen zijn, met een zin in plaats van een tabel', () => {
    const { cellen } = extraLessenBlad(factuur({ extra_lessen: [] }));
    expect(cel(cellen, 'A4')?.cel).toEqual({
      soort: 'tekst',
      waarde: 'Geen extra lessen in deze maand.',
    });
    expect(cel(cellen, 'D4')).toBeUndefined();
  });
});

describe('factuurWerkmap', () => {
  it('levert een leesbare werkmap met twee tabbladen', () => {
    const bytes = factuurWerkmap(factuur({ extra_lessen: EXTRA }), LEVERANCIER);
    expect(bytes.length).toBeGreaterThan(500);
    // "PK" — de handtekening van een zip.
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
  });
});

describe('factuurBestandsnaam', () => {
  it('neemt het nummer over', () => {
    expect(factuurBestandsnaam('NG-0007')).toBe('factuur-NG-0007.xlsx');
    expect(factuurBestandsnaam('AI4UT_2026-001')).toBe('factuur-AI4UT_2026-001.xlsx');
  });

  it('vervangt wat niet in een bestandsnaam hoort', () => {
    expect(factuurBestandsnaam('N/G 7')).toBe('factuur-N-G-7.xlsx');
  });

  it('valt terug op "factuur.xlsx" als het nummer leeg is', () => {
    expect(factuurBestandsnaam('   ')).toBe('factuur.xlsx');
  });
});
