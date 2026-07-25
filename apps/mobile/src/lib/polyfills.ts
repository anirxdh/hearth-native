/**
 * Runtime polyfills, imported FIRST from the root layout.
 *
 * Hermes ships no global crypto; @rua/core's uuidv7 needs
 * crypto.getRandomValues, so we back it with expo-crypto's native RNG.
 */
import { getRandomValues } from 'expo-crypto';

const g = globalThis as { crypto?: { getRandomValues?: unknown } };
if (!g.crypto) g.crypto = {};
if (!g.crypto.getRandomValues) {
  g.crypto.getRandomValues = getRandomValues;
}
