import { useEffect, useState } from 'react';

import { type BundledWhiskey, loadBundledCatalog } from '@/lib/catalog/loadBundledCatalog';
import { bundledPhotoSource, bundledPhotoUri } from '@/lib/db/bundledPhotoUri';
import { type CatalogStore, openCatalogStore } from '@/lib/db/database';
import { reseedIfModelChanged } from '@/lib/db/seedCatalog';
import { embedPhoto, embedUprightPhoto, type PhotoEmbedding, uprightCopy } from '@/lib/embedding/embedPhoto';
import { readLabelText } from '@/lib/embedding/readLabelText';
import { closeSpellings, labelQuery, labelTokens, matchedWords } from '@/lib/matching/labelText';
import { rankWhiskeys } from '@/lib/matching/rankWhiskeys';

/** `score` is the similarity, 0–100; `cardImage` is the catalog card image asset id. */
export type MatchCandidate = { bottleId: string; name: string; category: string; score: number; cardImage?: number };

/** `words` are the label words found in that whiskey's name, producer, expression or age, in label order. */
export type LabelHit = {
  bottleId: string;
  name: string;
  words: string[];
  category: string;
  cardImage?: number;
};

/** What the label read found. Combined with the image ranking for the cards; the evidence section still shows it on its own. */
export type LabelEvidence = {
  /** The best OCR reading of each text observation; empty when no label text was read. */
  lines: string[];
  /** At most 3 catalog whiskeys ranked by label words, best first. */
  hits: LabelHit[];
};

export type BottleMatch = {
  confident: boolean;
  /** Every whiskey that scored, best first; empty when nothing could be matched. */
  candidates: MatchCandidate[];
  /** Asset id of the catalog photo that scored best for the top whiskey. */
  winningPhoto?: number;
  elapsedMs: number;
  /** Absent when the scan could not be embedded. */
  modelId?: string;
  label: LabelEvidence;
};

export type BottleMatchDeps = {
  upright: (photoUri: string) => Promise<string>;
  embedUpright: (uprightUri: string) => Promise<PhotoEmbedding>;
  /** Never rejects; empty when no text was read. */
  readLabel: (uprightUri: string) => Promise<string[]>;
  /** Embeds catalog photos when a reseed is needed. */
  embed: (photoUri: string) => Promise<PhotoEmbedding>;
  openStore: () => Promise<CatalogStore>;
  resolveUri: (imagePath: string) => Promise<string>;
  loadCatalog: () => BundledWhiskey[];
  photoSource: (imagePath: string) => number | undefined;
};

const appDeps: BottleMatchDeps = {
  upright: uprightCopy,
  embedUpright: embedUprightPhoto,
  readLabel: readLabelText,
  embed: embedPhoto,
  openStore: openCatalogStore,
  resolveUri: bundledPhotoUri,
  loadCatalog: loadBundledCatalog,
  photoSource: bundledPhotoSource,
};

type ImageMatch = Omit<BottleMatch, 'elapsedMs' | 'label'>;

const catalogById = (deps: BottleMatchDeps) => new Map(deps.loadCatalog().map((whiskey) => [whiskey.id, whiskey]));

/** Never rejects: any failure is an image match with no candidates. */
async function matchImage(uprightUri: string, deps: BottleMatchDeps): Promise<ImageMatch> {
  let modelId: string | undefined;
  try {
    const scan = await deps.embedUpright(uprightUri);
    modelId = scan.modelId;
    const store = await deps.openStore();
    await reseedIfModelChanged({ store, embed: deps.embed, resolveUri: deps.resolveUri }, modelId);
    // A reseed that ended on another model id leaves nothing this scan may be scored against.
    const photos = (await store.getModelId()) === modelId ? await store.loadPhotoVectors() : [];
    const whiskeys = catalogById(deps);
    const { scores, confident } = rankWhiskeys(
      scan.vector,
      photos.filter(({ bottleId }) => whiskeys.has(bottleId)),
    );
    const candidates = scores.map(({ bottleId, score }) => {
      const { name, category, imageSource } = whiskeys.get(bottleId)!;
      return { bottleId, name, category, score, cardImage: imageSource };
    });
    const winningPhoto = scores.length > 0 ? deps.photoSource(scores[0].imagePath) : undefined;
    return { confident, candidates, winningPhoto, modelId };
  } catch {
    return { confident: false, candidates: [], modelId };
  }
}

/** Never rejects: a failed search keeps the lines with no hits. */
async function matchLabel(lines: string[], deps: BottleMatchDeps): Promise<LabelEvidence> {
  const whiskeys = catalogById(deps);
  const fields = [...whiskeys.values()].flatMap(({ name, producer, expression, age }) => [name, producer, expression, age]);
  const tokens = closeSpellings(labelTokens(lines), fields);
  if (tokens.length === 0) return { lines, hits: [] };
  try {
    const store = await deps.openStore();
    const bottleIds = await store.searchLabels(labelQuery(tokens));
    const hits = bottleIds.flatMap((bottleId) => {
      const whiskey = whiskeys.get(bottleId);
      if (!whiskey) return [];
      const { name, producer, expression, age, category, imageSource } = whiskey;
      return [{ bottleId, name, category, cardImage: imageSource, words: matchedWords(tokens, [name, producer, expression, age]) }];
    });
    return { lines, hits };
  } catch {
    return { lines, hits: [] };
  }
}

/** Never rejects: the image match and the label read fail independently, keeping the elapsed time. */
async function matchBottle(photoUri: string, deps: BottleMatchDeps): Promise<BottleMatch> {
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);
  let uprightUri: string;
  try {
    uprightUri = await deps.upright(photoUri);
  } catch {
    return { confident: false, candidates: [], elapsedMs: elapsed(), label: { lines: [], hits: [] } };
  }
  const [image, lines] = await Promise.all([matchImage(uprightUri, deps), deps.readLabel(uprightUri)]);
  const label = await matchLabel(lines, deps);
  return { ...image, elapsedMs: elapsed(), label };
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
