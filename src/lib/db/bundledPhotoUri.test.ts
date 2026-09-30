jest.mock('../../../assets/catalog/image-map.js', () => ({ 'photos/1/1-front.jpg': 101 }), {
  virtual: true,
});
jest.mock('expo-asset', () => ({ Asset: { fromModule: jest.fn() } }));

import { Asset } from 'expo-asset';

import { bundledPhotoUri } from './bundledPhotoUri';

const downloadedAsset = (asset: { localUri: string | null; uri: string }) => {
  jest.mocked(Asset.fromModule).mockReturnValue({ downloadAsync: jest.fn().mockResolvedValue(asset) } as never);
};

describe('bundledPhotoUri', () => {
  it('downloads the bundled asset and returns its local file URI', async () => {
    downloadedAsset({ localUri: 'file:///cache/1-front.jpg', uri: 'http://metro/1-front.jpg' });

    await expect(bundledPhotoUri('photos/1/1-front.jpg')).resolves.toBe('file:///cache/1-front.jpg');
    expect(Asset.fromModule).toHaveBeenCalledWith(101);
  });

  it('falls back to the asset URI when there is no local copy', async () => {
    downloadedAsset({ localUri: null, uri: 'file:///bundle/1-front.jpg' });

    await expect(bundledPhotoUri('photos/1/1-front.jpg')).resolves.toBe('file:///bundle/1-front.jpg');
  });

  it('rejects a photo path that is not in the image map', async () => {
    await expect(bundledPhotoUri('photos/9/missing.jpg')).rejects.toThrow('not bundled: photos/9/missing.jpg');
  });
});
