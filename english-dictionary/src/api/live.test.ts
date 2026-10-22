import { describe, expect, it } from "vitest";
import { createLookupRunner } from "./lookup";
import type { LookupOptions, LookupResult } from "./types";
import { allSources, findSource } from "./sources";

// Skipped unless LIVE_SOURCES=1; MW_API_KEY and COLLINS_API_KEY enable the key-gated sources.
const options: LookupOptions = {
  merriamWebster: process.env.MW_API_KEY ? { apiKey: process.env.MW_API_KEY, reference: "collegiate" } : undefined,
  collins: process.env.COLLINS_API_KEY
    ? { apiKey: process.env.COLLINS_API_KEY, dictionary: "english-learner" }
    : undefined,
};

function expectFound(result: LookupResult) {
  if (result.status !== "found") throw new Error(`expected found, got ${JSON.stringify(result)}`);
  return result.entry;
}

describe.skipIf(!process.env.LIVE_SOURCES)("allSources against the live sites", () => {
  const runner = createLookupRunner();

  for (const source of allSources) {
    const missingKey = Boolean(source.requiresApiKey && !options[source.requiresApiKey]);
    it.skipIf(missingKey)(
      `should return a kitchen entry with senses and a pronunciation from ${source.title}`,
      async () => {
        const entry = expectFound(await runner.lookup(source, "kitchen", options));
        expect(entry.headword.toLowerCase()).toBe("kitchen");
        expect(entry.sections.length).toBeGreaterThan(0);
        expect(entry.sections.flatMap(section => section.senses).length).toBeGreaterThan(0);
        expect(entry.sections[0].pronunciations.some(pronunciation => pronunciation.audioUrl)).toBe(true);
      },
      30_000,
    );
  }

  it("should report a miss for a nonsense word on every source", async () => {
    for (const source of allSources) {
      if (source.requiresApiKey && !options[source.requiresApiKey]) continue;
      const result = await runner.lookup(source, "zzzqqqnotaword", options);
      expect(result.status, source.id).toBe("not-found");
    }
  }, 60_000);

  it("should carry a picture for an illustrated word on the sources that publish pictures", async () => {
    const illustrated = { "merriam-webster": "guitar" } as const;
    for (const [id, word] of Object.entries(illustrated)) {
      const source = findSource(allSources, id as keyof typeof illustrated);
      if (!source || (source.requiresApiKey && !options[source.requiresApiKey])) continue;
      const entry = expectFound(await runner.lookup(source, word, options));
      expect(
        entry.sections.some(section => section.picture),
        id,
      ).toBe(true);
    }
  }, 60_000);
});
