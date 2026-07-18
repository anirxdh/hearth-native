import React from 'react';
import { Tabs } from 'expo-router/js-tabs';
import { GlassTabBar } from '../../components/GlassTabBar';

/**
 * The tab shell: Companion, Home, Settings, left to right, with Home as
 * the landing tab. The bar itself is GlassTabBar (a floating Liquid Glass
 * capsule on iOS, a plain flow bar on web and Android). Route paths are
 * unchanged by the group segment: '/', '/settings', '/chat'.
 */
export default function TabsLayout() {
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
