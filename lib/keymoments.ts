// Keymoments: de vaste ijkpunten van een slag, elk met twee spelers ter vergelijking.
//
// Dit is leerstof, geen lesmateriaal: een trainer maakt het niet aan en past het niet aan,
// dus het staat hier in de code en niet in de databank. Een nieuwe slag erbij is een regel
// in SLAGEN plus een map foto's onder assets/keymoments/.
//
// De foto's zijn meegebundeld (require, geen url) zodat ze het ook op de baan doen, waar
// het netwerk vaak wegvalt.

import type { ImageSourcePropType } from 'react-native';

export type Keymoment = {
  /** 1 tot en met 8 — de volgorde waarin ze in de slag voorkomen. */
  nummer: number;
  /** Waar in de beweging je het frame herkent. */
  titel: string;
  /** Twee spelers, hetzelfde moment, zodat je ziet wat er hetzelfde blijft. */
  fotos: readonly [ImageSourcePropType, ImageSourcePropType];
};

export type Slag = {
  /** Deel van de route: /coaches/lessons/keymoments/forehand. */
  id: string;
  naam: string;
  keymoments: readonly Keymoment[];
};

const forehand: readonly Keymoment[] = [
  {
    nummer: 1,
    titel: 'Frame net voor het racket naar achter vertrekt',
    fotos: [require('../assets/keymoments/forehand/km1-a.jpg'), require('../assets/keymoments/forehand/km1-b.jpg')],
  },
  {
    nummer: 2,
    titel: 'Laatste frame waar het racket zich op het hoogste punt bevindt',
    fotos: [require('../assets/keymoments/forehand/km2-a.jpg'), require('../assets/keymoments/forehand/km2-b.jpg')],
  },
  {
    nummer: 3,
    titel: 'Frame waar het racket op maximale afstand van het net is',
    fotos: [require('../assets/keymoments/forehand/km3-a.jpg'), require('../assets/keymoments/forehand/km3-b.jpg')],
  },
  {
    nummer: 4,
    titel: 'Laatste frame waar het racket zich op het laagste punt bevindt',
    fotos: [require('../assets/keymoments/forehand/km4-a.jpg'), require('../assets/keymoments/forehand/km4-b.jpg')],
  },
  {
    nummer: 5,
    titel: 'Frame waar het racket de bal raakt',
    fotos: [require('../assets/keymoments/forehand/km5-a.jpg'), require('../assets/keymoments/forehand/km5-b.jpg')],
  },
  {
    nummer: 6,
    titel: 'Frame waar het racket op maximale afstand voorwaarts is',
    fotos: [require('../assets/keymoments/forehand/km6-a.jpg'), require('../assets/keymoments/forehand/km6-b.jpg')],
  },
  {
    nummer: 7,
    titel: 'Frame waar de onderarm evenwijdig is met het net',
    fotos: [require('../assets/keymoments/forehand/km7-a.jpg'), require('../assets/keymoments/forehand/km7-b.jpg')],
  },
  {
    nummer: 8,
    titel: 'Frame waar het racket op maximale afstand achter is',
    fotos: [require('../assets/keymoments/forehand/km8-a.jpg'), require('../assets/keymoments/forehand/km8-b.jpg')],
  },
];

export const SLAGEN: readonly Slag[] = [
  { id: 'forehand', naam: 'Forehand', keymoments: forehand },
];

export function slagMet(id: string | undefined): Slag | undefined {
  return SLAGEN.find((s) => s.id === id);
}
