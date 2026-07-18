import React from 'react';
import { Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { LiquidGlass, liquidGlassAvailable } from '../../components/LiquidGlass';
import { color, space, type } from '../../ds';

const TOTAL_STEPS = 4;

/**
 * The quiet progress indicator shared by every wizard step: a mini
 * "Step n of 4" line with a row of thin ink ticks. Deliberately small;
 * the step content carries the screen. On glass devices the row sits
 * in a quiet floating capsule; elsewhere it stays plain paper.
 */
export function OnboardingSteps({ step }: { step: 1 | 2 | 3 | 4 }) {
  const onGlass = liquidGlassAvailable();
  const row = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        marginBottom: onGlass ? 0 : space.lg,
      }}
      accessible
      accessibilityLabel={`Step ${step} of ${TOTAL_STEPS}`}
    >
      <Text style={type.mini}>{`Step ${step} of ${TOTAL_STEPS}`}</Text>
      <View style={{ flexDirection: 'row', gap: 5 }}>
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <View
            key={i}
            style={{
              width: 14,
              height: 3,
              borderRadius: 2,
              backgroundColor: i < step ? color.ink : color.line,
            }}
          />
        ))}
      </View>
    </View>
  );
  if (!onGlass) return row;
  return (
    <LiquidGlass
      effect="regular"
      style={{
        alignSelf: 'flex-start',
        marginBottom: space.lg,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 7,
      }}
    >
      {row}
    </LiquidGlass>
  );
}

/**
 * This file lives inside the route directory so the wizard steps can share
 * it, which makes expo-router treat it as a route; the default export sends
 * any accidental visit back to the start of the wizard.
 */
export default function OnboardingUiRoute() {
  return <Redirect href={'/onboarding' as never} />;
}
