import type { CatalogWhiskey } from '@/lib/catalog/catalog';
import type { PhotoEmbedding } from '@/lib/embedding/embedPhoto';

import type { CatalogBottle, CatalogStore } from './database';
import { reseedIfModelChanged, seedCatalog, type SeedDeps } from './seedCatalog';
import { decodeVector } from './vectors';

/** An in-memory `CatalogStore` with the same upsert and delete rules as the SQLite one. */
function memoryStore() {
  const bottles = new Map<string, CatalogBottle>();
  const photos = new Map<string, { bottleId: string; embedding: Uint8Array | null }>();
  let modelId: string | null = null;

  const store: CatalogStore = {
    async syncCatalog(nextBottles, nextPhotos) {
      for (const bottle of nextBottles) bottles.set(bottle.id, bottle);
      for (const { bottleId, imagePath } of nextPhotos) {
        photos.set(imagePath, { bottleId, embedding: photos.get(imagePath)?.embedding ?? null });
      }
      const keepPhotos = new Set(nextPhotos.map((photo) => photo.imagePath));
      for (const imagePath of photos.keys()) if (!keepPhotos.has(imagePath)) photos.delete(imagePath);
      const keepBottles = new Set(nextBottles.map((bottle) => bottle.id));
      for (const id of bottles.keys()) if (!keepBottles.has(id)) bottles.delete(id);
    },
    async photosMissingEmbedding() {
      return [...photos].filter(([, row]) => !row.embedding).map(([imagePath, { bottleId }]) => ({ bottleId, imagePath }));
    },
    async saveEmbedding(imagePath, embedding) {
      photos.get(imagePath)!.embedding = embedding;
    },
    async getModelId() {
      return modelId;
    },
    async resetEmbeddings(nextModelId) {
      for (const row of photos.values()) row.embedding = null;
      modelId = nextModelId;
    },
    async loadPhotoVectors() {
      return [...photos]
        .filter(([, row]) => row.embedding)
        .map(([imagePath, { bottleId, embedding }]) => ({ bottleId, imagePath, vector: decodeVector(embedding!) }));
    },
  };
  return { store, bottles, photos, modelId: () => modelId };
}

const whiskey = (id: string, photoCount: number): CatalogWhiskey => {
  const photos = Array.from({ length: photoCount }, (_, index) => `photos/${id}/${index + 1}.jpg`);
  return {
    id,
    name: `Whiskey ${id}`,
    producer: `Producer ${id}`,
    expression: `Expression ${id}`,
    age: '12',
    category: 'Bourbon',
    note: `Note ${id}`,
    image: photos[0],
    photos,
  };
};

const CATALOG = [whiskey('1', 2), whiskey('2', 3)];
const PHOTO_COUNT = 5;

let model = 'apple-vision-feature-print:float:768';
const embedWithCurrentModel = async (uri: string): Promise<PhotoEmbedding> => ({
  vector: [uri.length, 3, 4],
  modelId: model,
});
const embed = jest.fn(embedWithCurrentModel);
const resolveUri = jest.fn(async (imagePath: string) => `file:///bundle/${imagePath}`);

let db: ReturnType<typeof memoryStore>;
const deps = (overrides: Partial<SeedDeps> = {}): SeedDeps => ({ store: db.store, embed, resolveUri, ...overrides });
const storedPaths = async () => (await db.store.loadPhotoVectors()).map((row) => row.imagePath);

beforeEach(() => {
  jest.clearAllMocks();
  embed.mockReset().mockImplementation(embedWithCurrentModel);
  model = 'apple-vision-feature-print:float:768';
  db = memoryStore();
});

