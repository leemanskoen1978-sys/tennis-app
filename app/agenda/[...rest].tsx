import React from 'react';
import { Redirect } from 'expo-router';

// Alles wat dieper onder /agenda lag — overzicht, historiek, komend, week, afvinken — en
// dat nu elders staat. Eén regel in plaats van vijf omleidingen: op Home staan ze alle vijf
// binnen handbereik, en een bladwijzer van een jaar oud hoeft niet precies te landen, hij
// hoeft alleen niet dood te lopen. Zie de uitleg in index.tsx hiernaast.
export default function AgendaOpgehevenDieper() {
  return <Redirect href="/" />;
}
