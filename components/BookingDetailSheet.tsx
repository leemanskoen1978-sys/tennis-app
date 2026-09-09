// Alles over één geboekte les, in een blad — een Booking dus, een uur op de baan. Het heette
// LessonDetailSheet, naast een LessonDetailModal dat over lesmateriaal gaat; twee namen die
// precies andersom klonken dan wat ze doen.
//
// Het maandoverzicht toonde dat allemaal op de kaart zelf:
// twee namen, twee badges en een knop per les. Daardoor werd elke kaart een blok en paste er
// maar één les per rij. Nu draagt de kaart alleen wat je nodig hebt om een les te herkennen,
// en woont de rest — met de handelingen — hier.

import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';

import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Chip } from './ui/Chip';
import { DetailSheet } from './ui/DetailSheet';
import { ParticipantPicker } from './ParticipantPicker';
import { PaymentMethodSheet } from './PaymentMethodSheet';
import { useSimpleData } from '../providers/SimpleDataProvider';
import { materiaalVoor } from '../lib/lesplanning';
import { useActieveSpeler } from '../providers/kindkeuze';
import { cardsFor, remaining, GROEPSLES_ALLEEN_FACTUUR } from '../lib/beurtenkaart';
import { formatDayTimeRange } from '../lib/datetime';
import { isGroupLesson, lessonPlayerIds, participantIdsOf } from '../lib/groups';
import { actieveGroepen } from '../lib/lesgroepen';
import {
  aanwezigheidRegel, aanwezigheidVan, magAanwezigheidZetten,
} from '../lib/aanwezigheid';
import {
  bookingPaymentMeta, lessonPriceLine, lessonShares, splitOf, type PaymentMeta,
} from '../lib/payments';
import { formatEuro } from '../lib/money';
import { seriesFrom } from '../lib/series';
import { sponsorHint, sponsorState } from '../lib/sponsor';
import { bookingStatusLabel } from '../lib/status';
import { isAwaitingApproval } from '../lib/inbox';
import { openZiekmeldingen, zoektVervanger } from '../lib/ziekmelding';
import type { Beurtenkaart, Booking, BookingStatus, PaymentMethod } from '../lib/types';
import { useT, t as tr } from '../lib/i18n';
import { tennisColors } from '../constants/tennis-colors';
import { spacing, typography, minTapTarget, webCursor } from '../constants/theme';
import { playersOf } from '../lib/hub';
import { kinderenVan } from '../lib/ouderkind';
import { isAdmin, isCoach, magLesVerwijderen } from '../lib/rechten';

/** De kleur bij een status; dezelfde die het maandoverzicht ooit op de kaart zette. */
const STATUS_COLORS: Record<BookingStatus, string> = {
  pending: tennisColors.warningFill,
  confirmed: tennisColors.primaryFill,
  cancelled: tennisColors.mutedFill,
  completed: tennisColors.courtFill,
  synchronized: tennisColors.courtFill,
};

/**
 * Het label op de betaal-badge. Bij een les die op een beurtenkaart staat hoort het saldo
 * van die kaart erbij; hangt er geen kaart aan, dan blijft het bij het label. Gedeeld met
 * het maandoverzicht, zodat de kaart en dit blad hetzelfde zeggen.
 */
/**
 * Hoe de reeks heet waar deze les bij hoort. De boeking draagt alleen een `series_id`, geen
 * frequentie — die lees je terug uit de afstand tussen de lessen. De kleinste afstand telt:
 * in een wekelijkse reeks waar één week oversprong staat een gat van veertien dagen, maar
 * ergens staat dan nog altijd een gat van zeven. Herkent hij het niet, dan blijft het bij
 * "een reeks": een verkeerde naam is erger dan geen naam.
 */
function seriesName(sameSeries: ReadonlyArray<{ start_time: string }>): string {
  const times = sameSeries.map((b) => new Date(b.start_time).getTime()).sort((a, b) => a - b);
  let smallest = Infinity;
  for (let i = 1; i < times.length; i++) {
    smallest = Math.min(smallest, times[i] - times[i - 1]);
  }
  const days = Math.round(smallest / 86_400_000);
  if (days === 7) return tr('een wekelijkse reeks');
  if (days === 14) return tr('een tweewekelijkse reeks');
  return tr('een reeks');
}

/** "1 les" / "5 lessen", voor de vraag hoeveel er meegaan. */
function lessons(n: number): string {
  return n === 1 ? tr('1 les') : tr('{n} lessen', { n });
}

export function paymentLabelFor(
  booking: Booking,
  meta: PaymentMeta,
  cards: Beurtenkaart[],
): string {
  if (booking.payment_method !== 'beurtenkaart' || !booking.beurtenkaart_id) return meta.label;
  const card = cards.find((c) => c.id === booking.beurtenkaart_id);
  if (!card) return meta.label;
  return `${meta.label} · ${tr('nog {n}', { n: remaining(card) })}`;
}

