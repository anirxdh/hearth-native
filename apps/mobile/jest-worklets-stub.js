/**
 * react-native-worklets stub for jest: the native TurboModule does not exist
 * under test, and reanimated's official mock still transitively imports the
 * package. Everything runs synchronously on the JS thread here, which is
 * exactly what component tests want.
 */
const passthrough = (fn) => fn;
module.exports = {
  RuntimeKind: { UI: 1, RN: 0 },
  WorkletsModule: { installUnpackers: () => {} },
  createSerializable: (v) => v,
  makeShareable: (v) => v,
  isWorkletFunction: () => false,
  runOnUISync: passthrough,
  scheduleOnRN: (fn, ...args) => fn(...args),
  scheduleOnUI: passthrough,
  runOnJS: passthrough,
  runOnUI: passthrough,
};
