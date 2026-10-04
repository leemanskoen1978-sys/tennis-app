// Facturatie, blad 2: de factuur maken.
//
// Per klant staan de twee bronnen naast elkaar — wat de app zegt en wat de geplakte lijst
// zegt — en je kiest er één. Optellen kan niet: ze beschrijven dezelfde lessen. Verschillen
// de twee, dan staat dat er met zoveel woorden bij; dat is de controle die in facturen.xlsx
// niemand deed.
//
// De zeven controleformules uit K9:L18 van het oude blad staan hier als meldingen. Alleen een
// leeg factuurnummer en een totaal van nul houden de knop tegen. De rest zijn waarschuwingen:
// Koen weet beter dan de app wanneer een factuur toch mag.

import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Plus, Trash2 } from 'lucide-react-native';

import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { Veld } from './LessenBlad';
import { backend } from '../../providers/backend';
import { factuurBestandsnaam, factuurWerkmap } from '../../lib/facturatie-xlsx';
import { shareXlsx, xlsxWordtOndersteund } from '../../lib/share';
import {
  MAANDNAMEN, extraLessenUit, factuurUit, nieuwId, onbekendeClubs, rond2, urenPerClub,
  urenUitApp,
  type AppBoeking, type Bron, type ExtraLes, type FacturatieData, type Klant,
  type VrijeLijn,
} from '../../lib/facturatie';
import { formatEuro, parseEuro } from '../../lib/money';
import { formatDayInput, parseDayInput } from '../../lib/period';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, radius, typography, webCursor, minTapTarget } from '../../constants/theme';

/**
 * Een vrije lijn zoals het scherm hem vasthoudt, met een eigen sleutel erbij.
 *
 * Die sleutel staat er voor React en gaat niet mee de databank in. Zonder hem zou een lijst
 * op volgnummer gesleuteld worden, en dan hergebruikt React de rij die op die plek stond
 * zodra je er eentje wegneemt — met het aantal en het tarief van de verwijderde lijn nog in
 * beeld, want die velden houden hun eigen tekst vast terwijl je typt.
 */
interface LijnInBewerking extends VrijeLijn {
  sleutel: string;
}

/** Wat ervan op de factuur komt: zonder de sleutel, die alleen het scherm nodig had. */
function zonderSleutel(lijn: LijnInBewerking): VrijeLijn {
  return {
    omschrijving: lijn.omschrijving,
    aantal: lijn.aantal,
    eenheid: lijn.eenheid,
    tarief: lijn.tarief,
  };
}

/**
 * Valt deze factuurdatum redelijk bij deze dienstmaand?
 *
 * Redelijk is: vanaf de eerste van de dienstmaand tot en met het einde van de maand erna.
 * Dat is dezelfde marge als de controle in L16 van het oude blad (`EOMONTH(...;1)`), en ze
 * vangt het echte geval: je maakt de factuur van september begin oktober.
 */
function datumPastBijMaand(dag: Date, maand: number, jaar: number): boolean {
  const begin = new Date(jaar, maand - 1, 1);
  // Dag 0 van twee maanden verder is de laatste dag van de maand erna; de maandgrens en de
  // jaargrens rolt `Date` zelf om.
  const eind = new Date(jaar, maand + 1, 0, 23, 59, 59);
  return dag >= begin && dag <= eind;
}

/** De vorige maand. Een factuur maak je achteraf, niet voor de maand waar je in zit. */
function vorigeMaand(nu: Date): { maand: number; jaar: number } {
  const maand = nu.getMonth(); // 0-gebaseerd = de vorige maand, 1-gebaseerd
  return maand === 0
    ? { maand: 12, jaar: nu.getFullYear() - 1 }
    : { maand, jaar: nu.getFullYear() };
}

