import type { Catalog, CatalogWhiskey } from './catalog';

/** `imageSource` is the Metro asset id for `image`, absent when the photo is not bundled. */
export type BundledWhiskey = CatalogWhiskey & { imageSource?: number };

/** Reads the gitignored catalog written by `npm run catalog`. */
export function loadBundledCatalog(): BundledWhiskey[] {
  const catalog: Catalog = require('../../../assets/catalog/catalog.json');
  // A static import would break typecheck where the gitignored catalog has not been built (CI).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const images: Record<string, number> = require('../../../assets/catalog/image-map.js');
  return catalog.whiskeys.map((whiskey) => ({ ...whiskey, imageSource: images[whiskey.image] }));
}