describe('seedCatalog', () => {
  it('stores every bottle and embeds each photo once on first launch', async () => {
    await seedCatalog(deps(), CATALOG);

    expect(embed).toHaveBeenCalledTimes(PHOTO_COUNT);
    expect(embed).toHaveBeenCalledWith('file:///bundle/photos/2/3.jpg');
    expect(db.modelId()).toBe('apple-vision-feature-print:float:768');
    const vectors = await db.store.loadPhotoVectors();
    expect(vectors).toHaveLength(PHOTO_COUNT);
    for (const { vector } of vectors) {
      expect(vector).toBeInstanceOf(Float32Array);
      expect(Math.hypot(...vector)).toBeCloseTo(1, 5);
    }
    expect(vectors[0]).toMatchObject({ bottleId: '1', imagePath: 'photos/1/1.jpg' });
    expect(db.bottles.get('2')).toEqual({
      id: '2',
      name: 'Whiskey 2',
      producer: 'Producer 2',
      expression: 'Expression 2',
      category: 'Bourbon',
      age: '12',
      note: 'Note 2',
      imagePath: 'photos/2/1.jpg',
    });
  });

  it('reuses stored vectors on a later launch without embedding', async () => {
    await seedCatalog(deps(), CATALOG);
    const before = await db.store.loadPhotoVectors();
    embed.mockClear();

    await seedCatalog(deps(), CATALOG);

    expect(embed).not.toHaveBeenCalled();
    expect(resolveUri).toHaveBeenCalledTimes(PHOTO_COUNT);
    expect(await db.store.loadPhotoVectors()).toEqual(before);
  });

  it('replaces every vector when an embed in this run returns a different model id', async () => {
    await seedCatalog(deps(), CATALOG);
    embed.mockClear();
    model = 'apple-vision-feature-print:float:1024';

    await seedCatalog(deps(), [...CATALOG, whiskey('3', 1)]);

    expect(db.modelId()).toBe('apple-vision-feature-print:float:1024');
    expect(embed).toHaveBeenCalledTimes(PHOTO_COUNT + 1);
    expect(await storedPaths()).toHaveLength(PHOTO_COUNT + 1);
  });

  it('embeds only the rows still missing after an interrupted seed', async () => {
    embed.mockImplementationOnce(async () => {
      throw new Error('Failed to create espresso context');
    });
    embed.mockRejectedValueOnce(new Error('interrupted'));
    await seedCatalog(deps(), CATALOG);
    expect(await storedPaths()).toHaveLength(PHOTO_COUNT - 2);
    embed.mockClear();

    await seedCatalog(deps(), CATALOG);

    expect(embed.mock.calls.map(([uri]) => uri)).toEqual([
      'file:///bundle/photos/1/1.jpg',
      'file:///bundle/photos/1/2.jpg',
    ]);
    expect(await storedPaths()).toHaveLength(PHOTO_COUNT);
  });

  it('keeps earlier vectors and shows no error when embedding throws mid-run', async () => {
    embed.mockImplementation(async (uri) => {
      if (uri.includes('photos/2/')) throw new Error('Vision failed');
      return { vector: [1, 2, 2], modelId: model };
    });

    await expect(seedCatalog(deps(), CATALOG)).resolves.toBeUndefined();

    expect(await storedPaths()).toEqual(['photos/1/1.jpg', 'photos/1/2.jpg']);
    expect((await db.store.photosMissingEmbedding()).map((row) => row.imagePath)).toEqual([
      'photos/2/1.jpg',
      'photos/2/2.jpg',
      'photos/2/3.jpg',
    ]);
  });

  it('embeds an added photo and deletes removed photos and bottles', async () => {
    await seedCatalog(deps(), CATALOG);
    embed.mockClear();
    const edited = [{ ...whiskey('1', 3), photos: ['photos/1/1.jpg', 'photos/1/new.jpg'] }];

    await seedCatalog(deps(), edited);

    expect(embed).toHaveBeenCalledTimes(1);
    expect(embed).toHaveBeenCalledWith('file:///bundle/photos/1/new.jpg');
    expect(await storedPaths()).toEqual(['photos/1/1.jpg', 'photos/1/new.jpg']);
    expect([...db.bottles.keys()]).toEqual(['1']);
  });

  it('saves rows with no vectors and never embeds when no embedder is available', async () => {
    await expect(seedCatalog(deps({ embed: undefined }), CATALOG)).resolves.toBeUndefined();

    expect(embed).not.toHaveBeenCalled();
    expect(db.bottles.size).toBe(2);
    expect(db.photos.size).toBe(PHOTO_COUNT);
    expect(await db.store.loadPhotoVectors()).toEqual([]);
    expect(db.modelId()).toBeNull();
  });

  it.each([
    ['an empty', []],
    ['a zero', [0, 0, 0]],
  ])('does not store %s vector', async (_, badVector) => {
    embed.mockResolvedValueOnce({ vector: badVector, modelId: model });

    await seedCatalog(deps(), CATALOG);

    expect(await storedPaths()).not.toContain('photos/1/1.jpg');
    expect(await storedPaths()).toHaveLength(PHOTO_COUNT - 1);
  });

  it('leaves a photo missing when a second model id shows up in the same run', async () => {
    model = 'model-a';
    embed.mockResolvedValueOnce({ vector: [1, 0, 0], modelId: 'model-a' });
    embed.mockResolvedValueOnce({ vector: [0, 1, 0], modelId: 'model-b' });

    await seedCatalog(deps(), CATALOG);

    expect(db.modelId()).toBe('model-a');
    expect(await storedPaths()).not.toContain('photos/1/2.jpg');
    expect(await storedPaths()).toHaveLength(PHOTO_COUNT - 1);
  });

  it('runs overlapping seeds one after another so no photo is embedded twice', async () => {
    await Promise.all([seedCatalog(deps(), CATALOG), seedCatalog(deps(), CATALOG)]);

    expect(embed).toHaveBeenCalledTimes(PHOTO_COUNT);
  });

  it('still runs the next seed after one fails', async () => {
    const failing = { ...db.store, syncCatalog: jest.fn().mockRejectedValue(new Error('disk full')) };

    await expect(seedCatalog(deps({ store: failing }), CATALOG)).rejects.toThrow('disk full');
    await seedCatalog(deps(), CATALOG);

    expect(embed).toHaveBeenCalledTimes(PHOTO_COUNT);
  });
});

describe('reseedIfModelChanged', () => {
  it('does nothing when the model id matches the stored one', async () => {
    await seedCatalog(deps(), CATALOG);
    embed.mockClear();

    await reseedIfModelChanged(deps(), 'apple-vision-feature-print:float:768');

    expect(embed).not.toHaveBeenCalled();
    expect(await storedPaths()).toHaveLength(PHOTO_COUNT);
  });

  it('replaces every vector when a scan reports a new model id', async () => {
    await seedCatalog(deps(), CATALOG);
    embed.mockClear();
    model = 'apple-vision-feature-print:float:1024';

    await reseedIfModelChanged(deps(), model);

    expect(db.modelId()).toBe(model);
    expect(embed).toHaveBeenCalledTimes(PHOTO_COUNT);
    expect(await storedPaths()).toHaveLength(PHOTO_COUNT);
  });
});