export function FactuurBlad({ data, bookings, trainerId, opnieuwLaden }: {
  data: FacturatieData;
  bookings: readonly AppBoeking[];
  trainerId: string;
  opnieuwLaden: () => Promise<void>;
}) {
  const start = useMemo(() => vorigeMaand(new Date()), []);
  const [maand, setMaand] = useState(start.maand);
  const [jaar, setJaar] = useState(start.jaar);

  const perClub = useMemo(
    () => urenPerClub(data.lessen, data.klanten, maand, jaar),
    [data.lessen, data.klanten, maand, jaar],
  );
  const uitApp = useMemo(
    () => urenUitApp(bookings, trainerId, maand, jaar),
    [bookings, trainerId, maand, jaar],
  );
  const onbekend = useMemo(
    () => onbekendeClubs(data.lessen, data.klanten, maand, jaar),
    [data.lessen, data.klanten, maand, jaar],
  );

  const opApp = data.klanten.filter((k) => k.bron_voorkeur === 'app').length;

  return (
    <View style={styles.blad}>
      <Card>
        <Text style={styles.kop}>Welke maand?</Text>
        <View style={styles.maanden}>
          {MAANDNAMEN.map((naam, i) => (
            <Chip key={naam} label={naam.slice(0, 3)} selected={maand === i + 1} onPress={() => setMaand(i + 1)} />
          ))}
        </View>
        <View style={styles.maanden}>
          {[jaar - 1, jaar, jaar + 1].map((j) => (
            <Chip key={j} label={String(j)} selected={jaar === j} onPress={() => setJaar(j)} />
          ))}
        </View>
      </Card>

      {onbekend.map((club) => (
        <Text key={club.naam} style={styles.waarschuwing}>
          {club.aantal} {club.aantal === 1 ? 'les' : 'lessen'} bij een club die ik niet ken:{' '}
          {club.naam}. Voeg hem toe bij Instellingen, met die naam in het veld
          &quot;naam in de geplakte lijst&quot;.
        </Text>
      ))}

      {opApp > 1 && (
        <Text style={styles.waarschuwing}>
          {opApp} clubs staan op de bron &quot;de app&quot;. De app weet niet bij welke club een
          les hoort, dus die tellen allebei dezelfde uren.
        </Text>
      )}

      {perClub.map((rij) => (
        <KlantFactuur
          // De maand hoort in de sleutel. Een factuurkaart draagt een nummer, een datum,
          // een omschrijving en vrije lijnen die bij één maand horen; blijft dezelfde kaart
          // staan als je van maand wisselt, dan houdt ze "Tennislessen September" en die
          // ene extra lijn vast terwijl de uren al die van augustus zijn. Een andere
          // sleutel geeft een schone kaart, en dat is precies wat een andere maand is.
          key={`${rij.klant.id}-${jaar}-${maand}`}
          klant={rij.klant}
          urenGeplakt={rij.urenGeplakt}
          urenPrive={rij.urenPrive}
          urenApp={uitApp}
          extraLessen={extraLessenUit(data.lessen, rij.klant, maand, jaar)}
          maand={maand}
          jaar={jaar}
          data={data}
          opnieuwLaden={opnieuwLaden}
        />
      ))}
    </View>
  );
}

