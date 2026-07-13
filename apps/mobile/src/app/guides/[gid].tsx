import React, { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, PhoneCall, Printer } from 'lucide-react-native';
import { Linking } from 'react-native';
import { PillButton, Screen, color, radius, space, type } from '../../ds';
import { GUIDES } from '../../content/guides';
import { outputGuide } from '../../lib/print';

/** One guide, read full-screen: numbered pictogram steps, calm and large. */
export default function GuideReader() {
  const { gid } = useLocalSearchParams<{ gid: string }>();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const guide = GUIDES.find((g) => g.id === gid);

  if (!guide) {
    return (
      <Screen title="Guide not found">
        <PillButton label="Back" variant="outline" onPress={() => router.back()} />
      </Screen>
    );
  }

  async function print() {
    if (!guide) return;
    setBusy(true);
    try {
      await outputGuide(guide, 'print');
    } catch (e) {
      Alert.alert('Could not print', String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back to guides"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 44 }}
        >
          <ChevronLeft size={18} color={color.ink2} strokeWidth={1.8} />
          <Text style={type.mini}>All guides</Text>
        </Pressable>
        {guide.callFirst ? (
          <Pressable
            onPress={() => Linking.openURL('tel:911')}
            accessibilityRole="button"
            accessibilityLabel="Call 911"
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: color.red,
                borderRadius: 999,
                paddingHorizontal: 16,
                paddingVertical: 9,
                minHeight: 38,
              },
              pressed && { opacity: 0.8 },
            ]}
          >
            <PhoneCall size={14} color={color.paper} strokeWidth={2.2} />
            <Text style={{ color: color.paper, fontWeight: '700', fontSize: 13.5 }}>Call 911</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={[type.title, { marginTop: space.lg }]}>{guide.title}</Text>
      <Text style={[type.detail, { marginTop: 4 }]}>{guide.oneLiner}</Text>

      {guide.warning ? (
        <View
          style={{
            marginTop: space.lg,
            borderWidth: 1,
            borderColor: color.red,
            borderRadius: radius.md,
            paddingHorizontal: 14,
            paddingVertical: 10,
          }}
        >
          <Text style={[type.mini, { color: color.red, fontWeight: '600' }]}>{guide.warning}</Text>
        </View>
      ) : null}

      <View style={{ marginTop: space.lg, gap: 14 }}>
        {guide.steps.map((s) => {
          const Art = s.Art;
          return (
            <View
              key={s.n}
              accessible
              accessibilityLabel={`Step ${s.n}: ${s.title}. ${s.body}`}
              style={{
                borderWidth: 1,
                borderColor: color.line,
                borderRadius: radius.lg,
                padding: 16,
                flexDirection: 'row',
                gap: 16,
                alignItems: 'center',
              }}
            >
              <View style={{ alignItems: 'center', gap: 8 }}>
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    backgroundColor: color.ink,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: color.paper, fontWeight: '700', fontSize: 13 }}>{s.n}</Text>
                </View>
                <Art size={64} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[type.heading]}>{s.title}</Text>
                <Text style={[type.body, { marginTop: 4, color: color.ink2 }]}>{s.body}</Text>
              </View>
            </View>
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: space.xl }}>
        <PillButton
          label="Print this guide"
          variant="outline"
          icon={<Printer size={14} color={color.ink} strokeWidth={2} />}
          onPress={() => void print()}
          loading={busy}
        />
      </View>

      <Text style={[type.mini, { marginTop: space.lg }]}>
        Version {guide.review.version} · {guide.review.reviewer} · reviewed {guide.review.reviewedOn}. General
        first aid information, not medical advice. When in doubt, call 911.
      </Text>
    </Screen>
  );
}
