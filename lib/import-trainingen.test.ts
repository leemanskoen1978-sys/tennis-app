import {
  bestandAfgekeurdLessen, leesKopregelLessen,
} from './import-trainingen';

// De koprij van `koen.xlsx`, letterlijk zoals plan 05-03 hem uit het echte bestand las. Vier
// van de tien kolommen betekenen niets voor de import; ze mogen dus geen ruis opleveren.
const KOP_KOEN = [
  'Datum', 'Weekdag', 'Weeknr', 'Uur', 'Type les', 'Groep', 'Coach', 'Leerling',
  'Locatie', 'Indoor/Outdoor',
];

/** De koprij die de export van fase 4 schrijft: zestien kolommen, waarvan negen betekenis hebben. */
const KOP_EXPORT = [
  'Datum', 'Weekdag', 'Weeknr', 'Uur', 'Einduur', 'Type les', 'Groep', 'Groep-ID', 'Coach',
  'Gaf de les', 'Leerling', 'E-mail leerling', 'Baan', 'Indoor/Outdoor', 'Spelers', 'Status',
];

describe('leesKopregelLessen', () => {
  it('herkent de vijf verplichte kolommen', () => {
    const kop = leesKopregelLessen(['Datum', 'Uur', 'Groep', 'Coach', 'Leerling']);
    expect(kop.kolommen).toEqual({ datum: 0, uur: 1, groep: 2, coach: 3, leerling: 4 });
    expect(kop.nietHerkend).toEqual([]);
    expect(kop.dubbel).toEqual([]);
  });

  it('herkent ook de vier optionele kolommen', () => {
    const kop = leesKopregelLessen([
      'Datum', 'Uur', 'Groep', 'Coach', 'Leerling', 'Groep-ID', 'Type les', 'E-mail leerling', 'Baan',
    ]);
    expect(kop.kolommen).toEqual({
      datum: 0, uur: 1, groep: 2, coach: 3, leerling: 4,
      groepId: 5, typeLes: 6, emailLeerling: 7, baan: 8,
    });
    expect(kop.nietHerkend).toEqual([]);
  });

  it('trekt zich niets aan van hoofdletters, spaties eromheen en spaties erin', () => {
    const kop = leesKopregelLessen([' DATUM ', 'uur', 'Groep', 'coach', 'LEERLING', 'typeles', 'Groep - ID']);
    expect(kop.kolommen).toEqual({
      datum: 0, uur: 1, groep: 2, coach: 3, leerling: 4, typeLes: 5, groepId: 6,
    });
    expect(kop.nietHerkend).toEqual([]);
  });

  it('leest de kolommen ook als ze in een andere volgorde staan', () => {
    const kop = leesKopregelLessen(['Leerling', 'Coach', 'Groep', 'Uur', 'Datum']);
    expect(kop.kolommen).toEqual({ leerling: 0, coach: 1, groep: 2, uur: 3, datum: 4 });
  });

  it('meldt de kolommen van koen.xlsx niet als onbekend', () => {
    const kop = leesKopregelLessen(KOP_KOEN);
    expect(kop.kolommen).toEqual({
      datum: 0, uur: 3, typeLes: 4, groep: 5, coach: 6, leerling: 7,
    });
    expect(kop.nietHerkend).toEqual([]);
    expect(kop.dubbel).toEqual([]);
  });

  it('meldt de zestien kolommen van de eigen export niet als onbekend', () => {
    const kop = leesKopregelLessen(KOP_EXPORT);
    expect(kop.kolommen).not.toBeNull();
    expect(kop.nietHerkend).toEqual([]);
    expect(kop.dubbel).toEqual([]);
  });

  it('meldt een echt onbekende kop, letterlijk, en keurt het bestand er niet om af', () => {
    const kop = leesKopregelLessen(['Datum', 'Uur', 'Groep', 'Coach', 'Leerling', ' Opmerking ']);
    expect(kop.nietHerkend).toEqual(['Opmerking']);
    expect(kop.kolommen).not.toBeNull();
  });

  it('laat de eerste kolom winnen en meldt de tweede als dubbel', () => {
    const kop = leesKopregelLessen(['Datum', 'Uur', 'Groep', 'Coach', 'Leerling', 'leerling']);
    expect(kop.kolommen?.leerling).toBe(4);
    expect(kop.dubbel).toEqual(['leerling']);
  });

  it('slaat een lege kop over zonder hem een vergissing te noemen', () => {
    const kop = leesKopregelLessen(['Datum', '', 'Uur', '   ', 'Groep', 'Coach', 'Leerling']);
    expect(kop.nietHerkend).toEqual([]);
    expect(kop.kolommen).not.toBeNull();
  });

  it.each(['Datum', 'Uur', 'Groep', 'Coach', 'Leerling'])(
    'geeft geen kolommen als %s ontbreekt', (weg) => {
      const koppen = ['Datum', 'Uur', 'Groep', 'Coach', 'Leerling'].filter((k) => k !== weg);
      expect(leesKopregelLessen(koppen).kolommen).toBeNull();
    },
  );

  it('vult nietHerkend en dubbel ook als een verplichte kolom ontbreekt', () => {
    // Juist dán heeft de beheerder die lijstjes nodig: "ik mis Coach, maar ik zag wel een
    // kolom Trainer die ik niet herken" is bruikbaar, "verplichte kolom ontbreekt" niet.
    const kop = leesKopregelLessen(['Datum', 'Uur', 'Groep', 'Leerling', 'Trainer', 'Datum']);
    expect(kop.kolommen).toBeNull();
    expect(kop.nietHerkend).toEqual(['Trainer']);
    expect(kop.dubbel).toEqual(['Datum']);
  });
});

describe('bestandAfgekeurdLessen', () => {
  it('is waar bij precies één fout op regel 1 en geen enkele gelezen regel', () => {
    expect(bestandAfgekeurdLessen({ regels: [], fouten: [{ regel: 1, reden: 'Dit bestand is leeg.' }] }))
      .toBe(true);
  });

  it('is onwaar zodra er ook maar één regel wel gelezen kon worden', () => {
    expect(bestandAfgekeurdLessen({
      regels: [{}],
      fouten: [{ regel: 1, reden: 'Dit bestand is leeg.' }],
    })).toBe(false);
  });

  it('is onwaar bij een fout op een gewone regel', () => {
    expect(bestandAfgekeurdLessen({ regels: [], fouten: [{ regel: 7, reden: 'Geen coach ingevuld.' }] }))
      .toBe(false);
  });

  it('is onwaar zonder fouten', () => {
    expect(bestandAfgekeurdLessen({ regels: [], fouten: [] })).toBe(false);
  });
});
