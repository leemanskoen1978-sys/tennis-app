import { NIVEAUS } from './oefeningen';
import { kleurIn } from './groepskleur';

describe('NIVEAUS', () => {
  it('heeft de vier kleuren, elk met twee weken', () => {
    expect(NIVEAUS.map((n) => n.kleur)).toEqual(['blauw', 'rood', 'oranje', 'groen']);
    for (const n of NIVEAUS) expect(n.weken).toHaveLength(2);
  });

  // Het scherm tekent het randje links met de kleur die groepskleur bij dit woord kent; een
  // niveau zonder herkende kleur zou zonder randje op het scherm staan, zonder foutmelding.
  it('heeft voor elke kleur een tint in lib/groepskleur', () => {
    for (const n of NIVEAUS) expect(kleurIn(n.kleur)).not.toBeNull();
  });

  it('heeft in elke week een titel, een opwarming, een leskern en een wedstrijdvorm', () => {
    for (const n of NIVEAUS) {
      for (const w of n.weken) {
        expect(w.titel.trim()).not.toBe('');
        expect(w.opwarming.regels.length).toBeGreaterThan(0);
        expect(w.leskern.blokken.length).toBeGreaterThan(0);
        expect(w.wedstrijdvorm.blokken.length).toBeGreaterThan(0);
        for (const blok of [...w.leskern.blokken, ...w.wedstrijdvorm.blokken]) {
          expect(blok.punten.length).toBeGreaterThan(0);
        }
      }
    }
  });
});
