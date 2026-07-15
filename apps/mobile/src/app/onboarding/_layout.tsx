import React from 'react';
import { Stack } from 'expo-router';
import { color } from '../../ds';

/** The first-time-user wizard: a plain stack, each step is one screen. */
export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: color.paper },
      }}
    />
  );
}
