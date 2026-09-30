const BYTES_PER_VALUE = 4;

/** Scales `vector` to unit length; an empty, zero or non-finite vector throws because it must not be stored. */
export function normalizeVector(vector: readonly number[]): number[] {
  const norm = Math.hypot(...vector);
  if (!(norm > 0) || !Number.isFinite(norm)) throw new Error('embedding has zero length');
  return vector.map((value) => value / norm);
}

/** The stored BLOB: the L2-normalized vector as little-endian float32. */
export function encodeVector(vector: readonly number[]): Uint8Array {
  const unit = normalizeVector(vector);
  const bytes = new Uint8Array(unit.length * BYTES_PER_VALUE);
  const view = new DataView(bytes.buffer);
  unit.forEach((value, index) => view.setFloat32(index * BYTES_PER_VALUE, value, true));
  return bytes;
}

/** Copies a BLOB written by `encodeVector` into a new `Float32Array`. */
export function decodeVector(bytes: Uint8Array): Float32Array {
  if (bytes.byteLength % BYTES_PER_VALUE !== 0) {
    throw new Error(`embedding BLOB has ${bytes.byteLength} bytes, not a whole number of float32 values`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return Float32Array.from({ length: bytes.byteLength / BYTES_PER_VALUE }, (_, index) =>
    view.getFloat32(index * BYTES_PER_VALUE, true),
  );
}
