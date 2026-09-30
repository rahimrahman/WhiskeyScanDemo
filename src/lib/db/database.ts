import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { decodeVector } from './vectors';

export type CatalogBottle = {
  id: string;
  name: string;
  producer: string;
  expression: string;
  category: string;
  age: string;
  note: string;
  imagePath: string;
};

/** `imagePath` is relative to `assets/catalog/` (e.g. `photos/1/1-front.jpg`), never a `file://` URI. */
export type CatalogPhoto = { bottleId: string; imagePath: string };

export type PhotoVector = CatalogPhoto & { vector: Float32Array };

export type CatalogStore = {
  /** Upserts every bottle and photo, keeping stored vectors; bottles and photos not passed are deleted. */
  syncCatalog(bottles: CatalogBottle[], photos: CatalogPhoto[]): Promise<void>;
  photosMissingEmbedding(): Promise<CatalogPhoto[]>;
  saveEmbedding(imagePath: string, embedding: Uint8Array): Promise<void>;
  getModelId(): Promise<string | null>;
  /** Clears every stored vector and records `modelId`, so vectors from two models never mix. */
  resetEmbeddings(modelId: string): Promise<void>;
  /** Every stored vector; empty until the first photo is embedded. */
  loadPhotoVectors(): Promise<PhotoVector[]>;
};

const DATABASE_NAME = 'catalog.db';
const MODEL_ID_KEY = 'model_id';

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS bottles (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  producer TEXT NOT NULL,
  expression TEXT NOT NULL,
  category TEXT NOT NULL,
  age TEXT NOT NULL,
  note TEXT NOT NULL,
  image_path TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bottle_photos (
  image_path TEXT PRIMARY KEY NOT NULL,
  bottle_id TEXT NOT NULL REFERENCES bottles (id) ON DELETE CASCADE,
  embedding BLOB
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
`;

type PhotoRow = { bottleId: string; imagePath: string };
type VectorRow = PhotoRow & { embedding: Uint8Array };

export function createCatalogStore(db: SQLiteDatabase): CatalogStore {
  return {
    async syncCatalog(bottles, photos) {
      const createdAt = new Date().toISOString();
      await db.withTransactionAsync(async () => {
        for (const bottle of bottles) {
          await db.runAsync(
            `INSERT INTO bottles (id, name, producer, expression, category, age, note, image_path, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT (id) DO UPDATE SET name = excluded.name, producer = excluded.producer,
               expression = excluded.expression, category = excluded.category, age = excluded.age,
               note = excluded.note, image_path = excluded.image_path`,
            [
              bottle.id,
              bottle.name,
              bottle.producer,
              bottle.expression,
              bottle.category,
              bottle.age,
              bottle.note,
              bottle.imagePath,
              createdAt,
            ],
          );
        }
        for (const photo of photos) {
          await db.runAsync(
            `INSERT INTO bottle_photos (image_path, bottle_id) VALUES (?, ?)
             ON CONFLICT (image_path) DO UPDATE SET bottle_id = excluded.bottle_id`,
            [photo.imagePath, photo.bottleId],
          );
        }
        await db.runAsync(
          'DELETE FROM bottle_photos WHERE image_path NOT IN (SELECT value FROM json_each(?))',
          [JSON.stringify(photos.map((photo) => photo.imagePath))],
        );
        await db.runAsync('DELETE FROM bottles WHERE id NOT IN (SELECT value FROM json_each(?))', [
          JSON.stringify(bottles.map((bottle) => bottle.id)),
        ]);
      });
    },

    photosMissingEmbedding() {
      return db.getAllAsync<PhotoRow>(
        `SELECT bottle_id AS bottleId, image_path AS imagePath FROM bottle_photos
         WHERE embedding IS NULL ORDER BY rowid`,
      );
    },

    async saveEmbedding(imagePath, embedding) {
      await db.runAsync('UPDATE bottle_photos SET embedding = ? WHERE image_path = ?', [embedding, imagePath]);
    },

    async getModelId() {
      const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
        MODEL_ID_KEY,
      ]);
      return row?.value ?? null;
    },

    async resetEmbeddings(modelId) {
      await db.withTransactionAsync(async () => {
        await db.runAsync('UPDATE bottle_photos SET embedding = NULL');
        await db.runAsync(
          `INSERT INTO settings (key, value) VALUES (?, ?)
           ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
          [MODEL_ID_KEY, modelId],
        );
      });
    },

    async loadPhotoVectors() {
      const rows = await db.getAllAsync<VectorRow>(
        `SELECT bottle_id AS bottleId, image_path AS imagePath, embedding FROM bottle_photos
         WHERE embedding IS NOT NULL ORDER BY rowid`,
      );
      return rows.map(({ bottleId, imagePath, embedding }) => ({
        bottleId,
        imagePath,
        vector: decodeVector(embedding),
      }));
    },
  };
}

let opening: Promise<CatalogStore> | undefined;

/** Opens the on-device catalog database once per app run, creating its tables on first use. */
export function openCatalogStore(): Promise<CatalogStore> {
  opening ??= openDatabaseAsync(DATABASE_NAME)
    .then(async (db) => {
      await db.execAsync(SCHEMA);
      return createCatalogStore(db);
    })
    .catch((error: unknown) => {
      opening = undefined;
      throw error;
    });
  return opening;
}
