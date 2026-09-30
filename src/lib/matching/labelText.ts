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

/** Long enough that one wrong letter is still the name, and short ages stay exact. */
const CLOSE_SPELLING_LENGTH = 6;

/** True when `left` and `right` differ by one inserted, deleted, or substituted character. */
function withinOneEdit(left: string, right: string): boolean {
  if (Math.abs(left.length - right.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (left.length === right.length) {
      i += 1;
      j += 1;
    } else if (left.length > right.length) {
      i += 1;
    } else {
      j += 1;
    }
  }
  if (i < left.length || j < right.length) edits += 1;
  return edits === 1;
}

/**
 * Adds the catalog spelling when OCR drops or swaps one letter of a long name.
 * `APHROAIG` is not a token in `Laphroaig`, so whole-word search would miss it.
 */
export function closeSpellings(tokens: string[], fields: string[]): string[] {
  const catalogWords = [...new Set(fields.flatMap(words))].filter(
    (word) => word.length >= CLOSE_SPELLING_LENGTH && !GENERIC_WORDS.has(word),
  );
  const recovered = tokens.flatMap((token) =>
    token.length < CLOSE_SPELLING_LENGTH ? [] : catalogWords.filter((word) => withinOneEdit(token, word)),
  );
  return [...new Set([...tokens, ...recovered])];
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
