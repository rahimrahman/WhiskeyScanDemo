import type { LabelHit, MatchCandidate } from '@/components/scan/useBottleMatch';

import { combineFindings } from './combineFindings';

const image = (bottleId: string, score: number): MatchCandidate => ({
  bottleId,
  name: `Whiskey ${bottleId}`,
  category: 'Bourbon',
  score,
  cardImage: Number(bottleId),
});

const hit = (bottleId: string, name = `Label ${bottleId}`): LabelHit => ({
  bottleId,
  name,
  words: [name.toLowerCase()],
  category: 'Scotch',
  cardImage: 50,
});

describe('combineFindings', () => {
  it('moves a label hit ahead of a higher image score when both found it and it clears 70', () => {
    const { confident, cards } = combineFindings([image('1', 88), image('2', 78), image('3', 70)], [hit('2', 'Whiskey 2')], true);

    expect(cards.map(({ bottleId }) => bottleId)).toEqual(['2', '1', '3']);
    expect(confident).toBe(true);
    expect(cards[0]).toMatchObject({ name: 'Whiskey 2', score: 78 });
  });

  it('leaves a weak visual match in image order when the label names it', () => {
    const { confident, cards } = combineFindings([image('1', 90), image('2', 60)], [hit('2', 'Whiskey 2')], true);

    expect(cards.map(({ bottleId }) => bottleId)).toEqual(['1', '2']);
    expect(confident).toBe(true);
  });

  it('adds a label-only whiskey to the cards without taking a confident name', () => {
    const { confident, cards } = combineFindings([image('1', 91), image('2', 80), image('3', 74)], [hit('9')], true);

    expect(cards.map(({ bottleId }) => bottleId)).toEqual(['1', '2', '9']);
    expect(cards[2]).toMatchObject({ name: 'Label 9', category: 'Scotch', cardImage: 50 });
    expect(cards[2].score).toBeUndefined();
    expect(confident).toBe(true);
  });

  it('names the shared whiskey instead of Not found when the image match is not confident', () => {
    const { showName, confident, cards } = combineFindings(
      [image('1', 66), image('2', 60)],
      [hit('2', 'Whiskey 2')],
      false,
    );

    expect(showName).toBe(true);
    expect(confident).toBe(false);
    expect(cards[0]).toMatchObject({ bottleId: '2', name: 'Whiskey 2', score: 60 });
  });

  it('stays Not found when the only finding is the label', () => {
    const { confident, cards } = combineFindings([], [hit('9')], false);

    expect(cards.map(({ bottleId }) => bottleId)).toEqual(['9']);
    expect(confident).toBe(false);
  });
});
