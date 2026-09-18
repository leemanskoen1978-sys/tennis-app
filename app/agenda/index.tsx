import React from 'react';
import { Redirect } from 'expo-router';

// De Agenda-tab is opgeheven: haar schermen zijn verdeeld over Home, Spelers, Trainers en
// Beheer (de tabel in OPENSTAAND.md zegt welk scherm waarheen ging). Wie nog een bladwijzer
// of een snelkoppeling op zijn beginscherm heeft van vóór die verhuizing, kwam uit op het
// Engelse "Unmatched Route" van de router: een zwart scherm dat niets uitlegt en nergens
// heen gaat. Dit bestand en [...rest] ernaast zetten hem gewoon op Home; daar staat alles
// wat de Agenda-tab had, één tik verder.
//
// /agenda/new blijft wél bestaan — dat is het scherm Reserveren. Een bestand met een echte
// naam gaat bij de router vóór de catch-all, dus dat pad handelt new.tsx zelf af.
export default function AgendaOpgeheven() {
  return <Redirect href="/" />;
}
