import { usePromise } from "@raycast/utils";
import { lookupRunner, normalizeWord, resultFromError } from "../api/lookup";
import type { DictionarySource, LookupOptions, LookupResult, SourceId } from "../api/types";

export interface LookupState {
  result: LookupResult | undefined;
  resultSourceId: SourceId | undefined;
  resultWord: string | undefined;
  isLoading: boolean;
  refresh: () => void;
}

interface Loaded {
  sourceId: SourceId;
  word: string;
  result: LookupResult;
}

// No abort signal: StrictMode mounts twice, and the second mount joins the first request.
export function useLookup(source: DictionarySource | undefined, word: string, options: LookupOptions): LookupState {
  const normalized = normalizeWord(word);
  const { data, isLoading, revalidate } = usePromise(
    async (sourceId: SourceId | undefined, lookupWord: string): Promise<Loaded | undefined> => {
      if (!source || source.id !== sourceId || !lookupWord) return undefined;
      try {
        const result = await lookupRunner.lookup(source, lookupWord, options);
        return { sourceId, word: lookupWord, result };
      } catch (error) {
        return { sourceId, word: lookupWord, result: resultFromError(error) };
      }
    },
    [source?.id, normalized],
    { execute: Boolean(source && normalized) },
  );
  return {
    result: data?.result,
    resultSourceId: data?.sourceId,
    resultWord: data?.word,
    isLoading,
    refresh: () => {
      if (source) lookupRunner.forget(source.id, normalized);
      revalidate();
    },
  };
}
