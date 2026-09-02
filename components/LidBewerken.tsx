// Eén lid bewerken — en dan ook echt maar één plek.
//
// Dit blad hing eerst alleen achter een naam in Beheer → Leden, en daarnaast bestond er een
// tweede formulier ("Mijn gegevens") waar een trainer zijn eigen e-mailadres en lesdagen
// zette, met net andere velden en net andere regels. Wie zijn gsm-nummer wilde wijzigen,
// moest weten welke van de twee het kon. Nu is dit de enige: Beheer → Leden opent hem voor
// een lid, je profiel en je eigen dossier openen hem voor jezelf, en wat je mag hangt aan
// wie je bent — niet aan waar je vandaan kwam.
//
// Wat er níét in staat: de boekingstijden. Dat zijn geen persoonsgegevens maar een rooster
// met periodes erin, en dat past niet in een blad. Er staat een knop naar dat scherm.
//
// Drie dingen op dit blad zijn geen gewoon veld en gedragen zich ook niet zo:
//  - de rol, want een trainer met lessen op zijn naam kan niet zomaar speler worden;
//  - het beheerdersvinkje, want de laatste beheerder die zichzelf ontvinkt sluit de club
//    buiten haar eigen deur;
//  - verwijderen, want dat neemt zijn lessen, zijn dossier en zijn kaarten mee.
// De regels erachter staan in lib/leden; hier staat wat je ervan ziet.

import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Clock, Save, Trash2 } from 'lucide-react-native';

import { Button } from './ui/Button';
import { Chip } from './ui/Chip';
import { DetailSheet } from './ui/DetailSheet';
import { useSimpleData } from '../providers/SimpleDataProvider';
import { isValidEmail, normalizePhone } from '../lib/contact';
import {
  gevolgenVanVerwijderen, heeftGevolgen, magVinkjeWeg, rolWisselBezwaar, type Gevolgen,
} from '../lib/leden';
import { isAdmin, isCoach, roleLabel } from '../lib/rechten';
import { isMijnKind } from '../lib/ouderkind';
import { DAY_LABELS } from '../lib/slots';
import { PAYMENT_METHODS, PAYMENT_LABELS } from '../lib/payments';
import { useT } from '../lib/i18n';
import { tennisColors } from '../constants/tennis-colors';
import { spacing, radius, typography } from '../constants/theme';
import type { PaymentMethod, Role, User } from '../lib/types';

/** Lesdagen op leesvolgorde: maandag eerst, zondag laatst. De waarden blijven getDay(). */
const DAG_VOLGORDE = [1, 2, 3, 4, 5, 6, 0] as const;

/** De opsomming onder de verwijderknop: wat er meegaat, in gewone woorden. */
function gevolgenTekst(g: Gevolgen, t: (nl: string, vars?: Record<string, string | number>) => string): string {
  const delen: string[] = [];
  if (g.lessen > 0) delen.push(g.lessen === 1 ? t('1 les') : t('{n} lessen', { n: g.lessen }));
  if (g.verslagen > 0) {
    delen.push(g.verslagen === 1 ? t('1 verslag') : t('{n} verslagen', { n: g.verslagen }));
  }
  if (g.kaarten > 0) {
    delen.push(g.kaarten === 1 ? t('1 beurtenkaart') : t('{n} beurtenkaarten', { n: g.kaarten }));
  }
  if (g.doelen > 0) delen.push(g.doelen === 1 ? t('1 doel') : t('{n} doelen', { n: g.doelen }));
  if (g.memos > 0) delen.push(g.memos === 1 ? t('1 memo') : t('{n} memo’s', { n: g.memos }));
  if (g.lesmateriaal > 0) {
    delen.push(g.lesmateriaal === 1
      ? t('1 stuk lesmateriaal')
      : t('{n} stukken lesmateriaal', { n: g.lesmateriaal }));
  }
  if (g.koppelingen > 0) {
    delen.push(g.koppelingen === 1
      ? t('1 koppeling met een ouder of kind')
      : t('{n} koppelingen met ouders of kinderen', { n: g.koppelingen }));
  }
  return delen.join(' · ');
}

