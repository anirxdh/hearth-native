import { RandomFill, uuidv7, uuidv7TimestampMs } from '../uuid';

/**
 * Type-only shim, no runtime effect. src/uuid.ts passes a Uint8Array (typed
 * Uint8Array<ArrayBufferLike> since TS 5.7 generic typed arrays) to
 * Crypto.getRandomValues, whose @types/node 26 signature only accepts typed
 * arrays over a non-shared ArrayBuffer, so the frozen implementation fails to
 * compile under this package's toolchain. The proper fix belongs in uuid.ts
 * (type the buffer as Uint8Array<ArrayBuffer>); until then this merged
 * overload keeps the suite compiling. Delete once uuid.ts is fixed.
 */
declare global {
  interface Crypto {
    getRandomValues<T extends ArrayBufferView>(array: T): T;
  }
}

const fillWith =
  (byte: number): RandomFill =>
  (bytes) => {
    bytes.fill(byte);
    return bytes;
  };

const UUID_V7_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('uuidv7 format', () => {
  test('version nibble is 7 and variant bits are 10 across many random ids', () => {
    for (let i = 0; i < 100; i++) {
      const id = uuidv7();
      expect(id).toMatch(UUID_V7_RE);
    }
  });

  test('version and variant survive adversarial random bytes', () => {
    // 0xff would set every bit; the implementation must mask version/variant.
    expect(uuidv7(0, fillWith(0xff))).toMatch(UUID_V7_RE);
    expect(uuidv7(0, fillWith(0x00))).toMatch(UUID_V7_RE);
  });
});

describe('uuidv7 determinism with injected randomFill', () => {
  test('same timestamp and random source produce the identical id', () => {
    expect(uuidv7(1_721_000_000_000, fillWith(0x42))).toBe(uuidv7(1_721_000_000_000, fillWith(0x42)));
  });

  test('known byte-level fixture at timestamp 0', () => {
    expect(uuidv7(0, fillWith(0xab))).toBe('00000000-0000-7bab-abab-abababababab');
  });

  test('known byte-level fixture with zero randomness', () => {
    expect(uuidv7(0x0123456789ab, fillWith(0x00))).toBe('01234567-89ab-7000-8000-000000000000');
  });

  test('random source is asked for exactly 10 bytes', () => {
    const seen: number[] = [];
    const rf: RandomFill = (bytes) => {
      seen.push(bytes.length);
      bytes.fill(0);
      return bytes;
    };
    uuidv7(1000, rf);
    expect(seen).toEqual([10]);
  });
});

describe('uuidv7 time ordering', () => {
  test('ids from strictly increasing timestamps sort lexicographically ascending', () => {
    const base = 1_750_000_000_000;
    const ids: string[] = [];
    for (let i = 0; i < 200; i++) {
      ids.push(uuidv7(base + i * 137, fillWith(0x55)));
    }
    const sorted = [...ids].sort();
    expect(sorted).toEqual(ids);
    for (let i = 1; i < ids.length; i++) {
      expect(ids[i]! > ids[i - 1]!).toBe(true);
    }
  });

  test('millisecond-adjacent timestamps still order correctly at range extremes', () => {
    const nearMax = 2 ** 48 - 2;
    expect(uuidv7(nearMax + 1, fillWith(0)) > uuidv7(nearMax, fillWith(0))).toBe(true);
    expect(uuidv7(1, fillWith(0)) > uuidv7(0, fillWith(0))).toBe(true);
  });
});

describe('uuidv7TimestampMs round-trip', () => {
  test.each([0, 1, 255, 256, 1_721_000_000_000, 2 ** 48 - 1])(
    'timestamp %d survives encode/decode',
    (ts) => {
      expect(uuidv7TimestampMs(uuidv7(ts, fillWith(0x99)))).toBe(ts);
    },
  );

  test('default timestamp is the current clock', () => {
    const before = Date.now();
    const decoded = uuidv7TimestampMs(uuidv7());
    const after = Date.now();
    expect(decoded).toBeGreaterThanOrEqual(before);
    expect(decoded).toBeLessThanOrEqual(after);
  });

  test('max timestamp encodes as all-f time bits', () => {
    expect(uuidv7(2 ** 48 - 1, fillWith(0)).startsWith('ffffffff-ffff')).toBe(true);
  });
});

describe('uuidv7 timestamp validation', () => {
  test('rejects negative timestamps', () => {
    expect(() => uuidv7(-1, fillWith(0))).toThrow(/out of range/i);
  });

  test('rejects timestamps beyond 48 bits', () => {
    expect(() => uuidv7(2 ** 48, fillWith(0))).toThrow(/out of range/i);
  });

  test('rejects non-integer timestamps', () => {
    expect(() => uuidv7(1.5, fillWith(0))).toThrow(/out of range/i);
    expect(() => uuidv7(NaN, fillWith(0))).toThrow(/out of range/i);
  });

  test('accepts both range endpoints', () => {
    expect(() => uuidv7(0, fillWith(0))).not.toThrow();
    expect(() => uuidv7(2 ** 48 - 1, fillWith(0))).not.toThrow();
  });
});
