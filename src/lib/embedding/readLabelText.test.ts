const mockRecognizeText = jest.fn();

jest.mock('@insidepics/expo-apple-intelligence', () => ({
  __esModule: true,
  default: { recognizeText: (path: string) => mockRecognizeText(path) },
}));

import { Platform } from 'react-native';

import { readLabelText } from './readLabelText';

const observation = (...candidates: string[]) => ({
  boundingBox: { x: 0, y: 0, width: 1, height: 1 },
  confidence: 0.9,
  candidates: candidates.map((string, index) => ({ string, confidence: 0.9 - index / 10 })),
});

describe('readLabelText', () => {
  beforeEach(() => {
    mockRecognizeText.mockReset();
    jest.replaceProperty(Platform, 'OS', 'ios');
  });

  afterEach(() => jest.restoreAllMocks());

  it('reads the best candidate of each observation from the upright URI, ignoring the others', async () => {
    mockRecognizeText.mockResolvedValue([
      observation(" Maker's Mark ", "Maker's Mork", 'Makers Mark'),
      observation('Kentucky Straight Bourbon Whisky', 'Kentucky Straight Bourbon Whiskey'),
    ]);

    await expect(readLabelText('file:///tmp/upright.jpg')).resolves.toEqual([
      "Maker's Mark",
      'Kentucky Straight Bourbon Whisky',
    ]);
    expect(mockRecognizeText).toHaveBeenCalledWith('file:///tmp/upright.jpg');
  });

  it.each([
    ['no observations', []],
    ['only empty candidates', [observation(), observation('  ', 'Eagle Rare')]],
  ])('reads nothing from %s', async (_, observations) => {
    mockRecognizeText.mockResolvedValue(observations);

    await expect(readLabelText('file:///tmp/upright.jpg')).resolves.toEqual([]);
  });

  it('reads nothing instead of rejecting when Vision fails', async () => {
    mockRecognizeText.mockRejectedValue(new Error('Vision failed'));

    await expect(readLabelText('file:///tmp/upright.jpg')).resolves.toEqual([]);
  });

  it('reads nothing on Android without loading the native module', async () => {
    jest.resetModules();
    await jest.isolateModulesAsync(async () => {
      const load = jest.fn(() => {
        throw new Error("Cannot find native module 'ExpoAppleIntelligence'");
      });
      jest.doMock('@insidepics/expo-apple-intelligence', load);
      jest.replaceProperty(require('react-native').Platform, 'OS', 'android');

      const { readLabelText: isolatedReadLabelText } = require('./readLabelText');

      await expect(isolatedReadLabelText('file:///tmp/upright.jpg')).resolves.toEqual([]);
      expect(load).not.toHaveBeenCalled();
    });
  });
});
