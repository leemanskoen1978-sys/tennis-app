import { groepskleur, kleurIn } from './groepskleur';

describe('kleurIn', () => {
  it('leest de kleur uit een niveau zoals de clublijst hem schrijft', () => {
    // Precies de vorm die uit de kolom Doelgroep komt.
    expect(kleurIn('Kidstennis blauw')?.naam).toBe('blauw');
    expect(kleurIn('Kidstennis rood')?.naam).toBe('rood');
    expect(kleurIn('Oranje')?.naam).toBe('oranje');
  });

  it('kijkt niet naar hoofdletters', () => {
    expect(kleurIn('BLAUW')?.naam).toBe('blauw');
    expect(kleurIn('Groen')?.naam).toBe('groen');
  });

  it('herkent de verbogen vorm', () => {
    // "de rode groep" en "de witte lessen" staan zo in de lijst.
    expect(kleurIn('rode groep')?.naam).toBe('rood');
    expect(kleurIn('witte lessen')?.naam).toBe('wit');
    expect(kleurIn('gele kaart')?.naam).toBe('geel');
    expect(kleurIn('groene ploeg')?.naam).toBe('groen');
  });

  it('geeft een kleur om mee te tekenen', () => {
    expect(kleurIn('blauw')?.hex).toMatch(/^#[0-9A-F]{6}$/i);
  });

  it('zegt niets bij een tekst zonder kleur', () => {
    // Een volwaardig niveau; het heeft alleen geen kleur, en dan hoort er geen bolletje
    // te staan in plaats van een grijs vraagteken.
    expect(kleurIn('Volwassenen gevorderden')).toBeNull();
    expect(kleurIn('Competitie heren')).toBeNull();
  });

  it('trapt niet in een kleurnaam die in een ander woord zit', () => {
    // Dit is de reden dat er woordgrenzen in de patronen staan: zonder die grens zag
    // "Witsel" er als wit uit en "Bordeaux" als rood, en een plausibel fout bolletje
    // meldt niemand.
    expect(kleurIn('Witsel')).toBeNull();
    expect(kleurIn('Groepslessen')).toBeNull();
    expect(kleurIn('Bordeaux')).toBeNull();
  });

  it('weigert een lege of ontbrekende tekst', () => {
    expect(kleurIn('')).toBeNull();
    expect(kleurIn(null)).toBeNull();
    expect(kleurIn(undefined)).toBeNull();
  });

  it('kiest bij twee kleuren altijd dezelfde', () => {
    // Willekeurig welke, maar wel elke keer dezelfde: anders krijgt één groep twee
    // bolletjes naargelang wie haar opschreef.
    expect(kleurIn('van blauw naar rood')?.naam).toBe(kleurIn('van rood naar blauw')?.naam);
  });
});

describe('groepskleur', () => {
  it('leest de kleur uit het niveau', () => {
    expect(groepskleur('Kidstennis blauw', 'Groep 1')?.naam).toBe('blauw');
  });

  it('valt terug op de naam als het niveau geen kleur noemt', () => {
    // De kleur staat in beide velden, maar niet altijd in allebei tegelijk.
    expect(groepskleur('Kidstennis', 'Blauw - Groep 1')?.naam).toBe('blauw');
  });

  it('laat het niveau voorgaan als ze het oneens zijn', () => {
    // Het niveau is de indeling van de club; de naam is hoe één groep daarbinnen heet.
    expect(groepskleur('Kidstennis rood', 'Blauw - Groep 1')?.naam).toBe('rood');
  });

  it('werkt met alleen een niveau', () => {
    expect(groepskleur('Oranje')?.naam).toBe('oranje');
  });

  it('zegt niets als geen van beide een kleur noemt', () => {
    expect(groepskleur('Volwassenen', 'Dinsdaggroep')).toBeNull();
    expect(groepskleur(null, null)).toBeNull();
  });
});
