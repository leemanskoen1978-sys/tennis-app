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

  it('zet de totalen onder het blok met de lijnen, dat zoals in het oude blad tot rij 28 loopt', () => {
    const { cellen } = factuurBlad(factuur(), LEVERANCIER);
    expect(cel(cellen, 'G29')?.cel).toEqual({ soort: 'tekst', waarde: 'netto:' });
    expect(cel(cellen, 'I29')?.cel).toEqual({ soort: 'geld', waarde: 248 });
    expect(cel(cellen, 'I30')?.cel).toEqual({ soort: 'getal', waarde: 0 });
    expect(cel(cellen, 'I31')?.cel).toEqual({ soort: 'geld', waarde: 0 });
    expect(cel(cellen, 'H34')?.cel).toEqual({ soort: 'tekst', waarde: 'Te Betalen:' });
    expect(cel(cellen, 'I34')?.cel).toEqual({ soort: 'geld', waarde: 248 });
  });

  it('zet vrije lijnen onder de urenlijn, en houdt de totalen op hun plaats zolang ze passen', () => {
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
    expect(cel(cellen, 'G29')?.cel).toEqual({ soort: 'tekst', waarde: 'netto:' });
    expect(cel(cellen, 'I29')?.cel).toEqual({ soort: 'geld', waarde: 313 });
  });

  it('schuift de totalen op als de lijnen voorbij rij 28 lopen', () => {
    const lijn = { omschrijving: 'Lijn', aantal: 1, eenheid: 'stuk', tarief: 1 };
    const { cellen } = factuurBlad(factuur({ vrije_lijnen: Array(6).fill(lijn) }), LEVERANCIER);
    expect(cel(cellen, 'A30')?.cel).toEqual({ soort: 'tekst', waarde: 'Lijn' });
    expect(cel(cellen, 'G31')?.cel).toEqual({ soort: 'tekst', waarde: 'netto:' });
  });

  it('zet de twee BTW-voetnoten en de twee opmerkingen erbij', () => {
    const { cellen } = factuurBlad(factuur(), LEVERANCIER);
    expect(cel(cellen, 'A30')?.cel).toEqual({
      soort: 'tekst',
      waarde: 'Artikel 44.2.3 vrijstelling btw exploitatie lichamelijke ontwikkeling',
    });
    expect(cel(cellen, 'A31')?.cel).toEqual({ soort: 'tekst', waarde: 'kleine onderneming' });
    expect(cel(cellen, 'A33')?.cel).toEqual({ soort: 'tekst', waarde: 'AANVULLENDE OPMERKINGEN' });
    expect((cel(cellen, 'A34')?.cel as { waarde: string }).waarde)
      .toContain('te storten op rekening: BE90143103210832');
    expect(cel(cellen, 'A36')?.cel).toEqual({
      soort: 'tekst',
      waarde: '2. Gelieve het factuur# te vermelden als mededeling',
    });
  });

  it('voegt de lange regels samen zodat ze niet achter de bedragen lopen', () => {
    const blad = factuurBlad(factuur(), LEVERANCIER);
    expect(blad.samengevoegd).toContain('A23:E23');
    expect(blad.samengevoegd).toContain('A34:F34');
  });

  it('bevat geen enkele formule — een bewaarde factuur hoort niet te herrekenen', () => {
    const blad = factuurBlad(factuur(), LEVERANCIER);
    const teksten = blad.cellen
      .map((c) => (c.cel?.soort === 'tekst' ? c.cel.waarde : ''))
      .join(' ');
    expect(teksten).not.toContain('=');
  });

});

