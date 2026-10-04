// Facturatie, blad 4: mijn gegevens en de klanten.
//
// Het veld dat hier het meest toe doet is `naam_in_lijst`: onder welke naam een club in de
// geplakte tekst staat. In facturen.xlsx stond daar "RACSO" terwijl de lijst "T.C. RACSO"
// zegt, en die werkmap telde Racso daardoor op nul uur zonder dat er iets misliep. Daarom
// staat het hier als een gewoon, zichtbaar veld en niet verstopt in de code.

import { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Plus } from 'lucide-react-native';

import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { Veld } from './LessenBlad';
import { backend } from '../../providers/backend';
import { nieuwId, type Bron, type FacturatieData, type Klant, type Leverancier } from '../../lib/facturatie';
import { formatEuro, parseEuro } from '../../lib/money';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography } from '../../constants/theme';

export function InstellingenBlad({ data, opnieuwLaden }: {
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

  // `urenPerClub` gaat ervan uit dat elke naam bij één club hoort en houdt een dubbel niet
  // tegen — daar weet het rekenwerk niet of het een vergissing is. Hier wel: dit is de
  // enige plek waar iemand die naam intikt.
  const dubbeleNamen = useMemo(() => {
    const geteld = new Map<string, number>();
    for (const k of data.klanten) {
      const naam = k.naam_in_lijst.trim();
      if (naam !== '') geteld.set(naam, (geteld.get(naam) ?? 0) + 1);
    }
    return [...geteld.entries()].filter(([, n]) => n > 1).map(([naam]) => naam);
  }, [data.klanten]);

  return (
    <View style={styles.blad}>
      <LeverancierKaart
        leverancier={data.leverancier}
        onBewaar={(l) => doe(() => backend.facturatie.leverancierBewaren(l))}
      />

      {dubbeleNamen.length > 0 && (
        <Text style={styles.waarschuwing}>
          Twee clubs met dezelfde naam in de lijst: {dubbeleNamen.join(', ')}. Ze tellen
          allebei dezelfde lessen, en dan factureer je die twee keer.
        </Text>
      )}

      {data.klanten.map((klant) => (
        <KlantKaart
          key={klant.id}
          klant={klant}
          onBewaar={(k) => doe(() => backend.facturatie.klantBewaren(k))}
          onVerwijder={() => doe(() => backend.facturatie.klantVerwijderen(klant.id))}
        />
      ))}

      <Button
        label="Club toevoegen"
        variant="secondary"
        icon={<Plus size={18} color={tennisColors.primary} />}
        onPress={() => void doe(() => backend.facturatie.klantBewaren({
          id: nieuwId('kl'),
          klantnaam: 'Nieuwe club',
          adres: '',
          postcode_gemeente: '',
          btw_nummer: '',
          uurtarief: 0,
          korte_naam: '',
          naam_in_lijst: '',
          btw_percentage: 0,
          bron_voorkeur: 'geplakt',
          volgorde: data.klanten.length + 1,
        }))}
      />

      {fout !== '' && <Text style={styles.fout}>{fout}</Text>}
    </View>
  );
}

function LeverancierKaart({ leverancier, onBewaar }: {
  leverancier: Leverancier;
  onBewaar: (l: Leverancier) => Promise<void>;
}) {
  const [concept, setConcept] = useState(leverancier);
  const gewijzigd = JSON.stringify(concept) !== JSON.stringify(leverancier);

  return (
    <Card>
      <Text style={styles.kop}>Mijn gegevens</Text>
      <Text style={styles.uitleg}>Deze staan bovenaan elke factuur, aan beide clubs.</Text>
      <Veld label="Naam" waarde={concept.naam} onChange={(naam) => setConcept({ ...concept, naam })} />
      <Veld label="Adres" waarde={concept.adres} onChange={(adres) => setConcept({ ...concept, adres })} />
      <Veld label="BTW-nummer" waarde={concept.btw} onChange={(btw) => setConcept({ ...concept, btw })} />
      <Veld label="IBAN" waarde={concept.iban} onChange={(iban) => setConcept({ ...concept, iban })} />
      <Veld label="BIC" waarde={concept.bic} onChange={(bic) => setConcept({ ...concept, bic })} />
      <Button label="Bewaren" onPress={() => void onBewaar(concept)} disabled={!gewijzigd} />
    </Card>
  );
}

function KlantKaart({ klant, onBewaar, onVerwijder }: {
  klant: Klant;
  onBewaar: (k: Klant) => Promise<void>;
  onVerwijder: () => Promise<void>;
}) {
  const [concept, setConcept] = useState(klant);
  const [tariefTekst, setTariefTekst] = useState(formatEuro(klant.uurtarief));
  const [bevestig, setBevestig] = useState(false);

  const tarief = parseEuro(tariefTekst);
  const gewijzigd = JSON.stringify(concept) !== JSON.stringify(klant)
    || (tarief !== undefined && tarief !== klant.uurtarief);

  const onvolledig = concept.adres.trim() === '' || concept.btw_nummer.trim() === '';

  function zetBron(bron_voorkeur: Bron) {
    setConcept({ ...concept, bron_voorkeur });
  }

  return (
    <Card>
      <Text style={styles.kop}>{klant.klantnaam}</Text>

      {onvolledig && (
        <Text style={styles.waarschuwing}>
          Zonder adres en BTW-nummer van de klant is een factuur niet in orde.
        </Text>
      )}

      <Veld label="Klantnaam" waarde={concept.klantnaam} onChange={(klantnaam) => setConcept({ ...concept, klantnaam })} />
      <Veld label="Adres" waarde={concept.adres} onChange={(adres) => setConcept({ ...concept, adres })} />
      <Veld label="Postcode + gemeente" waarde={concept.postcode_gemeente} onChange={(postcode_gemeente) => setConcept({ ...concept, postcode_gemeente })} />
      <Veld label="BTW-nummer" waarde={concept.btw_nummer} onChange={(btw_nummer) => setConcept({ ...concept, btw_nummer })} />
      <Veld label="Uurtarief (€)" waarde={tariefTekst} onChange={setTariefTekst} />
      <Veld label="Korte naam — hier hangen de privélessen aan" waarde={concept.korte_naam} onChange={(korte_naam) => setConcept({ ...concept, korte_naam })} />
      <Veld
        label="Naam in de geplakte lijst — exact, bv. T.C. RACSO"
        waarde={concept.naam_in_lijst}
        onChange={(naam_in_lijst) => setConcept({ ...concept, naam_in_lijst })}
      />

      <Text style={styles.veldLabel}>Waar komen de uren vandaan?</Text>
      <View style={styles.bronnen}>
        <Chip label="De geplakte lijst" selected={concept.bron_voorkeur === 'geplakt'} onPress={() => zetBron('geplakt')} />
        <Chip label="De app" selected={concept.bron_voorkeur === 'app'} onPress={() => zetBron('app')} />
      </View>

      <Button
        label="Bewaren"
        onPress={() => void onBewaar({ ...concept, uurtarief: tarief ?? klant.uurtarief })}
        disabled={!gewijzigd}
      />

      {bevestig ? (
        <View style={styles.knoppen}>
          <Button label="Ja, verwijderen" variant="danger" onPress={() => void onVerwijder()} fullWidth={false} />
          <Button label="Nee" variant="secondary" onPress={() => setBevestig(false)} fullWidth={false} />
        </View>
      ) : (
        <Button label="Club verwijderen" variant="secondary" onPress={() => setBevestig(true)} />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  blad: { gap: spacing.lg },
  kop: { ...typography.h3, color: tennisColors.text, marginBottom: spacing.xs },
  uitleg: { ...typography.caption, color: tennisColors.textMuted, marginBottom: spacing.sm },
  waarschuwing: { ...typography.caption, color: tennisColors.warning, marginBottom: spacing.sm },
  veldLabel: { ...typography.caption, color: tennisColors.textMuted, marginBottom: 2 },
  bronnen: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md },
  knoppen: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  fout: { ...typography.body, color: tennisColors.danger },
});
