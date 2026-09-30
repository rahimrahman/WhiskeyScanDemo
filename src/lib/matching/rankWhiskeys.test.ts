import type { PhotoVector } from '@/lib/db/database';

import { matchConfig } from './config';
import { rankWhiskeys } from './rankWhiskeys';

/** Not unit length, so every test also proves the scan is normalized. */
const SCAN = [2, 0];

/** A stored unit vector whose dot product with the normalized scan is `similarity`. */
const photo = (bottleId: string, similarity: number, imagePath = `photos/${bottleId}/1.jpg`): PhotoVector => ({
  bottleId,
  imagePath,
  vector: Float32Array.of(similarity, Math.sqrt(1 - similarity ** 2)),
});

describe('matchConfig', () => {
  it('starts at 70% similarity and an 8 point lead', () => {
    expect(matchConfig).toEqual({ minSimilarity: 70, minMargin: 8 });
  });
});

describe('rankWhiskeys', () => {
  it('is confident when the best whiskey clears the score and leads by the margin', () => {
    const { scores, confident } = rankWhiskeys(SCAN, [photo('2', 0.6), photo('1', 0.82)]);

    expect(confident).toBe(true);
    expect(scores).toEqual([
      { bottleId: '1', imagePath: 'photos/1/1.jpg', score: 82 },
      { bottleId: '2', imagePath: 'photos/2/1.jpg', score: 60 },
    ]);
  });

  it('is not confident when the best score is low', () => {
    const { scores, confident } = rankWhiskeys(SCAN, [photo('1', 0.4)]);

    expect(confident).toBe(false);
    expect(scores).toEqual([{ bottleId: '1', imagePath: 'photos/1/1.jpg', score: 40 }]);
  });

  it('is not confident when the runner-up is within the margin', () => {
    const { scores, confident } = rankWhiskeys(SCAN, [photo('1', 0.8), photo('2', 0.74)]);

    expect(confident).toBe(false);
    expect(scores.map(({ score }) => score)).toEqual([80, 74]);
  });

  it('is confident at exactly the thresholds', () => {
    expect(rankWhiskeys(SCAN, [photo('1', 0.7), photo('2', 0.62)]).confident).toBe(true);
  });

  it('is confident with a single whiskey above the score, since no runner-up passes the margin', () => {
    expect(rankWhiskeys(SCAN, [photo('1', 0.9)])).toEqual({
      scores: [{ bottleId: '1', imagePath: 'photos/1/1.jpg', score: 90 }],
      confident: true,
    });
  });

  it('passes the margin for a single whiskey even when the margin exceeds its score', () => {
    expect(rankWhiskeys(SCAN, [photo('1', 0.9)], { minSimilarity: 70, minMargin: 95 }).confident).toBe(true);
  });

  it("keeps each whiskey's best photo", () => {
    const { scores, confident } = rankWhiskeys(SCAN, [
      photo('1', 0.4, 'photos/1/back.jpg'),
      photo('2', 0.8),
      photo('1', 0.91, 'photos/1/front.jpg'),
    ]);

    expect(confident).toBe(true);
    expect(scores).toEqual([
      { bottleId: '1', imagePath: 'photos/1/front.jpg', score: 91 },
      { bottleId: '2', imagePath: 'photos/2/1.jpg', score: 80 },
    ]);
  });

  it('puts the lower bottle id first on a tie', () => {
    const { scores, confident } = rankWhiskeys(SCAN, [photo('10', 0.85), photo('9', 0.85), photo('2', 0.5)]);

    expect(scores.map(({ bottleId }) => bottleId)).toEqual(['9', '10', '2']);
    expect(confident).toBe(false);
  });

  it('scores a vector pointing away from the scan as 0', () => {
    const away: PhotoVector = { bottleId: '1', imagePath: 'photos/1/1.jpg', vector: Float32Array.of(-1, 0) };

    expect(rankWhiskeys(SCAN, [away]).scores[0].score).toBe(0);
  });

  it.each([
    ['no stored vectors', SCAN, []],
    ['a zero scan vector', [0, 0], [photo('1', 0.9)]],
    ['an empty scan vector', [], [photo('1', 0.9)]],
  ])('matches nothing with %s', (_, scan, photos) => {
    expect(rankWhiskeys(scan, photos)).toEqual({ scores: [], confident: false });
  });

  it('skips stored vectors of another length', () => {
    const other: PhotoVector = { bottleId: '2', imagePath: 'photos/2/1.jpg', vector: Float32Array.of(1, 0, 0) };

    expect(rankWhiskeys(SCAN, [other, photo('1', 0.75)]).scores.map(({ bottleId }) => bottleId)).toEqual(['1']);
  });

  it('applies a tuned config', () => {
    const photos = [photo('1', 0.82), photo('2', 0.6)];

    expect(rankWhiskeys(SCAN, photos, { minSimilarity: 85, minMargin: 8 }).confident).toBe(false);
    expect(rankWhiskeys(SCAN, photos, { minSimilarity: 70, minMargin: 25 }).confident).toBe(false);
  });
});