function KlantFactuur({
  klant, urenGeplakt, urenPrive, urenApp, extraLessen, maand, jaar, data, opnieuwLaden,
}: {
  klant: Klant;
  urenGeplakt: number;
  urenPrive: number;
  urenApp: number;
  extraLessen: readonly ExtraLes[];
  maand: number;
  jaar: number;
  data: FacturatieData;
  opnieuwLaden: () => Promise<void>;
}) {
  const [bron, setBron] = useState<Bron>(klant.bron_voorkeur);
  const [nummer, setNummer] = useState('');
  const [datum, setDatum] = useState(formatDayInput(new Date()));
  const [omschrijving, setOmschrijving] = useState(
    `Tennislessen ${MAANDNAMEN[maand - 1]} ${jaar}`,
  );
  const [lijnen, setLijnen] = useState<LijnInBewerking[]>([]);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState('');
  const [klaar, setKlaar] = useState('');

  const urenBron = bron === 'app' ? urenApp : urenGeplakt;
  const uren = rond2(urenBron + urenPrive);
  // Met de áfgedrukte uren rekenen, niet met het ruwe getal. Staat er 8,01 u op de factuur
  // en rekent het bedrag met 8,005, dan telt de regel niet op tot het nettobedrag eronder —
  // en dan heeft wie het natelt gelijk en de factuur ongelijk.
  const aantalUren = rond2(uren);
  const urenBedrag = rond2(aantalUren * klant.uurtarief);
  const vrijBedrag = lijnen.reduce((som, l) => som + rond2(l.aantal * l.tarief), 0);
  const netto = rond2(urenBedrag + vrijBedrag);
  const btw = rond2((netto * klant.btw_percentage) / 100);
  const totaal = rond2(netto + btw);

  const dag = parseDayInput(datum);
  const dagIso = dag === null
    ? ''
    : `${dag.getFullYear()}-${String(dag.getMonth() + 1).padStart(2, '0')}-${String(dag.getDate()).padStart(2, '0')}`;

  const nummerBestaat = data.facturen.some((f) => f.factuurnr.trim() === nummer.trim());
  const alGefactureerd = data.facturen.some(
    (f) => f.klant_naam === klant.klantnaam && f.dienstmaand === maand && f.dienstjaar === jaar,
  );
  const datumBuitenMaand = dag !== null && !datumPastBijMaand(dag, maand, jaar);
  const bronnenVerschillen = urenApp !== urenGeplakt;

  const mag = nummer.trim() !== '' && uren > 0 && dag !== null && !bezig;

  async function kiesBron(nieuw: Bron) {
    setBron(nieuw);
    // Meteen bewaren: de keuze hoort bij de klant en niet bij dit scherm, zodat Gantoise
    // volgende maand weer op de app staat zonder dat iemand eraan denkt.
    try {
      await backend.facturatie.klantBewaren({ ...klant, bron_voorkeur: nieuw });
      await opnieuwLaden();
    } catch (e) {
      setFout(e instanceof Error ? e.message : String(e));
    }
  }

  async function maak() {
    if (!mag) return;
    setBezig(true);
    setFout('');
    setKlaar('');
    try {
      const factuur = factuurUit({
        id: nieuwId('fac'),
        klant,
        uren,
        vrijeLijnen: lijnen.map(zonderSleutel),
        extraLessen,
        factuurnr: nummer.trim(),
        factuurdatum: dagIso,
        omschrijving,
        maand,
        jaar,
        aangemaakt: new Date().toISOString(),
      });

      const bytes = factuurWerkmap(factuur, data.leverancier);
      await shareXlsx(factuurBestandsnaam(factuur.factuurnr), bytes);
      // Pas registreren nadat het bestand er is: mislukt de download, dan staat er geen
      // factuur in het register die nooit verstuurd is.
      await backend.facturatie.factuurBewaren(factuur);
      await opnieuwLaden();
      setKlaar(`${factuur.factuurnr} staat in het register.`);
      setNummer('');
      setLijnen([]);
    } catch (e) {
      setFout(e instanceof Error ? e.message : String(e));
    } finally {
      setBezig(false);
    }
  }

  return (
    <Card>
      <Text style={styles.kop}>{klant.klantnaam}</Text>

      <BronRegel label="Uit de app" uren={urenApp} gekozen={bron === 'app'} onKies={() => void kiesBron('app')} />
      <BronRegel label="Uit de geplakte lijst" uren={urenGeplakt} gekozen={bron === 'geplakt'} onKies={() => void kiesBron('geplakt')} />
      <View style={styles.regel}>
        <Text style={styles.regelLabel}>
          Extra lessen{extraLessen.length > 0 ? ` (${extraLessen.length})` : ''}
        </Text>
        <Text style={styles.regelUren}>{formatEuro(urenPrive)} u</Text>
      </View>

      {extraLessen.length > 0 && (
        <Text style={styles.uitleg}>
          Gaan als tweede tabblad mee in het bestand:{' '}
          {extraLessen.map((l) => l.naam).join(', ')}.
        </Text>
      )}

      <View style={styles.totaalBlok}>
        <Text style={styles.totaalRegel}>
          {formatEuro(uren)} u × € {formatEuro(klant.uurtarief)} = € {formatEuro(urenBedrag)}
        </Text>
        {lijnen.length > 0 && (
          <Text style={styles.totaalRegel}>Vrije lijnen: € {formatEuro(vrijBedrag)}</Text>
        )}
        <Text style={styles.totaalRegel}>
          BTW {formatEuro(klant.btw_percentage)} %: € {formatEuro(btw)}
        </Text>
        <Text style={styles.teBetalen}>Te betalen: € {formatEuro(totaal)}</Text>
      </View>

      {bronnenVerschillen && (
        <Text style={styles.waarschuwing}>
          De app zegt {formatEuro(urenApp)} u, de geplakte lijst {formatEuro(urenGeplakt)} u.
        </Text>
      )}
      {nummerBestaat && nummer.trim() !== '' && (
        <Text style={styles.waarschuwing}>Dit nummer staat al in het register.</Text>
      )}
      {alGefactureerd && (
        <Text style={styles.waarschuwing}>
          Deze club is deze maand al gefactureerd.
        </Text>
      )}
      {datumBuitenMaand && (
        <Text style={styles.waarschuwing}>De factuurdatum valt buiten de dienstmaand.</Text>
      )}
      {uren === 0 && <Text style={styles.waarschuwing}>Er zijn geen uren voor deze maand.</Text>}

      <Veld label="Factuurnummer" waarde={nummer} onChange={setNummer} placeholder="NG-0007" />
      <Veld label="Factuurdatum (dd/mm/jjjj)" waarde={datum} onChange={setDatum} />
      <Text style={styles.uitleg}>
        Vervaldatum: {dag === null ? '—' : formatDayInput(new Date(dag.getTime() + 15 * 86_400_000))}
      </Text>
      <Veld label="Omschrijving" waarde={omschrijving} onChange={setOmschrijving} />

      {lijnen.map((lijn) => (
        <VrijeLijnRegel
          key={lijn.sleutel}
          lijn={lijn}
          onWijzig={(nieuw) => setLijnen(lijnen.map(
            (l) => (l.sleutel === lijn.sleutel ? { ...nieuw, sleutel: l.sleutel } : l),
          ))}
          onWeg={() => setLijnen(lijnen.filter((l) => l.sleutel !== lijn.sleutel))}
        />
      ))}

      <Button
        label="Vrije lijn toevoegen"
        variant="secondary"
        icon={<Plus size={18} color={tennisColors.primary} />}
        onPress={() => setLijnen([...lijnen, {
          sleutel: nieuwId('lijn'), omschrijving: '', aantal: 1, eenheid: 'stuk', tarief: 0,
        }])}
      />

      {/*
        Downloaden kan alleen op het web — `shareXlsx` zegt dat zelf ook. De knop hier laten
        staan en hem daar laten omvallen is wat de andere exportschermen bewust níét doen;
        zie app/admin/export en app/admin/reports.
      */}
      {xlsxWordtOndersteund ? (
        <Button
          label={bezig ? 'Bezig…' : 'Factuur downloaden'}
          onPress={() => void maak()}
          disabled={!mag}
        />
      ) : (
        <Text style={styles.uitleg}>
          Een factuur maken kan alleen op de website, niet op een telefoon.
        </Text>
      )}

      {klaar !== '' && <Text style={styles.klaar}>{klaar}</Text>}
      {fout !== '' && <Text style={styles.fout}>{fout}</Text>}
    </Card>
  );
}

