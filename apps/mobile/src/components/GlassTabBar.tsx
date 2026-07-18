import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { House, MessageCircle, Settings2 } from 'lucide-react-native';
import { LiquidGlass } from './LiquidGlass';
import { color, hairline } from '../ds';

/**
 * The tab shell's bar, iOS 26 Phone-app style: on native iOS a floating
 * Liquid Glass capsule hovers above the bottom edge, and the active item
 * sits in its own contrasting inner pill. On web and Android the same
 * three items render as a plain flow-layout bar under the screen content,
 * so Playwright clicks are never intercepted by an overlay.
 *
 * No reanimated entering animation here or on any ancestor of the glass:
 * the layout-animation snapshot keeps the material from compositing
 * (see LiquidGlass.tsx). The active pill placement just switches.
 */

const ITEMS: Record<string, { Icon: typeof House; label: string; testID: string }> = {
  chat: { Icon: MessageCircle, label: 'Companion', testID: 'tab-chat' },
  index: { Icon: House, label: 'Home', testID: 'tab-home' },
  settings: { Icon: Settings2, label: 'Settings', testID: 'tab-settings' },
};

function TabItem({
  name,
  focused,
  floating,
  onPress,
}: {
  name: string;
  focused: boolean;
  /** Fixed-width capsule item on iOS; flexible flow item elsewhere. */
  floating: boolean;
  onPress: () => void;
}) {
  const item = ITEMS[name];
  if (!item) return null;
  const ink = focused ? color.ink : color.ink3;
  return (
    <Pressable
      onPress={onPress}
      testID={item.testID}
      accessibilityRole="tab"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: focused }}
      style={floating ? { width: 92 } : { flex: 1, maxWidth: 140 }}
    >
      <View
        style={{
          borderRadius: 999,
          paddingVertical: 7,
          alignItems: 'center',
          backgroundColor: focused ? 'rgba(17,17,17,0.08)' : 'transparent',
        }}
      >
        <item.Icon size={20} color={ink} strokeWidth={focused ? 2 : 1.8} />
        <Text
          style={{
            marginTop: 2,
            fontSize: 10.5,
            fontWeight: focused ? '600' : '500',
            color: ink,
          }}
        >
          {item.label}
        </Text>
      </View>
    </Pressable>
  );
}

export function GlassTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  const focusedKey = state.routes[state.index]?.key;
  const items = state.routes
    .filter((route) => ITEMS[route.name])
    .map((route) => {
      const focused = route.key === focusedKey;
      return (
        <TabItem
          key={route.key}
          name={route.name}
          focused={focused}
          floating={Platform.OS === 'ios'}
          onPress={() => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (focused || event.defaultPrevented) return;
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            }
            navigation.navigate(route.name);
          }}
        />
      );
    });

  if (Platform.OS === 'ios') {
    // The floating capsule. LiquidGlass falls back to a quiet translucent
    // surface on devices without the material; layout is identical.
    return (
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: insets.bottom + 12,
          alignItems: 'center',
        }}
      >
        <LiquidGlass
          effect="regular"
          style={{
            borderRadius: 999,
            paddingHorizontal: 10,
            paddingVertical: 8,
            flexDirection: 'row',
          }}
        >
          {items}
        </LiquidGlass>
      </View>
    );
  }

  // Web and Android: a plain bar in normal document flow, hairline on top.
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'center',
        paddingVertical: 6,
        paddingBottom: insets.bottom + 6,
        borderTopWidth: hairline,
        borderTopColor: color.line,
        backgroundColor: color.paper,
      }}
    >
      {items}
    </View>
  );
}
