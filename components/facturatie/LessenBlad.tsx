// Facturatie, blad 1: de lessen.
//
// Hier komt de lijst binnen die uit het clubsysteem gekopieerd wordt, en hier staat wat er
// met de hand bij moet. Eén regel: wat niet gelezen kan worden, komt op het scherm. Een
// factuur die twee uur te weinig telt omdat één regel stil overgeslagen werd, merkt niemand.

import { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Plus, RotateCcw, Trash2 } from 'lucide-react-native';

import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { backend } from '../../providers/backend';
import { leesPlaktekst, verwerkPlak, type OvergeslagenRegel } from '../../lib/facturatie-plak';
import {
  MAANDNAMEN, nieuwId, sleutelVan, urenVan,
  type FacturatieData, type Factuurles,
} from '../../lib/facturatie';
import { formatEuro } from '../../lib/money';
import { parseDayInput, formatDayInput } from '../../lib/period';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, radius, typography, webCursor, minTapTarget } from '../../constants/theme';

/** Wat er na een plakbeurt op het scherm komt. */
interface Uitkomst {
  nieuw: number;
  bekend: number;
  overgeslagen: OvergeslagenRegel[];
}

/**
 * De extra lessen die er op dit moment bij kunnen komen: twee, allebei bij Racso en allebei
 * sponsor.
 *
 * Een lijst bovenaan en geen twee knoppen verderop in de opmaak, zodat er een regel bij kan
 * komen zonder dat iemand door het scherm moet. Het volle formulier eronder blijft bestaan: deze
 * twee zijn de stand van zaken van 4 oktober 2026, geen wet.
 */
const SNELLE_EXTRA_LESSEN = [
  { naam: 'Stan', type: 'sponsor', club: 'Racso', van: '09:00', tot: '10:00', uren: 1 },
  { naam: 'Veerle', type: 'sponsor', club: 'Racso', van: '10:00', tot: '11:00', uren: 1 },
] as const;

