import { useEffect } from 'react';
import { Platform } from 'react-native';

import { loadBundledCatalog } from '@/lib/catalog/loadBundledCatalog';
import { bundledPhotoUri } from '@/lib/db/bundledPhotoUri';
import { openCatalogStore } from '@/lib/db/database';
import { seedCatalog } from '@/lib/db/seedCatalog';
import { embedPhoto } from '@/lib/embedding/embedPhoto';

/**
 * Seeds the vector catalog in the background once `ready`, showing nothing.
 * Failures are silent: photos left without a vector are embedded on the next launch.
 */
export function useCatalogSeed(ready: boolean): void {
  useEffect(() => {
    if (!ready) return;
    const embed = Platform.OS === 'ios' ? embedPhoto : undefined;
    openCatalogStore()
      .then((store) => seedCatalog({ store, embed, resolveUri: bundledPhotoUri }, loadBundledCatalog()))
      .catch(() => {});
  }, [ready]);
}
