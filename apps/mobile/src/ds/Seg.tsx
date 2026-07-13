import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { color, radius, type } from './tokens';

/**
 * Editorial segmented control: a hairline capsule row, ink fill on the active
 * segment. Scrolls horizontally when segments overflow (five-tab Patient 360).
 */
export function Seg<T extends string>({
  options,
  value,
  onChange,
  scroll = false,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  scroll?: boolean;
}) {
  const row = (
    <View
      style={{
        flexDirection: 'row',
        borderWidth: 1,
        borderColor: color.line,
        borderRadius: radius.pill,
        padding: 3,
        alignSelf: 'flex-start',
      }}
      accessibilityRole="tablist"
    >
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
            hitSlop={6}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: radius.pill,
              backgroundColor: on ? color.ink : 'transparent',
            }}
          >
            <Text
              style={[
                type.mini,
                { fontWeight: '600', color: on ? color.paper : color.ink2 },
              ]}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
  if (!scroll) return row;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 8 }}>
      {row}
    </ScrollView>
  );
}
