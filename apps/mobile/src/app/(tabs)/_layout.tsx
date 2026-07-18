import React from 'react';
import { Platform } from 'react-native';
import { Tabs } from 'expo-router/js-tabs';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { GlassTabBar } from '../../components/GlassTabBar';
import { color } from '../../ds';

/**
 * The tab shell: Companion, Home, Settings, left to right, with Home as
 * the landing tab (expo-router anchors on the index route). Route paths
 * are unchanged by the group segment: '/', '/settings', '/chat'.
 *
 * On iOS this is the SYSTEM tab bar (UITabBarController via native tabs):
 * the real iOS 26 Liquid Glass capsule with its smooth morphing, scroll
 * edge behavior, and SF Symbol icons - the gear is the same gear the
 * iPhone Settings app wears. Web (the Playwright test surface) and
 * Android keep the plain flow-layout GlassTabBar so nothing overlays
 * content and clicks stay deterministic.
 */
export default function TabsLayout() {
  if (Platform.OS === 'ios') {
    return (
      <NativeTabs tintColor={color.ink}>
        <NativeTabs.Trigger name="chat">
          <NativeTabs.Trigger.Icon sf={{ default: 'bubble.left', selected: 'bubble.left.fill' }} />
          <NativeTabs.Trigger.Label>Companion</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} />
          <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="settings">
          <NativeTabs.Trigger.Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} />
          <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }
  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <GlassTabBar {...props} />}
    >
      <Tabs.Screen name="chat" options={{ title: 'Companion' }} />
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