export function LessenBlad({ data, opnieuwLaden }: {
  data: FacturatieData;
  opnieuwLaden: () => Promise<void>;
}) {
  const [tekst, setTekst] = useState('');
  const [bezig, setBezig] = useState(false);
  const [uitkomst, setUitkomst] = useState<Uitkomst | null>(null);
  const [fout, setFout] = useState('');
  const [filterClub, setFilterClub] = useState('');
  const [filterMaand, setFilterMaand] = useState('');
  const [prive, setPrive] = useState(false);

  async function verwerken() {
    setBezig(true);
    setFout('');
    try {
      const gelezen = leesPlaktekst(tekst);
      const { nieuw, bekend } = verwerkPlak(data.lessen, gelezen.lessen);

      await backend.facturatie.lessenToevoegen(nieuw.map((l) => ({
        ...l,
        id: nieuwId('les'),
        uren_handmatig: null,
        actief: true,
        naam_prive: '',
        type_prive: '',
      })));

      setUitkomst({ nieuw: nieuw.length, bekend, overgeslagen: gelezen.overgeslagen });
      setTekst('');
      await opnieuwLaden();
    } catch (e) {
      setFout(e instanceof Error ? e.message : String(e));
    } finally {
      setBezig(false);
    }
  }

  async function bewaarLes(les: Factuurles) {
    setFout('');
    try {
      await backend.facturatie.lesBewaren(les);
      await opnieuwLaden();
    } catch (e) {
      setFout(e instanceof Error ? e.message : String(e));
    }
  }

  const clubs = useMemo(
    () => [...new Set(data.lessen.map((l) => l.club_tekst))].sort(),
    [data.lessen],
  );

  // De maanden waarin er iets staat, nieuwste eerst: `2026-09`.
  const maanden = useMemo(
    () => [...new Set(data.lessen.map((l) => l.datum.slice(0, 7)))].sort().reverse(),
    [data.lessen],
  );

  // Nieuwste eerst: de maand waar je mee bezig bent, staat bovenaan.
  const zichtbaar = useMemo(() => {
    const gefilterd = data.lessen.filter((l) =>
      (filterClub === '' || l.club_tekst === filterClub)
      && (filterMaand === '' || l.datum.startsWith(filterMaand)));
    return [...gefilterd].sort((a, b) => b.datum.localeCompare(a.datum));
  }, [data.lessen, filterClub, filterMaand]);

  /** `2026-09` → `September 2026`. */
  function maandLabel(sleutel: string): string {
    const [jaar, maand] = sleutel.split('-');
    return `${MAANDNAMEN[Number(maand) - 1]} ${jaar}`;
  }

  return (
    <View style={styles.blad}>
      <Card>
        <Text style={styles.kop}>Lijst plakken</Text>
        <Text style={styles.uitleg}>
          Kopieer het overzicht uit het clubsysteem en plak het hier. De koprij mag mee. Lessen
          die al gekend zijn, komen er geen tweede keer bij.
        </Text>
        <TextInput
          value={tekst}
          onChangeText={setTekst}
          multiline
          numberOfLines={8}
          placeholder="GANTOISE&#9;Tennis - Jaarcyclus…"
          placeholderTextColor={tennisColors.textMuted}
          style={styles.plakvlak}
        />
        <Button
          label={bezig ? 'Bezig…' : 'Verwerken'}
          onPress={() => void verwerken()}
          disabled={bezig || tekst.trim() === ''}
        />

        {uitkomst && (
          <View style={styles.melding}>
            <Text style={styles.meldingTekst}>
              {uitkomst.nieuw} nieuw, {uitkomst.bekend} waren al gekend,{' '}
              {uitkomst.overgeslagen.length} overgeslagen.
            </Text>
            {uitkomst.overgeslagen.map((r, i) => (
              <Text key={i} style={styles.overgeslagen} numberOfLines={2}>
                {r.reden}: {r.regel}
              </Text>
            ))}
          </View>
        )}
      </Card>

      <SnelleExtraLes onBewaar={bewaarLes} />

      <PriveFormulier
        open={prive}
        onOpen={() => setPrive(true)}
        onSluit={() => setPrive(false)}
        onBewaar={async (les) => {
          await bewaarLes(les);
          setPrive(false);
        }}
      />

      <Card>
        <Text style={styles.kop}>
          {zichtbaar.length} van {data.lessen.length} lessen ·{' '}
          {formatEuro(zichtbaar.filter((l) => l.actief).reduce((som, l) => som + urenVan(l), 0))} u
        </Text>
        <View style={styles.filters}>
          <Chip label="Alle clubs" selected={filterClub === ''} onPress={() => setFilterClub('')} />
          {clubs.map((c) => (
            <Chip key={c} label={c} selected={filterClub === c} onPress={() => setFilterClub(c)} />
          ))}
        </View>
        <View style={styles.filters}>
          <Chip label="Alle maanden" selected={filterMaand === ''} onPress={() => setFilterMaand('')} />
          {maanden.map((m) => (
            <Chip key={m} label={maandLabel(m)} selected={filterMaand === m} onPress={() => setFilterMaand(m)} />
          ))}
        </View>

        {zichtbaar.length === 0 && <Text style={styles.uitleg}>Niets om te tonen.</Text>}

        {zichtbaar.map((les) => (
          <Lesregel key={les.id} les={les} onBewaar={bewaarLes} />
        ))}
      </Card>

      {fout !== '' && <Text style={styles.fout}>{fout}</Text>}
    </View>
  );
}

