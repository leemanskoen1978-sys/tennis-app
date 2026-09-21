// De lesopzetten per niveau: opwarming, leskern, tussenspel en wedstrijdvorm, voor de vier
// kleuren van het jeugdtennis en telkens voor twee weken.
//
// Net als de keymoments is dit leerstof en geen lesmateriaal: een trainer maakt het niet
// aan en past het niet aan, dus het staat in de code en niet in de databank. Een week of een
// niveau erbij is een blok in NIVEAUS.
//
// Overgenomen uit tennis-oefeningen.html. De tekeningen ("Tekening volgt") zijn niet
// meegekomen: die map met afbeeldingen bestond nog niet.

export type Kleur = 'blauw' | 'rood' | 'oranje' | 'groen';

/** Eén kolom van een oefening: een rijtje punten, met eventueel een titel en een noot. */
export type Oefenblok = {
  titel?: string;
  punten: readonly string[];
  noot?: string;
};

/** Leskern of wedstrijdvorm. */
export type Oefenonderdeel = {
  /** Wat er in dit onderdeel gebeurt, in één regel: "FH lukken in een diepe zone". */
  kop?: string;
  duur?: string;
  materiaal?: string;
  blokken: readonly Oefenblok[];
};

export type Oefenweek = {
  titel: string;
  kernwoorden: readonly string[];
  opwarming: { duur?: string; regels: readonly string[] };
  leskern: Oefenonderdeel;
  tussenspel?: { duur?: string; tekst: string };
  wedstrijdvorm: Oefenonderdeel;
};

export type Oefenniveau = {
  kleur: Kleur;
  /** Waar het niveau op mikt: ontvangen, zenden of lukken. */
  doel: string;
  /** Week 1 en week 2, in die volgorde. */
  weken: readonly [Oefenweek, Oefenweek];
};

/** "blauw" als naam op het scherm: "Blauw". Vertalen doet wie het toont, met `t`. */
export function kleurNaam(kleur: Kleur): string {
  return kleur.charAt(0).toUpperCase() + kleur.slice(1);
}

