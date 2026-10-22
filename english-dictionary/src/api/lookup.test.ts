import { describe, expect, it } from "vitest";
import { createLookupRunner, normalizeWord, resultFromError } from "./lookup";
import { NetworkError } from "./request";
import type { DictionarySource, LookupResult } from "./types";

function sourceReturning(
  results: Array<LookupResult | Error>,
  overrides: Partial<DictionarySource> = {},
): { source: DictionarySource; calls: string[] } {
  const calls: string[] = [];
  const queue = [...results];
  const source: DictionarySource = {
    id: "wiktionary",
    title: "Wiktionary",
    attribution: {},
    entryUrl: word => `https://example.test/${word}`,
    async lookup(word) {
      calls.push(word);
      const next = queue.shift() ?? { status: "not-found", suggestions: [] };
      if (next instanceof Error) throw next;
      return next;
    },
    ...overrides,
  };
  return { source, calls };
}

const found: LookupResult = {
  status: "found",
  entry: { source: "wiktionary", headword: "kitchen", url: "https://example.test/kitchen", sections: [] },
};

describe("normalizeWord", () => {
  it("should trim, collapse inner spaces, and lowercase the word", () => {
    expect(normalizeWord("  Give   Up ")).toBe("give up");
  });
});

describe("resultFromError", () => {
  it("should report a network failure when the source throws a NetworkError", () => {
    const error = new NetworkError("https://example.test/kitchen", new Error("reset"));
    expect(resultFromError(error)).toEqual({ status: "unavailable", reason: "network", message: error.message });
  });

  it("should report a format change naming the error when the source throws anything else", () => {
    expect(resultFromError(new TypeError("entry is undefined"))).toEqual({
      status: "unavailable",
      reason: "format-changed",
      message: "The entry could not be read: entry is undefined",
    });
  });
});

describe("createLookupRunner", () => {
  it("should ask the source with the normalized word", async () => {
    const { source, calls } = sourceReturning([found]);
    await createLookupRunner().lookup(source, "  Kitchen ", {});
    expect(calls).toEqual(["kitchen"]);
  });

  it("should answer repeated lookups of the same word from memory", async () => {
    const { source, calls } = sourceReturning([found]);
    const runner = createLookupRunner();
    await runner.lookup(source, "kitchen", {});
    await runner.lookup(source, "Kitchen", {});
    expect(calls).toHaveLength(1);
  });

  it("should share one request between callers that ask while it is in flight", async () => {
    const { source, calls } = sourceReturning([found]);
    const runner = createLookupRunner();
    await Promise.all([runner.lookup(source, "kitchen", {}), runner.lookup(source, "kitchen", {})]);
    expect(calls).toHaveLength(1);
  });

  it("should retry after a failure instead of remembering it", async () => {
    const failure: LookupResult = { status: "unavailable", reason: "network", message: "offline" };
    const { source, calls } = sourceReturning([failure, found]);
    const runner = createLookupRunner();
    await expect(runner.lookup(source, "kitchen", {})).resolves.toEqual(failure);
    await expect(runner.lookup(source, "kitchen", {})).resolves.toEqual(found);
    expect(calls).toHaveLength(2);
  });

  it("should start a new request after the source throws instead of replaying the rejected one", async () => {
    const { source, calls } = sourceReturning([new Error("the page could not be parsed"), found]);
    const runner = createLookupRunner();
    await expect(runner.lookup(source, "kitchen", {})).rejects.toThrow("the page could not be parsed");
    await expect(runner.lookup(source, "kitchen", {})).resolves.toEqual(found);
    expect(calls).toHaveLength(2);
  });

  it("should refetch after a word is forgotten", async () => {
    const { source, calls } = sourceReturning([found, found]);
    const runner = createLookupRunner();
    await runner.lookup(source, "kitchen", {});
    runner.forget("wiktionary", "kitchen");
    await runner.lookup(source, "kitchen", {});
    expect(calls).toHaveLength(2);
  });

  it("should issue a second network request for a repeat lookup on a source with caching forbidden", async () => {
    const { source, calls } = sourceReturning([found, found], { cachingForbidden: true });
    const runner = createLookupRunner();
    await runner.lookup(source, "kitchen", {});
    await runner.lookup(source, "kitchen", {});
    expect(calls).toHaveLength(2);
  });

  it("should still share one request between simultaneous callers when caching is forbidden", async () => {
    const { source, calls } = sourceReturning([found], { cachingForbidden: true });
    const runner = createLookupRunner();
    await Promise.all([runner.lookup(source, "kitchen", {}), runner.lookup(source, "kitchen", {})]);
    expect(calls).toHaveLength(1);
  });
});
