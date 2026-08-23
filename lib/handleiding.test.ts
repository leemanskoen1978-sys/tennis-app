import { gidsVoor, gidsLabel, gidsAlsTekst } from './handleiding';
import type { Role } from './types';

const rollen: Role[] = ['coach', 'player'];

describe('gidsVoor', () => {
  it('geeft voor elke rol een gids met inhoud', () => {
    for (const rol of rollen) {
      expect(gidsVoor(rol).length).toBeGreaterThan(3);
    }
  });

  it('geeft twee verschillende gidsen', () => {
    expect(gidsVoor('coach')).not.toEqual(gidsVoor('player'));
  });

  // Een gids met een leeg hoofdstuk is stil kapot: er komt geen foutmelding, er staat
  // gewoon een kop zonder tekst op het scherm.
  it('heeft nergens een leeg hoofdstuk of een leeg blokje', () => {
    for (const rol of rollen) {
      for (const stuk of gidsVoor(rol)) {
        expect(stuk.titel.trim()).not.toBe('');
        expect(stuk.plaats.trim()).not.toBe('');
        expect(stuk.delen.length).toBeGreaterThan(0);
        for (const deel of stuk.delen) {
          expect(deel.kop.trim()).not.toBe('');
          expect(deel.waar.trim()).not.toBe('');
          expect(deel.tekst.length).toBeGreaterThan(0);
          for (const alinea of deel.tekst) expect(alinea.trim()).not.toBe('');
        }
        if (stuk.waarschuwing) {
          expect(stuk.waarschuwing.kop.trim()).not.toBe('');
          expect(stuk.waarschuwing.tekst.length).toBeGreaterThan(0);
        }
      }
    }
  });

  // De id's worden gebruikt als sleutel in de lijst; twee dezelfde laten React de verkeerde
  // hertekenen, en in de webversie zouden twee ankers naar dezelfde plek wijzen.
  it('houdt de sleutels binnen één gids uniek', () => {
    for (const rol of rollen) {
      const ids = gidsVoor(rol).map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe('gidsLabel', () => {
  it('zegt voor wie de gids is', () => {
    expect(gidsLabel('coach')).toBe('Voor trainers');
    expect(gidsLabel('player')).toBe('Voor spelers');
  });
});

describe('gidsAlsTekst', () => {
  it('zet elke kop en elke alinea in de tekst', () => {
    const tekst = gidsAlsTekst('coach');
    for (const stuk of gidsVoor('coach')) {
      expect(tekst).toContain(stuk.titel);
      for (const deel of stuk.delen) {
        expect(tekst).toContain(deel.kop);
        for (const alinea of deel.tekst) expect(tekst).toContain(alinea);
      }
    }
  });

  it('houdt de twee gidsen uit elkaar', () => {
    expect(gidsAlsTekst('coach')).not.toBe(gidsAlsTekst('player'));
    expect(gidsAlsTekst('player')).toContain('Voor spelers'.toUpperCase());
  });

  // Opmaak overleeft het plakken in een mail niet; streepjes en lege regels wel.
  it('bevat geen opmaaktekens', () => {
    const tekst = gidsAlsTekst('player');
    expect(tekst).not.toMatch(/<[a-z]/i);
    expect(tekst).not.toContain('**');
  });
});