export function LidBewerken({
  lid,
  visible,
  onClose,
}: {
  lid: User;
  visible: boolean;
  onClose: () => void;
}): React.JSX.Element {
  const t = useT();
  const router = useRouter();
  const {
    currentUser, users, bookings, progress, beurtenkaarten, goals, lessons, relaties, memos,
    updateUser, setUserRole, setBeheerder, deleteUser, error, clearError,
  } = useSimpleData();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [rate, setRate] = useState('');
  const [budget, setBudget] = useState('');
  const [days, setDays] = useState<number[]>([]);
  const [opmerking, setOpmerking] = useState('');
  const [bevestigen, setBevestigen] = useState(false);
  const [bewaard, setBewaard] = useState(false);

  // Bij elk openen opnieuw vullen: het blad blijft gemonteerd, dus een afgebroken bewerking
  // van het vorige lid zou anders boven het volgende blijven hangen.
  useEffect(() => {
    if (!visible) return;
    setName(lid.name);
    setEmail(lid.email);
    setPhone(lid.phone ?? '');
    setRate(lid.hourly_rate !== undefined ? String(lid.hourly_rate) : '');
    setBudget(lid.sponsor_budget !== undefined ? String(lid.sponsor_budget) : '');
    setDays(lid.working_days ?? []);
    setOpmerking(lid.note_for_coach ?? '');
    setBevestigen(false);
    setBewaard(false);
    clearError();
  }, [visible, lid, clearError]);

  const emailOk = isValidEmail(email.trim());
  const naamOk = name.trim().length > 0;

  // De vraag "mag dit vinkje weg" gaat over de stand zoals ze nu is opgeslagen, niet over
  // wat er in de velden staat: het vinkje schrijft meteen weg.
  const vinkjeWegMag = magVinkjeWeg(users, lid.id);
  const bezwaar = rolWisselBezwaar(lid, lid.role === 'coach' ? 'player' : 'coach', bookings);
  const gevolgen = gevolgenVanVerwijderen(
    { bookings, progress, beurtenkaarten, goals, lessons, relaties, memos },
    lid.id,
  );
  const zelf = currentUser?.id === lid.id;
  // Wie wat mag, op één plek uitgerekend — het blad wordt vanaf drie schermen geopend en
  // mag niet van de aanroeper afhangen wat er te zien is.
  //
  //  - je eigen gegevens: iedereen;
  //  - die van een speler: elke trainer, want hij maakt die accounts ook aan;
  //  - die van een collega: alleen de beheerder.
  const beheerder = isAdmin(currentUser);
  const magBewerken = beheerder || zelf || (isCoach(currentUser) && lid.role === 'player');
  // De opmerking voor de trainer is het enige dat een ouder op het account van zijn kind
  // mag schrijven. Hij regelt de club niet mee, maar hij is wel degene die weet dat zijn
  // zoon een week weg is of met een gekneusde pols speelt.
  const ouderVan = isMijnKind(currentUser?.id, lid.id, relaties);
  const magOpmerking = magBewerken || ouderVan;
  // Het uurloon is wat de club uitbetaalt; wie het zelf kan zetten, verhoogt zijn eigen
  // loon. De databank denkt er hetzelfde over (`rates_write`).
  const magTarief = beheerder;

  const bewaar = (): void => {
    if (magBewerken && (!naamOk || !emailOk)) return;
    const nummer = normalizePhone(phone);
    const tarief = Number(rate.replace(',', '.'));
    const sponsor = Number(budget.replace(',', '.'));
    void updateUser(lid.id, {
      // De opmerking staat los van de rest: een ouder mag alleen díé schrijven, en dan mag
      // er ook niets anders meegaan — anders zet hij ongemerkt de naam terug zoals het veld
      // toevallig stond.
      ...(magOpmerking ? { note_for_coach: opmerking.trim() || undefined } : {}),
      ...(!magBewerken ? {} : {
      name: name.trim(),
      email: email.trim(),
      // Leeg betekent "niet ingevuld", en dat is iets anders dan een lege tekst: de rest
      // van de app leest `undefined` als "er staat niets".
      phone: nummer ? nummer : undefined,
      ...(lid.role === 'coach'
        ? {
          // Alleen meesturen als je het mag: anders zou een trainer die zijn nummer
          // bijwerkt zijn eigen tarief "opnieuw zetten" en daarop stuklopen.
          ...(magTarief ? { hourly_rate: rate.trim() && Number.isFinite(tarief) ? tarief : undefined } : {}),
          working_days: days.length > 0 ? [...days].sort((a, b) => a - b) : undefined,
        }
        : {
          sponsor_budget: budget.trim() && Number.isFinite(sponsor) ? sponsor : undefined,
        }),
      }),
    }).then(() => setBewaard(true), () => {});
  };

  return (
    <DetailSheet
      title={zelf ? t('Mijn gegevens') : lid.name}
      subtitle={lid.email}
      visible={visible}
      onClose={onClose}
    >
      {/* Wie hier alleen mag kijken, krijgt dat te horen in plaats van velden die weigeren.
          Gebeurt in de praktijk zelden — de knop staat er dan niet — maar een blad dat via
          een link opengaat hoort het ook te weten. */}
      {!magBewerken ? (
        <Text style={styles.helper}>
          {magOpmerking
            ? t('De gegevens hieronder beheert de club. Je opmerking voor de trainer schrijf '
              + 'je zelf.')
            : t('Deze gegevens beheert de beheerder van de club.')}
        </Text>
      ) : null}
      {/* Zonder recht om te wijzigen staat hier tekst en geen invulveld. Een veld dat er
          uitziet als een veld maar niets bewaart, is erger dan geen veld. */}
      {magBewerken ? (
        <>
          <Text style={styles.label}>{t('Naam')}</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} />
          {!naamOk ? <Text style={styles.error}>{t('Een naam is verplicht.')}</Text> : null}

          <Text style={styles.label}>{t('E-mailadres')}</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.helper}>
            {t('Hiermee logt hij in. Verander je het, dan hoort hij het te weten.')}
          </Text>
          {!emailOk ? <Text style={styles.error}>{t('Dit lijkt geen geldig e-mailadres.')}</Text> : null}

          <Text style={styles.label}>{t('Gsm-nummer')}</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        </>
      ) : (
        <>
          <Text style={styles.label}>{t('Naam')}</Text>
          <Text style={styles.waarde}>{lid.name}</Text>
          <Text style={styles.label}>{t('E-mailadres')}</Text>
          <Text style={styles.waarde}>{lid.email}</Text>
          <Text style={styles.label}>{t('Gsm-nummer')}</Text>
          <Text style={styles.waarde}>{lid.phone ?? t('Niet ingevuld')}</Text>
        </>
      )}

      {/* Voor de trainer, van de speler of zijn ouder. Bij de speler en niet bij een les:
          het gaat zelden over één uur, en een trainer die elke les moet openen om te zien
          of er iets in staat, leest het niet. */}
      <Text style={styles.label}>{t('Opmerking voor de trainer')}</Text>
      {magOpmerking ? (
        <>
          <TextInput
            style={[styles.input, styles.opmerking]}
            value={opmerking}
            onChangeText={setOpmerking}
            multiline
            placeholder={t('bv. speelt met een gekneusde pols, of: weg in de paasvakantie')}
            placeholderTextColor={tennisColors.textMuted}
          />
          <Text style={styles.helper}>
            {t('De trainer leest dit op het dossier. Leeg maken mag: dan staat er niets.')}
          </Text>
        </>
      ) : (
        <Text style={styles.waarde}>{lid.note_for_coach ?? t('Niets ingevuld')}</Text>
      )}

      {lid.role === 'coach' && magBewerken ? (
        <>
          {/* De lesdagen stonden in het tweede formulier dat hiermee verdwijnt. Ze horen
              bij wie iemand is en niet bij het rooster: welke uren hij geeft, staat op
              Boekingstijden. */}
          <Text style={styles.label}>{t('Lesdagen')}</Text>
          <View style={styles.chipRow}>
            {DAG_VOLGORDE.map((d) => (
              <Chip
                key={d}
                label={t(DAY_LABELS[d])}
                selected={days.includes(d)}
                onPress={() => setDays((vorige) => (
                  vorige.includes(d) ? vorige.filter((x) => x !== d) : [...vorige, d]
                ))}
              />
            ))}
          </View>
          <Text style={styles.helper}>
            {t('Niets aangevinkt betekent: elke dag beschikbaar.')}
          </Text>

          <View style={styles.actions}>
            <Button
              label={t('Boekingstijden')}
              variant="secondary"
              fullWidth={false}
              icon={<Clock size={16} color={tennisColors.text} />}
              onPress={() => {
                onClose();
                router.push('/admin/boekingstijden');
              }}
            />
          </View>
          <Text style={styles.helper}>
            {t('Tussen welke uren er geboekt kan worden, en de periodes waarin dat anders '
              + 'is.')}
          </Text>

          {magTarief ? (
            <>
              <Text style={styles.label}>{t('Uurtarief')}</Text>
              <TextInput style={styles.input} value={rate} onChangeText={setRate} keyboardType="numeric" />
              <Text style={styles.helper}>
                {t('Alleen ter informatie — de omzet loopt op het baantarief.')}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.label}>{t('Uurtarief')}</Text>
              <Text style={styles.waarde}>
                {lid.hourly_rate === undefined
                  ? t('Nog niet ingesteld')
                  : t('€{bedrag} per uur', { bedrag: lid.hourly_rate })}
              </Text>
              <Text style={styles.helper}>
                {t('Dit stelt de beheerder in: het is wat de club uitbetaalt.')}
              </Text>
            </>
          )}
        </>
      ) : !magBewerken ? (
        /* Een ouder kijkt hier alleen mee: het sponsorbudget is een afspraak met de club en
           de standaard betaalwijze hangt aan de rekening. Beide schreef de app meteen weg,
           dus ze mogen hier niet als knop staan. */
        null
      ) : (
        <>
          <Text style={styles.label}>{t('Sponsorbudget')}</Text>
          <TextInput style={styles.input} value={budget} onChangeText={setBudget} keyboardType="numeric" />
          <Text style={styles.helper}>
            {t('Leeg is geen sponsorcontract. Wat er nog van over is, rekent de app uit de '
              + 'gesponsorde lessen.')}
          </Text>

          {/* Schrijft meteen weg: het is een keuze uit een rij en geen veld dat je afmaakt. */}
          <Text style={styles.label}>{t('Standaard betaalwijze')}</Text>
          <View style={styles.chipRow}>
            {PAYMENT_METHODS.map((m: PaymentMethod) => (
              <Chip
                key={m}
                label={t(PAYMENT_LABELS[m])}
                selected={(lid.default_payment_method ?? 'open') === m}
                onPress={() => {
                  clearError();
                  void updateUser(lid.id, { default_payment_method: m });
                }}
              />
            ))}
          </View>
          <Text style={styles.helper}>
            {t('Hiermee staat een nieuwe les van deze speler alvast klaar; je kunt het per '
              + 'les nog wijzigen.')}
          </Text>
        </>
      )}

      {magOpmerking ? (
        <View style={styles.actions}>
          <Button
            label={bewaard ? t('Bewaard') : t('Bewaren')}
            onPress={bewaar}
            disabled={magBewerken && (!naamOk || !emailOk)}
            fullWidth={false}
            icon={<Save size={16} color={tennisColors.onFill} />}
          />
        </View>
      ) : null}

      {/* Het type account, het beheerdersvinkje en het verwijderen zijn er alleen voor de
          beheerder. Een trainer die zijn eigen nummer bijwerkt, hoort geen knop te zien
          waarmee hij zichzelf tot speler maakt of zijn account opblaast. */}
      {beheerder ? (
      <>
      <View style={styles.divider} />

      {/* De rol schrijft meteen weg, net als het vinkje: het is één keuze en geen formulier,
          en een bewaarknop die soms wél en soms niet nodig is, is erger dan geen. */}
      <Text style={styles.label}>{t('Type account')}</Text>
      <View style={styles.chipRow}>
        {(['player', 'coach'] as Role[]).map((r) => (
          <Chip
            key={r}
            label={roleLabel(r)}
            selected={lid.role === r}
            disabled={lid.role !== r && bezwaar !== null}
            onPress={() => {
              if (lid.role === r) return;
              clearError();
              void setUserRole(lid.id, r);
            }}
          />
        ))}
      </View>
      <Text style={styles.helper}>
        {bezwaar
          ?? t('Een trainer heeft een eigen agenda en spelers; een speler niet. Zijn lessen, '
            + 'dossier en betalingen blijven hoe dan ook staan.')}
      </Text>

      <Text style={styles.label}>{t('Beheerder')}</Text>
      <View style={styles.chipRow}>
        <Chip
          label={isAdmin(lid) ? t('Is beheerder') : t('Beheerder maken')}
          selected={isAdmin(lid)}
          disabled={isAdmin(lid) && !vinkjeWegMag}
          onPress={() => {
            clearError();
            void setBeheerder(lid.id, !isAdmin(lid));
          }}
        />
      </View>
      <Text style={styles.helper}>
        {isAdmin(lid) && !vinkjeWegMag
          ? t('Dit is de enige beheerder. Maak eerst iemand anders beheerder; anders komt '
            + 'niemand er nog bij.')
          : t('Een beheerder mag in elke agenda werken, ziet de cijfers van de club en kan '
            + 'hier andere beheerders aanwijzen.')}
      </Text>
      {zelf && isAdmin(lid) && vinkjeWegMag ? (
        <Text style={styles.helper}>
          {t('Dit ben jij: neem je het weg, dan verlies je zelf dit scherm.')}
        </Text>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {bevestigen ? (
        <View style={styles.confirmBox}>
          <Text style={styles.confirmText}>
            {t('{naam} verwijderen. Weg is weg.', { naam: lid.name })}
            {heeftGevolgen(gevolgen)
              ? ` ${t('Dit gaat mee: {dingen}.', { dingen: gevolgenTekst(gevolgen, t) })}`
              : ` ${t('Er hangt verder niets aan hem.')}`}
          </Text>
          <View style={styles.chipRow}>
            <Button
              label={t('Ja, verwijderen')}
              variant="danger"
              fullWidth={false}
              onPress={() => {
                setBevestigen(false);
                // Pas dichtdoen als het gelukt is: anders is er geen plek meer waar een
                // weigering te lezen valt.
                void deleteUser(lid.id).then(onClose, () => {});
              }}
            />
            <Button
              label={t('Nee')}
              variant="secondary"
              fullWidth={false}
              onPress={() => setBevestigen(false)}
            />
          </View>
        </View>
      ) : (
        <View style={styles.actions}>
          <Button
            label={t('Lid verwijderen')}
            variant="danger"
            fullWidth={false}
            disabled={zelf}
            icon={<Trash2 size={16} color={tennisColors.onFill} />}
            onPress={() => {
              clearError();
              setBevestigen(true);
            }}
          />
        </View>
      )}
      {zelf ? (
        <Text style={styles.helper}>{t('Je eigen account verwijder je hier niet.')}</Text>
      ) : null}
      </>
      ) : null}
    </DetailSheet>
  );
}

const styles = StyleSheet.create({
  label: { ...typography.label, color: tennisColors.textMuted, marginTop: spacing.md },
  input: {
    backgroundColor: tennisColors.background,
    borderWidth: 1,
    borderColor: tennisColors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: tennisColors.text,
  },
  helper: { ...typography.caption, color: tennisColors.textMuted },
  waarde: { ...typography.body, color: tennisColors.text },
  opmerking: { minHeight: 88, textAlignVertical: 'top' },
  error: { color: tennisColors.danger, fontSize: 13 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  divider: { height: 1, backgroundColor: tennisColors.border, marginVertical: spacing.lg },
  confirmBox: {
    backgroundColor: tennisColors.dangerTint,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  confirmText: { ...typography.body, color: tennisColors.text },
});
