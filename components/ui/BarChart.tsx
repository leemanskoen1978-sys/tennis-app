// Een staafgrafiek die alleen tekent. Hij weet niets van lessen, geld of maanden: hij krijgt
// staafjes met een waarde en een opschrift en zet die naast elkaar. Wat er in de staafjes zit
// en hoe een bedrag eruitziet, bepaalt de aanroeper — anders zou hier een tweede plek ontstaan
// waar euro's worden opgemaakt.
//
// De breedte wordt gemeten in plaats van geraden: op een telefoon is er minder plaats dan in
// de browser, en een vaste breedte zou de laatste maanden buiten beeld duwen.

import React, { useState } from 'react';
import { View, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';

import { tennisColors } from '../../constants/tennis-colors';

export interface Bar {
  /** Onder het staafje, bv. een maandnaam. */
  label: string;
  /** Bepaalt alleen de hoogte; de hoogste staaf vult de grafiek. */
  value: number;
  /** Boven het staafje, al opgemaakt door de aanroeper. Leeg laten mag. */
  caption?: string;
}

export function BarChart({
  bars,
  accessibilityLabel,
  height = 180,
}: {
  bars: Bar[];
  /** Wat een blinde gebruiker in plaats van de staafjes te horen krijgt. Verplicht. */
  accessibilityLabel: string;
  height?: number;
}): React.JSX.Element {
  const [width, setWidth] = useState<number>(0);

  function onLayout(e: LayoutChangeEvent): void {
    setWidth(e.nativeEvent.layout.width);
  }

  // Ruimte boven voor het opschrift en onder voor het label; wat overblijft is staafhoogte.
  const topRoom = 18;
  const bottomRoom = 20;
  const plot = Math.max(1, height - topRoom - bottomRoom);
  const max = bars.reduce((m, b) => Math.max(m, b.value), 0);
  const slot = bars.length > 0 && width > 0 ? width / bars.length : 0;
  // Een staafje neemt niet de hele sleuf: de witruimte ertussen maakt de maanden leesbaar.
  const barWidth = Math.max(4, Math.min(44, slot * 0.55));

  return (
    <View onLayout={onLayout} style={{ height }}>
      {width > 0 && bars.length > 0 ? (
        <Svg
          width={width}
          height={height}
          accessible
          accessibilityLabel={accessibilityLabel}
        >
          {bars.map((bar, i) => {
            const cx = slot * i + slot / 2;
            // Alles nul: dan is er geen verhouding en blijven de staafjes plat op de lijn.
            const h = max > 0 ? (bar.value / max) * plot : 0;
            const y = topRoom + plot - h;
            return (
              <React.Fragment key={`${bar.label}-${i}`}>
                {bar.caption ? (
                  <SvgText
                    x={cx}
                    y={Math.max(12, y - 5)}
                    fontSize={11}
                    fill={tennisColors.textMuted}
                    textAnchor="middle"
                  >
                    {bar.caption}
                  </SvgText>
                ) : null}
                <Rect
                  x={cx - barWidth / 2}
                  // Een staaf van nul blijft als streepje zichtbaar, zodat de maand niet lijkt
                  // te ontbreken.
                  y={h < 2 ? topRoom + plot - 2 : y}
                  width={barWidth}
                  height={h < 2 ? 2 : h}
                  rx={4}
                  fill={h < 2 ? tennisColors.border : tennisColors.primary}
                />
                <SvgText
                  x={cx}
                  y={height - 5}
                  fontSize={11}
                  fill={tennisColors.textMuted}
                  textAnchor="middle"
                >
                  {bar.label}
                </SvgText>
              </React.Fragment>
            );
          })}
          <Line
            x1={0}
            y1={topRoom + plot}
            x2={width}
            y2={topRoom + plot}
            stroke={tennisColors.border}
            strokeWidth={1}
          />
        </Svg>
      ) : (
        // Vóór de eerste meting is de breedte nog nul; een lege bak houdt de hoogte vast,
        // zodat het scherm niet zichtbaar opspringt zodra de grafiek verschijnt.
        <View style={styles.placeholder} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: { flex: 1 },
});
