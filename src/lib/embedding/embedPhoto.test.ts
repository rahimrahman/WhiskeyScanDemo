const mockGenerateFeaturePrint = jest.fn();
const mockLoadFromFileAsync = jest.fn();
const mockResizeAsync = jest.fn();

jest.mock('@insidepics/expo-apple-intelligence', () => ({
  __esModule: true,
  default: { generateFeaturePrint: (path: string) => mockGenerateFeaturePrint(path) },
}));
jest.mock('react-native-nitro-image', () => ({
  Images: { loadFromFileAsync: (path: string) => mockLoadFromFileAsync(path) },
}));

import { Platform } from 'react-native';

import { embedPhoto } from './embedPhoto';

const print = { data: [0.25, -1, 3.5], elementType: 'float', elementCount: 3 };

/** A loaded image whose `width`/`height` are the orientation-applied size, as UIImage reports them. */
const loadedImage = (width: number, height: number) => ({ width, height, resizeAsync: mockResizeAsync });

describe('embedPhoto', () => {
  beforeEach(() => {
    mockGenerateFeaturePrint.mockReset();
    mockLoadFromFileAsync.mockReset().mockResolvedValue(loadedImage(3024, 4032));
    mockResizeAsync.mockReset().mockResolvedValue({
      saveToTemporaryFileAsync: jest.fn().mockResolvedValue('/tmp/upright.jpg'),
    });
    jest.replaceProperty(Platform, 'OS', 'ios');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each(['file:///var/mobile/photo.jpg', '/var/mobile/photo.jpg'])(
    'embeds the upright copy of %s and returns a shape-based model id',
    async (uri) => {
      mockGenerateFeaturePrint.mockResolvedValue(print);

      await expect(embedPhoto(uri)).resolves.toEqual({
        vector: [0.25, -1, 3.5],
        modelId: 'apple-vision-feature-print:float:3',
      });
      expect(mockLoadFromFileAsync).toHaveBeenCalledWith('/var/mobile/photo.jpg');
      expect(mockGenerateFeaturePrint).toHaveBeenCalledWith('file:///tmp/upright.jpg');
    },
  );

  it.each([
    [3024, 4032, 768, 1024],
    [4032, 3024, 1024, 768],
    [800, 600, 800, 600],
  ])('redraws a %i×%i photo at %i×%i', async (width, height, outWidth, outHeight) => {
    mockLoadFromFileAsync.mockResolvedValue(loadedImage(width, height));
    mockGenerateFeaturePrint.mockResolvedValue(print);

    await embedPhoto('file:///var/mobile/photo.jpg');

    expect(mockResizeAsync).toHaveBeenCalledWith(outWidth, outHeight);
  });

  it('loads the trimmed URI', async () => {
    mockGenerateFeaturePrint.mockResolvedValue(print);

    await embedPhoto('  file:///var/mobile/photo.jpg\n');

    expect(mockLoadFromFileAsync).toHaveBeenCalledWith('/var/mobile/photo.jpg');
  });

  it.each(['android', 'web'] as const)('rejects on %s without calling Vision', async (os) => {
    jest.replaceProperty(Platform, 'OS', os);

    await expect(embedPhoto('file:///photo.jpg')).rejects.toThrow(/requires iOS/);
    expect(mockLoadFromFileAsync).not.toHaveBeenCalled();
    expect(mockGenerateFeaturePrint).not.toHaveBeenCalled();
  });

  it('rejects instead of returning an empty vector when Vision returns no print', async () => {
    mockGenerateFeaturePrint.mockResolvedValue(null);

    await expect(embedPhoto('file:///photo.jpg')).rejects.toThrow(/no feature print/);
  });

  it.each(['', '   '])('rejects an empty URI (%j) without calling Vision', async (uri) => {
    await expect(embedPhoto(uri)).rejects.toThrow(/requires a photo URI/);
    expect(mockGenerateFeaturePrint).not.toHaveBeenCalled();
  });

  it('imports and rejects with the iOS error on Android even when the package throws on load', async () => {
    // Jest serves a cached mock before a doMock factory, and react-native's Platform getter and
    // embedPhoto's package require both resolve at call time, so reset and run the call isolated.
    jest.resetModules();
    await jest.isolateModulesAsync(async () => {
      jest.doMock('@insidepics/expo-apple-intelligence', () => {
        throw new Error("Cannot find native module 'ExpoAppleIntelligence'");
      });
      expect(() => require('@insidepics/expo-apple-intelligence')).toThrow(/native module/);
      jest.replaceProperty(require('react-native').Platform, 'OS', 'android');

      const { embedPhoto: isolatedEmbedPhoto } = require('./embedPhoto');

      await expect(isolatedEmbedPhoto('file:///photo.jpg')).rejects.toThrow(/requires iOS/);
    });
  });
});
