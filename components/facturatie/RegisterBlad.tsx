// Facturatie, blad 3: de gemaakte facturen.
//
// Dit is het archief uit het tabblad Facturenregister. Wat hier staat zijn de cijfers, niet
// het bestand: een factuur opnieuw downloaden kan niet, je maakt hem opnieuw met hetzelfde
// nummer. Een bestand bewaren zou betekenen dat de app megabytes aan zips draagt voor iets
// wat in twee tikken opnieuw gemaakt is.

import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';

import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { Veld } from './LessenBlad';
import { backend } from '../../providers/backend';
import { MAANDNAMEN, type Factuur, type FacturatieData } from '../../lib/facturatie';
import { formatEuro } from '../../lib/money';
import { formatDayInput, parseDayInput } from '../../lib/period';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography, webCursor, minTapTarget } from '../../constants/theme';

/** `2026-10-16` als dag op de kalender. Niet via `new Date(tekst)`: dat leest UTC. */
function alsDag(iso: string): Date {
  const [j, m, d] = iso.split('-').map(Number);
  return new Date(j, m - 1, d);
}

export function RegisterBlad({ data, opnieuwLaden }: {
  data: FacturatieData;
  opnieuwLaden: () => Promise<void>;
}) {
  const [fout, setFout] = useState('');

  async function doe(actie: () => Promise<void>) {
    setFout('');
    try {
      await actie();
      await opnieuwLaden();
    } catch (e) {
      setFout(e instanceof Error ? e.message : String(e));
    }
  }

  if (data.facturen.length === 0) {
    return (
      <Card>
        <Text style={styles.uitleg}>Er staat nog geen factuur in het register.</Text>
      </Card>
    );
  }

  const openstaand = data.facturen.filter((f) => !f.betaald);
  const openBedrag = openstaand.reduce((som, f) => som + f.totaal, 0);

  return (
    <View style={styles.blad}>
      <Card>
        <Text style={styles.kop}>
          {data.facturen.length} facturen, waarvan {openstaand.length} open
        </Text>
        <Text style={styles.uitleg}>Nog te ontvangen: € {formatEuro(openBedrag)}</Text>
      </Card>

      {data.facturen.map((factuur) => (
        <FactuurRij
          key={factuur.id}
          factuur={factuur}
          onBewaar={(f) => doe(() => backend.facturatie.factuurBewaren(f))}
          onVerwijder={() => doe(() => backend.facturatie.factuurVerwijderen(factuur.id))}
        />
      ))}

      {fout !== '' && <Text style={styles.fout}>{fout}</Text>}
    </View>
  );
}

function FactuurRij({ factuur, onBewaar, onVerwijder }: {
  factuur: Factuur;
  onBewaar: (f: Factuur) => Promise<void>;
  onVerwijder: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [bevestig, setBevestig] = useState(false);
  const [betaaldOp, setBetaaldOp] = useState(
    // Niet `new Date('2026-10-16')`: dat leest UTC, en op een toestel westelijk van Greenwich
    // staat er dan 15 oktober in het veld.
    factuur.betaald_op === null ? '' : formatDayInput(alsDag(factuur.betaald_op)),
  );
  const [opmerking, setOpmerking] = useState(factuur.opmerking);

  function zetBetaald(betaald: boolean) {
    void onBewaar({
      ...factuur,
      betaald,
      // Afvinken zet de dag van vandaag; afzetten haalt hem weg. Een betaaldatum zonder
      // betaling is een gegeven dat niemand meer vertrouwt.
      betaald_op: betaald ? new Date().toISOString().slice(0, 10) : null,
    });
  }

  function bewaarDetails() {
    const dag = parseDayInput(betaaldOp);
    void onBewaar({
      ...factuur,
      opmerking,
      betaald_op: dag === null
        ? null
        : `${dag.getFullYear()}-${String(dag.getMonth() + 1).padStart(2, '0')}-${String(dag.getDate()).padStart(2, '0')}`,
    });
  }

  // De kaart zelf is niet aanklikbaar: er staan knoppen en invulvelden in, en een tik daarop
  // zou de kaart er meteen weer bij dichtklappen. Uitklappen gebeurt met de pijl.
  return (
    <Card>
      <View style={styles.rij}>
        <Pressable
          onPress={() => setOpen(!open)}
          accessibilityRole="button"
          accessibilityLabel={`Factuur ${factuur.factuurnr}`}
          accessibilityState={{ expanded: open }}
          style={[styles.rijTekst, webCursor]}
        >
          <Text style={styles.rijKop}>{factuur.factuurnr} · {factuur.klant_naam}</Text>
          <Text style={styles.rijSub}>
            {MAANDNAMEN[factuur.dienstmaand - 1]} {factuur.dienstjaar} ·{' '}
            {formatEuro(factuur.aantal_uren)} u · € {formatEuro(factuur.totaal)}
          </Text>
        </Pressable>
        <Chip
          label={factuur.betaald ? 'Betaald' : 'Open'}
          selected={factuur.betaald}
          onPress={() => zetBetaald(!factuur.betaald)}
        />
        <Pressable
          onPress={() => setOpen(!open)}
          accessibilityRole="button"
          accessibilityLabel={open ? 'Dichtklappen' : 'Openklappen'}
          style={[styles.pijl, webCursor]}
        >
          {open
            ? <ChevronUp size={18} color={tennisColors.textMuted} />
            : <ChevronDown size={18} color={tennisColors.textMuted} />}
        </Pressable>
      </View>

      {open && (
        <View style={styles.details}>
          <Text style={styles.rijSub}>Factuurdatum {factuur.factuurdatum}</Text>
          <Text style={styles.rijSub}>Vervaldatum {factuur.vervaldatum}</Text>
          <Text style={styles.rijSub}>{factuur.omschrijving}</Text>
          <Text style={styles.rijSub}>
            Netto € {formatEuro(factuur.netto)} · BTW € {formatEuro(factuur.btw_bedrag)}
          </Text>

          <Veld label="Betaald op (dd/mm/jjjj)" waarde={betaaldOp} onChange={setBetaaldOp} />
          <Veld label="Opmerking" waarde={opmerking} onChange={setOpmerking} />
          <Button label="Bewaren" onPress={bewaarDetails} />

          {bevestig ? (
            <View style={styles.knoppen}>
              <Button label="Ja, uit het register halen" variant="danger" onPress={() => void onVerwijder()} fullWidth={false} />
              <Button label="Nee" variant="secondary" onPress={() => setBevestig(false)} fullWidth={false} />
            </View>
          ) : (
            <Button label="Uit het register halen" variant="secondary" onPress={() => setBevestig(true)} />
          )}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  blad: { gap: spacing.md },
  kop: { ...typography.h3, color: tennisColors.text },
  uitleg: { ...typography.caption, color: tennisColors.textMuted },
  rij: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rijTekst: { flex: 1, paddingVertical: spacing.xs },
  pijl: {
    minWidth: minTapTarget,
    minHeight: minTapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rijKop: { ...typography.label, color: tennisColors.text },
  rijSub: { ...typography.caption, color: tennisColors.textMuted },
  details: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: tennisColors.border,
    gap: spacing.xs,
  },
  knoppen: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  fout: { ...typography.body, color: tennisColors.danger },
});
