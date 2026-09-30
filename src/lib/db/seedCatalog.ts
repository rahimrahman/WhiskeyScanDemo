import type { CatalogWhiskey } from '@/lib/catalog/catalog';
import type { PhotoEmbedding } from '@/lib/embedding/embedPhoto';

import type { CatalogBottle, CatalogPhoto, CatalogStore } from './database';
import { encodeVector } from './vectors';

export type SeedDeps = {
  store: CatalogStore;
  /** Absent where photos cannot be embedded (off iOS): rows are still saved, with no vectors. */
  embed?: (photoUri: string) => Promise<PhotoEmbedding>;
  /** A local file URI for a catalog-relative photo path. */
  resolveUri: (imagePath: string) => Promise<string>;
};

type StoredEmbedding = { modelId: string; bytes: Uint8Array };

let queue: Promise<void> = Promise.resolve();

/** One seed at a time, so the launch seed and a reseed never embed the same photo twice. */
function exclusive(task: () => Promise<void>): Promise<void> {
  const run = queue.then(task);
  queue = run.catch(() => {});
  return run;
}

const toBottle = ({ id, name, producer, expression, category, age, note, image }: CatalogWhiskey): CatalogBottle => ({
  id,
  name,
  producer,
  expression,
  category,
  age,
  note,
  imagePath: image,
});

const toPhotos = ({ id, photos }: CatalogWhiskey): CatalogPhoto[] =>
  photos.map((imagePath) => ({ bottleId: id, imagePath }));

/** A failed embed or an unusable vector yields null; that photo stays missing until the next run. */
async function tryEmbed(
  photo: CatalogPhoto,
  embed: NonNullable<SeedDeps['embed']>,
  resolveUri: SeedDeps['resolveUri'],
): Promise<StoredEmbedding | null> {
  try {
    const { vector, modelId } = await embed(await resolveUri(photo.imagePath));
    return { modelId, bytes: encodeVector(vector) };
  } catch {
    return null;
  }
}

/** Embeds each photo without a vector; an embed from a model other than `model_id` clears every vector and starts over. */
async function embedMissingPhotos({ store, embed, resolveUri }: SeedDeps): Promise<void> {
  if (!embed) return;
  let modelId = await store.getModelId();
  let replaced = false;
  const failed = new Set<string>();
  const pending = await store.photosMissingEmbedding();
  while (pending.length > 0) {
    const photo = pending.shift()!;
    const embedding = await tryEmbed(photo, embed, resolveUri);
    if (!embedding) {
      failed.add(photo.imagePath);
      continue;
    }
    if (embedding.modelId !== modelId) {
      // A second model id in one run would restart forever; leave that photo for the next run.
      if (replaced) continue;
      replaced = true;
      modelId = embedding.modelId;
      await store.resetEmbeddings(modelId);
      await store.saveEmbedding(photo.imagePath, embedding.bytes);
      const missing = await store.photosMissingEmbedding();
      pending.splice(0, pending.length, ...missing.filter(({ imagePath }) => !failed.has(imagePath)));
      continue;
    }
    await store.saveEmbedding(photo.imagePath, embedding.bytes);
  }
}

/** Stores the bundled catalog and embeds only photos that have no vector yet; a finished catalog embeds nothing. */
export function seedCatalog(deps: SeedDeps, whiskeys: CatalogWhiskey[]): Promise<void> {
  return exclusive(async () => {
    await deps.store.syncCatalog(whiskeys.map(toBottle), whiskeys.flatMap(toPhotos));
    await embedMissingPhotos(deps);
  });
}

/** For a model id learned from a scan embed: replaces every stored vector when it differs from `model_id`. */
export function reseedIfModelChanged(deps: SeedDeps, modelId: string): Promise<void> {
  return exclusive(async () => {
    if ((await deps.store.getModelId()) === modelId) return;
    await deps.store.resetEmbeddings(modelId);
    await embedMissingPhotos(deps);
  });
}