function BronRegel({ label, uren, gekozen, onKies }: {
  label: string;
  uren: number;
  gekozen: boolean;
  onKies: () => void;
}) {
  return (
    <Pressable
      onPress={onKies}
      accessibilityRole="radio"
      accessibilityState={{ selected: gekozen }}
      accessibilityLabel={`${label}: ${formatEuro(uren)} uur`}
      style={[styles.regel, gekozen && styles.regelGekozen, webCursor]}
    >
      <Text style={[styles.regelLabel, gekozen && styles.regelLabelGekozen]}>{label}</Text>
      <Text style={[styles.regelUren, gekozen && styles.regelLabelGekozen]}>{formatEuro(uren)} u</Text>
    </Pressable>
  );
}

function VrijeLijnRegel({ lijn, onWijzig, onWeg }: {
  lijn: VrijeLijn;
  onWijzig: (lijn: VrijeLijn) => void;
  onWeg: () => void;
}) {
  const [aantal, setAantal] = useState(String(lijn.aantal));
  const [tarief, setTarief] = useState(formatEuro(lijn.tarief));

  return (
    <View style={styles.vrijeLijn}>
      <Veld label="Omschrijving" waarde={lijn.omschrijving} onChange={(omschrijving) => onWijzig({ ...lijn, omschrijving })} />
      <Veld label="Eenheid" waarde={lijn.eenheid} onChange={(eenheid) => onWijzig({ ...lijn, eenheid })} />
      <Veld
        label="Aantal"
        waarde={aantal}
        onChange={(tekst) => {
          setAantal(tekst);
          const getal = Number(tekst.replace(',', '.'));
          if (Number.isFinite(getal) && getal >= 0) onWijzig({ ...lijn, aantal: getal });
        }}
      />
      <Veld
        label="Tarief (€)"
        waarde={tarief}
        onChange={(tekst) => {
          setTarief(tekst);
          const bedrag = parseEuro(tekst);
          if (bedrag !== undefined) onWijzig({ ...lijn, tarief: bedrag });
        }}
      />
      <Pressable onPress={onWeg} accessibilityRole="button" accessibilityLabel="Lijn weghalen" style={[styles.knopje, webCursor]}>
        <Trash2 size={18} color={tennisColors.danger} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  blad: { gap: spacing.lg },
  kop: { ...typography.h3, color: tennisColors.text, marginBottom: spacing.sm },
  uitleg: { ...typography.caption, color: tennisColors.textMuted, marginBottom: spacing.sm },
  maanden: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  regel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    minHeight: minTapTarget,
  },
  regelGekozen: { backgroundColor: tennisColors.primaryTint },
  regelLabel: { ...typography.body, color: tennisColors.textMuted },
  regelLabelGekozen: { color: tennisColors.text, fontWeight: '700' },
  regelUren: { ...typography.body, color: tennisColors.textMuted },
  totaalBlok: {
    borderTopWidth: 1,
    borderTopColor: tennisColors.border,
    paddingTop: spacing.sm,
    marginBottom: spacing.sm,
    gap: 2,
  },
  totaalRegel: { ...typography.caption, color: tennisColors.textMuted },
  teBetalen: { ...typography.h3, color: tennisColors.court, marginTop: spacing.xs },
  waarschuwing: { ...typography.caption, color: tennisColors.warning, marginBottom: spacing.sm },
  vrijeLijn: {
    borderWidth: 1,
    borderColor: tennisColors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  knopje: {
    minWidth: minTapTarget,
    minHeight: minTapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  klaar: { ...typography.body, color: tennisColors.success, marginTop: spacing.sm },
  fout: { ...typography.body, color: tennisColors.danger, marginTop: spacing.sm },
});