export const NIVEAUS: readonly Oefenniveau[] = [
  {
    kleur: 'blauw',
    doel: 'Ontvangen',
    weken: [
      {
        titel: 'FH lukken + ontvangen',
        kernwoorden: ['Lukken', 'Over en in', 'Dakje van Kastaar', 'Kleuren mengen'],
        opwarming: {
          duur: "10'",
          regels: [
            'LLn lopen met bal op racket door de zaal (nageltjes naar omhoog, plateautje).',
            'Trainer noemt drie snelheden waarop de kinderen moeten bewegen: 1 = traag wandelen, 2 = snel wandelen, 3 = lopen / 1 = vooruit, 2 = achteruit.',
            'LLn tikken de bal met hun racket omhoog, laten de bal botsen en vangen hem nadien op. Nadien 2 keer tikken, 3 keer, enz.',
          ],
        },
        leskern: {
          duur: "24' = 4x6'",
          materiaal: 'Ladder, potje, STAGE3-bal of voetbal of softbal, markeringstrips',
          blokken: [
            {
              punten: [
                'T aan zelfde kant van het net',
                'Werpt ballen aan zonder verplaatsing',
                'LL staat klaar in starthouding (FH)',
                'LL moet fijn lukken (= over en in) — trechter',
              ],
              noot: 'Tikken achter contactpunt (= achter en onder)',
            },
            {
              punten: [
                'T aan zelfde kant van het net',
                'Werpt ballen aan met verplaatsing (voorwaarts)',
                'LL staat klaar in starthouding (FH)',
                'LL moet fijn lukken (= over en in)',
              ],
              noot: 'Slingerbeweging + dakje van Kastaar + kleuren mengen',
            },
            {
              punten: [
                'LLn staan aan dezelfde kant van het net op speelbasis',
                'LL C laat de bal vallen voor LL D',
                'LL D probeert de bal over en in te spelen',
              ],
              noot: '1 punt = potje omdraaien — variatie: mikken naar goaltjes, ballen, zones',
            },
          ],
        },
        tussenspel: {
          duur: "6'",
          tekst: 'Rovertje: alle ballen liggen in een hoepel aan de andere kant van het speelveld. LLn lopen naar de hoepel en proberen zoveel mogelijk ballen op hun racket naar de andere kant te brengen. 1 bal per keer, geen tikker.',
        },
        wedstrijdvorm: {
          duur: "20'",
          materiaal: 'Wasknijpers, STAGE3-bal of voetbal of softbal, markeringstrips',
          blokken: [
            {
              titel: 'Mollentennis',
              punten: [
                'Wie maakt de meeste goals?',
                'Wedstrijdjes tegen elkaar',
              ],
            },
            {
              titel: 'Variatie',
              punten: [
                'Grote goaltjes / grotere ballen',
                'Kleine goaltjes / kleinere ballen',
              ],
            },
          ],
        },
      },
      {
        titel: 'FH lukken + starten van het punt',
        kernwoorden: ['Lukken', 'Over en in', 'Dakje van Kastaar'],
        opwarming: {
          duur: "10'",
          regels: [
            'LLn tikken de bal met hun racket omhoog, laten de bal botsen en vangen hem nadien op. Nadien 2 keer tikken, 3 keer, enz.',
            'LLn gooien de bal omhoog en proberen hem te laten stilvallen op hun racket.',
            'LLn proberen de bal te laten ronddraaien langs de rand van hun racket.',
            'LLn gooien de bal omhoog en duwen hem nadien met hun racket terug naar beneden zodat hij stil blijft liggen op de grond.',
          ],
        },
        leskern: {
          duur: "24' = 4x6'",
          blokken: [
            {
              punten: [
                'T aan zelfde kant van het net',
                'Werpt ballen aan zonder verplaatsing',
                'LL staat éénzijdig klaar in FH',
                'LL moet fijn lukken: ‘over en in’',
              ],
              noot: 'Tikken achter contactpunt: achter en onder',
            },
            {
              punten: [
                'T aan andere kant van het net',
                'Werpt ballen aan met voorwaartse verplaatsing',
                'LL staat éénzijdig klaar in FH aan speelbasis',
                'LL moet fijn lukken verhogen',
              ],
              noot: 'Slingerbeweging + dakje van Kastaar',
            },
            {
              punten: [
                'LL C start aan de eerste pannenkoek en probeert de bal over en in te spelen met bots',
                'LL D vangt de bal op in het net',
                'Lukt LL C, dan mag hij steeds een pannenkoek naar achter',
                'Is de oefening gedaan, dan krijgt LL D een kleiner net om te vangen',
              ],
            },
          ],
        },
        tussenspel: {
          duur: "6'",
          tekst: '‘Tennisbowling’: LLn staan aan speelbasis en proberen met hun racket de kegeltjes aan de andere kant van het terrein omver te rollen. Verhoog het net zodat de leerlingen onder het net kunnen rollen. (teamspel of individueel)',
        },
        wedstrijdvorm: {
          duur: "20'",
          blokken: [
            {
              punten: [
                'LLn staan aan speelbasis',
                'Elk om beurt laten ze de bal botsen en spelen hem over en in',
                'Lukken = 1 punt. Wie haalt de meeste punten?',
              ],
              noot: 'Punten bijgehouden met gekleurde wasknijpers (wisselen van tegenstander)',
            },
            {
              punten: [
                'LLn mogen in het terrein staan',
                'LLn kunnen mikken in een diepe zone',
                'Over en in diepe zone = 1 punt',
              ],
            },
          ],
        },
      },
    ],
  },
  {
    kleur: 'rood',
    doel: 'Zenden',
    weken: [
      {
        titel: 'FH lukken / zenden – ontvangen',
        kernwoorden: ['Lukken verhogen', 'Aandachtshouding', 'Dakje kastaar', 'Kleuren mengen'],
        opwarming: {
          duur: "10'",
          regels: [
            'LLn lopen met bal op racket door de zaal (nageltjes naar omhoog, plateautje).',
            'Trainer noemt drie snelheden waarop de kinderen moeten bewegen: 1 = traag wandelen, 2 = snel wandelen, 3 = lopen / 1 = vooruit, 2 = achteruit.',
            'LLn tikken de bal omhoog met hun racket (eventueel met tussenbots). Wie haalt de langste reeks zonder fout te maken?',
          ],
        },
        leskern: {
          duur: "24' = 4x6'",
          materiaal: 'Ladder, potje, STAGE3-bal of softbal, markeringstrips',
          blokken: [
            {
              punten: [
                'T aan zelfde kant van het net',
                'Werpt ballen aan zonder verplaatsing',
                'LL staat klaar in aandachtshouding',
                'LL draait romp weg naar dakje van Kastaar (FH)',
              ],
              noot: 'Lukken verhogen!',
            },
            {
              punten: [
                'T aan de andere kant van het net, in het midden van het net',
                'Werpt ballen aan met voor- en zijwaartse verplaatsing',
                'LL staat klaar in aandachtshouding',
                'LL draait romp weg naar dakje van Kastaar (FH)',
              ],
              noot: 'LL in beweging brengen!',
            },
            {
              punten: [
                'LL C werpt de bal onderhands vanaf speelbasis ‘over en in’ naar LL D',
                'LL D laat de bal botsen en vangt hem op met de handen',
                'Nadien werpt LL D vanaf die plaats de bal terug naar LL C',
              ],
              noot: 'Lukken = 1 plaats vooruit op de ladder',
            },
            {
              punten: [
                'LLn staan niet aan speelbasis maar in het terrein (dichter bij elkaar) — LLn werpen met een STAGE3-bal',
                'LLn staan beide aan speelbasis — LLn werpen met een softbal',
              ],
            },
          ],
        },
        tussenspel: {
          duur: "6'",
          tekst: 'Rovertje: alle ballen liggen in een hoepel aan de andere kant van het speelveld. LLn lopen naar de hoepel en proberen zoveel mogelijk ballen op hun racket naar de andere kant te brengen. 1 bal per keer, geen tikker.',
        },
        wedstrijdvorm: {
          duur: "20'",
          materiaal: 'STAGE3-bal of softbal, markeringstrips',
          blokken: [
            {
              punten: [
                'LLn spelen eenvoudige wedstrijdjes ‘werptennis’ met een STAGE3-bal',
                'Aandacht voor ‘over en in’',
                'Herplaatsen en steeds ‘klaar zijn voor de bal’ (keeper)',
                'Punten bijgehouden met 2 verschillende kleuren wasknijpers',
              ],
            },
            {
              punten: [
                'LLn spelen met een STAGE3-bal',
              ],
            },
            {
              punten: [
                'LLn starten beide aan speelbasis',
                'Spelen werptennis met een softbal',
              ],
            },
          ],
        },
      },
      {
        titel: 'FH lukken in beweging + ontvangen',
        kernwoorden: ['Lukken verhogen in beweging', 'Aandachtshouding', 'Splitstep', 'Slingeren'],
        opwarming: {
          duur: "10'",
          regels: [
            'LLn tikken de bal omhoog met hun racket (eventueel met tussenbots). Wie haalt de hoogste reeks zonder een fout te maken?',
            'LLn gooien de bal omhoog en proberen hem te laten stilvallen op hun racket.',
            'LLn proberen de bal te laten ronddraaien langs de rand van hun racket.',
            'LLn gooien de bal omhoog en duwen hem nadien met hun racket terug naar beneden zodat hij stil blijft liggen op de grond.',
          ],
        },
        leskern: {
          duur: "24' = 4x6'",
          materiaal: 'Ladder, potje, STAGE3-bal, markeringstrips',
          blokken: [
            {
              punten: [
                'T aan zelfde kant van het net',
                'LL aan speelbasis, aandachtshouding, triplings',
                'T werpt ballen aan met voor- en zijwaartse verplaatsing',
                'Romp wegdraaien naar dakje van Kastaar (FH)',
              ],
              noot: 'Slingeren + kleuren mengen ifv topspin',
            },
            {
              punten: [
                'T aan de andere kant van het net, in het midden van het terrein',
                'LL aan speelbasis, aandachtshouding, triplings',
                'T speelt ballen aan met racket (voor- en zijwaarts)',
                'Splitstep + romp wegdraaien naar dakje van Kastaar',
              ],
              noot: 'Slingeren + kleuren mengen ifv topspin',
            },
            {
              punten: [
                'LL C staat aan de andere kant van het net, in het midden van het terrein',
                'LL D aan speelbasis',
                'LL C gooit de bal in een boogje aan in een zone schuinvoor LL D (FH)',
                'LL D verplaatst zich en speelt de bal over en in',
              ],
              noot: 'Lukken = 1 plaats vooruit op de ladder',
            },
            {
              punten: [
                'LL C staat aan dezelfde kant van het net, aan speelbasis',
                'Vaardige kinderen mogen de bal aanspelen met racket in plaats van te gooien',
              ],
            },
          ],
        },
        tussenspel: {
          duur: "6'",
          tekst: '‘Tennisbowling’: LLn staan aan speelbasis en proberen met hun racket de kegeltjes aan de andere kant van het net omver te slaan (teamspel of individueel). LLn mogen de bal inspelen met of zonder bots.',
        },
        wedstrijdvorm: {
          duur: "20'",
          materiaal: 'STAGE3-ballen, ladder, potje',
          blokken: [
            {
              punten: [
                'LLn spelen rally met tussentoets! (2 teams)',
                '3 keer lukken = 1 plaats vooruit op de ladder',
                '5 keer lukken = 2 plaatsen vooruit',
                '7 keer lukken of meer = 3 plaatsen vooruit',
              ],
              noot: 'Welk team haalt als eerste het einde van de ladder?',
            },
            {
              punten: [
                'LLn spelen rally zonder tussentoets',
                'Mogen in het terrein starten',
                '4 keer lukken = 1 plaats vooruit',
                '7 keer lukken = 2 plaatsen vooruit',
                '10 keer lukken of meer = 3 plaatsen vooruit',
              ],
            },
          ],
        },
      },
    ],
  },
  {
    kleur: 'oranje',
    doel: 'Lukken',
    weken: [
      {
        titel: 'Forehand lukken / lukken in een diepe zone',
        kernwoorden: ['Lukken', 'Slingeren', 'Pendel', 'Schild', 'Schans'],
        opwarming: {
          regels: [
            'Balvaardigheid',
            'Bal inbrengen met een ping-pong opslag (5 ptn. winnaars tegen elkaar)',
          ],
        },
        leskern: {
          materiaal: 'Softballen, markeringstrips',
          blokken: [
            {
              punten: [
                'Rechtstreekse voorbereiding',
                'Pendel',
                'Starten vanuit splitstep',
                'Nadruk op lukken',
                'Topspin',
              ],
              noot: 'Regelmaatoefening met tussentoets',
            },
            {
              punten: [
                'Voorbereiding met een lus (schild / schans)',
                'Top voldoende laten vallen (valactie)',
                'Triplings + split',
                'Nadruk op lukken',
                'Topspin',
              ],
              noot: 'Regelmaatoefening zonder tussentoets',
            },
          ],
        },
        wedstrijdvorm: {
          kop: 'FH lukken in een diepe zone',
          blokken: [
            {
              punten: [
                'Ploegenspel (2 teams)',
              ],
            },
            {
              punten: [
                'Ploegenspel (2 teams)',
              ],
            },
          ],
        },
      },
      {
        titel: 'Forehand lukken verhogen',
        kernwoorden: ['Lukken', 'Slingeren', 'Pendel', 'Schild', 'Schans'],
        opwarming: {
          regels: [
            'Balvaardigheid',
            'Bal inbrengen met een bovenhandse werpbeweging (5 ptn. winnaars tegen elkaar)',
          ],
        },
        leskern: {
          materiaal: 'Softballen, markeringstrips, ladder',
          blokken: [
            {
              punten: [
                'Rechtstreekse voorbereiding',
                'Pendel',
                '‘Onderhoudspasjes’ (trippelen links-rechts)',
                'Nadruk op lukken',
                'Topspin (lichte verticale spin)',
              ],
              noot: 'Regelmaatsoefening met tussentoets',
            },
            {
              punten: [
                'Voorbereiding met een lus (schild / schans)',
                'Top voldoende laten vallen (valactie)',
                'Triplings + split / voorwaartse verplaatsing',
                'Nadruk op lukken',
                'Topspin (snelle verticale spin)',
              ],
              noot: 'Regelmaatsoefening zonder tussentoets',
            },
          ],
        },
        wedstrijdvorm: {
          kop: 'FH lukken in beweging',
          blokken: [
            {
              punten: [
                'Ploegenspel (2 teams) (met tussentoets)',
                'Elk team heeft 1 potje en 1 ladder',
                '3 keer lukken = 1 plaats vooruit op de ladder',
                '5 keer lukken = 2 plaatsen vooruit',
                '8 keer lukken = 3 plaatsen vooruit',
              ],
            },
            {
              punten: [
                'Ploegenspel (2 teams) (zonder tussentoets)',
                'Elk team heeft 1 potje en 1 ladder',
                '4 keer lukken = 1 plaats vooruit',
                '7 keer lukken = 2 plaatsen vooruit',
                '10 keer lukken = 3 plaatsen vooruit',
              ],
            },
          ],
        },
      },
    ],
  },
  {
    kleur: 'groen',
    doel: 'Lukken',
    weken: [
      {
        titel: 'Forehand lukken / lukken in een diepe zone',
        kernwoorden: ['Lukken', 'Slingeren', 'Pendel', 'Schild', 'Schans'],
        opwarming: {
          regels: [
            'Balvaardigheid',
            'Bal inbrengen met een ping-pong opslag (5 ptn. winnaars tegen elkaar)',
          ],
        },
        leskern: {
          materiaal: 'Overgangsballen, markeringstrips',
          blokken: [
            {
              punten: [
                'Rechtstreekse voorbereiding',
                'Pendel',
                'Starten vanuit splitstep',
                'Nadruk op lukken',
                'Topspin',
              ],
              noot: 'Regelmaatoefening met tussentoets',
            },
            {
              punten: [
                'Voorbereiding met een lus (schild / schans)',
                'Top voldoende laten vallen (valactie)',
                'Triplings + split',
                'Nadruk op lukken',
                'Topspin',
              ],
              noot: 'Regelmaatoefening zonder tussentoets',
            },
          ],
        },
        wedstrijdvorm: {
          kop: 'FH lukken in een diepe zone',
          blokken: [
            {
              punten: [
                'Ploegenspel (2 teams)',
              ],
            },
            {
              punten: [
                'Ploegenspel (2 teams)',
              ],
            },
          ],
        },
      },
      {
        titel: 'Forehand lukken verhogen',
        kernwoorden: ['Lukken', 'Slingeren', 'Pendel', 'Schild', 'Schans'],
        opwarming: {
          regels: [
            'Balvaardigheid',
            'Bal inbrengen met een bovenhandse werpbeweging (5 ptn. winnaars tegen elkaar)',
          ],
        },
        leskern: {
          materiaal: 'Overgangsballen, markeringstrips, ladder',
          blokken: [
            {
              punten: [
                'Rechtstreekse voorbereiding',
                'Pendel',
                '‘Onderhoudspasjes’ (trippelen links-rechts)',
                'Nadruk op lukken',
                'Topspin (lichte verticale spin)',
              ],
              noot: 'Regelmaatsoefening met tussentoets',
            },
            {
              punten: [
                'Voorbereiding met een lus (schild / schans)',
                'Top voldoende laten vallen (valactie)',
                'Triplings + split',
                'Nadruk op lukken',
                'Topspin (snelle verticale spin)',
              ],
              noot: 'Regelmaatsoefening zonder tussentoets',
            },
          ],
        },
        wedstrijdvorm: {
          kop: 'FH lukken in beweging',
          blokken: [
            {
              punten: [
                'Ploegenspel (2 teams) (met tussentoets)',
                'Elk team heeft 1 potje en 1 ladder',
                '3 keer lukken = 1 plaats vooruit op de ladder',
                '5 keer lukken = 2 plaatsen vooruit',
                '8 keer lukken = 3 plaatsen vooruit',
              ],
            },
            {
              punten: [
                'Ploegenspel (2 teams) (zonder tussentoets)',
                'Elk team heeft 1 potje en 1 ladder',
                '4 keer lukken = 1 plaats vooruit',
                '7 keer lukken = 2 plaatsen vooruit',
                '10 keer lukken = 3 plaatsen vooruit',
              ],
            },
          ],
        },
      },
    ],
  },
];
