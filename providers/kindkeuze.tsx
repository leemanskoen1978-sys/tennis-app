// Wiens gegevens staan er op het scherm?
//
// Voor iedereen is dat "van mij". Voor een ouder niet: hij heeft zelf geen lessen, geen
// saldo en geen voortgang — zijn kinderen hebben dat. Hij kiest er dus één, en daarna gaat
// de hele app over dat kind: dezelfde agenda, hetzelfde saldo en dezelfde voortgang die het
// kind van zichzelf ziet.
//
// Waarom één kind tegelijk en niet alles door elkaar: een agenda waarin de lessen van twee
// kinderen door elkaar staan, laat je bij elke regel opnieuw uitzoeken over wie hij gaat.
// Met één kind bovenaan weet je het van tevoren, en de schermen eronder hoeven er niets
// van te weten. Heeft een ouder maar één kind, dan valt er niets te kiezen en verdwijnt de
// kiezer.
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
   * ingelogde gebruiker zelf. Voor een ouder zonder goedgekeurd kind is het `null`: er is
   * dan niemand om over te tonen, en dat is een antwoord en geen fout.
   */
  speler: User | null;
  /** De goedgekeurde kinderen van deze ouder; leeg voor iedereen anders. */
  kinderen: User[];
  /** Kijkt er een ouder mee, of gaat dit scherm over de gebruiker zelf? */
  viaOuder: boolean;
  kies: (childId: string) => void;
}

const Ctx = createContext<Kindkeuze | null>(null);

export function KindkeuzeProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, relaties, users } = useSimpleData();
  const taal = useLanguage();
  const [gekozen, setGekozen] = useState<string | null>(null);

  const value = useMemo<Kindkeuze>(() => {
    const viaOuder = currentUser?.role === 'parent';
    if (!viaOuder) {
      return { speler: currentUser, kinderen: [], viaOuder: false, kies: setGekozen };
    }

    const kinderen = kinderenVoor(currentUser?.id, relaties, users, taal);
    // Zonder eigen keuze het eerste kind: een ouder met één kind hoeft niets te kiezen, en
    // een ouder met meer kinderen begint bij iemand in plaats van bij niets.
    const gekozenKind = kinderen.find((k) => k.id === gekozen) ?? kinderen[0] ?? null;
    return { speler: gekozenKind, kinderen, viaOuder: true, kies: setGekozen };
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
 * `currentUser` de juiste: dat is de ouder, niet zijn kind.
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
