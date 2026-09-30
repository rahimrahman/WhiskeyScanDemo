import { renderHook, waitFor } from '@testing-library/react-native';

jest.mock('@/lib/embedding/embedPhoto', () => ({
  embedPhoto: jest.fn(),
  embedUprightPhoto: jest.fn(),
  uprightCopy: jest.fn(),
}));
jest.mock('@/lib/embedding/readLabelText', () => ({ readLabelText: jest.fn() }));
jest.mock('@/lib/db/database', () => ({ openCatalogStore: jest.fn() }));

import { type BottleMatchDeps, useBottleMatch } from '@/components/scan/useBottleMatch';
import type { BundledWhiskey } from '@/lib/catalog/loadBundledCatalog';
import { type CatalogStore, openCatalogStore } from '@/lib/db/database';
import { decodeVector, encodeVector } from '@/lib/db/vectors';
import { embedPhoto, embedUprightPhoto, type PhotoEmbedding, uprightCopy } from '@/lib/embedding/embedPhoto';
import { readLabelText } from '@/lib/embedding/readLabelText';

type Row = { bottleId: string; imagePath: string; bytes: Uint8Array | null };

/** Bottle ids the label search returns, best first. */
let labelHits: string[];

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
    searchLabels: jest.fn(async () => labelHits.slice(0, 3)),
  };
  return { store, modelId: () => model };
}

const whiskey = (id: string, name: string, imageSource: number, fields: Partial<BundledWhiskey> = {}): BundledWhiskey => ({
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
  ...fields,
});

const CATALOG = [
  whiskey('1', 'Buffalo Trace', 11, { producer: 'Buffalo Trace Distillery' }),
  whiskey('2', 'Eagle Rare 10 Year', 22, { producer: 'Buffalo Trace Distillery', expression: '10 Year Old', age: '10 years' }),
];
const SCAN_URI = 'file:///tmp/scan.jpg';
const UPRIGHT_URI = 'file:///tmp/scan-upright.jpg';
const NO_LABEL = { lines: [], hits: [] };

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
let labelLines: string[];

/** The pinned `performance.now()`; only embeds advance it. */
let clock: number;

/** The upright scan takes 412.4 ms and embeds as [3, 0] with model-a. */
const embedScan = async (): Promise<PhotoEmbedding> => {
  clock += 412.4;
  return { vector: [3, 0], modelId: 'model-a' };
};
const embedUpright = jest.fn(embedScan);
/** Catalog photos embed from `catalogVectors` during a reseed. */
const embed = jest.fn(
  async (uri: string): Promise<PhotoEmbedding> => ({
    vector: catalogVectors[uri.replace('file:///bundle/', '')],
    modelId: catalogModel,
  }),
);
const upright = jest.fn(async (_photoUri: string) => UPRIGHT_URI);
const readLabel = jest.fn(async (_uprightUri: string) => labelLines);

