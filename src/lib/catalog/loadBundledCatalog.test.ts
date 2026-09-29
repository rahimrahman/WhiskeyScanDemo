jest.mock(
  '../../../assets/catalog/catalog.json',
  () => ({
    whiskeys: [
      { id: '1', name: 'Mapped', image: 'photos/1/1-front.jpg', photos: ['photos/1/1-front.jpg'] },
      { id: '2', name: 'Unmapped', image: 'photos/2/1-front.jpg', photos: ['photos/2/1-front.jpg'] },
    ],
  }),
  { virtual: true },
);
jest.mock('../../../assets/catalog/image-map.js', () => ({ 'photos/1/1-front.jpg': 101 }), {
  virtual: true,
});

import { loadBundledCatalog } from './loadBundledCatalog';

describe('loadBundledCatalog', () => {
  it('attaches the mapped asset id as imageSource, or undefined when the image is not mapped', () => {
    const [mapped, unmapped] = loadBundledCatalog();

    expect(mapped).toMatchObject({ id: '1', name: 'Mapped', imageSource: 101 });
    expect(unmapped.id).toBe('2');
    expect(unmapped.imageSource).toBeUndefined();
  });
});
