// De oefeningen per kleur: kies blauw, rood, oranje of groen en een week, en je krijgt de
// opzet van die les — opwarming, leskern, tussenspel, wedstrijdvorm.
//
// De opmaak is die van tennis-oefeningen.html, waar dit uit komt: een gekleurde tabbalk, een
// streeplijn onder elke kop, kaartjes met een gekleurde rand en een uitklapbare tekening. Het
// staat daarom op een eigen vel papier met vaste kleuren, en niet in de kleuren van de app:
// de kleur hier is de kleur van het niveau, en die verandert niet met de donkere modus.
//
// Alles staat in de app zelf (lib/oefeningen), want op de baan is er vaak geen net. Alleen de
// tekeningen komen van buiten: de beheerder voegt ze toe, elke trainer ziet ze. Een speler ziet
// dit scherm niet.

import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, Image, Pressable, StyleSheet, Platform, useWindowDimensions,
} from 'react-native';

import { Screen } from '../../../components/ui/Screen';
import {
  NIVEAUS, type Kleur, type Oefenblok, type Oefenonderdeel,
} from '../../../lib/oefeningen';
import { oefenmap, type Onderdeelnaam } from '../../../lib/oefenafbeeldingen';
import { kanBestandKiezen, kiesAfbeelding } from '../../../lib/bestand';
import {
  laadAfbeeldingen, bewaarAfbeelding, verwijderAfbeelding,
  type OefenAfbeelding, type OefenAfbeeldingen,
} from '../../../providers/oefenopslag';
import { isAdmin, isCoach } from '../../../lib/rechten';
import { useSimpleData } from '../../../providers/SimpleDataProvider';
import { useT } from '../../../lib/i18n';
import { tennisColors } from '../../../constants/tennis-colors';
import { typography, webCursor } from '../../../constants/theme';

// De kleuren van het papier en van de vier niveaus, zoals in de HTML.
const INK = '#181B18';
const PAPER = '#F4F5F0';
const MUTED = '#5C6259';
const LIJN = 'rgba(24,27,24,0.14)';
const PALET: Record<Kleur, { accent: string; donker: string; licht: string }> = {
  blauw: { accent: '#2E6FB0', donker: '#1E4A75', licht: '#D9E7F5' },
  rood: { accent: '#C4423E', donker: '#8C2926', licht: '#F6D9D7' },
  oranje: { accent: '#DE8323', donker: '#A15E14', licht: '#FBE7C8' },
  groen: { accent: '#3F8F3F', donker: '#275C27', licht: '#DCEEDC' },
};

// Bebas Neue voor koppen, zoals in de HTML. De app laadt geen eigen lettertypen; op het web
// halen we het van Google Fonts, net als de HTML. Elders (en zolang het laadt) staat er een
// smal, zwaar lettertype voor. Bebas Neue heeft alleen hoofdletters, dus die zijn er altijd.
const KOPFONT = Platform.OS === 'web' ? "'Bebas Neue', Impact, 'Arial Narrow', sans-serif" : undefined;
const kop = {
  fontFamily: KOPFONT,
  fontWeight: Platform.OS === 'web' ? ('400' as const) : ('800' as const),
  textTransform: 'uppercase' as const,
  color: INK,
};

function laadKopfont(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.getElementById('bebas-neue')) return;
  const link = document.createElement('link');
  link.id = 'bebas-neue';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap';
  document.head.appendChild(link);
}

type Palet = (typeof PALET)[Kleur];

