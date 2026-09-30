import { closeSpellings, labelQuery, labelTokens, matchedWords } from './labelText';

describe('labelTokens', () => {
  it("keeps the apostrophe and drops the generic words of a Maker's Mark label", () => {
    expect(labelTokens(["Maker's Mark", 'Kentucky Straight Bourbon Whisky'])).toEqual(["maker's", 'mark']);
  });

  it('keeps a digit age and drops the word years', () => {
    expect(labelTokens(['Eagle Rare', '10 Years'])).toEqual(['eagle', 'rare', '10']);
  });

  it('reads curly apostrophes as straight ones and splits on other punctuation', () => {
    expect(labelTokens(['BLANTON\u2019S', 'Bottled-in-Bond, 100 Proof'])).toEqual(["blanton's", 'in', 'bond', '100']);
  });

  it('keeps each token once, in first-seen order', () => {
    expect(labelTokens(['Mark Maker', "MARK maker's"])).toEqual(['mark', 'maker', "maker's"]);
  });

  it.each([
    ['only generic words', ['Single Malt Scotch Whisky', 'The Original Aged Years']],
    ['only single characters', ['A', 'B 7 %']],
    ['only punctuation', ['* * *', '\u2014']],
    ['no lines', []],
  ])('returns nothing for %s', (_, lines) => {
    expect(labelTokens(lines)).toEqual([]);
  });
});

describe('labelQuery', () => {
  it('quotes each token and joins them with OR', () => {
    expect(labelQuery(["maker's", 'mark'])).toBe('"maker\'s" OR "mark"');
  });
});

describe('closeSpellings', () => {
  const laphroaig = ['Laphroaig 10 Year Old', 'Laphroaig (Beam Suntory)', '10 Year Old Single Malt', '10 years'];

  it('queries the catalog spelling when OCR drops one letter of a long name', () => {
    expect(closeSpellings(['aphroaig', '10'], laphroaig)).toEqual(['aphroaig', '10', 'laphroaig']);
  });

  it('leaves short tokens exact, including ages and a one-letter miss on a short word', () => {
    expect(closeSpellings(['10', 'rare', 'mark'], ['Eagle Rare', 'Laphroaig', "Maker's Mark"])).toEqual(['10', 'rare', 'mark']);
  });

  it('does not treat a two-letter miss as the same name', () => {
    expect(closeSpellings(['phroaig'], laphroaig)).toEqual(['phroaig']);
  });
});

describe('matchedWords', () => {
  it("lists the tokens found in any of the whiskey's fields, in token order", () => {
    expect(matchedWords(['10', 'rare', 'eagle', 'glen'], ['Eagle Rare 10 Year', 'Buffalo Trace', '10 Year Old', '10 years'])).toEqual(
      ['10', 'rare', 'eagle'],
    );
  });

  it('matches whole words only, apostrophe included', () => {
    expect(matchedWords(['maker', "maker's", 'mar'], ["Maker's Mark"])).toEqual(["maker's"]);
  });
});
