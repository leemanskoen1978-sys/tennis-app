import React, { useEffect, useState } from 'react';
import { Text, TextInput, StyleSheet } from 'react-native';
import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { useT } from '../../lib/i18n';
import { parseCsv } from '../../lib/csv';
import {
  planImport, voorbeeldLedenCsv, pasImportToe, bestandAfgekeurd, VELD_NAMEN,
  type ImportPlan, type ImportUitslag,
} from '../../lib/import-leden';
import { kanBestandKiezen, kiesTekstbestand } from '../../lib/bestand';
import { shareCsv } from '../../lib/share';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography } from '../../constants/theme';

// Overleeft, anders dan React-state, een her-mount van dit scherm: een trainer die tijdens
// een grote import wegnavigeert en terugkomt krijgt zo geen tweede lus over hetzelfde
// bestand, ook al is de vorige `LedenImport`-instantie allang verdwenen. De luisteraars
// hieronder zorgen dat een scherm dat intussen opnieuw opende niet voor altijd "Bezig" blijft
// tonen: zodra de lopende lus klaar is, hoort elk gemount scherm dat.
let importDraait = false;
const importKlaarLuisteraars = new Set<() => void>();

function meldImportKlaar(): void {
  importDraait = false;
  importKlaarLuisteraars.forEach((fn) => fn());
}

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
  const [bezig, setBezig] = useState<boolean>(importDraait);
  const [voortgang, setVoortgang] = useState<{ klaar: number; totaal: number } | null>(null);
  const [uitkomst, setUitkomst] = useState<ImportUitslag | null>(null);

  // Zie `importKlaarLuisteraars` hierboven: dit scherm kan gemount worden ná het opnieuw
  // openen van de trainer, terwijl de lus van vóór het navigeren nog loopt op een intussen
  // verdwenen instantie. Zonder dit effect zou "Bezig" hier voor altijd blijven staan.
  useEffect(() => {
    const klaar = (): void => { setBezig(false); setVoortgang(null); };
    importKlaarLuisteraars.add(klaar);
    // Dekt de smalle kier tussen het lezen van `importDraait` hierboven (bij het aanmaken van
    // de state) en deze registratie: liep de import intussen al af, dan is er niemand meer
    // die het nog gaat melden, en zou dit scherm anders voor altijd op "Bezig" blijven staan.
    if (!importDraait) klaar();
    return () => { importKlaarLuisteraars.delete(klaar); };
  }, []);

  if (currentUser?.role !== 'coach') {
    return (
      <Screen scroll={false}>
        <Text style={styles.muted}>{t('Beheer is alleen voor trainers.')}</Text>
      </Screen>
    );
  }

  if (bezig) {
    return (
      <Screen scroll={false}>
        <Card>
          <Text style={styles.kop}>{t('Bezig met importeren…')}</Text>
          <Text style={styles.uitleg}>
            {voortgang
              ? t('Lid {klaar} van {totaal}.', { klaar: voortgang.klaar, totaal: voortgang.totaal })
              : t('Dit kan even duren. Blijf op dit scherm tot het klaar is.')}
          </Text>
        </Card>
      </Screen>
    );
  }

  const toonPlan = (inhoud: string): void => {
    setTekst(inhoud);
    setUitkomst(null);
    setPlan(planImport(parseCsv(inhoud), users));
  };

  const opnieuw = (): void => {
    setTekst('');
    setPlan(null);
    setUitkomst(null);
  };

  const voerUit = async (): Promise<void> => {
    if (!plan || bezig || importDraait) return;
    importDraait = true;
    setBezig(true);
    setVoortgang({ klaar: 0, totaal: plan.nieuw.length + plan.bijgewerkt.length });
    try {
      const uitslag = await pasImportToe(
        plan,
        { addUser, updateUser },
        (klaar, totaal) => setVoortgang({ klaar, totaal }),
      );
      setUitkomst(uitslag);
      // Alleen bij volledig succes mag het plakvak leeg: bij een mislukking staat er op web
      // weliswaar een bestand dat opnieuw te kiezen is, maar op een telefoon was er nooit een
      // bestand — alleen deze geplakte tekst — en het klembord kan intussen iets anders bevatten.
      if (uitslag.mislukt === 0) setTekst('');
    } finally {
      meldImportKlaar();
    }
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
                  tab-gescheiden kolommen en die leest `parseCsv` ook — dus staat de
                  voorbeeldtekst hieronder ook met tabs, en niet met puntkomma's. */}
              <Text style={styles.label}>{t('Plak hier de kolommen uit Excel')}</Text>
              <TextInput
                style={styles.plakvak}
                value={tekst}
                onChangeText={setTekst}
                multiline
                placeholder={'naam\temail\trol'}
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
        </Card>
      ) : bestandAfgekeurd(plan) ? (
        <>
          <Card>
            <Text style={styles.foutKop}>{t('Dit bestand kan niet gebruikt worden')}</Text>
            <Text style={styles.fout}>{t(plan.fouten[0].reden, plan.fouten[0].vars)}</Text>
            {/* Ook bij een afgekeurd bestand blijft dit meekomen: dat gaat over kolommen, niet
                over de reden waarom het bestand zelf niet bruikbaar is. */}
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
          </Card>
          <Card>
            <Button label={t('Ander bestand')} variant="secondary" onPress={opnieuw} />
          </Card>
        </>
      ) : (
        <>
          <Card>
            <Text style={styles.kop}>
              {uitkomst ? t('Resultaat') : t('Dit gaat er gebeuren')}
            </Text>
            <Text style={styles.telling}>
              {uitkomst ? (
                uitkomst.mislukt > 0
                  ? t('{toegevoegd} toegevoegd, {bijgewerkt} bijgewerkt, {mislukt} mislukt. Kijk de fouten hieronder na — wie er al staat, komt er niet dubbel bij als je het opnieuw probeert.', {
                    toegevoegd: uitkomst.toegevoegd, bijgewerkt: uitkomst.bijgewerkt, mislukt: uitkomst.mislukt,
                  })
                  : t('{toegevoegd} toegevoegd en {bijgewerkt} bijgewerkt.', {
                    toegevoegd: uitkomst.toegevoegd, bijgewerkt: uitkomst.bijgewerkt,
                  })
              ) : (
                <>
                  {t('{nieuw} nieuw, {bijgewerkt} bijgewerkt', {
                    nieuw: plan.nieuw.length,
                    bijgewerkt: plan.bijgewerkt.length,
                  })}
                  {', '}
                  {plan.fouten.length === 1 ? t('1 fout') : t('{n} fouten', { n: plan.fouten.length })}
                  {plan.waarschuwingen.length > 0
                    ? ` — ${t('{aantal} om na te kijken', { aantal: plan.waarschuwingen.length })}`
                    : ''}
                </>
              )}
            </Text>

            {/* Een kolom die we niet thuisbrengen valt stil weg; dat hoort de trainer te zien
                vóór hij importeert, niet weken later als de tarieven blijken te ontbreken.
                Dit is een mededeling en geen waarschuwing: een gewone ledenlijst met een
                kolom "lidnummer" levert deze lijst altijd, en dat is normaal — vandaar geen
                kop en dezelfde gedempte kleur als de rest van deze kaart, in plaats van de
                kleur van een fout of een waarschuwing. Ze blijven ook staan ná het
                importeren: dat gaat over kolommen, niet over wat er net gebeurd is. */}
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

            {/* Ná het importeren zijn deze twee lijsten al verwerkt; ze nog een keer tonen
                zou suggereren dat er nog iets te doen staat. */}
            {!uitkomst && plan.nieuw.map((lid) => (
              <Text key={`n-${lid.email}`} style={styles.regel}>
                {t('Nieuw lid: {naam} — {email}', { naam: lid.name, email: lid.email })}
              </Text>
            ))}
            {!uitkomst && plan.bijgewerkt.map((b) => (
              <Text key={`b-${b.bestaand.id}`} style={styles.regel}>
                {t('Bijgewerkt: {naam} — {velden}', {
                  naam: b.bestaand.name,
                  velden: Object.keys(b.wijzigingen)
                    .map((veld) => t(VELD_NAMEN[veld as keyof typeof VELD_NAMEN] ?? veld))
                    .join(', '),
                })}
              </Text>
            ))}
          </Card>

          {plan.waarschuwingen.length > 0 ? (
            <Card>
              {/* Deze regels gingen wél door. Ze staan apart van de fouten omdat ze om een
                  oordeel van de trainer vragen — is dit dezelfde Jonas of een tweede? — en
                  blijven ook ná het importeren staan: dat oordeel verandert niet met het
                  wegschrijven. */}
              <Text style={styles.waarschuwKop}>{t('Kijk deze regels even na')}</Text>
              {plan.waarschuwingen.map((w) => (
                <Text key={`w-${w.regel}-${w.reden}`} style={styles.waarschuwing}>
                  {t('Regel {regel}', { regel: w.regel })}: {t(w.reden, w.vars)}
                </Text>
              ))}
            </Card>
          ) : null}

          {plan.fouten.length > 0 ? (
            <Card>
              {/* Deze kaart blijft ook staan ná het importeren: dit zijn precies de regels
                  die de trainer met de hand moet natrekken, en dat blijft zo ongeacht of de
                  rest van het bestand lukte. */}
              <Text style={styles.foutKop}>{t('Deze regels worden overgeslagen')}</Text>
              {plan.fouten.map((f) => (
                <Text key={`f-${f.regel}`} style={styles.fout}>
                  {t('Regel {regel}', { regel: f.regel })}: {t(f.reden, f.vars)}
                </Text>
              ))}
            </Card>
          ) : null}

          <Card>
            {uitkomst ? (
              <Button label={t('Nieuwe import')} onPress={opnieuw} />
            ) : (
              <>
                <Button
                  label={t('Importeren')}
                  disabled={plan.nieuw.length === 0 && plan.bijgewerkt.length === 0}
                  onPress={() => { void voerUit(); }}
                />
                <Button
                  label={t('Ander bestand')}
                  variant="secondary"
                  onPress={opnieuw}
                  style={styles.knop}
                />
              </>
            )}
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
});
