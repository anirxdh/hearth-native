/**
 * Ambient Crypto type so @rua/core's uuid module compiles from this
 * package. core/src/uuid.ts refers to the global Crypto interface; with
 * lib ES2022 (no DOM) and @types/node 20 there is no ambient Crypto, so the
 * minimal surface core uses is declared here. Runtime behavior is unchanged;
 * Node and Hermes both provide a real globalThis.crypto.
 */

interface Crypto {
  getRandomValues<T extends ArrayBufferView>(array: T): T;
}
