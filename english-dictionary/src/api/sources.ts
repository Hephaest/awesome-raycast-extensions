import type { AppPreferences } from "../utils/preferences";
import { hyphenatedSlug } from "../utils/words";
import { createCollinsSource } from "./collins";
import { createMerriamWebsterSource } from "./merriamWebster";
import type { DictionarySource, SourceId } from "./types";
import { createWiktionarySource } from "./wiktionary";

// The first source needs no key, so it is the fallback.
export const allSources: DictionarySource[] = [
  createWiktionarySource(),
  createCollinsSource(),
  createMerriamWebsterSource(),
];

export type BrowserOnlySource = Pick<DictionarySource, "title" | "entryUrl">;

export const browserOnlySources: BrowserOnlySource[] = [
  // Oxford's legal notice forbids copying its content without written permission.
  {
    title: "Oxford Learner's",
    entryUrl: word => `https://www.oxfordlearnersdictionaries.com/definition/english/${hyphenatedSlug(word)}`,
  },
  {
    title: "Cambridge",
    entryUrl: word => `https://dictionary.cambridge.org/dictionary/english/${hyphenatedSlug(word)}`,
  },
  { title: "Longman", entryUrl: word => `https://www.ldoceonline.com/dictionary/${hyphenatedSlug(word)}` },
  {
    title: "Vocabulary.com",
    entryUrl: word => `https://www.vocabulary.com/dictionary/${encodeURIComponent(word.trim().toLowerCase())}`,
  },
  {
    title: "Urban Dictionary",
    entryUrl: word => `https://www.urbandictionary.com/define.php?term=${encodeURIComponent(word.trim())}`,
  },
  {
    title: "OED",
    entryUrl: word => `https://www.oed.com/search/dictionary/?scope=Entries&q=${encodeURIComponent(word.trim())}`,
  },
];

export function availableSources(preferences: Pick<AppPreferences, "merriamWebster" | "collins">): DictionarySource[] {
  return allSources.filter(source => !source.requiresApiKey || Boolean(preferences[source.requiresApiKey]));
}

export function findSource(sources: DictionarySource[], id: SourceId | undefined): DictionarySource | undefined {
  return sources.find(source => source.id === id);
}

export function resolveSource(
  sources: DictionarySource[],
  ...candidates: Array<SourceId | undefined>
): DictionarySource {
  for (const candidate of candidates) {
    const source = findSource(sources, candidate);
    if (source) return source;
  }
  return sources[0];
}
