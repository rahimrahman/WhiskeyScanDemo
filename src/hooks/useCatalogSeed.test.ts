import { renderHook, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

jest.mock('@/lib/db/database', () => ({ openCatalogStore: jest.fn() }));
jest.mock('@/lib/db/seedCatalog', () => ({ seedCatalog: jest.fn() }));
jest.mock('@/lib/db/bundledPhotoUri', () => ({ bundledPhotoUri: jest.fn() }));
jest.mock('@/lib/catalog/loadBundledCatalog', () => ({ loadBundledCatalog: jest.fn() }));
jest.mock('@/lib/embedding/embedPhoto', () => ({ embedPhoto: jest.fn() }));

import { useCatalogSeed } from '@/hooks/useCatalogSeed';
import { loadBundledCatalog } from '@/lib/catalog/loadBundledCatalog';
import { bundledPhotoUri } from '@/lib/db/bundledPhotoUri';
import { openCatalogStore } from '@/lib/db/database';
import { seedCatalog } from '@/lib/db/seedCatalog';
import { embedPhoto } from '@/lib/embedding/embedPhoto';

const store = { name: 'store' } as never;
const whiskeys = [{ id: '1' }] as never;

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(openCatalogStore).mockResolvedValue(store);
  jest.mocked(seedCatalog).mockResolvedValue();
  jest.mocked(loadBundledCatalog).mockReturnValue(whiskeys);
});

afterEach(() => jest.restoreAllMocks());

describe('useCatalogSeed', () => {
  it('waits until ready before touching the database', () => {
    renderHook(() => useCatalogSeed(false));

    expect(openCatalogStore).not.toHaveBeenCalled();
    expect(seedCatalog).not.toHaveBeenCalled();
  });

  it('seeds the bundled catalog with the Vision embedder on iOS', async () => {
    renderHook(() => useCatalogSeed(true));

    await waitFor(() =>
      expect(seedCatalog).toHaveBeenCalledWith({ store, embed: embedPhoto, resolveUri: bundledPhotoUri }, whiskeys),
    );
  });

  it('saves rows without an embedder off iOS', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');

    renderHook(() => useCatalogSeed(true));

    await waitFor(() =>
      expect(seedCatalog).toHaveBeenCalledWith({ store, embed: undefined, resolveUri: bundledPhotoUri }, whiskeys),
    );
  });

  it('swallows a failure to open the database', async () => {
    jest.mocked(openCatalogStore).mockRejectedValue(new Error('cannot open'));

    renderHook(() => useCatalogSeed(true));

    await waitFor(() => expect(openCatalogStore).toHaveBeenCalledTimes(1));
    expect(seedCatalog).not.toHaveBeenCalled();
  });

  it('swallows a failed seed', async () => {
    const unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);
    jest.mocked(seedCatalog).mockRejectedValue(new Error('seed failed'));

    expect(() => renderHook(() => useCatalogSeed(true))).not.toThrow();

    await waitFor(() => expect(seedCatalog).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setImmediate(resolve));
    process.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });
});
