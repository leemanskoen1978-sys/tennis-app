// Wiens gegevens staan er op het scherm?
//
// Voor iedereen is dat "van mij". Voor een ouder is het een vraag: hij volgt zijn kinderen,
// maar hij kan ook zelf op de baan staan — een ouder die zijn kind brengt en zelf een uur
// boekt, is geen uitzondering. Hij kiest dus bovenaan wie het is: zichzelf of één van zijn
// kinderen. Daarna gaat de hele app over die persoon: dezelfde agenda, hetzelfde saldo en
// dezelfde voortgang die diegene van zichzelf ziet.
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
  /** De goedgekeurde kinderen van deze ouder; leeg voor iedereen anders. */
  kinderen: User[];
  /**
   * Waar de kiezer uit kiest: de ouder zelf vooraan, daarna zijn kinderen. Bij minder dan
   * twee namen valt er niets te kiezen en tekent de kiezer zichzelf niet.
   */
  keuzes: User[];
  /** Kijkt er een ouder mee, of gaat dit scherm over de gebruiker zelf? */
  viaOuder: boolean;
  kies: (spelerId: string) => void;
}

const Ctx = createContext<Kindkeuze | null>(null);

export function KindkeuzeProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, relaties, users } = useSimpleData();
  const taal = useLanguage();
  const [gekozen, setGekozen] = useState<string | null>(null);

  const value = useMemo<Kindkeuze>(() => {
    const viaOuder = currentUser?.role === 'parent';
    if (!viaOuder || !currentUser) {
      return {
        speler: currentUser, kinderen: [], keuzes: [], viaOuder: false, kies: setGekozen,
      };
    }

    const kinderen = kinderenVoor(currentUser.id, relaties, users, taal);
    // Hijzelf vooraan: dat is de beginstand, en in de kiezer hoort de volgorde dezelfde te
    // zijn als de regel erachter.
    const keuzes = [currentUser, ...kinderen];
    const gekozenSpeler = keuzes.find((k) => k.id === gekozen) ?? currentUser;
    return { speler: gekozenSpeler, kinderen, keuzes, viaOuder: true, kies: setGekozen };
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
 * `currentUser` de juiste: dat is de ouder, ook als hij naar zijn kind kijkt.
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
