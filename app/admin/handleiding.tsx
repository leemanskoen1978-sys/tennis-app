// De gebruiksaanwijzing in de app zelf.
//
// Twee gidsen achter één schakelaar: die voor trainers en die voor spelers. Dat tweede is
// geen bijzaak — "wat ziet mijn speler eigenlijk" is een vraag die je aan de baan krijgt, en
// dan wil je het kunnen laten zien in plaats van het uit het hoofd uit te leggen.
//
// De tekst staat niet hier maar in lib/handleiding: dezelfde tekst komt ook op de deelbare
// webpagina terecht, en een handleiding die op de ene plek al bijgewerkt is en op de andere
// nog niet, is erger dan geen handleiding.

import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Copy } from 'lucide-react-native';

import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { Button } from '../../components/ui/Button';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { gidsVoor, gidsLabel, gidsAlsTekst } from '../../lib/handleiding';
import { kopieerOfDeel } from '../../lib/share';
import { isCoach } from '../../lib/rechten';
import { useT } from '../../lib/i18n';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, radius, typography } from '../../constants/theme';
import type { Role } from '../../lib/types';

const ROLLEN: Role[] = ['coach', 'player'];

export default function HandleidingScreen(): React.JSX.Element {
  const t = useT();
  const { currentUser } = useSimpleData();
  // Je begint bij je eigen gids: dat is negen van de tien keer wat je zoekt. De andere staat
  // ernaast, één tik ver.
  const [rol, setRol] = useState<Role>(() => (isCoach(currentUser) ? 'coach' : 'player'));
  // Wat er van de kopieerknop kwam. Verdwijnt zodra je van gids wisselt, want dan slaat hij
  // op de vorige.
  const [melding, setMelding] = useState<string | null>(null);

  const gids = gidsVoor(rol);

  const kopieer = async (): Promise<void> => {
    try {
      const waar = await kopieerOfDeel(gidsLabel(rol), gidsAlsTekst(rol));
      setMelding(waar === 'klembord'
        ? t('De hele gids staat op je klembord. Plak hem in een mail.')
        : t('De gids is klaargezet om te delen.'));
    } catch {
      // Een klembord kan geweigerd worden (een privévenster, een oude browser). Dan is de
      // knop niet stuk, maar het toestel doet niet mee — en dat hoort er te staan.
      setMelding(t('Kopiëren lukte niet. Selecteer de tekst hieronder en kopieer hem zelf.'));
    }
  };

  return (
    <Screen>
      <View style={styles.kiezer}>
        {ROLLEN.map((r) => (
          <Chip
            key={r}
            label={gidsLabel(r)}
            selected={rol === r}
            onPress={() => { setRol(r); setMelding(null); }}
          />
        ))}
      </View>

      {/* Om de gids in een mail te zetten: platte tekst, met de koppen als streepregels,
          zodat de indeling in elk mailprogramma blijft staan. */}
      <Button
        label={t('Kopieer als tekst')}
        variant="secondary"
        icon={<Copy size={16} color={tennisColors.text} />}
        onPress={() => { void kopieer(); }}
      />
      {melding ? <Text style={styles.melding}>{melding}</Text> : null}

      {gids.map((stuk) => (
        <Card key={stuk.id}>
          <Text style={styles.plaats}>{t(stuk.plaats)}</Text>
          <Text style={styles.titel}>{t(stuk.titel)}</Text>
          {stuk.leidraad ? <Text style={styles.leidraad}>{t(stuk.leidraad)}</Text> : null}

          {stuk.delen.map((deel) => (
            <View key={deel.kop} style={styles.deel}>
              {/* Waar het staat, vóór wat het is: je zoekt meestal eerst de plek. */}
              <Text style={styles.waar}>{t(deel.waar)}</Text>
              <Text style={styles.kop}>{t(deel.kop)}</Text>
              {deel.tekst.map((alinea) => (
                <Text key={alinea.slice(0, 24)} style={styles.tekst}>{t(alinea)}</Text>
              ))}
            </View>
          ))}

          {/* Iets dat je maar één keer verkeerd hoeft te doen, krijgt een eigen vlak. */}
          {stuk.waarschuwing ? (
            <View style={styles.letop}>
              <Text style={styles.letopKop}>{t(stuk.waarschuwing.kop)}</Text>
              {stuk.waarschuwing.tekst.map((alinea) => (
                <Text key={alinea.slice(0, 24)} style={styles.letopTekst}>{t(alinea)}</Text>
              ))}
            </View>
          ) : null}
        </Card>
      ))}

      <Text style={styles.colofon}>
        {t('Deze gids beschrijft de app zoals hij nu werkt. Verandert er iets aan de '
          + 'schermen, dan hoort dit mee te veranderen — een handleiding die niet meer klopt, '
          + 'is erger dan geen.')}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  kiezer: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  melding: { ...typography.body, fontSize: 14, color: tennisColors.primary },
  plaats: {
    fontSize: 12, fontWeight: '700', color: tennisColors.primary,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  titel: { ...typography.h2, color: tennisColors.text, marginTop: spacing.xs },
  leidraad: {
    ...typography.body, color: tennisColors.textMuted, marginTop: spacing.xs,
    paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: tennisColors.border,
  },
  deel: { marginTop: spacing.lg },
  waar: {
    fontSize: 11, fontWeight: '700', color: tennisColors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2,
  },
  kop: { ...typography.h3, color: tennisColors.text },
  tekst: { ...typography.body, color: tennisColors.text, marginTop: spacing.xs },
  letop: {
    marginTop: spacing.lg,
    backgroundColor: tennisColors.warningTint,
    borderLeftWidth: 3,
    borderLeftColor: tennisColors.warning,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  letopKop: {
    fontSize: 11, fontWeight: '700', color: tennisColors.warning,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.xs,
  },
  letopTekst: { ...typography.body, fontSize: 14, color: tennisColors.text },
  colofon: {
    ...typography.body, fontSize: 13, color: tennisColors.textMuted,
    marginTop: spacing.sm,
  },
});
