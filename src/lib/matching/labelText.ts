/** Words on most labels that name no particular whiskey; digit ages are kept because they tell expressions apart. */
const GENERIC_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'of',
  'whisky',
  'whiskey',
  'bourbon',
  'scotch',
  'rye',
  'aged',
  'age',
  'year',
  'years',
  'old',
  'single',
  'malt',
  'barrel',
  'proof',
  'straight',
  'kentucky',
  'bottled',
  'bottle',
  'alcohol',
  'vol',
  'alc',
  'limited',
  'edition',
  'original',
  'distillery',
  'distilled',
]);

/** Lower-cased words split as the `unicode61` tokenizer with `tokenchars '` splits them; OCR's curly apostrophes count as `'`. */
function words(text: string): string[] {
  return (
    text
      .replace(/[\u2018\u2019]/g, "'")
      .toLowerCase()
      .match(/[\p{L}\p{N}']+/gu) ?? []
  );
}

/** The distinctive words of the label lines, first occurrence first: no generic words and nothing shorter than 2. */
export function labelTokens(lines: string[]): string[] {
  const tokens = lines.flatMap(words).filter((word) => word.length >= 2 && !GENERIC_WORDS.has(word));
  return [...new Set(tokens)];
}

/** An FTS5 `MATCH` expression for any of `tokens`, each quoted so apostrophes and digits stay literal. */
export function labelQuery(tokens: string[]): string {
  return tokens.map((token) => `"${token}"`).join(' OR ');
}

/** The `tokens` that also occur in any of `fields`, in token order. */
export function matchedWords(tokens: string[], fields: string[]): string[] {
  const indexed = new Set(fields.flatMap(words));
  return tokens.filter((token) => indexed.has(token));
}
