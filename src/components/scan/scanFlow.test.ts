import { canUseCamera, navigationFor, pickedUri, sheetChoice, toImageUri } from '@/components/scan/scanFlow';

describe('sheetChoice', () => {
  it('maps Take Photo and Upload Picture, and cancels on anything else', () => {
    expect(sheetChoice(0)).toBe('camera');
    expect(sheetChoice(1)).toBe('library');
    expect(sheetChoice(2)).toBe('cancel');
    expect(sheetChoice(-1)).toBe('cancel');
  });
});

describe('canUseCamera', () => {
  it('opens without asking when already authorized', async () => {
    const request = jest.fn();

    await expect(canUseCamera('authorized', request)).resolves.toBe(true);
    expect(request).not.toHaveBeenCalled();
  });

  it('asks when undecided and follows the answer', async () => {
    await expect(canUseCamera('not-determined', () => Promise.resolve(true))).resolves.toBe(true);
    await expect(canUseCamera('not-determined', () => Promise.resolve(false))).resolves.toBe(false);
  });

  it.each(['denied', 'restricted'] as const)('stays closed without asking when %s', async (status) => {
    const request = jest.fn();

    await expect(canUseCamera(status, request)).resolves.toBe(false);
    expect(request).not.toHaveBeenCalled();
  });
});

describe('toImageUri', () => {
  it('prefixes a bare path with file://', () => {
    expect(toImageUri('/tmp/a.jpg')).toBe('file:///tmp/a.jpg');
  });

  it('keeps a URI that already has a scheme', () => {
    expect(toImageUri('file:///tmp/a.jpg')).toBe('file:///tmp/a.jpg');
    expect(toImageUri('content://media/1')).toBe('content://media/1');
  });
});

describe('pickedUri', () => {
  it('returns the first asset URI', () => {
    expect(pickedUri({ canceled: false, assets: [{ uri: 'file:///a.jpg' }, { uri: 'file:///b.jpg' }] })).toBe(
      'file:///a.jpg',
    );
  });

  it('returns null when canceled or empty', () => {
    expect(pickedUri({ canceled: true, assets: null })).toBeNull();
    expect(pickedUri({ canceled: false, assets: [] })).toBeNull();
    expect(pickedUri({ canceled: false, assets: null })).toBeNull();
    expect(pickedUri({ canceled: false, assets: [{ uri: '' }] })).toBeNull();
  });
});

describe('navigationFor', () => {
  it('pushes from Search and replaces from Scan Bottle', () => {
    expect(navigationFor('search')).toBe('push');
    expect(navigationFor('scan')).toBe('replace');
  });
});
