import { renderHook, waitFor } from '@testing-library/react-native';

jest.mock('@/lib/embedding/embedPhoto', () => ({ embedPhoto: jest.fn() }));
jest.mock('@/lib/db/database', () => ({ openCatalogStore: jest.fn() }));

import { type BottleMatchDeps, useBottleMatch } from '@/components/scan/useBottleMatch';
import type { BundledWhiskey } from '@/lib/catalog/loadBundledCatalog';
import { type CatalogStore, openCatalogStore } from '@/lib/db/database';
import { decodeVector, encodeVector } from '@/lib/db/vectors';
import { embedPhoto, type PhotoEmbedding } from '@/lib/embedding/embedPhoto';

type Row = { bottleId: string; imagePath: string; bytes: Uint8Array | null };

/** An in-memory `CatalogStore` holding one row per catalog photo. */
function memoryStore(modelId: string | null, vectors: Record<string, number[] | null>) {
  let model = modelId;
  const rows: Row[] = Object.entries(vectors).map(([imagePath, vector]) => ({
    bottleId: imagePath.split('/')[1],
    imagePath,
    bytes: vector && encodeVector(vector),
  }));
  const store: CatalogStore = {
    syncCatalog: async () => {},
    photosMissingEmbedding: async () =>
      rows.filter((row) => !row.bytes).map(({ bottleId, imagePath }) => ({ bottleId, imagePath })),
    saveEmbedding: async (imagePath, bytes) => {
      rows.find((row) => row.imagePath === imagePath)!.bytes = bytes;
    },
    getModelId: async () => model,
    resetEmbeddings: async (nextModelId) => {
      model = nextModelId;
      for (const row of rows) row.bytes = null;
    },
    loadPhotoVectors: jest.fn(async () =>
      rows
        .filter((row) => row.bytes)
        .map(({ bottleId, imagePath, bytes }) => ({ bottleId, imagePath, vector: decodeVector(bytes!) })),
    ),
  };
  return { store, modelId: () => model };
}

const whiskey = (id: string, name: string, imageSource: number): BundledWhiskey => ({
  id,
  name,
  producer: '',
  expression: '',
  age: '',
  category: 'Bourbon',
  note: '',
  image: `photos/${id}/front.jpg`,
  photos: [],
  imageSource,
});

const CATALOG = [whiskey('1', 'Buffalo Trace', 11), whiskey('2', 'Eagle Rare', 22)];
const SCAN_URI = 'file:///tmp/scan.jpg';

/** Vectors whose dot product with the scan vector [1, 0] is the given similarity. */
const at = (similarity: number) => [similarity, Math.sqrt(1 - similarity ** 2)];

const STORED = {
  'photos/1/front.jpg': at(0.9),
  'photos/1/back.jpg': at(0.4),
  'photos/2/front.jpg': at(0.6),
};

let db: ReturnType<typeof memoryStore>;
let catalogVectors: Record<string, number[]>;
let catalogModel: string;

/** The pinned `performance.now()`; only embeds advance it. */
let clock: number;

/** The scan takes 412.4 ms and embeds as [3, 0] with model-a; catalog photos embed from `catalogVectors`. */
const embedScanOrCatalog = async (uri: string): Promise<PhotoEmbedding> => {
  if (uri === SCAN_URI) {
    clock += 412.4;
    return { vector: [3, 0], modelId: 'model-a' };
  }
  return { vector: catalogVectors[uri.replace('file:///bundle/', '')], modelId: catalogModel };
};
const embed = jest.fn(embedScanOrCatalog);

const deps = (): BottleMatchDeps => ({
  embed,
  openStore: jest.fn(async () => db.store),
  resolveUri: async (imagePath) => `file:///bundle/${imagePath}`,
  loadCatalog: () => CATALOG,
  photoSource: (imagePath) => ({ 'photos/1/front.jpg': 101, 'photos/2/front.jpg': 201 })[imagePath],
});

const renderMatch = (photoUri: string | undefined, matchDeps = deps()) =>
  renderHook((uri: string | undefined) => useBottleMatch(uri, matchDeps), { initialProps: photoUri });

beforeEach(() => {
  jest.clearAllMocks();
  embed.mockReset().mockImplementation(embedScanOrCatalog);
  clock = 1000;
  jest.spyOn(performance, 'now').mockImplementation(() => clock);
  db = memoryStore('model-a', STORED);
  catalogVectors = {};
  catalogModel = 'model-a';
});

afterEach(() => jest.restoreAllMocks());

