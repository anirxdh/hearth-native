import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter } from 'expo-router';
import { Card, FormField, PillButton, Screen, color, space, type } from '../../ds';
import { enterLead, enterRow } from '../../ds/motion';
import { authProvider, currentUser } from '../../lib/auth';
import { confirmDialog, infoDialog } from '../../lib/dialogs';
import { confirmLoadDemoFamily } from '../../lib/demo';
import { ensureNotificationPermission } from '../../lib/notifications';
import { setSetting } from '../../db/repo';
import { BottleArt, ChartArt, FlowArt } from '../../components/EmptyArt';
import { LiquidGlass, liquidGlassAvailable } from '../../components/LiquidGlass';
import { PortraitPresence } from '../../components/PortraitPresence';
import { OnboardingSteps } from './ui';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Step 1: the landing. A quietly auto-advancing carousel says what Hearth
 * is in three swipes, the account card opens the door, and the demo path
 * lives here for the just-looking visitor. Face ID and notifications are
 * asked for right after the account exists, as native iOS sheets, never
 * as form screens.
 *
 * The account is device-local today; authProvider is shaped exactly like
 * the Clerk integration that replaces it (see TODO.md), so this screen
 * survives that swap untouched.
 */

const SLIDES = [
  {
    key: 'presence',
    Art: PortraitPresence,
    title: 'Built around a person',
    line: 'Not charts first. Someone you love, held gently in one place.',
  },
  {
    key: 'meds',
    Art: BottleArt,
    title: 'One glance, every medication',
    line: 'Refill runways computed from the label. Nothing logged by hand.',
  },
  {
    key: 'papers',
    Art: FlowArt,
    title: 'Paperwork, automated',
    line: 'Denial appeals, renewals, and releases assembled from your records.',
  },
  {
    key: 'rhythm',
    Art: ChartArt,
    title: 'The daily rhythm',
    line: 'Steps, sleep, and heart rate as calm trends, never alarms.',
  },
] as const;

const SLIDE_HOLD_MS = 2600;

/** One paging dot; the active dot stretches wide on a quiet spring. */
function PagerDot({ active }: { active: boolean }) {
  const width = useSharedValue(active ? 18 : 6);
  useEffect(() => {
    width.value = withSpring(active ? 18 : 6, {
      damping: 24,
      stiffness: 220,
      reduceMotion: ReduceMotion.System,
    });
  }, [active, width]);
  const stretch = useAnimatedStyle(() => ({ width: width.value }));
  return (
    <Animated.View
      style={[
        {
          height: 6,
          borderRadius: 3,
          backgroundColor: active ? color.ink : color.line,
        },
        stretch,
      ]}
    />
  );
}

function HeroCarousel() {
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);
  const listRef = useRef<FlatList>(null);
  const pageRef = useRef(0);
  const touched = useRef(false);

  // Auto-advance until the caregiver touches it; their hand takes over.
  useEffect(() => {
    if (width === 0) return;
    const id = setInterval(() => {
      if (touched.current) return;
      const next = (pageRef.current + 1) % SLIDES.length;
      listRef.current?.scrollToOffset({ offset: next * width, animated: true });
    }, SLIDE_HOLD_MS);
    return () => clearInterval(id);
  }, [width]);

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (width === 0) return;
    const p = Math.round(e.nativeEvent.contentOffset.x / width);
    if (p !== pageRef.current) {
      pageRef.current = p;
      setPage(p);
    }
  }

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ marginTop: space.md }}>
      {width > 0 ? (
        <FlatList
          ref={listRef}
          data={SLIDES}
          keyExtractor={(s) => s.key}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={32}
          onTouchStart={() => {
            touched.current = true;
          }}
          renderItem={({ item }) => (
            <View style={{ width, alignItems: 'center', paddingVertical: space.lg }}>
              <item.Art size={96} />
              <Text style={[type.heading, { marginTop: space.lg, textAlign: 'center' }]}>
                {item.title}
              </Text>
              <Text
                style={[
                  type.detail,
                  { marginTop: 6, textAlign: 'center', maxWidth: 300 },
                ]}
              >
                {item.line}
              </Text>
            </View>
          )}
        />
      ) : null}
      {liquidGlassAvailable() ? (
        // The pager floats as a glass pill; the shimmer answers the finger.
        <LiquidGlass
          effect="regular"
          interactive
          style={{
            alignSelf: 'center',
            marginTop: space.sm,
            borderRadius: 999,
            paddingHorizontal: 12,
            paddingVertical: 7,
          }}
        >
          <View
            style={{ flexDirection: 'row', justifyContent: 'center', gap: 7 }}
            accessibilityLabel={`Slide ${page + 1} of ${SLIDES.length}`}
          >
            {SLIDES.map((s, i) => (
              <PagerDot key={s.key} active={i === page} />
            ))}
          </View>
        </LiquidGlass>
      ) : (
        <View
          style={{ flexDirection: 'row', justifyContent: 'center', gap: 7, marginTop: space.sm }}
          accessibilityLabel={`Slide ${page + 1} of ${SLIDES.length}`}
        >
          {SLIDES.map((s, i) => (
            <PagerDot key={s.key} active={i === page} />
          ))}
        </View>
      )}
    </View>
  );
}

