import type { LabelHit, MatchCandidate } from '@/components/scan/useBottleMatch';
import { matchConfig } from '@/lib/matching/config';

const MAX_CARDS = 3;

export type ListedMatch = {
  bottleId: string;
  name: string;
  category: string;
  cardImage?: number;
  /** Absent when only the label found this whiskey. */
  score?: number;
};

/**
 * Cards are the image matches and the label matches together.
 * A label hit the image also found moves to the front: above 70 when the image match is already confident,
 * and at any score when it is not. A shared whiskey is named. "Not found" is only for no shared whiskey and no confident image.
 * A label-only whiskey is listed too, after the image matches that still fit.
 */
export function combineFindings(
  image: readonly MatchCandidate[],
  hits: readonly LabelHit[],
  imageConfident: boolean,
): { showName: boolean; confident: boolean; cards: ListedMatch[] } {
  const imageById = new Map(image.map((candidate) => [candidate.bottleId, candidate]));
  const agreed = hits.flatMap((hit) => {
    const found = imageById.get(hit.bottleId);
    return found ? [found] : [];
  });
  const promoted = imageConfident ? agreed.filter((candidate) => candidate.score >= matchConfig.minSimilarity) : agreed;
  const promotedIds = new Set(promoted.map((candidate) => candidate.bottleId));
  const textOnly: ListedMatch[] = hits
    .filter((hit) => !imageById.has(hit.bottleId))
    .map(({ bottleId, name, category, cardImage }) => ({ bottleId, name, category, cardImage }));
  const imageOnly = image.filter((candidate) => !promotedIds.has(candidate.bottleId));
  const textRoom = imageOnly.length > 0 ? Math.max(0, MAX_CARDS - promoted.length - 1) : MAX_CARDS - promoted.length;
  const shownText = textOnly.slice(0, textRoom);
  const imageSlots = MAX_CARDS - promoted.length - shownText.length;
  const cards = [...promoted, ...imageOnly.slice(0, imageSlots), ...shownText].slice(0, MAX_CARDS);
  const top = cards[0];
  const imageNameStands = imageConfident && top?.bottleId === image[0]?.bottleId;
  const confident = imageNameStands || (!!top && imageConfident && promotedIds.has(top.bottleId));
  return { showName: confident || agreed.length > 0, confident, cards };
}
