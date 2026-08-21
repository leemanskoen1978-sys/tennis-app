import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { useT } from '../../lib/i18n';
import { parseCsv } from '../../lib/csv';
import { planImport, voorbeeldLedenCsv, type ImportPlan } from '../../lib/import-leden';
import { kanBestandKiezen, kiesTekstbestand } from '../../lib/bestand';
import { shareCsv } from '../../lib/share';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography } from '../../constants/theme';

/**
 * Leden importeren uit een lijst die de club al heeft.
 *
 * Het scherm schrijft nooit iets weg op grond van een bestand alleen: eerst komt het plan
 * in beeld ("40 nieuw, 2 bijgewerkt, 1 fout"), en pas de knop eronder doet iets. Wie het
 * verkeerde bestand koos, ziet dat vóór het gebeurd is en niet erna.
 */
export default function LedenImport(): React.JSX.Element {
  const t = useT();
  const { currentUser, users, addUser, updateUser } = useSimpleData();
  const [tekst, setTekst] = useState<string>('');
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [bezig, setBezig] = useState<boolean>(false);
  const [resultaat, setResultaat] = useState<string | null>(null);

  if (currentUser?.role !== 'coach') {
    return (
      <Screen scroll={false}>
        <Text style={styles.muted}>{t('Beheer is alleen voor trainers.')}</Text>
      </Screen>
    );
  }

  const toonPlan = (inhoud: string): void => {
    setTekst(inhoud);
    setResultaat(null);
    setPlan(planImport(parseCsv(inhoud), users));
  };

  const opnieuw = (): void => {
    setTekst('');
    setPlan(null);
    setResultaat(null);
  };

  const voerUit = async (): Promise<void> => {
    if (!plan || bezig) return;
    setBezig(true);
    let toegevoegd = 0;
    let bijgewerkt = 0;
    let mislukt = 0;
    // Eén voor één en niet in één klap: elke wijziging loopt zo over dezelfde bewaakte weg
    // als een trainer die met de hand een lid toevoegt. Het kost een ronde per lid en dat
    // duurt merkbaar bij een grote lijst — de winst is dat er geen tweede manier bestaat om
    // een lid de club in te krijgen, met eigen regels die kunnen gaan afwijken.
    for (const lid of plan.nieuw) {
      try { await addUser(lid); toegevoegd++; } catch { mislukt++; }
    }
    for (const b of plan.bijgewerkt) {
      try { await updateUser(b.bestaand.id, b.wijzigingen); bijgewerkt++; } catch { mislukt++; }
    }
    setBezig(false);
    setPlan(null);
    setTekst('');
    setResultaat(
      mislukt > 0
        ? t('{toegevoegd} toegevoegd, {bijgewerkt} bijgewerkt, {mislukt} mislukt. Probeer het bestand opnieuw — wie er al staat, komt er niet dubbel bij.',
          { toegevoegd, bijgewerkt, mislukt })
        : t('{toegevoegd} toegevoegd en {bijgewerkt} bijgewerkt.', { toegevoegd, bijgewerkt }),
    );
  };

  return (
    <Screen>
      <Card>
        <Text style={styles.kop}>{t('Leden importeren')}</Text>
        <Text style={styles.uitleg}>
          {t('Sla je Excel-lijst op als CSV en kies hem hier. Kolommen: naam, email, rol, telefoon, uurtarief. Alleen naam en email zijn verplicht.')}
        </Text>
        <Button
          label={t('Voorbeeldbestand downloaden')}
          variant="secondary"
          onPress={() => { void shareCsv('leden-voorbeeld.csv', voorbeeldLedenCsv()); }}
        />
      </Card>

      {plan === null ? (
        <Card>
          {kanBestandKiezen ? (
            <Button
              label={t('Bestand kiezen')}
              onPress={() => {
                void kiesTekstbestand().then((inhoud) => {
                  if (inhoud !== null) toonPlan(inhoud);
                });
              }}
            />
          ) : (
            <>
              {/* Op een telefoon is er geen bestandskiezer. Plakken uit Excel geeft
                  tab-gescheiden kolommen en die leest `parseCsv` ook. */}
              <Text style={styles.label}>{t('Plak hier de kolommen uit Excel')}</Text>
              <TextInput
                style={styles.plakvak}
                value={tekst}
                onChangeText={setTekst}
                multiline
                numberOfLines={8}
                placeholder={t('naam;email;rol')}
                placeholderTextColor={tennisColors.textMuted}
              />
              <Button
                label={t('Nakijken')}
                disabled={tekst.trim().length === 0}
                onPress={() => toonPlan(tekst)}
                style={styles.knop}
              />
            </>
          )}
          {resultaat ? <Text style={styles.resultaat}>{resultaat}</Text> : null}
        </Card>
      ) : (
        <>
          <Card>
            <Text style={styles.kop}>{t('Dit gaat er gebeuren')}</Text>
            <Text style={styles.telling}>
              {t('{nieuw} nieuw, {bijgewerkt} bijgewerkt, {fouten} fout', {
                nieuw: plan.nieuw.length,
                bijgewerkt: plan.bijgewerkt.length,
                fouten: plan.fouten.length,
              })}
              {plan.waarschuwingen.length > 0
                ? t(' — {aantal} om na te kijken', { aantal: plan.waarschuwingen.length })
                : ''}
            </Text>

            {/* Een kolom die we niet thuisbrengen valt stil weg; dat hoort de trainer te
                zien vóór hij importeert, niet weken later als de tarieven blijken te
                ontbreken. Dit is een mededeling en geen waarschuwing: een gewone ledenlijst
                met een kolom "lidnummer" levert deze lijst altijd, en dat is normaal. */}
            {plan.nietHerkend.length > 0 ? (
              <Text style={styles.mededeling}>
                {t('Deze kolommen herken ik niet en komen niet mee: {koppen}', {
                  koppen: plan.nietHerkend.join(', '),
                })}
              </Text>
            ) : null}
            {plan.dubbel.length > 0 ? (
              <Text style={styles.mededeling}>
                {t('Deze kolommen staan er twee keer; ik lees alleen de eerste: {koppen}', {
                  koppen: plan.dubbel.join(', '),
                })}
              </Text>
            ) : null}

            {plan.nieuw.map((lid) => (
              <Text key={`n-${lid.email}`} style={styles.regel}>
                {t('Nieuw')}: {lid.name} — {lid.email}
              </Text>
            ))}
            {plan.bijgewerkt.map((b) => (
              <Text key={`b-${b.bestaand.id}`} style={styles.regel}>
                {t('Bijwerken')}: {b.bestaand.name} — {Object.keys(b.wijzigingen).join(', ')}
              </Text>
            ))}
          </Card>

          {plan.waarschuwingen.length > 0 ? (
            <Card>
              {/* Deze regels gaan wél door. Ze staan apart van de fouten omdat ze om een
                  oordeel van de trainer vragen — is dit dezelfde Jonas of een tweede? */}
              <Text style={styles.waarschuwKop}>{t('Kijk deze regels even na')}</Text>
              {plan.waarschuwingen.map((w) => (
                <Text key={`w-${w.regel}-${w.reden}`} style={styles.waarschuwing}>
                  {t('Regel {regel}', { regel: w.regel })}: {t(w.reden)}
                </Text>
              ))}
            </Card>
          ) : null}

          {plan.fouten.length > 0 ? (
            <Card>
              <Text style={styles.foutKop}>{t('Deze regels worden overgeslagen')}</Text>
              {plan.fouten.map((f) => (
                <Text key={`f-${f.regel}`} style={styles.fout}>
                  {t('Regel {regel}', { regel: f.regel })}: {t(f.reden)}
                </Text>
              ))}
            </Card>
          ) : null}

          <Card>
            <Button
              label={bezig ? t('Bezig…') : t('Importeren')}
              disabled={bezig || (plan.nieuw.length === 0 && plan.bijgewerkt.length === 0)}
              onPress={() => { void voerUit(); }}
            />
            <Button
              label={t('Ander bestand')}
              variant="secondary"
              disabled={bezig}
              onPress={opnieuw}
              style={styles.knop}
            />
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: tennisColors.textMuted, fontSize: 14 },
  kop: { ...typography.h3, color: tennisColors.text },
  uitleg: {
    fontSize: 14,
    color: tennisColors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: tennisColors.textMuted,
    marginBottom: spacing.xs,
  },
  plakvak: {
    backgroundColor: tennisColors.background,
    borderWidth: 1,
    borderColor: tennisColors.border,
    borderRadius: 8,
    padding: spacing.md,
    minHeight: 160,
    fontSize: 14,
    color: tennisColors.text,
    textAlignVertical: 'top',
  },
  knop: { marginTop: spacing.md },
  telling: { ...typography.h3, color: tennisColors.primary, marginBottom: spacing.sm },
  regel: { fontSize: 14, color: tennisColors.text, marginTop: spacing.xs },
  mededeling: { fontSize: 14, color: tennisColors.textMuted, marginBottom: spacing.sm },
  waarschuwKop: { ...typography.h3, color: tennisColors.text },
  waarschuwing: { fontSize: 14, color: tennisColors.textMuted, marginTop: spacing.xs },
  foutKop: { ...typography.h3, color: tennisColors.danger },
  fout: { fontSize: 14, color: tennisColors.danger, marginTop: spacing.xs },
  resultaat: { fontSize: 14, color: tennisColors.text, marginTop: spacing.md },
});
