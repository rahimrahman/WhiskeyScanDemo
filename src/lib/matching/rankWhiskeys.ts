import type { PhotoVector } from '@/lib/db/database';
import { normalizeVector } from '@/lib/db/vectors';

import { matchConfig, type MatchConfig } from './config';

/** A whiskey's best photo and its similarity, 0–100. */
export type WhiskeyScore = { bottleId: string; imagePath: string; score: number };

/** `scores` holds one entry per whiskey, best first. */
export type Ranking = { scores: WhiskeyScore[]; confident: boolean };

const NO_MATCH: Ranking = { scores: [], confident: false };

const byBottleId = (a: WhiskeyScore, b: WhiskeyScore) => a.bottleId.localeCompare(b.bottleId, 'en', { numeric: true });

function dot(a: readonly number[], b: ArrayLike<number>): number {
  let sum = 0;
  for (let index = 0; index < a.length; index++) sum += a[index] * b[index];
  return sum;
}

function unitOrNull(vector: readonly number[]): number[] | null {
  try {
    return normalizeVector(vector);
  } catch {
    return null;
  }
}

/**
 * Scores each stored photo against the scan, keeps each whiskey's best photo, and applies the confidence gate.
 * Stored vectors are used as saved; a zero or empty scan vector matches nothing.
 */
export function rankWhiskeys(
  scanVector: readonly number[],
  photos: readonly PhotoVector[],
  { minSimilarity, minMargin }: MatchConfig = matchConfig,
): Ranking {
  const scan = unitOrNull(scanVector);
  if (!scan) return NO_MATCH;

  const best = new Map<string, WhiskeyScore>();
  for (const { bottleId, imagePath, vector } of photos) {
    // A vector of another length came from another model and must not be scored.
    if (vector.length !== scan.length) continue;
    const score = Math.round(Math.max(0, dot(scan, vector)) * 100);
    if (score > (best.get(bottleId)?.score ?? -1)) best.set(bottleId, { bottleId, imagePath, score });
  }

  const scores = [...best.values()].sort((a, b) => b.score - a.score || byBottleId(a, b));
  const [top, runnerUp] = scores;
  const confident = !!top && top.score >= minSimilarity && (!runnerUp || top.score - runnerUp.score >= minMargin);
  return { scores, confident };
}