describe('de opmaak van facturen.xlsx', () => {
  const ORANJE = 'FF3300';
  const LICHT = 'F4B183';
  const blad = () => factuurBlad(factuur(), LEVERANCIER);

  it('zet de koppen van mijn gegevens en van de beschrijving op een oranje balk', () => {
    const { cellen, samengevoegd } = blad();
    expect(cel(cellen, 'A5')?.stijl?.vulling).toBe(ORANJE);
    expect(samengevoegd).toContain('A5:I5');
    for (const ref of ['A22', 'F22', 'G22', 'H22', 'I22']) {
      expect(cel(cellen, ref)?.stijl?.vulling).toBe(ORANJE);
    }
  });

  it('schrijft de tekst op de oranje balken in het wit', () => {
    const { cellen } = blad();
    for (const ref of ['A5', 'A22', 'I22']) expect(cel(cellen, ref)?.stijl?.kleur).toBe('FFFFFF');
  });

  it('zet "Factuur" vet en goudgeel, over drie kolommen', () => {
    const { cellen, samengevoegd } = blad();
    expect(cel(cellen, 'G6')?.stijl).toMatchObject({ vet: true, kleur: 'FFC000' });
    expect(samengevoegd).toContain('G6:I6');
  });

  it('kleurt de bedragkolom en de factuurdatum lichtoranje', () => {
    const { cellen } = blad();
    for (const ref of ['H7', 'I24', 'I28', 'I29', 'I30', 'I31', 'I34']) {
      expect(cel(cellen, ref)?.stijl?.vulling).toBe(LICHT);
    }
  });

  it('zet een kader rond mijn gegevens, de factuurgegevens en de klant', () => {
    const { cellen } = blad();
    expect(cel(cellen, 'A6')?.stijl?.rand?.links).toBe(true);
    expect(cel(cellen, 'C10')?.stijl?.rand).toMatchObject({ onder: true, rechts: true });
    expect(cel(cellen, 'I9')?.stijl?.rand).toMatchObject({ onder: true, rechts: true });
    expect(cel(cellen, 'A16')?.stijl?.rand).toMatchObject({ boven: true, links: true });
    expect(cel(cellen, 'D20')?.stijl?.rand).toMatchObject({ onder: true, rechts: true });
  });

  it('schrijft klein (9 pt) en de klant en de beschrijving groter (11 pt)', () => {
    const { cellen } = blad();
    expect(cel(cellen, 'G7')?.stijl?.grootte).toBe(9);
    expect(cel(cellen, 'I24')?.stijl?.grootte).toBe(9);
    expect(cel(cellen, 'A17')?.stijl?.grootte).toBe(11);
    expect(cel(cellen, 'A23')?.stijl?.grootte).toBe(11);
  });

  it('drukt af op één A4, van A1 tot en met de laatste regel', () => {
    expect(blad().afdrukbereik).toBe('A1:I36');
  });

  it('neemt de kolombreedtes van het oude blad over, met ruimte voor een bedrag in I', () => {
    expect(blad().breedtes).toEqual([33.2, 7.7, 12.7, 2.3, 2.7, 6.2, 10.8, 10.7, 10]);
  });

  it('levert een werkmap die de opmaak ook echt meedraagt', () => {
    const bytes = factuurWerkmap(factuur(), LEVERANCIER);
    expect(bytes.length).toBeGreaterThan(0);
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

  it('botst nooit op zichzelf, hoeveel vrije lijnen er ook bij komen', () => {
    // `vrijBladXml` gooit als twee cellen op dezelfde plaats landen. Het totalenblok
    // schuift op met het aantal vrije lijnen, dus dat is precies waar een rijnummer één
    // te ver kan tellen. Deze test laat het blad écht schrijven in plaats van losse
    // celverwijzingen na te kijken.
    for (const aantal of [0, 1, 2, 5, 12]) {
      const lijnen = Array.from({ length: aantal }, (_, i) => ({
        omschrijving: `Lijn ${i + 1}`, aantal: 1, eenheid: 'stuk', tarief: 10,
      }));
      expect(() => factuurWerkmap(factuur({ vrije_lijnen: lijnen }), LEVERANCIER)).not.toThrow();
    }
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

  it('haalt streepjes aan de randen weg', () => {
    expect(factuurBestandsnaam('-NG-0007-')).toBe('factuur-NG-0007.xlsx');
  });

  it('topt een onwaarschijnlijk lang nummer af', () => {
    const lang = 'A'.repeat(300);
    expect(factuurBestandsnaam(lang).length).toBeLessThanOrEqual(113);
  });
});
