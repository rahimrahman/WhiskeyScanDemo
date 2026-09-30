import { Asset } from 'expo-asset';

/** The Metro asset id for a catalog-relative photo path in the bundled `image-map.js`, if it is bundled. */
export function bundledPhotoSource(imagePath: string): number | undefined {
  // A static import would break typecheck where the gitignored catalog has not been built (CI).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const images: Record<string, number> = require('../../../assets/catalog/image-map.js');
  return images[imagePath];
}

/** A local file URI for a catalog-relative photo path in the bundled `image-map.js`. */
export async function bundledPhotoUri(imagePath: string): Promise<string> {
  const source = bundledPhotoSource(imagePath);
  if (source === undefined) throw new Error(`Catalog photo is not bundled: ${imagePath}`);
  const asset = await Asset.fromModule(source).downloadAsync();
  return asset.localUri ?? asset.uri;
}
