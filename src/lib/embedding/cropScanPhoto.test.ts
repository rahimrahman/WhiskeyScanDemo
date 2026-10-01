const mockUprightCopy = jest.fn();
const mockDetectSaliency = jest.fn();
const mockDetectRectangles = jest.fn();
const mockLoadFromFileAsync = jest.fn();

jest.mock('./embedPhoto', () => ({ uprightCopy: (uri: string) => mockUprightCopy(uri) }));
jest.mock('@insidepics/expo-apple-intelligence', () => ({
  __esModule: true,
  default: {
    detectSaliency: (path: string) => mockDetectSaliency(path),
    detectRectangles: (path: string) => mockDetectRectangles(path),
  },
}));
jest.mock('react-native-nitro-image', () => ({
  Images: { loadFromFileAsync: (path: string) => mockLoadFromFileAsync(path) },
}));

import { Platform } from 'react-native';

import { bottleBox, cropPixels, cropScanPhoto, labelRectangle, uprightTurn } from './cropScanPhoto';

const box = { x: 0.1, y: 0.2, width: 0.5, height: 0.4 };

const loaded = (cropAsync = jest.fn()) => ({
  width: 1000,
  height: 2000,
  cropAsync,
});

describe('bottleBox', () => {
  it('uses the objectness region Vision is most sure about', () => {
    expect(
      bottleBox({
        objectnessRegions: [
          { boundingBox: { x: 0, y: 0, width: 0.2, height: 0.2 }, confidence: 0.4 },
          { boundingBox: box, confidence: 0.9 },
        ],
        attentionRegions: [{ boundingBox: { x: 0.5, y: 0.5, width: 0.2, height: 0.2 }, confidence: 0.99 }],
      }),
    ).toEqual(box);
  });

  it('uses attention when no object was found', () => {
    expect(
      bottleBox({
        objectnessRegions: [],
        attentionRegions: [{ boundingBox: box, confidence: 0.7 }],
      }),
    ).toEqual(box);
  });

  it('returns nothing when Vision found no region', () => {
    expect(bottleBox(null)).toBeNull();
    expect(bottleBox({ objectnessRegions: [], attentionRegions: [] })).toBeNull();
  });
});

const corners = (topX: number, topY: number, bottomX: number, bottomY: number) => ({
  topLeft: { x: topX - 0.1, y: topY },
  topRight: { x: topX + 0.1, y: topY },
  bottomLeft: { x: bottomX - 0.1, y: bottomY },
  bottomRight: { x: bottomX + 0.1, y: bottomY },
  boundingBox: box,
  confidence: 0.8,
});

describe('uprightTurn', () => {
  it('levels a label whose top leans right, without flipping it', () => {
    const turn = uprightTurn(corners(0.6, 0.8, 0.5, 0.2));

    expect(turn).toBeCloseTo((-Math.atan2(0.1, 0.6) * 180) / Math.PI);
    expect(turn).toBeLessThan(0);
  });

  it('leaves an upright label alone', () => {
    expect(uprightTurn(corners(0.5, 0.8, 0.5, 0.2))).toBeNull();
    expect(uprightTurn(null)).toBeNull();
  });

  it('does not lay the bottle on its side when the rectangle top is a side edge', () => {
    expect(uprightTurn(corners(0.8, 0.55, 0.2, 0.45))).toBeNull();
  });
});

describe('labelRectangle', () => {
  it('picks the rectangle that covers the most of the photo', () => {
    const small = { ...corners(0.5, 0.8, 0.5, 0.2), confidence: 0.9, boundingBox: { x: 0, y: 0, width: 0.2, height: 0.2 } };
    const large = { ...corners(0.5, 0.8, 0.5, 0.2), confidence: 0.5, boundingBox: { x: 0, y: 0, width: 0.6, height: 0.8 } };

    expect(labelRectangle([small, large])).toBe(large);
    expect(labelRectangle([])).toBeNull();
  });
});

describe('cropPixels', () => {
  it('turns a bottom-left Vision box into a padded top-left crop', () => {
    expect(cropPixels(box, 1000, 2000)).toEqual({ startX: 60, startY: 736, endX: 640, endY: 1664 });
  });

  it('rejects a tiny or unusable box', () => {
    expect(cropPixels({ x: 0.5, y: 0.5, width: 0.01, height: 0.4 }, 1000, 2000)).toBeNull();
    expect(cropPixels({ ...box, width: Number.NaN }, 1000, 2000)).toBeNull();
  });
});