/** Eén les in de lijst: wat hij is, hoeveel uur hij telt, en of hij meetelt. */
function Lesregel({ les, onBewaar }: {
  les: Factuurles;
  onBewaar: (les: Factuurles) => Promise<void>;
}) {
  const [urenTekst, setUrenTekst] = useState(String(urenVan(les)));

  function zetUren() {
    const getal = Number(urenTekst.replace(',', '.'));
    // Onzin of hetzelfde getal: niets wegschrijven. Een lege databankronde per toetsaanslag
    // is precies wat dit scherm traag zou maken.
    if (!Number.isFinite(getal) || getal < 0 || getal === urenVan(les)) {
      setUrenTekst(String(urenVan(les)));
      return;
    }
    void onBewaar({ ...les, uren_handmatig: getal });
  }

  const aangepast = les.uren_handmatig !== null;

  return (
    <View style={[styles.regel, !les.actief && styles.regelGeschrapt]}>
      <View style={styles.regelTekst}>
        <Text style={[styles.regelKop, !les.actief && styles.doorstreept]} numberOfLines={1}>
          {les.bron === 'prive' ? `${les.naam_prive} · ${les.type_prive}` : les.groep}
        </Text>
        <Text style={styles.regelSub} numberOfLines={1}>
          {les.club_tekst} · {les.bron === 'prive' ? les.datum : les.dag_uur}
          {aangepast ? ` · gerekend: ${les.uren}` : ''}
        </Text>
      </View>

      <TextInput
        value={urenTekst}
        onChangeText={setUrenTekst}
        onBlur={zetUren}
        keyboardType="decimal-pad"
        style={styles.urenVeld}
        accessibilityLabel="Uren"
      />

      <Pressable
        onPress={() => void onBewaar({ ...les, actief: !les.actief })}
        accessibilityRole="button"
        accessibilityLabel={les.actief ? 'Schrappen' : 'Terugzetten'}
        style={[styles.knopje, webCursor]}
      >
        {les.actief
          ? <Trash2 size={18} color={tennisColors.danger} />
          : <RotateCcw size={18} color={tennisColors.primary} />}
      </Pressable>
    </View>
  );
}

/**
 * De twee vaste extra lessen bij Racso, met één tik.
 *
 * Alles staat al ingevuld behalve de datum, want dat is het enige wat per keer verschilt.
 * Zo is een maand bijtikken acht tikken in plaats van acht formulieren.
 */
function SnelleExtraLes({ onBewaar }: { onBewaar: (les: Factuurles) => Promise<void> }) {
  const [datum, setDatum] = useState(formatDayInput(new Date()));
  const dag = parseDayInput(datum);

  return (
    <Card>
      <Text style={styles.kop}>Extra les</Text>
      <Text style={styles.uitleg}>
        Kies de datum en tik op wie er les had. Staat er iemand anders op de baan, gebruik dan
        het formulier eronder.
      </Text>
      <Veld label="Datum (dd/mm/jjjj)" waarde={datum} onChange={setDatum} />
      <View style={styles.knoppen}>
        {SNELLE_EXTRA_LESSEN.map((sjabloon) => (
          <Button
            key={sjabloon.naam}
            label={`${sjabloon.naam} ${sjabloon.van}-${sjabloon.tot}`}
            variant="secondary"
            fullWidth={false}
            disabled={dag === null}
            onPress={() => {
              if (dag === null) return;
              void onBewaar(priveLes({
                naam: sjabloon.naam,
                type: sjabloon.type,
                club: sjabloon.club,
                dag,
                uren: sjabloon.uren,
                dagUur: `${sjabloon.van} - ${sjabloon.tot}`,
              }));
            }}
          />
        ))}
      </View>
    </Card>
  );
}

/**
 * Eén privéles, klaar om weg te schrijven.
 *
 * Staat apart omdat de snelknoppen en het volle formulier allebei precies dezelfde rij
 * moeten maken — zou dat op twee plekken staan, dan loopt er ooit één achter.
 */
function priveLes({ naam, type, club, dag, uren, dagUur }: {
  naam: string;
  type: string;
  club: string;
  dag: Date;
  uren: number;
  dagUur: string;
}): Factuurles {
  const iso = `${dag.getFullYear()}-${String(dag.getMonth() + 1).padStart(2, '0')}-${String(dag.getDate()).padStart(2, '0')}`;
  const id = nieuwId('priv');
  return {
    id,
    bron: 'prive',
    // De korte naam van de klant: zo telt `urenPerClub` een privéles mee. Een geplakte les
    // hangt aan `naam_in_lijst`, en dat is een andere naam voor dezelfde club.
    club_tekst: club.trim(),
    aanbod: '',
    doelgroep: '',
    groep: '',
    dag_uur: dagUur,
    trainer: '',
    status: '',
    datum: iso,
    uren,
    uren_handmatig: null,
    actief: true,
    naam_prive: naam.trim(),
    type_prive: type.trim(),
    // Een eigen sleutel met het id erin: twee identieke privélessen op dezelfde dag zijn
    // twee lessen, en mogen elkaar niet uitsluiten op de unieke index.
    sleutel: `${sleutelVan(club, naam, iso)}|${id}`,
  };
}

