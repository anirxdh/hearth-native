import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, PhoneCall } from 'lucide-react-native';
import { Screen, SectionHeader, color, radius, space, type } from '../../ds';
import { GUIDES } from '../../content/guides';

/**
 * Emergency guides (P16): a bundled, offline book of cards. Static content,
 * versioned and stamped for clinician review; nothing here is generated.
 */
export default function GuidesIndex() {
  const router = useRouter();

  return (
    <Screen>
      <Pressable
        onPress={() => router.back()}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Back to home"
        style={{ marginBottom: space.md, flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 32 }}
      >
        <ChevronLeft size={18} color={color.ink2} strokeWidth={1.8} />
        <Text style={type.mini}>Home</Text>
      </Pressable>

      <Text style={type.title}>Open this when something happens</Text>
      <Text style={[type.detail, { marginTop: 4 }]}>
        Six situations, four calm steps each. Works with no signal, prints to paper, and never changes unless a
        clinician reviews the change.
      </Text>

      <View
        style={{
          marginTop: space.lg,
          borderWidth: 1,
          borderColor: color.red,
          borderRadius: radius.md,
          paddingHorizontal: 14,
          paddingVertical: 11,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <PhoneCall size={15} color={color.red} strokeWidth={2} />
        <Text style={[type.mini, { flex: 1, color: color.red, fontWeight: '600' }]}>
          If someone is unconscious, not breathing normally, or fading fast: call 911 first. These cards are for
          the minutes around that call, not instead of it.
        </Text>
      </View>

      <SectionHeader label="The guides" meta={`${GUIDES.length}`} />
      {GUIDES.map((g, i) => {
        const FirstArt = g.steps[0]!.Art;
        return (
          <Pressable
            key={g.id}
            onPress={() => router.push(`/guides/${g.id}` as never)}
            accessibilityRole="button"
            accessibilityLabel={`Open guide: ${g.title}`}
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                paddingVertical: 14,
                borderBottomWidth: i === GUIDES.length - 1 ? 0 : 1,
                borderBottomColor: color.line,
              },
              pressed && { opacity: 0.7 },
            ]}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: color.line,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FirstArt size={44} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[type.body, { fontWeight: '600' }]}>{g.title}</Text>
              <Text style={[type.mini, { marginTop: 2 }]} numberOfLines={2}>
                {g.oneLiner}
              </Text>
            </View>
            {g.callFirst ? (
              <Text style={[type.mini, { color: color.red, fontWeight: '700' }]}>911 first</Text>
            ) : null}
            <ChevronRight size={17} color={color.ink3} strokeWidth={1.8} />
          </Pressable>
        );
      })}

      <Text style={[type.mini, { marginTop: space.xl }]}>
        Content version {GUIDES[0]!.review.version} · {GUIDES[0]!.review.reviewer} · these cards are general first
        aid information, not medical advice, and do not replace emergency services or training.
      </Text>
    </Screen>
  );
}
