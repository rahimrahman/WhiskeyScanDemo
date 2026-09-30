jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import type { SQLInputValue } from 'node:sqlite';

import { createCatalogStore, type CatalogBottle } from './database';
import { encodeVector } from './vectors';

/** A stand-in for the expo-sqlite handle: records statements and returns canned rows. */
function fakeDatabase(rows: unknown[] = [], first: unknown = null) {
  const db = {
    execAsync: jest.fn().mockResolvedValue(undefined),
    runAsync: jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 }),
    getAllAsync: jest.fn().mockResolvedValue(rows),
    getFirstAsync: jest.fn().mockResolvedValue(first),
    withTransactionAsync: jest.fn(async (task: () => Promise<void>) => task()),
  };
  return { db, store: createCatalogStore(db as unknown as SQLiteDatabase) };
}

const bottle: CatalogBottle = {
  id: '7',
  name: 'Name',
  producer: 'Producer',
  expression: 'Expression',
  category: 'Bourbon',
  age: 'NAS',
  note: 'Note',
  imagePath: 'photos/7/1-front.jpg',
};

describe('createCatalogStore', () => {
  it('returns no vectors before any BLOB is stored', async () => {
    const { db, store } = fakeDatabase([]);

    await expect(store.loadPhotoVectors()).resolves.toEqual([]);
    expect(db.getAllAsync.mock.calls[0][0]).toContain('WHERE embedding IS NOT NULL');
  });

  it('decodes stored BLOBs into unit-length Float32Arrays', async () => {
    const { store } = fakeDatabase([
      { bottleId: '7', imagePath: 'photos/7/1-front.jpg', embedding: encodeVector([3, 4]) },
    ]);

    const [row] = await store.loadPhotoVectors();

    expect(row.bottleId).toBe('7');
    expect(row.imagePath).toBe('photos/7/1-front.jpg');
    expect(Array.from(row.vector)).toEqual([Math.fround(0.6), Math.fround(0.8)]);
  });

  it('upserts bottles and photos in one transaction and deletes the rest', async () => {
    const { db, store } = fakeDatabase();

    await store.syncCatalog([bottle], [{ bottleId: '7', imagePath: 'photos/7/1-front.jpg' }]);

    expect(db.withTransactionAsync).toHaveBeenCalledTimes(1);
    const [bottleInsert, photoInsert, photoDelete, bottleDelete] = db.runAsync.mock.calls;
    expect(bottleInsert[0]).toContain('ON CONFLICT (id) DO UPDATE');
    expect(bottleInsert[0]).not.toMatch(/created_at = excluded/);
    expect(bottleInsert[1]).toEqual([
      '7',
      'Name',
      'Producer',
      'Expression',
      'Bourbon',
      'NAS',
      'Note',
      'photos/7/1-front.jpg',
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
    ]);
    expect(photoInsert[0]).not.toContain('embedding');
    expect(photoInsert[1]).toEqual(['photos/7/1-front.jpg', '7']);
    expect(photoDelete[1]).toEqual(['["photos/7/1-front.jpg"]']);
    expect(bottleDelete[1]).toEqual(['["7"]']);
  });

  it('refills the label index from every kept bottle in the same transaction, leaving vectors alone', async () => {
    const { db, store } = fakeDatabase();

    await store.syncCatalog([bottle], [{ bottleId: '7', imagePath: 'photos/7/1-front.jpg' }]);

    const statements = db.runAsync.mock.calls.map(([sql]) => sql as string);
    const [clear, refill] = statements.slice(-2);
    expect(clear).toBe('DELETE FROM bottles_fts');
    expect(refill).toMatch(/INSERT INTO bottles_fts \(bottle_id, name, producer, expression, age\)\s+SELECT id, name, producer, expression, age FROM bottles/);
    expect(statements.findIndex((sql) => sql.startsWith('DELETE FROM bottles WHERE'))).toBeLessThan(statements.indexOf(clear));
    expect(statements.join('\n')).not.toMatch(/embedding|model_id/);
    expect(db.withTransactionAsync).toHaveBeenCalledTimes(1);
  });

  it('searches the label index by rank, returning up to 3 bottle ids', async () => {
    const { db, store } = fakeDatabase([{ bottleId: '3' }, { bottleId: '4' }]);

    await expect(store.searchLabels('"maker\'s" OR "mark"')).resolves.toEqual(['3', '4']);
    expect(db.getAllAsync).toHaveBeenCalledWith(
      'SELECT bottle_id AS bottleId FROM bottles_fts WHERE bottles_fts MATCH ? ORDER BY rank LIMIT 3',
      ['"maker\'s" OR "mark"'],
    );
  });

  it('lists photos with no vector', async () => {
    const missing = [{ bottleId: '7', imagePath: 'photos/7/1-front.jpg' }];
    const { db, store } = fakeDatabase(missing);

    await expect(store.photosMissingEmbedding()).resolves.toEqual(missing);
    expect(db.getAllAsync.mock.calls[0][0]).toContain('WHERE embedding IS NULL');
  });

  it('writes the BLOB bytes, not JSON', async () => {
    const { db, store } = fakeDatabase();
    const blob = encodeVector([1, 0]);

    await store.saveEmbedding('photos/7/1-front.jpg', blob);

    expect(db.runAsync).toHaveBeenCalledWith(expect.stringContaining('SET embedding = ?'), [
      blob,
      'photos/7/1-front.jpg',
    ]);
  });

  it('reads model_id, or null before one is stored', async () => {
    await expect(fakeDatabase([], null).store.getModelId()).resolves.toBeNull();
    await expect(fakeDatabase([], { value: 'model-a' }).store.getModelId()).resolves.toBe('model-a');
  });

  it('clears every vector and records the new model id in one transaction', async () => {
    const { db, store } = fakeDatabase();

    await store.resetEmbeddings('model-b');

    expect(db.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(db.runAsync.mock.calls[0][0]).toBe('UPDATE bottle_photos SET embedding = NULL');
    expect(db.runAsync.mock.calls[1][1]).toEqual(['model_id', 'model-b']);
  });
});

describe('openCatalogStore', () => {
  beforeEach(() => jest.resetModules());

  /** A fresh module per test, so the once-per-run cache starts empty. */
  const load = () => ({
    openCatalogStore: (require('./database') as typeof import('./database')).openCatalogStore,
    open: jest.mocked((require('expo-sqlite') as { openDatabaseAsync: typeof openDatabaseAsync }).openDatabaseAsync),
  });

  it('opens the database once and creates the tables', async () => {
    const { db } = fakeDatabase();
    const { openCatalogStore, open } = load();
    open.mockResolvedValue(db as unknown as SQLiteDatabase);

    const [first, second] = await Promise.all([openCatalogStore(), openCatalogStore()]);

    expect(first).toBe(second);
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith('catalog.db');
    expect(db.execAsync.mock.calls[0][0]).toContain('CREATE TABLE IF NOT EXISTS bottle_photos');
  });

  it('creates the label index with unicode61 keeping apostrophes inside tokens', async () => {
    const { db } = fakeDatabase();
    const { openCatalogStore, open } = load();
    open.mockResolvedValue(db as unknown as SQLiteDatabase);

    await openCatalogStore();

    const schema: string = db.execAsync.mock.calls[0][0];
    expect(schema).toMatch(
      /CREATE VIRTUAL TABLE IF NOT EXISTS bottles_fts USING fts5\(\s*bottle_id UNINDEXED,\s*name,\s*producer,\s*expression,\s*age,/,
    );
    expect(schema).toContain(`tokenize = "unicode61 tokenchars ''''"`);
  });

  it('searches labels with the real schema on SQLite FTS5 and forgets bottles a later sync removed', async () => {
    const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite');
    const sqlite = new DatabaseSync(':memory:');
    /** The expo-sqlite calls the store makes, run on Node's built-in SQLite. */
    const db = {
      execAsync: async (sql: string) => sqlite.exec(sql),
      runAsync: async (sql: string, params: SQLInputValue[] = []) => sqlite.prepare(sql).run(...params),
      getAllAsync: async (sql: string, params: SQLInputValue[] = []) => sqlite.prepare(sql).all(...params),
      getFirstAsync: async (sql: string, params: SQLInputValue[] = []) => sqlite.prepare(sql).get(...params) ?? null,
      withTransactionAsync: async (task: () => Promise<void>) => {
        sqlite.exec('BEGIN');
        await task();
        sqlite.exec('COMMIT');
      },
    };
    const { openCatalogStore, open } = load();
    open.mockResolvedValue(db as unknown as SQLiteDatabase);
    const whiskey = (id: string, name: string, producer: string, expression: string, age: string): CatalogBottle => ({
      ...bottle,
      id,
      name,
      producer,
      expression,
      age,
      imagePath: `photos/${id}/1-front.jpg`,
    });
    const makersMark = whiskey('3', "Maker's Mark", "Maker's Mark Distillery (Beam Suntory)", 'Original (red wax)', 'NAS');
    const eagleRare = whiskey('7', 'Eagle Rare 10 Year', 'Buffalo Trace Distillery', '10 Year Old', '10 years');
    const laphroaig = whiskey('10', 'Laphroaig 10 Year Old', 'Laphroaig (Beam Suntory)', '10 Year Old Single Malt', '10 years');
    const catalog = [makersMark, eagleRare, laphroaig];
    const store = await openCatalogStore();

    await store.syncCatalog(catalog, []);

    await expect(store.searchLabels('"maker\'s" OR "mark"')).resolves.toEqual(['3']);
    await expect(store.searchLabels('"maker"')).resolves.toEqual([]);
    const eagleHits = await store.searchLabels('"eagle" OR "rare" OR "10"');
    expect(eagleHits[0]).toBe('7');
    expect(eagleHits).toContain('10');

    await store.syncCatalog([eagleRare, laphroaig], []);

    await expect(store.searchLabels('"maker\'s" OR "mark"')).resolves.toEqual([]);
    sqlite.close();
  });

  it('tries again on the next call after opening fails', async () => {
    const { db } = fakeDatabase();
    const { openCatalogStore, open } = load();
    open.mockRejectedValueOnce(new Error('locked')).mockResolvedValueOnce(db as unknown as SQLiteDatabase);

    await expect(openCatalogStore()).rejects.toThrow('locked');
    await expect(openCatalogStore()).resolves.toBeDefined();
    expect(open).toHaveBeenCalledTimes(2);
  });
});
