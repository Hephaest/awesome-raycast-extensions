export const MAX_PHRASE_WORDS = 6;

const EDGE_PUNCTUATION = /^[\s"'“”‘’(),.;:!?[\]{}«»]+|[\s"'“”‘’(),.;:!?[\]{}«»]+$/g;

export function cleanSelection(text: string): string {
  return text.replace(/\s+/g, " ").replace(EDGE_PUNCTUATION, "").trim();
}

export function longestWord(text: string): string {
  return cleanSelection(text)
    .split(" ")
    .map(token => token.replace(EDGE_PUNCTUATION, ""))
    .filter(Boolean)
    .reduce((longest, token) => (token.length > longest.length ? token : longest), "");
}

export interface LookupTarget {
  word: string;
  substitutedFrom?: string;
}

export function chooseLookupTarget(selection: string): LookupTarget | undefined {
  const cleaned = cleanSelection(selection);
  if (!cleaned) return undefined;
  if (cleaned.split(" ").length <= MAX_PHRASE_WORDS) return { word: cleaned };
  const word = longestWord(cleaned);
  return word ? { word, substitutedFrom: cleaned } : undefined;
}

export function hyphenatedSlug(word: string): string {
  return encodeURIComponent(word.trim().toLowerCase().replace(/\s+/g, "-"));
}