const deps = (): BottleMatchDeps => ({
  upright,
  embedUpright,
  readLabel,
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
  embedUpright.mockReset().mockImplementation(embedScan);
  upright.mockReset().mockResolvedValue(UPRIGHT_URI);
  clock = 1000;
  jest.spyOn(performance, 'now').mockImplementation(() => clock);
  db = memoryStore('model-a', STORED);
  catalogVectors = {};
  catalogModel = 'model-a';
  labelLines = [];
  labelHits = [];
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
        { bottleId: '2', name: 'Eagle Rare 10 Year', category: 'Bourbon', score: 60, cardImage: 22 },
      ],
      winningPhoto: 101,
      elapsedMs: 412,
      modelId: 'model-a',
      label: NO_LABEL,
    });
  });

  it('makes one upright copy and hands that URI to both the feature print and OCR', async () => {
    const { result } = renderMatch(SCAN_URI);
    await waitFor(() => expect(result.current).not.toBeNull());

    expect(upright).toHaveBeenCalledTimes(1);
    expect(upright).toHaveBeenCalledWith(SCAN_URI);
    expect(embedUpright).toHaveBeenCalledTimes(1);
    expect(embedUpright).toHaveBeenCalledWith(UPRIGHT_URI);
    expect(readLabel).toHaveBeenCalledTimes(1);
    expect(readLabel).toHaveBeenCalledWith(UPRIGHT_URI);
    expect(embed).not.toHaveBeenCalled();
  });

  it('lists the label ranking beside an image match whose top whiskey differs', async () => {
    labelLines = ['Eagle Rare', '10 Years', 'Kentucky Straight Bourbon Whiskey'];
    labelHits = ['2'];

    const { result } = renderMatch(SCAN_URI);
    await waitFor(() => expect(result.current).not.toBeNull());

    expect(result.current).toMatchObject({ confident: true, candidates: [{ bottleId: '1' }, { bottleId: '2' }] });
    expect(result.current!.label).toEqual({
      lines: ['Eagle Rare', '10 Years', 'Kentucky Straight Bourbon Whiskey'],
      hits: [{ bottleId: '2', name: 'Eagle Rare 10 Year', words: ['eagle', 'rare', '10'] }],
    });
    expect(db.store.searchLabels).toHaveBeenCalledWith('"eagle" OR "rare" OR "10"');
  });

  it("queries only the distinctive words of a Maker's Mark label", async () => {
    labelLines = ["Maker's Mark", 'Kentucky Straight Bourbon Whisky'];

    const { result } = renderMatch(SCAN_URI);
    await waitFor(() => expect(result.current).not.toBeNull());

    expect(db.store.searchLabels).toHaveBeenCalledWith('"maker\'s" OR "mark"');
  });

  it('keeps the lines and searches nothing when every word is generic or too short', async () => {
    labelLines = ['Straight Bourbon Whiskey', 'A 7'];

    const { result } = renderMatch(SCAN_URI);
    await waitFor(() => expect(result.current).not.toBeNull());

    expect(result.current!.label).toEqual({ lines: ['Straight Bourbon Whiskey', 'A 7'], hits: [] });
    expect(db.store.searchLabels).not.toHaveBeenCalled();
  });

  it('keeps the lines with no hits when the label search finds nothing', async () => {
    labelLines = ['Glenmorangie'];

    const { result } = renderMatch(SCAN_URI);
    await waitFor(() => expect(result.current).not.toBeNull());

    expect(result.current!.label).toEqual({ lines: ['Glenmorangie'], hits: [] });
    expect(db.store.searchLabels).toHaveBeenCalledWith('"glenmorangie"');
  });

  it('skips label hits that are not in the bundled catalog', async () => {
    labelLines = ['Eagle Rare'];
    labelHits = ['9', '2'];

    const { result } = renderMatch(SCAN_URI);
    await waitFor(() => expect(result.current).not.toBeNull());

    expect(result.current!.label.hits.map(({ bottleId }) => bottleId)).toEqual(['2']);
  });

  it('keeps the image match and the lines when the label search fails', async () => {
    labelLines = ['Eagle Rare'];
    jest.mocked(db.store.searchLabels).mockRejectedValueOnce(new Error('no such table: bottles_fts'));

    const { result } = renderMatch(SCAN_URI);
    await waitFor(() => expect(result.current).not.toBeNull());

    expect(result.current).toMatchObject({ confident: true, candidates: [{ bottleId: '1' }, { bottleId: '2' }] });
    expect(result.current!.label).toEqual({ lines: ['Eagle Rare'], hits: [] });
  });

  it('re-embeds the catalog with the scan model before ranking when the model changed', async () => {
    db = memoryStore('model-old', STORED);
    catalogVectors = { 'photos/1/front.jpg': at(0.3), 'photos/1/back.jpg': at(0.2), 'photos/2/front.jpg': at(0.95) };

    const { result } = renderMatch(SCAN_URI);
    await waitFor(() => expect(result.current).not.toBeNull());

    expect(db.modelId()).toBe('model-a');
    expect(embed).toHaveBeenCalledTimes(3);
    expect(upright).toHaveBeenCalledTimes(1);
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
    embedUpright.mockImplementationOnce(async () => {
      clock += 37.6;
      throw new Error('Vision failed');
    });
    const matchDeps = deps();

    const { result } = renderMatch(SCAN_URI, matchDeps);
    await waitFor(() => expect(result.current).not.toBeNull());

    expect(result.current).toEqual({
      confident: false,
      candidates: [],
      elapsedMs: 38,
      modelId: undefined,
      label: NO_LABEL,
    });
    expect(matchDeps.openStore).not.toHaveBeenCalled();
  });

  it('still shows the label ranking when the embed throws, opening the store only to search labels', async () => {
    embedUpright.mockRejectedValueOnce(new Error('Vision failed'));
    labelLines = ['Eagle Rare'];
    labelHits = ['2'];
    const matchDeps = deps();

    const { result } = renderMatch(SCAN_URI, matchDeps);
    await waitFor(() => expect(result.current).not.toBeNull());

    expect(result.current).toMatchObject({ confident: false, candidates: [], modelId: undefined });
    expect(result.current!.label).toEqual({
      lines: ['Eagle Rare'],
      hits: [{ bottleId: '2', name: 'Eagle Rare 10 Year', words: ['eagle', 'rare'] }],
    });
    expect(matchDeps.openStore).toHaveBeenCalledTimes(1);
    expect(db.store.loadPhotoVectors).not.toHaveBeenCalled();
  });

  it('matches nothing and reads no label when the upright copy fails', async () => {
    upright.mockImplementationOnce(async () => {
      clock += 5;
      throw new Error('cannot load image');
    });

    const { result } = renderMatch(SCAN_URI);
    await waitFor(() => expect(result.current).not.toBeNull());

    expect(result.current).toEqual({ confident: false, candidates: [], elapsedMs: 5, label: NO_LABEL });
    expect(embedUpright).not.toHaveBeenCalled();
    expect(readLabel).not.toHaveBeenCalled();
  });

  it('matches nothing, keeping the latency and model id, when the database cannot be opened', async () => {
    labelLines = ['Eagle Rare'];
    const matchDeps = { ...deps(), openStore: jest.fn().mockRejectedValue(new Error('cannot open')) };

    const { result } = renderMatch(SCAN_URI, matchDeps);
    await waitFor(() => expect(result.current).not.toBeNull());

    expect(result.current).toEqual({
      confident: false,
      candidates: [],
      elapsedMs: 412,
      modelId: 'model-a',
      label: { lines: ['Eagle Rare'], hits: [] },
    });
  });

  it('matches nothing, keeping the latency and model id, when loading vectors fails', async () => {
    jest.mocked(db.store.loadPhotoVectors).mockRejectedValueOnce(new Error('disk I/O error'));

    const { result } = renderMatch(SCAN_URI);
    await waitFor(() => expect(result.current).not.toBeNull());

    expect(db.store.loadPhotoVectors).toHaveBeenCalledTimes(1);
    expect(result.current).toEqual({
      confident: false,
      candidates: [],
      elapsedMs: 412,
      modelId: 'model-a',
      label: NO_LABEL,
    });
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
    expect(upright).not.toHaveBeenCalled();
  });

  it('clears the previous verdict as soon as a new photo arrives', async () => {
    const { result, rerender } = renderMatch(SCAN_URI);
    await waitFor(() => expect(result.current).not.toBeNull());
    embedUpright.mockImplementationOnce(() => new Promise(() => {}));

    rerender('file:///tmp/second.jpg');

    expect(result.current).toBeNull();
  });

  it('ignores an attempt that finishes after a newer photo', async () => {
    const finish: ((embedding: PhotoEmbedding) => void)[] = [];
    embedUpright.mockImplementation(() => new Promise((resolve) => finish.push(resolve)));
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

  it('uses the upright copy, Vision print, Vision OCR and the app database by default', async () => {
    jest.mocked(uprightCopy).mockResolvedValue(UPRIGHT_URI);
    jest.mocked(embedUprightPhoto).mockRejectedValue(new Error('embedUprightPhoto requires iOS'));
    jest.mocked(readLabelText).mockResolvedValue([]);

    const { result } = renderHook(() => useBottleMatch(SCAN_URI));
    await waitFor(() => expect(result.current).not.toBeNull());

    expect(uprightCopy).toHaveBeenCalledWith(SCAN_URI);
    expect(embedUprightPhoto).toHaveBeenCalledWith(UPRIGHT_URI);
    expect(readLabelText).toHaveBeenCalledWith(UPRIGHT_URI);
    expect(embedPhoto).not.toHaveBeenCalled();
    expect(openCatalogStore).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({ confident: false, candidates: [], label: NO_LABEL });
  });
});