/** Een privéles bijtikken: het blokje M–Q uit Sheet3 van facturen.xlsx. */
function PriveFormulier({ open, onOpen, onSluit, onBewaar }: {
  open: boolean;
  onOpen: () => void;
  onSluit: () => void;
  onBewaar: (les: Factuurles) => Promise<void>;
}) {
  const [naam, setNaam] = useState('');
  const [type, setType] = useState('');
  const [club, setClub] = useState('');
  const [datum, setDatum] = useState(formatDayInput(new Date()));
  const [uren, setUren] = useState('1');

  const dag = parseDayInput(datum);
  const urenGetal = Number(uren.replace(',', '.'));
  const mag = naam.trim() !== '' && club.trim() !== '' && dag !== null
    && Number.isFinite(urenGetal) && urenGetal > 0;

  if (!open) {
    return (
      <Button
        label="Privéles toevoegen"
        variant="secondary"
        icon={<Plus size={18} color={tennisColors.primary} />}
        onPress={onOpen}
      />
    );
  }

  function bewaar() {
    if (!mag || dag === null) return;
    void onBewaar(priveLes({
      naam, type, club, dag, uren: urenGetal, dagUur: '',
    }));
    setNaam('');
    setType('');
  }

  return (
    <Card>
      <Text style={styles.kop}>Privéles</Text>
      <Veld label="Naam" waarde={naam} onChange={setNaam} />
      <Veld label="Type" waarde={type} onChange={setType} />
      <Veld label="Club (korte naam, bv. Racso)" waarde={club} onChange={setClub} />
      <Veld label="Datum (dd/mm/jjjj)" waarde={datum} onChange={setDatum} />
      <Veld label="Uren" waarde={uren} onChange={setUren} />
      <View style={styles.knoppen}>
        <Button label="Bewaren" onPress={bewaar} disabled={!mag} fullWidth={false} />
        <Button label="Annuleren" variant="secondary" onPress={onSluit} fullWidth={false} />
      </View>
    </Card>
  );
}

/** Eén invulveld met zijn opschrift. Staat hier omdat vier bladen hem anders viermaal typen. */
export function Veld({ label, waarde, onChange, placeholder }: {
  label: string;
  waarde: string;
  onChange: (tekst: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={styles.veld}>
      <Text style={styles.veldLabel}>{label}</Text>
      <TextInput
        value={waarde}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={tennisColors.textMuted}
        style={styles.invoer}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  blad: { gap: spacing.lg },
  kop: { ...typography.h3, color: tennisColors.text, marginBottom: spacing.xs },
  uitleg: { ...typography.caption, color: tennisColors.textMuted, marginBottom: spacing.sm },
  plakvlak: {
    minHeight: 140,
    borderWidth: 1,
    borderColor: tennisColors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    color: tennisColors.text,
    backgroundColor: tennisColors.surfaceAlt,
    marginBottom: spacing.sm,
    textAlignVertical: 'top',
  },
  melding: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: tennisColors.primaryTint,
    gap: spacing.xs,
  },
  meldingTekst: { ...typography.label, color: tennisColors.text },
  overgeslagen: { ...typography.caption, color: tennisColors.warning },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  regel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: tennisColors.border,
  },
  regelGeschrapt: { opacity: 0.5 },
  regelTekst: { flex: 1 },
  regelKop: { ...typography.label, color: tennisColors.text },
  regelSub: { ...typography.caption, color: tennisColors.textMuted },
  doorstreept: { textDecorationLine: 'line-through' },
  urenVeld: {
    width: 64,
    textAlign: 'right',
    borderWidth: 1,
    borderColor: tennisColors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    color: tennisColors.text,
  },
  knopje: {
    minWidth: minTapTarget,
    minHeight: minTapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  veld: { marginBottom: spacing.sm },
  veldLabel: { ...typography.caption, color: tennisColors.textMuted, marginBottom: 2 },
  invoer: {
    borderWidth: 1,
    borderColor: tennisColors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    color: tennisColors.text,
    backgroundColor: tennisColors.surface,
  },
  knoppen: { flexDirection: 'row', gap: spacing.sm },
  fout: { ...typography.body, color: tennisColors.danger },
});