export default function OefeningenScreen(): React.JSX.Element {
  const t = useT();
  const { currentUser } = useSimpleData();
  const [niveauIndex, setNiveauIndex] = useState(0);
  const [weekIndex, setWeekIndex] = useState(0);
  const [afbeeldingen, setAfbeeldingen] = useState<OefenAfbeeldingen | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  useEffect(laadKopfont, []);

  const niveau = NIVEAUS[niveauIndex];
  const map = oefenmap(niveau.kleur, weekIndex);
  const admin = isAdmin(currentUser);

  // Bij elke keuze van kleur of week de bijbehorende map ophalen. Lukt dat niet (de bucket
  // bestaat nog niet, geen verbinding), dan zijn er gewoon geen tekeningen: de opzet zelf
  // staat in de app en blijft leesbaar.
  useEffect(() => {
    let vervallen = false;
    setAfbeeldingen(null);
    setFout(null);
    laadAfbeeldingen(map)
      .then((uit) => { if (!vervallen) setAfbeeldingen(uit); })
      .catch(() => { if (!vervallen) setAfbeeldingen(null); });
    return () => { vervallen = true; };
  }, [map]);

  const voegToe = useCallback(async (onderdeel: Onderdeelnaam): Promise<void> => {
    const dataUrl = await kiesAfbeelding();
    if (!dataUrl) return;
    setBezig(true);
    setFout(null);
    try {
      await bewaarAfbeelding(map, onderdeel, dataUrl);
      setAfbeeldingen(await laadAfbeeldingen(map));
    } catch {
      setFout(t('De tekening kon niet bewaard worden. Is OEFENAFBEELDINGEN.sql al gedraaid?'));
    } finally {
      setBezig(false);
    }
  }, [map, t]);

  const haalWeg = useCallback(async (pad: string): Promise<void> => {
    setBezig(true);
    setFout(null);
    try {
      await verwijderAfbeelding(pad);
      setAfbeeldingen(await laadAfbeeldingen(map));
    } catch {
      setFout(t('De tekening kon niet weggehaald worden.'));
    } finally {
      setBezig(false);
    }
  }, [map, t]);

  if (!isCoach(currentUser)) {
    return (
      <Screen>
        <Text style={styles.leeg}>{t('Alleen een trainer kan de oefeningen per kleur bekijken.')}</Text>
      </Screen>
    );
  }

  const week = niveau.weken[weekIndex];
  const p = PALET[niveau.kleur];
  const tekeningen = (onderdeel: Onderdeelnaam): React.JSX.Element | null => (
    <Tekeningen
      key={`${map}-${onderdeel}`}
      p={p}
      afbeeldingen={afbeeldingen?.[onderdeel] ?? []}
      kanToevoegen={admin && kanBestandKiezen}
      bezig={bezig}
      onToevoegen={() => voegToe(onderdeel)}
      onVerwijder={haalWeg}
    />
  );

  return (
    <Screen reading>
      <View style={styles.papier}>
        <View style={styles.tabbalk}>
          {NIVEAUS.map((n, i) => {
            const actief = i === niveauIndex;
            return (
              <Pressable
                key={n.kleur}
                accessibilityRole="tab"
                accessibilityLabel={`${t(kleurNaam(n.kleur))} — ${t(n.doel)}`}
                accessibilityState={{ selected: actief }}
                onPress={() => setNiveauIndex(i)}
                style={[styles.tab, { backgroundColor: PALET[n.kleur].accent }, webCursor]}
              >
                <Text style={[styles.tabNaam, { opacity: actief ? 1 : 0.72 }]}>{t(kleurNaam(n.kleur))}</Text>
                <Text style={styles.tabDoel}>{t(n.doel)}</Text>
                {actief ? <View style={styles.tabStreep} /> : null}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.weken}>
          {niveau.weken.map((_, i) => (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityState={{ selected: i === weekIndex }}
              onPress={() => setWeekIndex(i)}
              style={[styles.weekKnop, i === weekIndex && styles.weekKnopActief, webCursor]}
            >
              <Text style={[styles.weekTekst, i === weekIndex && styles.weekTekstActief]}>
                {t('Week {n}', { n: i + 1 })}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.inhoud}>
          <Text style={styles.weekLabel}>{t('Week {n}', { n: weekIndex + 1 })}</Text>
          <Text style={styles.titel}>{week.titel}</Text>
          <View style={styles.kernwoorden}>
            {week.kernwoorden.map((woord) => (
              <Text
                key={woord}
                style={[styles.kernwoord, { borderColor: p.donker, color: p.donker, backgroundColor: p.licht }]}
              >
                {woord}
              </Text>
            ))}
          </View>

          <Sectie
            p={p}
            titel={week.opwarming.duur ? t('Opwarming') : t('Opwarming + coördinatie')}
            duur={week.opwarming.duur}
          >
            <Lijst regels={week.opwarming.regels} />
            {tekeningen('opwarming')}
          </Sectie>

          <Sectie p={p} titel={t('Leskern')} duur={week.leskern.duur}>
            <Onderdeelinhoud onderdeel={week.leskern} p={p} />
            {tekeningen('leskern')}
          </Sectie>

          {week.tussenspel ? (
            <Sectie p={p} titel={t('Tussenspel')} duur={week.tussenspel.duur}>
              <Text style={styles.proza}>{week.tussenspel.tekst}</Text>
              {tekeningen('tussenspel')}
            </Sectie>
          ) : null}

          <Sectie p={p} titel={t('Wedstrijdvorm')} duur={week.wedstrijdvorm.duur}>
            <Onderdeelinhoud onderdeel={week.wedstrijdvorm} p={p} />
            {tekeningen('wedstrijdvorm')}
          </Sectie>

          {fout ? <Text style={styles.fout}>{fout}</Text> : null}
          {admin && !kanBestandKiezen ? (
            <Text style={styles.voet}>{t('Tekeningen toevoegen kan alleen op de website.')}</Text>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

function kleurNaam(kleur: string): string {
  return kleur.charAt(0).toUpperCase() + kleur.slice(1);
}

/** Een kop met de duur ernaast, de streeplijn eronder, en dan de inhoud. */
function Sectie({
  p, titel, duur, children,
}: { p: Palet; titel: string; duur?: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <View style={styles.sectie}>
      <View style={styles.sectieKop}>
        <Text style={styles.sectieTitel}>{titel}</Text>
        {duur ? <Text style={[styles.duur, { backgroundColor: p.accent }]}>{duur}</Text> : null}
      </View>
      <View style={[styles.streep, { borderBottomColor: p.accent }]} />
      {children}
    </View>
  );
}

/** Materiaal, de regel onder de kop, en de kaartjes. */
function Onderdeelinhoud({ onderdeel, p }: { onderdeel: Oefenonderdeel; p: Palet }): React.JSX.Element {
  const t = useT();
  const { width } = useWindowDimensions();
  // Twee kaartjes naast elkaar, tot het te smal wordt: dezelfde grens als in de HTML.
  const naast = width > 560;
  return (
    <View>
      {onderdeel.materiaal ? (
        <Text style={styles.materiaal}>
          <Text style={styles.vet}>{t('Materiaal')}:</Text> {onderdeel.materiaal}
        </Text>
      ) : null}
      {onderdeel.kop ? <Text style={[styles.proza, styles.vet, { marginBottom: 8 }]}>{onderdeel.kop}</Text> : null}
      <View style={styles.raster}>
        {onderdeel.blokken.map((blok, i) => (
          <Kaart key={i} blok={blok} p={p} breed={naast ? '48.5%' : '100%'} />
        ))}
      </View>
    </View>
  );
}

function Kaart({ blok, p, breed }: { blok: Oefenblok; p: Palet; breed: '48.5%' | '100%' }): React.JSX.Element {
  return (
    <View style={[styles.kaart, { borderLeftColor: p.accent, width: breed }]}>
      {blok.titel ? <Text style={styles.kaartTitel}>{blok.titel}</Text> : null}
      {blok.punten.map((punt, i) => (
        <View key={i} style={styles.punt}>
          <Text style={styles.bolletje}>•</Text>
          <Text style={styles.kaartTekst}>{punt}</Text>
        </View>
      ))}
      {blok.noot ? <Text style={styles.noot}>{blok.noot}</Text> : null}
    </View>
  );
}

function Lijst({ regels }: { regels: readonly string[] }): React.JSX.Element {
  return (
    <View>
      {regels.map((regel, i) => (
        <View key={i} style={styles.punt}>
          <Text style={styles.bolletje}>•</Text>
          <Text style={styles.puntTekst}>{regel}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * De tekeningen bij één onderdeel: per tekening een knop die hem uitklapt, zoals in de HTML.
 * De beheerder ziet er een knop bij om een tekening toe te voegen, en een om hem weg te halen;
 * een trainer ziet alleen wat er staat, en niets als er niets staat.
 */
function Tekeningen({
  p, afbeeldingen, kanToevoegen, bezig, onToevoegen, onVerwijder,
}: {
  p: Palet;
  afbeeldingen: readonly OefenAfbeelding[];
  kanToevoegen: boolean;
  bezig: boolean;
  onToevoegen: () => void;
  onVerwijder: (pad: string) => void;
}): React.JSX.Element | null {
  const t = useT();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  // Weghalen vraagt na: één tik zet de knop op "Zeker weten?", de tweede haalt hem weg.
  const [zeker, setZeker] = useState<string | null>(null);

  if (afbeeldingen.length === 0 && !kanToevoegen) return null;

  return (
    <View style={styles.tekeningen}>
      {afbeeldingen.map((a, i) => {
        const uit = open[a.pad] === true;
        const label = afbeeldingen.length > 1
          ? t('Bekijk tekening {n}', { n: i + 1 })
          : t('Bekijk tekening');
        return (
          <View key={a.pad} style={styles.tekening}>
            <View style={styles.tekeningRij}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: uit }}
                onPress={() => setOpen({ ...open, [a.pad]: !uit })}
                style={[styles.tekeningKnop, { borderColor: p.donker }, webCursor]}
              >
                <Text style={[styles.tekeningTekst, { color: p.donker }]}>
                  {uit ? '▼' : '▶'} {uit ? t('Verberg tekening') : label}
                </Text>
              </Pressable>
              {kanToevoegen ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={bezig}
                  onPress={() => {
                    if (zeker === a.pad) { setZeker(null); onVerwijder(a.pad); } else setZeker(a.pad);
                  }}
                  style={[styles.tekeningKnop, { borderColor: tennisColors.danger }, webCursor]}
                >
                  <Text style={[styles.tekeningTekst, { color: tennisColors.danger }]}>
                    {zeker === a.pad ? t('Zeker weten?') : t('Weghalen')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            {uit ? (
              <View style={styles.tekeningVlak}>
                <Tekening url={a.url} beschrijving={label} />
              </View>
            ) : null}
          </View>
        );
      })}
      {kanToevoegen ? (
        <Pressable
          accessibilityRole="button"
          disabled={bezig}
          onPress={onToevoegen}
          style={[styles.toevoegen, webCursor, bezig && { opacity: 0.5 }]}
        >
          <Text style={styles.toevoegenTekst}>
            {bezig ? t('Bezig…') : `+ ${t('Tekening toevoegen')}`}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** De afbeelding op volle breedte, met de verhouding die hij zelf heeft. */
function Tekening({ url, beschrijving }: { url: string; beschrijving: string }): React.JSX.Element {
  const [verhouding, setVerhouding] = useState(4 / 3);
  useEffect(() => {
    Image.getSize(url, (w, h) => { if (w > 0 && h > 0) setVerhouding(w / h); }, () => {});
  }, [url]);
  return (
    <Image
      source={{ uri: url }}
      accessibilityLabel={beschrijving}
      resizeMode="contain"
      style={{ width: '100%', aspectRatio: verhouding, borderRadius: 6 }}
    />
  );
}

const styles = StyleSheet.create({
  leeg: { ...typography.body, color: tennisColors.textMuted },
  papier: { backgroundColor: PAPER, borderRadius: 12, overflow: 'hidden' },

  tabbalk: { flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: INK },
  tab: { flex: 1, alignItems: 'center', paddingTop: 14, paddingBottom: 12, paddingHorizontal: 6 },
  tabNaam: { ...kop, color: '#FFFFFF', fontSize: 20, letterSpacing: 0.8 },
  tabDoel: {
    color: '#FFFFFF', opacity: 0.85, fontSize: 9.5, fontWeight: '600',
    letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 2,
  },
  tabStreep: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, backgroundColor: '#FFFFFF' },

  weken: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 14 },
  weekKnop: {
    borderWidth: 1.5, borderColor: LIJN, backgroundColor: '#FFFFFF', borderRadius: 999,
    paddingVertical: 6, paddingHorizontal: 16,
  },
  weekKnopActief: { backgroundColor: INK, borderColor: INK },
  weekTekst: { color: MUTED, fontSize: 12.5, fontWeight: '700' },
  weekTekstActief: { color: '#FFFFFF' },

  inhoud: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 32 },
  weekLabel: { color: MUTED, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  titel: { ...kop, fontSize: 36, lineHeight: 38, marginTop: 2, marginBottom: 6 },
  kernwoorden: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14, marginBottom: 26 },
  kernwoord: {
    borderWidth: 1.5, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10,
    fontSize: 12.5, fontWeight: '600', overflow: 'hidden',
  },

  sectie: { marginBottom: 30 },
  sectieKop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  sectieTitel: { ...kop, fontSize: 22, letterSpacing: 0.7 },
  duur: {
    color: '#FFFFFF', fontSize: 12, fontWeight: '700', borderRadius: 999,
    paddingVertical: 2, paddingHorizontal: 8, overflow: 'hidden',
  },
  streep: { borderBottomWidth: 2, borderStyle: 'dashed', marginTop: 2, marginBottom: 14 },
  materiaal: { color: MUTED, fontSize: 12.5, marginBottom: 14 },
  vet: { color: INK, fontWeight: '700' },

  proza: { color: INK, fontSize: 14.5, lineHeight: 22 },
  puntTekst: { color: INK, fontSize: 14.5, lineHeight: 22, flex: 1 },
  punt: { flexDirection: 'row', gap: 8, marginBottom: 3 },
  bolletje: { color: INK, fontSize: 14.5, lineHeight: 22 },

  raster: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  kaart: {
    backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: LIJN, borderLeftWidth: 5,
    borderRadius: 3, paddingVertical: 12, paddingHorizontal: 14,
  },
  kaartTitel: { color: INK, fontSize: 13, fontWeight: '700', marginBottom: 6 },
  kaartTekst: { color: INK, fontSize: 13.5, lineHeight: 20, flex: 1 },
  noot: {
    color: MUTED, fontSize: 12.5, fontStyle: 'italic', marginTop: 8, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: LIJN, borderStyle: 'dashed',
  },

  tekeningen: { marginTop: 14, gap: 8, alignItems: 'flex-start' },
  tekening: { alignSelf: 'stretch' },
  tekeningRij: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tekeningKnop: { borderWidth: 1.5, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  tekeningTekst: { fontSize: 12.5, fontWeight: '700' },
  tekeningVlak: {
    alignSelf: 'stretch', backgroundColor: '#EFEEE8', borderWidth: 1.5, borderColor: LIJN,
    borderRadius: 8, padding: 14, marginTop: 8,
  },
  toevoegen: {
    borderWidth: 1.5, borderColor: LIJN, borderStyle: 'dashed', borderRadius: 8,
    paddingVertical: 12, paddingHorizontal: 16, alignSelf: 'stretch', alignItems: 'center',
  },
  toevoegenTekst: { color: MUTED, fontSize: 12.5, fontStyle: 'italic' },

  fout: { color: tennisColors.danger, fontSize: 13, marginTop: 4 },
  voet: { color: MUTED, fontSize: 12, marginTop: 4 },
});