/** Face ID and notifications as native sheets, right after the account exists. */
async function offerNativeProtections(): Promise<void> {
  if (Platform.OS === 'web') return; // test surface: no native sheets

  const canBio =
    (await LocalAuthentication.hasHardwareAsync().catch(() => false)) &&
    (await LocalAuthentication.isEnrolledAsync().catch(() => false));
  if (canBio) {
    await new Promise<void>((resolve) => {
      confirmDialog({
        title: 'Protect with Face ID?',
        message: 'Hearth will ask for Face ID to open, and to sign you back in quietly.',
        confirmText: 'Protect',
        cancelText: 'Not now',
        onConfirm: () => {
          LocalAuthentication.authenticateAsync({ promptMessage: 'Enable Face ID for Hearth' })
            .then((r) => {
              if (r.success) setSetting('appLock', true);
            })
            .catch(() => {})
            .finally(resolve);
        },
        onCancel: resolve,
      });
    });
  }

  // The real iOS notification sheet; declining is honored (canAskAgain gate).
  await ensureNotificationPermission().catch(() => {});
}

export default function OnboardingWelcome() {
  const router = useRouter();
  const existing = currentUser();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  function next() {
    router.push('/onboarding/person' as never);
  }

  async function create() {
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = 'Your name is required.';
    if (!EMAIL_RE.test(email.trim())) errs.email = 'Enter a valid email address.';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setBusy(true);
    try {
      await authProvider.signUp({ name: name.trim(), email: email.trim() });
      await offerNativeProtections();
      next();
    } catch (e) {
      infoDialog('Could not create the account', String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="Welcome to Hearth">
      <OnboardingSteps step={1} />

      {existing ? (
        <Animated.View entering={enterLead}>
          <Card style={{ marginTop: space.xl }}>
            <Text style={type.heading}>Welcome back, {existing.name}</Text>
            <Text style={[type.detail, { marginTop: 6 }]}>
              Your account is already on this device. Pick up the setup where you left off.
            </Text>
            <View style={{ marginTop: space.lg }} testID="ob-continue-account">
              <PillButton label="Continue" onPress={next} />
            </View>
          </Card>
        </Animated.View>
      ) : (
        <>
          <Animated.View entering={enterLead}>
            <HeroCarousel />
          </Animated.View>

          <Animated.View entering={enterRow(1)}>
            <Card style={{ marginTop: space.lg }}>
              <Text style={type.heading}>Your account</Text>
              <Text style={[type.detail, { marginTop: 6 }]}>
                Created on this phone, not on a server. Everything you enter stays here, encrypted.
              </Text>
              <FormField
                label="Full name"
                value={name}
                onChangeText={setName}
                placeholder="Maria Alvarez"
                testID="ob-name"
                {...(errors.name ? { error: errors.name } : {})}
              />
              <FormField
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="maria@example.com"
                autoCapitalize="none"
                keyboardType="email-address"
                testID="ob-email"
                {...(errors.email ? { error: errors.email } : {})}
              />
              <View style={{ marginTop: space.xl }} testID="ob-create">
                <PillButton label="Create account" onPress={() => void create()} loading={busy} />
              </View>
            </Card>
          </Animated.View>

          <Animated.View
            entering={enterRow(2)}
            style={{ alignItems: 'center', marginTop: space.lg }}
          >
            <Pressable
              onPress={() => confirmLoadDemoFamily(() => router.replace('/'))}
              accessibilityRole="button"
              testID="ob-demo"
              hitSlop={8}
            >
              <Text style={[type.mini, { textDecorationLine: 'underline', color: color.ink3 }]}>
                Just exploring? See a demo family
              </Text>
            </Pressable>
          </Animated.View>
        </>
      )}
    </Screen>
  );
}
