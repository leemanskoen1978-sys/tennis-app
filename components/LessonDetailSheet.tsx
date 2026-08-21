// Alles over één les, in een blad. Het maandoverzicht toonde dat allemaal op de kaart zelf:
// twee namen, twee badges en een knop per les. Daardoor werd elke kaart een blok en paste er
// maar één les per rij. Nu draagt de kaart alleen wat je nodig hebt om een les te herkennen,
// en woont de rest — met de handelingen — hier.

import React, { useState } from 'react';
import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, X } from 'lucide-react-native';

import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Chip } from './ui/Chip';
import { ParticipantPicker } from './ParticipantPicker';
import { PaymentMethodSheet } from './PaymentMethodSheet';
import { useSimpleData } from '../providers/SimpleDataProvider';
import { cardsFor, remaining, GROEPSLES_ALLEEN_FACTUUR } from '../lib/beurtenkaart';
import { formatDayTimeRange } from '../lib/datetime';
import { isGroupLesson, participantIdsOf } from '../lib/groups';
import {
  bookingPaymentMeta, lessonPriceLine, lessonShares, splitOf, type PaymentMeta,
} from '../lib/payments';
import { formatEuro } from '../lib/money';
import { seriesFrom } from '../lib/series';
import { sponsorHint, sponsorState } from '../lib/sponsor';
import { bookingStatusLabel } from '../lib/status';
import { isAwaitingApproval } from '../lib/inbox';
import type { Beurtenkaart, Booking, BookingStatus, PaymentMethod } from '../lib/types';
import { useT, t as tr } from '../lib/i18n';
import { tennisColors } from '../constants/tennis-colors';
import { spacing, radius, typography, shadow, minTapTarget, webCursor, contentMaxWidth } from '../constants/theme';

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

export function LessonDetailSheet({
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
  const {
    bookings, users, courts, beurtenkaarten,
    updateBooking, deleteBooking, cancelSeriesFrom, deleteSeriesFrom,
    approveBooking, rejectBooking,
    setPaymentMethod, setParticipants, setPaymentSplit, error, clearError,
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

  // De aanroeper geeft de les mee die hij had toen de kaart werd aangetikt. Lees hem terug
  // uit de opslag, anders blijven status en betaalwijze hier op de oude waarde staan zodra
  // je ze in dit blad wijzigt.
  const booking = selected ? (bookings.find((b) => b.id === selected.id) ?? selected) : null;
  if (!booking) return null;

  const nameOf = (id: string): string => users.find((u) => u.id === id)?.name ?? t('Onbekend');
  const courtName = courts.find((c) => c.id === booking.court_id)?.name ?? t('Onbekend terrein');
  const playerName = nameOf(booking.player_id);
  const coachName = nameOf(booking.coach_id);

  const payment = bookingPaymentMeta(booking);
  const paymentLabel = paymentLabelFor(booking, payment, beurtenkaarten);
  const isCancelled = booking.status === 'cancelled';
  const canCancel = !isCancelled && booking.status !== 'completed';
  // Alleen bij een lopende les: op een geannuleerde les valt niets meer te betalen.
  const canPay = canManage && !isCancelled;
  const isGroup = isGroupLesson(booking);
  const court = courts.find((c) => c.id === booking.court_id);
  const players = users.filter((u) => u.role !== 'coach');
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
    setConfirming(null);
    onClose();
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
      <Modal
        visible={visible && !choosing}
        transparent
        animationType="slide"
        onRequestClose={close}
      >
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <Text style={styles.title}>{formatDayTimeRange(booking.start_time, booking.end_time)}</Text>
              <Pressable
                onPress={close}
                accessibilityRole="button"
                accessibilityLabel={t('Sluiten')}
                style={[styles.close, webCursor]}
              >
                <X size={20} color={tennisColors.textMuted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.body}>
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

              {/* Een losse les gaat rechtstreeks: één les annuleren is geen vraag waard, en
                  verwijderen bestond hier niet. Bij een reeks wél, want daar kan één druk
                  een half seizoen meenemen — dus eerst vragen wat je bedoelt. */}
              {canManage && canCancel && !inSeries ? (
                <View style={styles.actions}>
                  <Button
                    label={t('Annuleren')}
                    variant="danger"
                    fullWidth={false}
                    onPress={() => {
                      void updateBooking(booking.id, { status: 'cancelled' });
                    }}
                  />
                </View>
              ) : null}

              {canManage && inSeries ? (
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
                          setConfirming(null);
                          if (confirming === 'cancel') {
                            void updateBooking(booking.id, { status: 'cancelled' });
                            return;
                          }
                          // De les bestaat straks niet meer; het blad zou naar een lege
                          // boeking staan te kijken, dus het gaat mee dicht.
                          void deleteBooking(booking.id);
                          close();
                        }}
                      />
                      {tailOnlyThis ? null : (
                        <Button
                          label={t('Deze en alle volgende ({n})', { n: tail.length })}
                          variant="danger"
                          fullWidth={false}
                          onPress={() => {
                            setConfirming(null);
                            if (confirming === 'cancel') {
                              void cancelSeriesFrom(booking.id);
                              return;
                            }
                            void deleteSeriesFrom(booking.id);
                            close();
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
                    {canCancel ? (
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
                    <Button
                      label={t('Verwijderen')}
                      variant="danger"
                      fullWidth={false}
                      onPress={() => {
                        clearError();
                        setConfirming('delete');
                      }}
                    />
                  </View>
                )
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

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
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  // Zonder breedte-cap plakt een blad in een breed venster over de volle breedte, terwijl
  // de rest van de app gecentreerd op zijn maximum staat. Een blad hoort bij het scherm
  // eronder, dus het houdt dezelfde maat aan.
  sheet: {
    width: '100%',
    maxWidth: contentMaxWidth,
    alignSelf: 'center',
    backgroundColor: tennisColors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    maxHeight: '85%',
    ...shadow('lg'),
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.sm,
    backgroundColor: tennisColors.border,
    marginBottom: spacing.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...typography.h2, color: tennisColors.text, flexShrink: 1 },
  close: { minHeight: minTapTarget, minWidth: minTapTarget, alignItems: 'flex-end', justifyContent: 'center' },
  body: { gap: spacing.xs, paddingBottom: spacing.lg },
  court: { ...typography.body, color: tennisColors.textMuted },
  partyLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: minTapTarget },
  partyLink: { ...typography.body, color: tennisColors.primary, fontWeight: '600' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  // De badge zelf is maar ~22 px hoog; het raakvlak eromheen houdt de app-brede 44 px aan.
  paymentTap: { minHeight: minTapTarget, justifyContent: 'center' },
  label: { fontSize: 13, fontWeight: '600', color: tennisColors.textMuted, marginTop: spacing.sm },
  price: { ...typography.body, fontWeight: '600', color: tennisColors.text, marginTop: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
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
