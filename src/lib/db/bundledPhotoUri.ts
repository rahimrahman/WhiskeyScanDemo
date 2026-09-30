import { Asset } from 'expo-asset';

/** A local file URI for a catalog-relative photo path in the bundled `image-map.js`. */
export async function bundledPhotoUri(imagePath: string): Promise<string> {
  // A static import would break typecheck where the gitignored catalog has not been built (CI).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const images: Record<string, number> = require('../../../assets/catalog/image-map.js');
  const source = images[imagePath];
  if (source === undefined) throw new Error(`Catalog photo is not bundled: ${imagePath}`);
  const asset = await Asset.fromModule(source).downloadAsync();
  return asset.localUri ?? asset.uri;
}
