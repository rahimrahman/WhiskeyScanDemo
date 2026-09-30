import { useEffect, useState } from 'react';

import { type BundledWhiskey, loadBundledCatalog } from '@/lib/catalog/loadBundledCatalog';
import { bundledPhotoSource, bundledPhotoUri } from '@/lib/db/bundledPhotoUri';
import { type CatalogStore, openCatalogStore } from '@/lib/db/database';
import { reseedIfModelChanged } from '@/lib/db/seedCatalog';
import { embedPhoto, type PhotoEmbedding } from '@/lib/embedding/embedPhoto';
import { rankWhiskeys } from '@/lib/matching/rankWhiskeys';

/** `score` is the similarity, 0–100; `cardImage` is the catalog card image asset id. */
export type MatchCandidate = { bottleId: string; name: string; category: string; score: number; cardImage?: number };

export type BottleMatch = {
  confident: boolean;
  /** Every whiskey that scored, best first; empty when nothing could be matched. */
  candidates: MatchCandidate[];
  /** Asset id of the catalog photo that scored best for the top whiskey. */
  winningPhoto?: number;
  elapsedMs: number;
  /** Absent when the scan could not be embedded. */
  modelId?: string;
};

export type BottleMatchDeps = {
  embed: (photoUri: string) => Promise<PhotoEmbedding>;
  openStore: () => Promise<CatalogStore>;
  resolveUri: (imagePath: string) => Promise<string>;
  loadCatalog: () => BundledWhiskey[];
  photoSource: (imagePath: string) => number | undefined;
};

const appDeps: BottleMatchDeps = {
  embed: embedPhoto,
  openStore: openCatalogStore,
  resolveUri: bundledPhotoUri,
  loadCatalog: loadBundledCatalog,
  photoSource: bundledPhotoSource,
};

/** Never rejects: any failure is a match with no candidates, keeping the elapsed time. */
async function matchBottle(photoUri: string, deps: BottleMatchDeps): Promise<BottleMatch> {
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);
  let modelId: string | undefined;
  try {
    const scan = await deps.embed(photoUri);
    modelId = scan.modelId;
    const store = await deps.openStore();
    await reseedIfModelChanged({ store, embed: deps.embed, resolveUri: deps.resolveUri }, modelId);
    // A reseed that ended on another model id leaves nothing this scan may be scored against.
    const photos = (await store.getModelId()) === modelId ? await store.loadPhotoVectors() : [];
    const whiskeys = new Map(deps.loadCatalog().map((whiskey) => [whiskey.id, whiskey]));
    const { scores, confident } = rankWhiskeys(
      scan.vector,
      photos.filter(({ bottleId }) => whiskeys.has(bottleId)),
    );
    const candidates = scores.map(({ bottleId, score }) => {
      const { name, category, imageSource } = whiskeys.get(bottleId)!;
      return { bottleId, name, category, score, cardImage: imageSource };
    });
    const winningPhoto = scores.length > 0 ? deps.photoSource(scores[0].imagePath) : undefined;
    return { confident, candidates, winningPhoto, elapsedMs: elapsed(), modelId };
  } catch {
    return { confident: false, candidates: [], elapsedMs: elapsed(), modelId };
  }
}

/** Matches the scanned photo against the stored catalog vectors; null while matching or without a photo. */
export function useBottleMatch(photoUri: string | undefined, deps: BottleMatchDeps = appDeps): BottleMatch | null {
  const [result, setResult] = useState<{ photoUri: string; match: BottleMatch } | null>(null);

  useEffect(() => {
    if (!photoUri) return;
    let current = true;
    void matchBottle(photoUri, deps).then((match) => {
      if (current) setResult({ photoUri, match });
    });
    return () => {
      current = false;
    };
  }, [photoUri, deps]);

  // Keyed by URI so a new photo never shows the previous verdict.
  return photoUri && result?.photoUri === photoUri ? result.match : null;
}
