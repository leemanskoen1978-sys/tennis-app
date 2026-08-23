// Wiens gegevens staan er op het scherm?
//
// Voor de meeste mensen is dat "van mij". Wie kinderen aan de club heeft, krijgt er een
// vraag bij: hij volgt zijn kind, maar hij staat vaak ook zelf op de baan — de mama die
// haar dochter brengt en daarna zelf een uur speelt, is de normale situatie en niet de
// uitzondering. Hij kiest dus bovenaan wie het is: zichzelf of één van zijn kinderen.
// Daarna gaat de hele app over die persoon: dezelfde agenda, hetzelfde saldo en dezelfde
// voortgang die diegene van zichzelf ziet.
//
// Dit hangt niet aan een rol. "Ouder" wás een rol, en dat werkte averechts: je moest kiezen
// tussen je eigen lessen zien óf die van je kind. Ouderschap is een band tussen twee
// mensen, geen soort account — dus een speler én een trainer kunnen hier kinderen hebben.
//
// Waarom één tegelijk en niet alles door elkaar: een agenda waarin de lessen van twee
// kinderen door elkaar staan, laat je bij elke regel opnieuw uitzoeken over wie hij gaat.
// Met één naam bovenaan weet je het van tevoren, en de schermen eronder hoeven er niets van
// te weten. Heeft een ouder geen kinderen, dan valt er niets te kiezen en verdwijnt de
// kiezer: dan is de app gewoon van hem.
//
// De beginstand is hijzelf, en dat is met opzet een vaste regel en geen slimme: het is zijn
// account, en een scherm dat uit zichzelf op andermans gegevens opent is het scherm dat je
// verrast. Wisselen is één tik, en de kiezer staat in beeld.
//
// De keuze staat hier en niet in de opslag: het is geen gegeven van de club maar van dit
// moment, zoals de trainerfilter op de agenda.

import React, { createContext, useContext, useMemo, useState } from 'react';
import { useSimpleData } from './SimpleDataProvider';
import { kinderenVoor } from '../lib/ouderkind';
import { useLanguage } from '../lib/i18n';
import { pendingPaymentsFor } from '../lib/payments';
import type { Booking, User } from '../lib/types';

interface Kindkeuze {
  /**
   * De speler wiens gegevens de schermen tonen. Voor iedereen behalve een ouder is dat de
   * ingelogde gebruiker zelf; bij een ouder is het wie hij bovenaan koos — hijzelf of een
   * van zijn kinderen.
   */
  speler: User | null;
  /** De goedgekeurde kinderen van deze gebruiker; leeg als hij er geen heeft. */
  kinderen: User[];
  /**
   * Waar de kiezer uit kiest: hijzelf vooraan, daarna zijn kinderen. Bij minder dan twee
   * namen valt er niets te kiezen en tekent de kiezer zichzelf niet.
   */
  keuzes: User[];
  /**
   * Gaat dit scherm over de gebruiker zelf, of kijkt hij naar een van zijn kinderen?
   *
   * Schermen die zich anders gedragen voor een trainer lezen dit mee: een trainer die naar
   * zijn kind kijkt, wil het beeld van een speler zien en niet zijn eigen lesrooster.
   */
  kijktNaarZichzelf: boolean;
  kies: (spelerId: string) => void;
}

const Ctx = createContext<Kindkeuze | null>(null);

export function KindkeuzeProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, relaties, users } = useSimpleData();
  const taal = useLanguage();
  const [gekozen, setGekozen] = useState<string | null>(null);

  const value = useMemo<Kindkeuze>(() => {
    if (!currentUser) {
      return {
        speler: null, kinderen: [], keuzes: [], kijktNaarZichzelf: true, kies: setGekozen,
      };
    }

    const kinderen = kinderenVoor(currentUser.id, relaties, users, taal);
    if (kinderen.length === 0) {
      return {
        speler: currentUser, kinderen: [], keuzes: [], kijktNaarZichzelf: true,
        kies: setGekozen,
      };
    }

    // Hijzelf vooraan: dat is de beginstand, en in de kiezer hoort de volgorde dezelfde te
    // zijn als de regel erachter.
    const keuzes = [currentUser, ...kinderen];
    const gekozenSpeler = keuzes.find((k) => k.id === gekozen) ?? currentUser;
    return {
      speler: gekozenSpeler,
      kinderen,
      keuzes,
      kijktNaarZichzelf: gekozenSpeler.id === currentUser.id,
      kies: setGekozen,
    };
  }, [currentUser, relaties, users, taal, gekozen]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useKindkeuze(): Kindkeuze {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useKindkeuze hoort binnen KindkeuzeProvider');
  return ctx;
}

/**
 * De speler over wie dit scherm gaat — de kortste vorm, want dit is wat de meeste schermen
 * nodig hebben.
 *
 * Gebruik dit overal waar tot nu toe `currentUser` stond en de vraag "van wie zijn deze
 * lessen" was. Gaat het over het account zelf (naam, e-mailadres, wachtwoord), dan blijft
 * `currentUser` de juiste: dat blijft de ingelogde persoon, ook als hij naar zijn kind kijkt.
 */
export function useActieveSpeler(): User | null {
  return useKindkeuze().speler;
}

/**
 * De lessen waar deze gebruiker nog een betaalwijze voor moet kiezen.
 *
 * Stond eerder in SimpleDataProvider en keek naar de ingelogde gebruiker. Voor een ouder is
 * dat het verkeerde antwoord: hij heeft zelf geen lessen, zijn kind wel. Hij hoort ze te
 * zien staan, want hij is degene die de rekening krijgt.
 */
export function useOpenstaandeBetalingen(): Booking[] {
  const { bookings } = useSimpleData();
  const speler = useActieveSpeler();
  return useMemo(() => pendingPaymentsFor(speler, bookings), [speler, bookings]);
}