describe('cropScanPhoto', () => {
  beforeEach(() => {
    mockUprightCopy.mockReset().mockResolvedValue('file:///tmp/upright.jpg');
    mockDetectSaliency.mockReset();
    mockDetectRectangles.mockReset().mockResolvedValue([]);
    mockLoadFromFileAsync.mockReset();
    jest.replaceProperty(Platform, 'OS', 'ios');
  });

  afterEach(() => jest.restoreAllMocks());

  it('crops the upright photo to the bottle', async () => {
    const cropAsync = jest.fn().mockResolvedValue({
      saveToTemporaryFileAsync: jest.fn().mockResolvedValue('/tmp/bottle.jpg'),
    });
    mockDetectSaliency.mockResolvedValue({ objectnessRegions: [{ boundingBox: box, confidence: 0.8 }], attentionRegions: [] });
    mockLoadFromFileAsync.mockResolvedValue(loaded(cropAsync));

    await expect(cropScanPhoto('file:///tmp/scan.jpg')).resolves.toBe('file:///tmp/bottle.jpg');

    expect(mockDetectSaliency).toHaveBeenCalledWith('file:///tmp/upright.jpg');
    expect(mockLoadFromFileAsync).toHaveBeenCalledWith('/tmp/upright.jpg');
    expect(cropAsync).toHaveBeenCalledWith(60, 736, 640, 1664);
  });

  it('crops to the bottle, stands that crop upright, then crops again', async () => {
    const firstCrop = jest.fn().mockResolvedValue({
      saveToTemporaryFileAsync: jest.fn().mockResolvedValue('/tmp/cropped.jpg'),
    });
    const rotateAsync = jest.fn().mockResolvedValue({
      saveToTemporaryFileAsync: jest.fn().mockResolvedValue('/tmp/turned.jpg'),
    });
    const secondCrop = jest.fn().mockResolvedValue({
      saveToTemporaryFileAsync: jest.fn().mockResolvedValue('/tmp/bottle.jpg'),
    });
    mockDetectRectangles.mockResolvedValue([corners(0.6, 0.8, 0.5, 0.2)]);
    mockDetectSaliency.mockResolvedValue({
      objectnessRegions: [{ boundingBox: box, confidence: 0.8 }],
      attentionRegions: [],
    });
    mockLoadFromFileAsync
      .mockResolvedValueOnce(loaded(firstCrop))
      .mockResolvedValueOnce({ width: 1000, height: 2000, rotateAsync })
      .mockResolvedValueOnce(loaded(secondCrop));

    await expect(cropScanPhoto('file:///tmp/scan.jpg')).resolves.toBe('file:///tmp/bottle.jpg');

    expect(firstCrop).toHaveBeenCalledWith(60, 736, 640, 1664);
    expect(mockDetectRectangles).toHaveBeenCalledWith('file:///tmp/cropped.jpg');
    expect(rotateAsync).toHaveBeenCalledWith(expect.closeTo((-Math.atan2(0.1, 0.6) * 180) / Math.PI), false);
    expect(mockDetectSaliency).toHaveBeenLastCalledWith('file:///tmp/turned.jpg');
    expect(secondCrop).toHaveBeenCalledWith(60, 736, 640, 1664);
  });

  it('does not rotate when the label rectangle would lay the bottle on its side', async () => {
    const cropAsync = jest.fn().mockResolvedValue({
      saveToTemporaryFileAsync: jest.fn().mockResolvedValue('/tmp/bottle.jpg'),
    });
    const rotateAsync = jest.fn();
    mockDetectRectangles.mockResolvedValue([corners(0.8, 0.55, 0.2, 0.45)]);
    mockDetectSaliency.mockResolvedValue({
      objectnessRegions: [{ boundingBox: box, confidence: 0.8 }],
      attentionRegions: [],
    });
    mockLoadFromFileAsync.mockResolvedValue({ width: 1000, height: 2000, cropAsync, rotateAsync });

    await expect(cropScanPhoto('file:///tmp/scan.jpg')).resolves.toBe('file:///tmp/bottle.jpg');

    expect(rotateAsync).not.toHaveBeenCalled();
  });

  it('keeps the upright photo when no bottle is found', async () => {
    mockDetectSaliency.mockResolvedValue({ objectnessRegions: [], attentionRegions: [] });

    await expect(cropScanPhoto('/tmp/scan.jpg')).resolves.toBe('file:///tmp/upright.jpg');
    expect(mockLoadFromFileAsync).not.toHaveBeenCalled();
  });

  it('keeps the upright photo when saliency throws', async () => {
    mockDetectSaliency.mockRejectedValue(new Error('Vision failed'));

    await expect(cropScanPhoto('file:///tmp/scan.jpg')).resolves.toBe('file:///tmp/upright.jpg');
  });

  it('returns the original photo when it cannot be redrawn upright', async () => {
    mockUprightCopy.mockRejectedValue(new Error('unreadable'));

    await expect(cropScanPhoto('file:///tmp/scan.jpg')).resolves.toBe('file:///tmp/scan.jpg');
    expect(mockDetectSaliency).not.toHaveBeenCalled();
  });

  it('does not crop off iOS', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');

    await expect(cropScanPhoto('content://media/1')).resolves.toBe('content://media/1');
    expect(mockUprightCopy).not.toHaveBeenCalled();
  });
});
