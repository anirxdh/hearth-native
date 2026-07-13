/**
 * UUIDv7: time-ordered ids (RFC 9562). Time-ordering keeps SQLite b-trees
 * append-friendly and gives the P30 sync engine a stable causal-ish order.
 *
 * The random source is injectable so tests are deterministic and the app can
 * pass expo-crypto's getRandomValues explicitly if globalThis.crypto is absent.
 */

export type RandomFill = (bytes: Uint8Array) => Uint8Array;

const defaultRandom: RandomFill = (bytes) => {
  const c = (globalThis as { crypto?: { getRandomValues?: (b: Uint8Array) => Uint8Array } }).crypto;
  if (!c?.getRandomValues) throw new Error('No crypto.getRandomValues available');
  c.getRandomValues(bytes);
  return bytes;
};

const HEX: string[] = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));

export function uuidv7(nowMs?: number, randomFill: RandomFill = defaultRandom): string {
  const ts = nowMs ?? Date.now();
  if (!Number.isInteger(ts) || ts < 0 || ts > 2 ** 48 - 1) {
    throw new Error(`Timestamp out of range for UUIDv7: ${ts}`);
  }
  const b = new Uint8Array(16);
  // 48-bit big-endian ms timestamp
  b[0] = (ts / 2 ** 40) & 0xff;
  b[1] = (ts / 2 ** 32) & 0xff;
  b[2] = (ts / 2 ** 24) & 0xff;
  b[3] = (ts / 2 ** 16) & 0xff;
  b[4] = (ts / 2 ** 8) & 0xff;
  b[5] = ts & 0xff;
  const rnd = randomFill(new Uint8Array(10));
  b.set(rnd, 6);
  b[6] = (b[6]! & 0x0f) | 0x70; // version 7
  b[8] = (b[8]! & 0x3f) | 0x80; // variant 10
  let s = '';
  for (let i = 0; i < 16; i++) {
    if (i === 4 || i === 6 || i === 8 || i === 10) s += '-';
    s += HEX[b[i]!];
  }
  return s;
}

export function uuidv7TimestampMs(id: string): number {
  const hex = id.replace(/-/g, '').slice(0, 12);
  return parseInt(hex, 16);
}
