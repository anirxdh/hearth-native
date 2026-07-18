/**
 * Minimal reanimated stub for jest, covering exactly Hearth's motion
 * surface: Animated.View/Text, chainable entering builders, ReduceMotion,
 * and the shared-value hooks. Animations are inert under test; behavior
 * and accessibility are what the suites assert.
 */
const React = require('react');
const { View, Text, ScrollView } = require('react-native');

const chain = () => {
  const b = {};
  for (const m of ['duration', 'delay', 'springify', 'damping', 'stiffness', 'reduceMotion']) {
    b[m] = () => b;
  }
  return b;
};
const builder = { duration: () => chain(), delay: () => chain(), springify: () => chain() };

module.exports = {
  __esModule: true,
  default: {
    View: React.forwardRef((p, ref) => React.createElement(View, { ...p, ref })),
    Text: React.forwardRef((p, ref) => React.createElement(Text, { ...p, ref })),
    ScrollView: React.forwardRef((p, ref) => React.createElement(ScrollView, { ...p, ref })),
    createAnimatedComponent: (C) => C,
  },
  FadeIn: builder,
  FadeInDown: builder,
  ZoomIn: builder,
  LinearTransition: builder,
  ReduceMotion: { System: 'system', Always: 'always', Never: 'never' },
  useSharedValue: (v) => ({ value: v }),
  useAnimatedStyle: () => ({}),
  withSpring: (v) => v,
  withTiming: (v) => v,
  withRepeat: (v) => v,
  cancelAnimation: () => {},
};
