// Welke login-beurt de app draait.
//
// De provider haalt op twee plekken op "wie is er nu ingelogd, en wat mag die zien":
// `start()` bij het opstarten en bij elke wisseling van login, en `refresh()` op verzoek.
// Allebei zijn ze traag — er zitten twee netwerkoproepen in — en allebei schrijven ze aan
// het eind hun antwoord in de stand van de app.
//
// Daar zat de fout die je bij het uitloggen zag. Gemeten op de echte site, één druk op
// Uitloggen:
//
//   11:32:44.390  REMOVE sb-…-auth-token          ← de sessie is echt weg
//   daarna        het scherm staat op de hub, "Hoi Koen Leemans", met verse cijfers
//
// De sessie was ingetrokken, maar een ophaalronde die al liep, kwam ná het uitloggen
// binnen met het antwoord "Koen is ingelogd" — dat antwoord was waar op het moment dat de
// vraag gesteld werd. Die schreef de leeggemaakte stand weer vol. Je stond dus terug op de
// hub terwijl je in werkelijkheid al uitgelogd was, en drukte een tweede keer.
//
// Vandaar een beurtenteller. Elke wisseling van login — uitloggen, een weggevallen sessie —
// is een nieuwe beurt. Wie begint met ophalen, onthoudt zijn beurt; wie terugkomt met een
// antwoord, mag het alleen nog wegschrijven als de app nog in diezelfde beurt zit. Een
// antwoord op een vraag van vóór het uitloggen gaat in de prullenmand, precies waar het
// hoort.
//
// Waarom een teller en geen `if (ingelogd)`: het gaat er niet om of er íemand ingelogd is,
// maar of het nog dezelfde aanmelding is als toen de vraag vertrok. Meldt iemand zich snel
// af en weer aan, dan is er allebei de keren "iemand ingelogd" en zou zo'n test de oude
// lading alsnog doorlaten — met de gegevens van de vorige gebruiker op het scherm.

export interface Beurtenteller {
  /** De beurt die nu loopt. Onthoud deze vóór je begint op te halen. */
  nu: () => number;
  /** Een nieuwe beurt beginnen: alles wat nog onderweg was, telt niet meer mee. */
  volgende: () => void;
  /** Mag een lading die in `beurt` begon nog weggeschreven worden? */
  geldig: (beurt: number) => boolean;
}

export function maakBeurtenteller(): Beurtenteller {
  let beurt = 0;
  return {
    nu: () => beurt,
    volgende: () => { beurt += 1; },
    geldig: (gestart: number) => gestart === beurt,
  };
}
