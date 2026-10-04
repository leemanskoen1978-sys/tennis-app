// Beheer → Facturatie. De uren van Koen omzetten in een factuur aan Gantoise en Racso.
//
// Dit scherm is van één persoon: `magFactureren` laat één e-mailadres door, en de RLS in
// FACTURATIE.sql houdt de rest tegen. Het staat onder Beheer omdat daar de andere schermen
// over geld staan, niet omdat de club er iets mee te maken heeft.
//
// Anders dan de rest van Beheer haalt dit scherm zijn eigen gegevens op. Ze komen niet mee
// in de lading bij het opstarten — zie `facturatie` op Backend in providers/backend.ts.

import { useCallback, useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { LessenBlad } from '../../components/facturatie/LessenBlad';
import { FactuurBlad } from '../../components/facturatie/FactuurBlad';
import { RegisterBlad } from '../../components/facturatie/RegisterBlad';
import { InstellingenBlad } from '../../components/facturatie/InstellingenBlad';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { backend } from '../../providers/backend';
import {
  magFactureren, nieuwId, standaardKlanten, standaardLeverancier, type FacturatieData,
} from '../../lib/facturatie';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography } from '../../constants/theme';

type Blad = 'lessen' | 'factuur' | 'register' | 'instellingen';

const BLADEN: Array<{ sleutel: Blad; label: string }> = [
  { sleutel: 'lessen', label: 'Lessen' },
  { sleutel: 'factuur', label: 'Factuur maken' },
  { sleutel: 'register', label: 'Register' },
  { sleutel: 'instellingen', label: 'Instellingen' },
];

/** Wat er op het scherm staat terwijl of nadat er geladen is. */
type Stand =
  | { soort: 'laden' }
  | { soort: 'geen-tabellen' }
  | { soort: 'fout'; bericht: string }
  | { soort: 'klaar'; data: FacturatieData };

export default function Facturatie() {
  const { currentUser, bookings, courts } = useSimpleData();
  const [blad, setBlad] = useState<Blad>('factuur');
  const [stand, setStand] = useState<Stand>({ soort: 'laden' });

  const laden = useCallback(async () => {
    try {
      const data = await backend.facturatie.laden();
      if (data === null) {
        setStand({ soort: 'geen-tabellen' });
        return;
      }

      // De eerste keer: mijn gegevens en de twee clubs klaarzetten. Dat gebeurt hier en niet
      // in FACTURATIE.sql, want daar is nog niet bekend wie de eigenaar is — de SQL-editor
      // draait zonder ingelogde gebruiker.
      let klaar = data;
      if (klaar.leverancier.id === '') {
        const leverancier = standaardLeverancier(nieuwId('lev'));
        await backend.facturatie.leverancierBewaren(leverancier);
        klaar = { ...klaar, leverancier };
      }
      if (klaar.klanten.length === 0) {
        const klanten = standaardKlanten([nieuwId('kl'), nieuwId('kl')]);
        for (const klant of klanten) await backend.facturatie.klantBewaren(klant);
        klaar = { ...klaar, klanten };
      }

      setStand({ soort: 'klaar', data: klaar });
    } catch (e) {
      setStand({ soort: 'fout', bericht: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  useEffect(() => {
    void laden();
  }, [laden]);

  if (!magFactureren(currentUser?.email)) {
    return (
      <Screen scroll={false}>
        <Text style={styles.muted}>Facturatie is persoonlijk en staat niet open.</Text>
      </Screen>
    );
  }

  if (stand.soort === 'laden') {
    return (
      <Screen scroll={false}>
        <ActivityIndicator color={tennisColors.primary} />
      </Screen>
    );
  }

  if (stand.soort === 'geen-tabellen') {
    return (
      <Screen>
        <Card>
          <Text style={styles.kop}>De tabellen staan er nog niet</Text>
          <Text style={styles.uitleg}>
            Draai `FACTURATIE.sql` in de SQL-editor van Supabase en herlaad daarna deze pagina
            hard. De app leest de databank bij het opstarten.
          </Text>
        </Card>
      </Screen>
    );
  }

  if (stand.soort === 'fout') {
    return (
      <Screen>
        <Card>
          <Text style={styles.kop}>Het laden liep mis</Text>
          <Text style={styles.uitleg}>{stand.bericht}</Text>
        </Card>
      </Screen>
    );
  }

  const { data } = stand;

  return (
    <Screen>
      <Text style={styles.titel}>Facturatie</Text>

      <View style={styles.tabs}>
        {BLADEN.map((b) => (
          <Chip
            key={b.sleutel}
            label={b.label}
            selected={blad === b.sleutel}
            onPress={() => setBlad(b.sleutel)}
          />
        ))}
      </View>

      {blad === 'lessen' && <LessenBlad data={data} opnieuwLaden={laden} />}
      {blad === 'factuur' && (
        <FactuurBlad data={data} bookings={bookings} courts={courts} trainerId={currentUser?.id ?? ''} opnieuwLaden={laden} />
      )}
      {blad === 'register' && <RegisterBlad data={data} opnieuwLaden={laden} />}
      {blad === 'instellingen' && <InstellingenBlad data={data} opnieuwLaden={laden} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  titel: { ...typography.h1, color: tennisColors.text, marginBottom: spacing.md },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  kop: { ...typography.h2, color: tennisColors.text, marginBottom: spacing.sm },
  uitleg: { ...typography.body, color: tennisColors.textMuted },
  muted: { ...typography.body, color: tennisColors.textMuted },
});
