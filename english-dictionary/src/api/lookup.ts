import { NetworkError } from "./request";
import type { DictionarySource, LookupOptions, LookupResult, SourceId } from "./types";

export type LookupKey = `${SourceId}:${string}`;

export function normalizeWord(word: string): string {
  return word.trim().replace(/\s+/g, " ").toLowerCase();
}

export function lookupKey(sourceId: SourceId, word: string): LookupKey {
  return `${sourceId}:${normalizeWord(word)}`;
}

export function resultFromError(error: unknown): LookupResult {
  if (error instanceof NetworkError) return { status: "unavailable", reason: "network", message: error.message };
  const message = error instanceof Error ? error.message : String(error);
  return { status: "unavailable", reason: "format-changed", message: `The entry could not be read: ${message}` };
}

export interface LookupRunner {
  // ! No AbortSignal: callers that join one in-flight request would inherit each other's aborts.
  lookup(source: DictionarySource, word: string, options: LookupOptions): Promise<LookupResult>;
  forget(sourceId: SourceId, word: string): void;
}

export function createLookupRunner(): LookupRunner {
  const results = new Map<LookupKey, LookupResult>();
  const inFlight = new Map<LookupKey, Promise<LookupResult>>();

  async function lookup(source: DictionarySource, word: string, options: LookupOptions): Promise<LookupResult> {
    const key = lookupKey(source.id, word);
    if (!source.cachingForbidden) {
      const cached = results.get(key);
      if (cached) return cached;
    }
    // Simultaneous callers share one request, even for a source that forbids caching.
    const pending = inFlight.get(key);
    if (pending) return pending;
    const request = source
      .lookup(normalizeWord(word), options)
      .then(result => {
        if (!source.cachingForbidden && result.status !== "unavailable") results.set(key, result);
        return result;
      })
      .finally(() => inFlight.delete(key));
    inFlight.set(key, request);
    return request;
  }

  return {
    lookup,
    forget: (sourceId, word) => results.delete(lookupKey(sourceId, word)),
  };
}

export const lookupRunner = createLookupRunner();