describe('useBottleMatch', () => {
  it("ranks the scan against the stored vectors, keeping each whiskey's best photo", async () => {
    const { result } = renderMatch(SCAN_URI);

    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).not.toBeNull());

    expect(result.current).toEqual({
      confident: true,
      candidates: [
        { bottleId: '1', name: 'Buffalo Trace', category: 'Bourbon', score: 90, cardImage: 11 },
        { bottleId: '2', name: 'Eagle Rare', category: 'Bourbon', score: 60, cardImage: 22 },
      ],
      winningPhoto: 101,
      elapsedMs: 412,
      modelId: 'model-a',
    });
    expect(embed).toHaveBeenCalledTimes(1);
    expect(embed).toHaveBeenCalledWith(SCAN_URI);
  });

  it('re-embeds the catalog with the scan model before ranking when the model changed', async () => {
    db = memoryStore('model-old', STORED);
    catalogVectors = { 'photos/1/front.jpg': at(0.3), 'photos/1/back.jpg': at(0.2), 'photos/2/front.jpg': at(0.95) };

    const { result } = renderMatch(SCAN_URI);
    await waitFor(() => expect(result.current).not.toBeNull());

    expect(db.modelId()).toBe('model-a');
    expect(embed).toHaveBeenCalledTimes(4);
    expect(result.current).toMatchObject({
      confident: true,
      candidates: [
        { bottleId: '2', score: 95 },
        { bottleId: '1', score: 30 },
      ],
      winningPhoto: 201,
      modelId: 'model-a',
    });
  });

  it('scores nothing when the reseed ends on another model id', async () => {
    db = memoryStore('model-old', STORED);
    catalogVectors = { 'photos/1/front.jpg': at(0.9), 'photos/1/back.jpg': at(0.9), 'photos/2/front.jpg': at(0.9) };
    catalogModel = 'model-b';

    const { result } = renderMatch(SCAN_URI);
    await waitFor(() => expect(result.current).not.toBeNull());

    expect(db.modelId()).toBe('model-b');
    expect(result.current).toMatchObject({ confident: false, candidates: [], winningPhoto: undefined });
    expect(db.store.loadPhotoVectors).not.toHaveBeenCalled();
  });

  it('matches nothing, keeping the latency and no model id, when the embed throws', async () => {
    embed.mockImplementationOnce(async () => {
      clock += 37.6;
      throw new Error('Vision failed');
    });
    const matchDeps = deps();

    const { result } = renderMatch(SCAN_URI, matchDeps);
    await waitFor(() => expect(result.current).not.toBeNull());

    expect(result.current).toEqual({ confident: false, candidates: [], elapsedMs: 38, modelId: undefined });
    expect(matchDeps.openStore).not.toHaveBeenCalled();
  });

  it('matches nothing, keeping the latency and model id, when the database cannot be opened', async () => {
    const matchDeps = { ...deps(), openStore: jest.fn().mockRejectedValue(new Error('cannot open')) };

    const { result } = renderMatch(SCAN_URI, matchDeps);
    await waitFor(() => expect(result.current).not.toBeNull());

    expect(result.current).toEqual({ confident: false, candidates: [], elapsedMs: 412, modelId: 'model-a' });
  });

  it('matches nothing, keeping the latency and model id, when loading vectors fails', async () => {
    jest.mocked(db.store.loadPhotoVectors).mockRejectedValueOnce(new Error('disk I/O error'));

    const { result } = renderMatch(SCAN_URI);
    await waitFor(() => expect(result.current).not.toBeNull());

    expect(db.store.loadPhotoVectors).toHaveBeenCalledTimes(1);
    expect(result.current).toEqual({ confident: false, candidates: [], elapsedMs: 412, modelId: 'model-a' });
  });

  it('matches nothing when no vectors are stored', async () => {
    db = memoryStore('model-a', { 'photos/1/front.jpg': null });

    const { result } = renderMatch(SCAN_URI);
    await waitFor(() => expect(result.current).not.toBeNull());

    expect(result.current).toMatchObject({ confident: false, candidates: [], winningPhoto: undefined, modelId: 'model-a' });
  });

  it('skips stored whiskeys that are not in the bundled catalog', async () => {
    db = memoryStore('model-a', { ...STORED, 'photos/3/front.jpg': at(0.99) });

    const { result } = renderMatch(SCAN_URI);
    await waitFor(() => expect(result.current).not.toBeNull());

    expect(result.current!.candidates.map(({ bottleId }) => bottleId)).toEqual(['1', '2']);
  });

  it.each([undefined, ''])('does not match without a photo URI (%p)', async (photoUri) => {
    const { result } = renderMatch(photoUri);

    await new Promise((resolve) => setImmediate(resolve));
    expect(result.current).toBeNull();
    expect(embed).not.toHaveBeenCalled();
  });

  it('clears the previous verdict as soon as a new photo arrives', async () => {
    const { result, rerender } = renderMatch(SCAN_URI);
    await waitFor(() => expect(result.current).not.toBeNull());
    embed.mockImplementationOnce(() => new Promise(() => {}));

    rerender('file:///tmp/second.jpg');

    expect(result.current).toBeNull();
  });

  it('ignores an attempt that finishes after a newer photo', async () => {
    const finish: ((embedding: PhotoEmbedding) => void)[] = [];
    embed.mockImplementation(() => new Promise((resolve) => finish.push(resolve)));
    const { result, rerender } = renderMatch(SCAN_URI);
    rerender('file:///tmp/second.jpg');
    await waitFor(() => expect(finish).toHaveLength(2));

    finish[0]({ vector: [1, 0], modelId: 'model-a' });
    await new Promise((resolve) => setImmediate(resolve));
    expect(result.current).toBeNull();

    finish[1]({ vector: [0, 1], modelId: 'model-a' });
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current!.candidates.map(({ score }) => score)).toEqual([92, 80]);
  });

  it('uses the Vision embedder and the app database by default', async () => {
    jest.mocked(embedPhoto).mockRejectedValue(new Error('embedPhoto requires iOS'));

    const { result } = renderHook(() => useBottleMatch(SCAN_URI));
    await waitFor(() => expect(result.current).not.toBeNull());

    expect(embedPhoto).toHaveBeenCalledWith(SCAN_URI);
    expect(openCatalogStore).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({ confident: false, candidates: [] });
  });
});
