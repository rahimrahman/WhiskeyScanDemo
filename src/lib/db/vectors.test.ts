import { decodeVector, encodeVector, normalizeVector } from './vectors';

const length = (vector: ArrayLike<number>) => Math.hypot(...Array.from(vector));

describe('normalizeVector', () => {
  it('scales a vector to unit length and keeps its direction', () => {
    expect(normalizeVector([3, 4])).toEqual([0.6, 0.8]);
    expect(length(normalizeVector([1, 2, 3, 4, 5]))).toBeCloseTo(1, 12);
  });

  it.each([
    ['empty', []],
    ['zero', [0, 0, 0]],
    ['NaN', [1, Number.NaN]],
    ['infinite', [1, Number.POSITIVE_INFINITY]],
  ])('rejects a %s vector', (_, vector) => {
    expect(() => normalizeVector(vector)).toThrow('embedding has zero length');
  });
});

describe('encodeVector / decodeVector', () => {
  it('writes the unit vector as little-endian float32, 4 bytes per value', () => {
    const bytes = encodeVector([0, 2]);

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(Array.from(bytes)).toEqual([0, 0, 0, 0, 0x00, 0x00, 0x80, 0x3f]);
  });

  it('round-trips to a unit-length Float32Array', () => {
    const vector = Array.from({ length: 768 }, (_, index) => Math.sin(index) * 3);

    const decoded = decodeVector(encodeVector(vector));

    expect(decoded).toBeInstanceOf(Float32Array);
    expect(decoded).toHaveLength(768);
    expect(length(decoded)).toBeCloseTo(1, 5);
    const expected = normalizeVector(vector);
    decoded.forEach((value, index) => expect(value).toBeCloseTo(expected[index], 6));
  });

  it('refuses to encode a zero vector', () => {
    expect(() => encodeVector([0, 0])).toThrow('embedding has zero length');
  });

  it('decodes a BLOB that starts at an unaligned offset of a larger buffer', () => {
    const blob = encodeVector([1, 0, 0]);
    const padded = new Uint8Array(blob.length + 1);
    padded.set(blob, 1);

    expect(Array.from(decodeVector(padded.subarray(1)))).toEqual([1, 0, 0]);
  });

  it('rejects a BLOB that is not a whole number of float32 values', () => {
    expect(() => decodeVector(new Uint8Array(6))).toThrow('6 bytes');
  });
});