export function BookingDetailSheet({
  booking: selected,
  visible,
  onClose,
  canManage,
}: {
  booking: Booking | null;
  visible: boolean;
  onClose: () => void;
  /** Alleen een trainer wijzigt of annuleert; een speler mag wel kijken. */
  canManage: boolean;
}): React.JSX.Element | null {
  const t = useT();
  const router = useRouter();
  const speler = useActieveSpeler();
  const {
    currentUser, bookings, users, courts, beurtenkaarten, relaties, lesGroepen, sickLeaves,
    // `lessons` is in dit bestand al een functie die "3 lessen" opmaakt (zie boven), dus het
    // lesmateriaal krijgt hier een eigen naam.
    lessons: lesmateriaal, lesPlanning,
    updateBooking, deleteBooking, cancelSeriesFrom, deleteSeriesFrom,
    approveBooking, rejectBooking,
    setPaymentMethod, setParticipants, setPaymentSplit, setAanwezigheid, setTaughtBy,
    error, clearError,
  } = useSimpleData();
  // Twee bladen over elkaar heen wordt op web en telefoon rommelig: de tweede backdrop
  // verduistert de eerste en op Android sluit één druk op terug ze allebei. Daarom is dit
  // een schakelaar en geen tweede laag — staat hij aan, dan is het detailblad even dicht en
  // heeft het gedeelde betaalwijze-blad het scherm alleen. Sluiten brengt de details terug.
  const [choosing, setChoosing] = useState(false);
  // De medespelers bijstellen is een handeling met gevolgen voor het geld; die staat daarom
  // achter een knop en niet altijd open.
  const [editingPlayers, setEditingPlayers] = useState(false);
  // Wat er ongevraagd meeveranderde toen de deelnemers wijzigden (een teruggegeven beurt,
  // een les die naar factuur ging). Blijft staan tot het blad dichtgaat.
  const [notice, setNotice] = useState<string | null>(null);
  // Welke vraag er in het blad zelf openstaat: annuleren, verwijderen, of geen. Bewust geen
  // `Alert`, want die blokkeert op web — dit volgt het bevestigingsvak van de beurtenkaarten.
  const [confirming, setConfirming] = useState<'cancel' | 'delete' | null>(null);
  // De lijst met lesgroepen klapt open achter een knop, net als `editingPlayers`: het blad is
  // in de eerste plaats om een les te lezen, en een lijst van elke groep van de club erin
  // laten staan duwt de aanwezigheid van het scherm af.
  const [kiezenGroep, setKiezenGroep] = useState(false);

  // De aanroeper geeft de les mee die hij had toen de kaart werd aangetikt. Lees hem terug
  // uit de opslag, anders blijven status en betaalwijze hier op de oude waarde staan zodra
  // je ze in dit blad wijzigt.
  const booking = selected ? (bookings.find((b) => b.id === selected.id) ?? selected) : null;
  if (!booking) return null;

  const nameOf = (id: string): string => users.find((u) => u.id === id)?.name ?? t('Onbekend');
  const courtName = courts.find((c) => c.id === booking.court_id)?.name ?? t('Onbekend terrein');
  const playerName = nameOf(booking.player_id);
  const coachName = nameOf(booking.coach_id);
  // De vervanger staat náást de vaste trainer, nooit in zijn plaats (D-07): leeg betekent
  // dat de vaste trainer de les zelf gaf (D-02).
  const vervangerNaam = booking.taught_by_id ? nameOf(booking.taught_by_id) : null;

  // Zoekt deze les nog een vervanger? Elke keer opnieuw gevraagd aan lib/ziekmelding, tegen de
  // meldingen die nú openstaan — nooit een boolean die ergens eerder is uitgerekend en
  // doorgegeven. Zo staat er op dit blad hetzelfde als op de agendakaart en in de werklijst.
  const zoektNogIemand = zoektVervanger(booking, openZiekmeldingen(sickLeaves));

  const payment = bookingPaymentMeta(booking);
  const paymentLabel = paymentLabelFor(booking, payment, beurtenkaarten);
  const isCancelled = booking.status === 'cancelled';
  const canCancel = !isCancelled && booking.status !== 'completed';
  // Wie de rekening krijgt, kiest hoe hij betaalt: de betaler zelf, en de ouder die voor
  // hem meekijkt. De trainer mag het ook — hij handelt het af aan de baan. Wat een betaler
  // verder níét mag (het uur verzetten, van trainer wisselen, zichzelf goedkeuren) hangt
  // aan `canManage` hieronder, en de databank bewaakt datzelfde verschil met de trigger
  // `bewaak_betaalvelden`.
  const betaler = speler?.id === booking.player_id;
  // Weghalen is een eigen recht en geen onderdeel van `canManage`: een ouder mag de les van
  // zijn kind schrappen zolang die nog moet beginnen, terwijl hij hem niet mag verzetten of
  // goedkeuren. De regel staat in lib/rechten, met dezelfde grens in de databank; hier staat
  // hij niet als prop maar wordt hij uitgerekend, zodat een scherm dat het blad opent hem
  // niet stilzwijgend kan vergeten.
  const magWeg = magLesVerwijderen(currentUser, speler, booking, new Date());
  // Alleen bij een lopende les: op een geannuleerde les valt niets meer te betalen.
  const canPay = (canManage || betaler) && !isCancelled;
  // De tennisschool-module is van de beheerder en niet van elke trainer (D-09), dus dit is
  // een eigen vraag naast `canManage`: die zegt "mag deze kijker deze les beheren", en daar
  // valt de trainer van de les ook onder. Aan een lesgroep hangen is iets anders — dat gaat
  // over de indeling van de club.
  const magGroepen = isAdmin(currentUser);
  const groepVanLes = booking.group_id
    ? (lesGroepen.find((g) => g.id === booking.group_id) ?? null)
    : null;
  // Alleen de groepen die de club dit seizoen nog inplant. Een gearchiveerde groep hoort niet
  // in de keuzelijst: een les eraan hangen zou een groep vullen die de club heeft weggezet.
  const teKiezenGroepen = actieveGroepen(lesGroepen);
  const isGroup = isGroupLesson(booking);
  // Voor wie spreek je: jezelf, plus je goedgekeurde kinderen. Eén lijst, want de vraag "mag
  // ik dit zetten" is voor elke naam in de les dezelfde.
  const eigenSpelers = currentUser
    ? [currentUser.id, ...kinderenVan(currentUser.id, relaties)]
    : [];
  const magIetsZetten = lessonPlayerIds(booking).some((id) => magAanwezigheidZetten(
    currentUser, booking, id, eigenSpelers, new Date(),
  ));
  const court = courts.find((c) => c.id === booking.court_id);
  const players = playersOf(users);
  // Wie er meedoet en wie wat betaalt: één lijst, met de betaler vooraan. Bij samen
  // factureren staat het hele bedrag bij hem en niets bij de rest — dat is precies wat er
  // hoort te staan, want zij betalen ook niets.
  const shares = lessonShares(booking, court);
  const amountOf = (id: string): number | null =>
    shares.find((share) => share.player_id === id)?.amount ?? null;

  // Hoort de les bij een reeks, dan raakt een handeling hier mogelijk meer dan deze ene les.
  // `tail` is deze les plus alle latere: precies wat "en alle volgende" wegveegt.
  const inSeries = Boolean(booking.series_id);
  const tail = inSeries ? seriesFrom(bookings, booking.id) : [];
  const sameSeries = inSeries ? bookings.filter((b) => b.series_id === booking.series_id) : [];
  // Is deze de laatste van de reeks, dan is "alleen deze" hetzelfde als "en alle volgende";
  // twee knoppen die hetzelfde doen zijn dan alleen maar verwarrend.
  const tailOnlyThis = tail.length <= 1;

  const cardHint = (): string | undefined => {
    const cards = cardsFor(beurtenkaarten, booking.player_id);
    if (cards.length === 0) return t('Deze speler heeft nog geen beurtenkaart.');
    const left = cards.reduce((sum, c) => sum + remaining(c), 0);
    return left === 1 ? t('Nog 1 beurt over.') : t('Nog {n} beurten over.', { n: left });
  };

  /**
   * Wat er van het sponsorbudget over is. De les zelf telt niet mee in het verbruik: staat
   * hij al op sponsor, dan zou hij anders zijn eigen bedrag van het saldo aftrekken en zou
   * er "nog € 0,00" staan terwijl er niets veranderd is.
   */
  const sponsorTekst = (): string =>
    sponsorHint(sponsorState(
      users.find((u) => u.id === booking.player_id),
      bookings,
      courts,
      booking.id,
    ));

  /** Dichtdoen zet het blad ook weer schoon: een melding of een open keuzelijst van de
   *  vorige les hoort niet boven de volgende te blijven hangen. */
  const close = (): void => {
    setNotice(null);
    setEditingPlayers(false);
    setKiezenGroep(false);
    setConfirming(null);
    onClose();
  };

  /**
   * Een les weghalen, en het blad pas dichtdoen als dat gelukt is.
   *
   * Meteen sluiten leek logisch — de les bestaat straks niet meer — maar dan is er geen
   * plek meer waar een weigering van de databank te lezen valt, en gedraagt een mislukte
   * poging zich als een knop die niets doet. Precies dat.
   */
  const weghalen = (doen: () => Promise<void>): void => {
    clearError();
    setConfirming(null);
    // Bij een fout blijft het blad staan: de melding erin komt uit `error` hierboven.
    void doen().then(close, () => {});
  };

  const goTo = (path: string): void => {
    close();
    router.push(path);
  };

  const pickMethod = async (method: PaymentMethod): Promise<void> => {
    clearError();
    try {
      const ok = await setPaymentMethod(booking.id, method);
      // Bij een geweigerde keuze blijft het blad open: daar, onder de chips die de trainer
      // net aantikte, staat de melding waar hij kijkt.
      if (!ok) return;
      setChoosing(false);
    } catch {
      // `commit` zette de foutregel al; het blad blijft open zodat die te lezen is.
    }
  };

  return (
    <>
      <DetailSheet
        title={formatDayTimeRange(booking.start_time, booking.end_time)}
        visible={visible && !choosing}
        onClose={close}
      >
        <Text style={styles.court}>{courtName}</Text>
        {/* Een les uit een reeks ziet er verder uit als elke andere les. Zeg het dus,
            vóór iemand hem annuleert in de veronderstelling dat het er één was. */}
        {inSeries ? (
          <Text style={styles.hint}>
            {t('Onderdeel van {reeks} · {lessen} vanaf deze.', {
              reeks: seriesName(sameSeries),
              lessen: lessons(tail.length),
            })}
          </Text>
        ) : null}

        {/* Beide namen klikken door: een les is het raakpunt van Spelers en Trainers,
            dus dit is de natuurlijke sprong tussen die twee delen. */}
        <Pressable
          onPress={() => goTo(`/players/${booking.player_id}`)}
          accessibilityRole="button"
          accessibilityLabel={t('Open dossier van {naam}', { naam: playerName })}
          style={[styles.partyLine, webCursor]}
        >
          <Text style={styles.partyLink}>
            {isGroup ? t('Betaalt') : t('Speler')}: {playerName}
            {isGroup ? ` · € ${formatEuro(amountOf(booking.player_id) ?? 0)}` : ''}
          </Text>
          <ChevronRight size={16} color={tennisColors.textMuted} />
        </Pressable>
        {isGroup ? (
          <>
            <Text style={styles.label}>{t('Medespelers')}</Text>
            {participantIdsOf(booking).map((id) => (
              <Pressable
                key={id}
                onPress={() => goTo(`/players/${id}`)}
                accessibilityRole="button"
                accessibilityLabel={t('Open dossier van {naam}', { naam: nameOf(id) })}
                style={[styles.partyLine, webCursor]}
              >
                <Text style={styles.partyLink}>
                  {nameOf(id)}
                  {amountOf(id) !== null ? ` · € ${formatEuro(amountOf(id) as number)}` : ''}
                </Text>
                <ChevronRight size={16} color={tennisColors.textMuted} />
              </Pressable>
            ))}
          </>
        ) : null}

        <Pressable
          onPress={() => goTo(`/coaches/${booking.coach_id}`)}
          accessibilityRole="button"
          accessibilityLabel={t('Open dossier van trainer {naam}', { naam: coachName })}
          style={[styles.partyLine, webCursor]}
        >
          <Text style={styles.partyLink}>{t('Trainer')}: {coachName}</Text>
          <ChevronRight size={16} color={tennisColors.textMuted} />
        </Pressable>
        {/* Beide namen blijven staan. Wie hier alleen de vervanger zou tonen, maakt achteraf
            onnavolgbaar wat er gebeurd is: dan is niet meer te zien aan wie de les was
            toegewezen én wie hem uiteindelijk gaf (D-07). */}
        {vervangerNaam && booking.taught_by_id ? (
          <Pressable
            onPress={() => goTo(`/coaches/${booking.taught_by_id as string}`)}
            accessibilityRole="button"
            accessibilityLabel={t('Open dossier van vervanger {naam}', { naam: vervangerNaam })}
            style={[styles.partyLine, webCursor]}
          >
            <Text style={styles.partyLink}>{t('Vervanger')}: {vervangerNaam}</Text>
            <ChevronRight size={16} color={tennisColors.textMuted} />
          </Pressable>
        ) : null}

        {/* De trainer van deze les is ziek gemeld en er staat nog niemand anders op: dat blijft
            hier staan tot de les geregeld of afgezegd is (D-06 / VERV-07). Er wordt niets
            weggeschreven en er staat geen vlaggetje op de les — is de ziekmelding ingetrokken,
            dan is deze regel vanzelf weg. Voor de beheerder staat erbij waar hij het oplost;
            een speler of trainer leest alleen dát er nog iemand gezocht wordt, en niet wie er
            ziek is of waarom. */}
        {zoektNogIemand ? (
          <Text style={styles.hint}>{t('De trainer is ziek gemeld: deze les zoekt nog een vervanger.')}</Text>
        ) : null}
        {zoektNogIemand && isAdmin(currentUser) ? (
          <Text style={styles.hint}>{t('Je regelt hem op de werklijst, onder Beheer bij Ziekmelding.')}</Text>
        ) : null}

        {/* Wat de tennisschool voor deze periode doorstuurde; zie `materiaalVoor` in
            lib/lesplanning. Tekst zonder tik, met opzet: dit blad is zelf een blad, en een blad
            binnen een blad is precies wat de betaalwijze hierboven met een schakelaar omzeilt.
            Wie het materiaal wil openen, doet dat op zijn lesdag of in Lesmateriaal.

            Geen kop als er niets geldt, om dezelfde reden als op de lesdag: een kop zonder
            inhoud leest als "er is niets gepland". */}
        {materiaalVoor(booking, lesPlanning, lesmateriaal).map((l) => (
          <Text key={l.id} style={styles.hint}>
            {t('Deze periode: {titel}', { titel: l.title })}
          </Text>
        ))}

        {/* "Deze les zoekt een trainer": het merkteken buiten ziekte om, dat de les in de lijst
            onder Trainers → Lessen zonder trainer zet. Alleen de trainer van de les en de
            beheerder — bewust niet `canManage`, want dat is "de trainer die naar zijn eigen
            agenda kijkt", en de beheerder hoort een les van een collega ook te kunnen vrijgeven
            als die zelf niet meer aan zijn telefoon komt. De databank bewaakt dezelfde grens;
            dit voorkomt alleen een knop die daarna geweigerd wordt.

            Staat er al een lesgever op, dan is er geen knop: die les zoekt niemand meer. En bij
            een ziekmelding staat hij er ook niet — de les staat dan al in de lijst, en een
            merkteken dat niets verandert is een knop die de trainer één keer indrukt en daarna
            wantrouwt. */}
        {(isAdmin(currentUser) || booking.coach_id === currentUser?.id)
          && !booking.taught_by_id && !isCancelled && !zoektNogIemand ? (
            <Button
              label={booking.zoekt_trainer === true
                ? t('Toch zelf geven')
                : t('Deze les zoekt een trainer')}
              variant="secondary"
              onPress={() => {
                clearError();
                void updateBooking(booking.id, {
                  zoekt_trainer: booking.zoekt_trainer !== true,
                });
              }}
            />
          ) : null}

        {/* Invullen wie de les werkelijk gaf mag alleen de beheerder (D-08) — bewust niet
            `canManage`, want daar valt de trainer van de les zelf ook onder. Die grens loopt
            hier anders: dit veld beslist wie er uitbetaald wordt, dus een trainer die op zijn
            eigen les een vervanger invult, zet daarmee zijn eigen loonstaat.

            Voor wie het niet mag staat er geen uitgeschakelde knop maar helemaal geen knop:
            er bestaat dan geen `onPress` die `setTaughtBy` kan bereiken. Dat is geen
            bewaking maar netheid — de bewaking staat in `bewaak_betaalvelden` in de databank,
            zodat het scherm geen knop toont die daarna geweigerd wordt (lib/rechten:
            "de app is niet de bewaker"). */}
        {isAdmin(currentUser) ? (
          <>
            <Text style={styles.label}>{t('Wie gaf deze les?')}</Text>
            <View style={styles.chipRow}>
              <Chip
                label={t('Gaf hem zelf')}
                selected={!booking.taught_by_id}
                onPress={() => {
                  void setTaughtBy(booking.id, null);
                }}
              />
              {users
                .filter((u) => isCoach(u) && u.id !== booking.coach_id)
                .map((u) => (
                  <Chip
                    key={u.id}
                    label={u.name}
                    selected={booking.taught_by_id === u.id}
                    onPress={() => {
                      void setTaughtBy(booking.id, u.id);
                    }}
                  />
                ))}
            </View>
          </>
        ) : null}

        <View style={styles.badgeRow}>
          <Badge label={bookingStatusLabel(booking.status)} color={STATUS_COLORS[booking.status]} />
          {canPay && !isGroup ? (
            <Pressable
              onPress={() => {
                clearError();
                setChoosing(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={t('Betaalwijze wijzigen, nu {wijze}', { wijze: paymentLabel })}
              style={[styles.paymentTap, webCursor]}
            >
              <Badge label={paymentLabel} color={payment.color} subtle={payment.subtle} />
            </Pressable>
          ) : (
            <Badge label={paymentLabel} color={payment.color} subtle={payment.subtle} />
          )}
        </View>
        {isGroup ? (
          <Text style={styles.hint}>
            {t('{regel} Een beurtenkaart en het sponsorbudget gelden alleen voor een '
              + 'privéles.', { regel: t(GROEPSLES_ALLEEN_FACTUUR) })}
          </Text>
        ) : null}

        <Text style={styles.price}>{lessonPriceLine(booking, court)}</Text>

        {isGroup && canManage && !isCancelled ? (
          <>
            <Text style={styles.label}>{t('Factuur')}</Text>
            <View style={styles.chipRow}>
              <Chip
                label={t('Samen')}
                selected={splitOf(booking) === 'together'}
                onPress={() => {
                  void setPaymentSplit(booking.id, 'together');
                }}
              />
              <Chip
                label={t('Apart')}
                selected={splitOf(booking) === 'separate'}
                onPress={() => {
                  void setPaymentSplit(booking.id, 'separate');
                }}
              />
            </View>
          </>
        ) : null}

        {canManage && !isCancelled ? (
          editingPlayers ? (
            <>
              <Text style={styles.label}>{t('Medespelers')}</Text>
              <ParticipantPicker
                players={players}
                payerId={booking.player_id}
                value={participantIdsOf(booking)}
                onChange={(ids) => {
                  clearError();
                  void setParticipants(booking.id, ids).then(setNotice);
                }}
              />
              <View style={styles.actions}>
                <Button
                  label={t('Klaar')}
                  variant="secondary"
                  fullWidth={false}
                  onPress={() => setEditingPlayers(false)}
                />
              </View>
            </>
          ) : (
            <View style={styles.actions}>
              <Button
                label={isGroup ? t('Medespelers wijzigen') : t('Medespeler toevoegen')}
                variant="secondary"
                fullWidth={false}
                onPress={() => {
                  clearError();
                  setEditingPlayers(true);
                }}
              />
            </View>
          )
        ) : null}

        {/* Aan welke lesgroep deze les hangt, en dat veranderen.

            Koppelen verandert alleen de verwijzing. Wie er bij déze les stond blijft staan
            zoals het staat: het rooster van de groep wordt hier niet overgenomen en
            `participant_ids` wordt nergens aangeraakt. Een les weet zelf wie erbij was, en
            dat blijft zo — anders zou de afvinklijst van vorige maand meeverschuiven met een
            groep die vandaag iemand erbij kreeg (D-07/D-08).

            Er wordt géén `series_id` gezet. Een reeks is een aanmaakbatch — hij vertelt welke
            lessen ooit in één keer gemaakt zijn — en een groep is een blijvende identiteit.
            Ze bestaan naast elkaar en nooit in elkaar (D-12). Een les aan een groep hangen
            maakt er dus ook geen reeks van: de knoppen hierboven blijven precies doen wat ze
            deden.

            Dit gaat bewust via het bestaande `updateBooking` en niet via een nieuwe
            provideractie. Elke extra weg die zelf een `Partial<Booking>` samenstelt is een
            weg langs `planMethodChange` heen, en dat is precies het gat waardoor een speler
            ooit twee keer betaalde — zie OPENSTAAND.md, "Eén bewaakte weg". `group_id` valt
            binnen wat het patchtype van `updateBooking` toelaat, dus er is hier niets nieuws
            voor nodig. */}
        {magGroepen ? (
          <>
            <Text style={styles.label}>{t('Lesgroep')}</Text>
            {booking.group_id ? (
              <>
                <Text style={styles.hint}>
                  {groepVanLes
                    ? `${groepVanLes.name} · ${groepVanLes.level}`
                    : t('Deze les verwijst naar een lesgroep die hier niet (meer) te vinden is.')}
                </Text>
                <View style={styles.actions}>
                  <Button
                    label={t('Losmaken van de lesgroep')}
                    variant="secondary"
                    fullWidth={false}
                    onPress={() => {
                      clearError();
                      void updateBooking(booking.id, { group_id: undefined });
                    }}
                  />
                </View>
              </>
            ) : kiezenGroep ? (
              <>
                {teKiezenGroepen.length === 0 ? (
                  <Text style={styles.hint}>
                    {t('Er is nog geen lesgroep om aan te hangen. Je maakt er een aan bij '
                      + 'Beheer, onder Lesgroepen.')}
                  </Text>
                ) : (
                  <View style={styles.chipRow}>
                    {teKiezenGroepen.map((groep) => (
                      <Chip
                        key={groep.id}
                        label={`${groep.name} · ${groep.level}`}
                        onPress={() => {
                          clearError();
                          setKiezenGroep(false);
                          void updateBooking(booking.id, { group_id: groep.id });
                        }}
                      />
                    ))}
                  </View>
                )}
                <View style={styles.actions}>
                  <Button
                    label={t('Klaar')}
                    variant="secondary"
                    fullWidth={false}
                    onPress={() => setKiezenGroep(false)}
                  />
                </View>
              </>
            ) : (
              <>
                <Text style={styles.hint}>
                  {t('Deze les hoort bij geen enkele lesgroep. Eraan hangen verandert niets '
                    + 'aan de les zelf: wie erbij stond, het uur en de betaling blijven.')}
                </Text>
                <View style={styles.actions}>
                  <Button
                    label={t('Aan een lesgroep hangen')}
                    variant="secondary"
                    fullWidth={false}
                    onPress={() => {
                      clearError();
                      setKiezenGroep(true);
                    }}
                  />
                </View>
              </>
            )}
          </>
        ) : null}

        {/* Wie er stond. De trainer van de les vinkt af — hij was erbij — en dat mag ook
            vooraf: weet hij nu al dat er iemand wegblijft, dan hoeft hij dat niet tot na de
            les te onthouden.
            
            Een speler zet zichzelf, een ouder zijn kind, en alleen voor een les die vandaag
            of later begint: je afmelden is iets anders dan de geschiedenis herschrijven.
            Per regel wordt dat opnieuw gevraagd, want in een groepsles gaat het over acht
            namen waarvan er één van jou is. Zie `magAanwezigheidZetten` in lib/aanwezigheid;
            de databank bewaakt dezelfde grens.

            Bij een geannuleerde les staat de lijst er niet: die les is niet doorgegaan, dus
            er valt niemand aan- of afwezig te noemen. */}
        {!isCancelled ? (
          <>
            <Text style={styles.label}>{t('Aanwezigheid')}</Text>
            <Text style={styles.hint}>{aanwezigheidRegel(booking)}</Text>
            {lessonPlayerIds(booking).map((id) => {
              const stand = aanwezigheidVan(booking, id);
              const magZetten = magAanwezigheidZetten(
                currentUser, booking, id, eigenSpelers, new Date(),
              );
              return (
                <View key={id} style={styles.attendanceRow}>
                  <Text style={styles.attendanceName} numberOfLines={1}>{nameOf(id)}</Text>
                  {magZetten ? (
                    <View style={styles.chipRow}>
                      <Chip
                        label={t('Aanwezig')}
                        selected={stand === 'aanwezig'}
                        onPress={() => {
                          void setAanwezigheid(booking.id, id, 'aanwezig');
                        }}
                      />
                      <Chip
                        label={t('Afwezig')}
                        selected={stand === 'afwezig'}
                        onPress={() => {
                          void setAanwezigheid(booking.id, id, 'afwezig');
                        }}
                      />
                    </View>
                  ) : (
                    <>
                      {/* Wie nog niet afgevinkt is, staat er zonder badge — dat is iets
                          anders dan afwezig. */}
                      {stand === 'aanwezig' ? (
                        <Badge label={t('Aanwezig')} color={tennisColors.courtFill} />
                      ) : null}
                      {stand === 'afwezig' ? (
                        <Badge label={t('Afwezig')} color={tennisColors.warningFill} />
                      ) : null}
                    </>
                  )}
                </View>
              );
            })}
            {/* Zonder dit leest een tweede tik op dezelfde knop als een knop die niets doet,
                terwijl het de enige weg terug is naar "nog niet afgevinkt". */}
            {magIetsZetten ? (
              <Text style={styles.hint}>
                {t('Nog eens op dezelfde knop tikken maakt de aantekening weer leeg.')}
              </Text>
            ) : null}
          </>
        ) : null}

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        {booking.notes ? (
          <>
            <Text style={styles.label}>{t('Notitie')}</Text>
            <Text style={styles.notes}>{booking.notes}</Text>
          </>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* Een aangevraagde les gaat pas door als de trainer ja zegt. Dat kan ook hier
            en niet alleen op het agendascherm: wie de les opent, wil hem hier kunnen
            afhandelen in plaats van eerst terug te moeten. */}
        {canManage && isAwaitingApproval(booking) ? (
          <View style={styles.actions}>
            <Button
              label={t('Goedkeuren')}
              variant="primary"
              fullWidth={false}
              onPress={() => {
                void approveBooking(booking.id);
              }}
            />
            <Button
              label={t('Weigeren')}
              variant="secondary"
              fullWidth={false}
              onPress={() => {
                void rejectBooking(booking.id);
              }}
            />
          </View>
        ) : null}

        {/* Annuleren van één losse les gaat rechtstreeks: dat is geen vraag waard, en de les
            blijft staan met "geannuleerd" erop. Verwijderen vraagt wél na, ook bij een losse
            les: daarna is er geen spoor meer van, ook niet in je historiek. Bij een reeks
            komt er nog een vraag bij, want daar kan één druk een half seizoen meenemen. */}
        {!inSeries && (canManage || magWeg) ? (
          confirming === 'delete' ? (
            <View style={styles.confirmBox}>
              <Text style={styles.confirmText}>
                {t('Verwijderen: deze les gaat uit de agenda. Weg is weg.')}
              </Text>
              <View style={styles.confirmRow}>
                <Button
                  label={t('Ja, verwijderen')}
                  variant="danger"
                  fullWidth={false}
                  onPress={() => weghalen(() => deleteBooking(booking.id))}
                />
                <Button
                  label={t('Nee')}
                  variant="secondary"
                  fullWidth={false}
                  onPress={() => setConfirming(null)}
                />
              </View>
            </View>
          ) : (
            <View style={[styles.actions, styles.confirmRow]}>
              {canManage && canCancel ? (
                <Button
                  label={t('Annuleren')}
                  variant="danger"
                  fullWidth={false}
                  onPress={() => {
                    void updateBooking(booking.id, { status: 'cancelled' });
                  }}
                />
              ) : null}
              {magWeg ? (
                <Button
                  label={t('Verwijderen')}
                  variant="danger"
                  fullWidth={false}
                  onPress={() => {
                    clearError();
                    setConfirming('delete');
                  }}
                />
              ) : null}
            </View>
          )
        ) : null}

        {inSeries && (canManage || magWeg) ? (
          confirming ? (
            <View style={styles.confirmBox}>
              <Text style={styles.confirmText}>
                {confirming === 'cancel' ? t('Annuleren') : t('Verwijderen')}:{' '}
                {tailOnlyThis
                  ? t('dit is de laatste les van de reeks.')
                  : t('alleen deze les, of deze en alle volgende ({lessen})?', {
                    lessen: lessons(tail.length),
                  })}
                {confirming === 'delete' ? ` ${t('Weg is weg.')}` : ''}
              </Text>
              <View style={styles.confirmRow}>
                <Button
                  label={tailOnlyThis ? t('Ja, deze les') : t('Alleen deze les')}
                  variant="danger"
                  fullWidth={false}
                  onPress={() => {
                    if (confirming === 'cancel') {
                      setConfirming(null);
                      void updateBooking(booking.id, { status: 'cancelled' });
                      return;
                    }
                    weghalen(() => deleteBooking(booking.id));
                  }}
                />
                {tailOnlyThis ? null : (
                  <Button
                    label={t('Deze en alle volgende ({n})', { n: tail.length })}
                    variant="danger"
                    fullWidth={false}
                    onPress={() => {
                      if (confirming === 'cancel') {
                        setConfirming(null);
                        void cancelSeriesFrom(booking.id);
                        return;
                      }
                      weghalen(() => deleteSeriesFrom(booking.id));
                    }}
                  />
                )}
                <Button
                  label={t('Nee')}
                  variant="secondary"
                  fullWidth={false}
                  onPress={() => setConfirming(null)}
                />
              </View>
            </View>
          ) : (
            <View style={[styles.actions, styles.confirmRow]}>
              {canManage && canCancel ? (
                <Button
                  label={t('Annuleren')}
                  variant="danger"
                  fullWidth={false}
                  onPress={() => {
                    clearError();
                    setConfirming('cancel');
                  }}
                />
              ) : null}
              {magWeg ? (
                <Button
                  label={t('Verwijderen')}
                  variant="danger"
                  fullWidth={false}
                  onPress={() => {
                    clearError();
                    setConfirming('delete');
                  }}
                />
              ) : null}
            </View>
          )
        ) : null}
      </DetailSheet>

      <PaymentMethodSheet
        visible={visible && choosing}
        current={booking.payment_method}
        cardHint={cardHint()}
        sponsorHint={sponsorTekst()}
        groupLesson={isGroup}
        error={error}
        onPick={(m) => {
          void pickMethod(m);
        }}
        onClose={() => {
          clearError();
          setChoosing(false);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  court: { ...typography.body, color: tennisColors.textMuted },
  partyLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: minTapTarget },
  partyLink: { ...typography.body, color: tennisColors.primary, fontWeight: '600' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  // De badge zelf is maar ~22 px hoog; het raakvlak eromheen houdt de app-brede 44 px aan.
  paymentTap: { minHeight: minTapTarget, justifyContent: 'center' },
  label: { fontSize: 13, fontWeight: '600', color: tennisColors.textMuted, marginTop: spacing.sm },
  price: { ...typography.body, fontWeight: '600', color: tennisColors.text, marginTop: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  // Naam links, de twee knoppen rechts. `wrap` omdat een lange naam naast twee knoppen op
  // een smalle telefoon niet past; dan schuiven de knoppen onder de naam in plaats van de
  // naam af te knijpen tot één letter.
  attendanceRow: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center',
    justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.sm,
  },
  attendanceName: { ...typography.body, color: tennisColors.text, flexShrink: 1 },
  notice: { fontSize: 13, color: tennisColors.text, fontStyle: 'italic', marginTop: spacing.sm },
  hint: { fontSize: 13, color: tennisColors.textMuted, fontStyle: 'italic', marginTop: spacing.xs },
  notes: { ...typography.body, color: tennisColors.text },
  error: { color: tennisColors.danger, fontSize: 14, marginTop: spacing.sm },
  actions: { marginTop: spacing.lg, alignItems: 'flex-start' },
  // Hetzelfde vak als bij het verwijderen van een beurtenkaart: de vraag staat in het blad
  // zelf, niet in een Alert die op web het scherm blokkeert.
  confirmBox: { marginTop: spacing.lg, gap: spacing.sm },
  confirmText: { fontSize: 14, color: tennisColors.text },
  confirmRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
