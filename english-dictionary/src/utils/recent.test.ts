import { beforeEach, describe, expect, it, vi } from "vitest";
import { SOURCE_IDS } from "../api/types";
import { clearRecent, forgetLookup, listRecent, matchingRecent, RECENT_LIMIT, rememberLookup } from "./recent";

// @raycast/api ships types only, so recent.ts gets an in-memory LocalStorage here.
const { store } = vi.hoisted(() => ({ store: new Map<string, string>() }));

vi.mock("@raycast/api", () => ({
  LocalStorage: {
    getItem: async (key: string) => store.get(key),
    setItem: async (key: string, value: string) => void store.set(key, value),
    removeItem: async (key: string) => void store.delete(key),
  },
}));

function storedRows(): Record<string, unknown>[] {
  const [raw] = [...store.values()];
  return raw ? JSON.parse(raw) : [];
}

beforeEach(() => store.clear());

describe("what a remembered lookup puts on disk", () => {
  it("should store only the reader's word, the dictionary, and the time", async () => {
    await rememberLookup({ word: "serendipity", source: "wiktionary" });

    const [row] = storedRows();
    expect(Object.keys(row).sort()).toEqual(["lookedUpAt", "source", "word"]);
    expect(row.word).toBe("serendipity");
    expect(row.source).toBe("wiktionary");
  });

  it("should never write a part of speech, because that is the dictionary's own data", async () => {
    await rememberLookup({ word: "run", source: "merriam-webster" });

    expect(JSON.stringify(storedRows())).not.toContain("partOfSpeech");
  });
});

describe("rows written by an older version", () => {
  it("should still load, dropping the fields that are no longer kept", async () => {
    store.set(
      "recent-lookups",
      JSON.stringify([
        { word: "run", source: "merriam-webster", partOfSpeech: "verb", lookedUpAt: "2026-09-05T00:00:00.000Z" },
      ]),
    );

    const [row] = await listRecent();
    expect(row.word).toBe("run");
    expect(Object.keys(row).sort()).toEqual(["lookedUpAt", "source", "word"]);
  });

  it("should be dropped when they no longer match the stored shape", async () => {
    store.set("recent-lookups", JSON.stringify([{ word: "", source: "wiktionary", lookedUpAt: "2026-09-05" }]));

    expect(await listRecent()).toEqual([]);
  });
});

describe("the recent list itself", () => {
  it("should keep one row when the same word is looked up twice in the same dictionary", async () => {
    await rememberLookup({ word: "kitchen", source: "collins" });
    await rememberLookup({ word: "kitchen", source: "collins" });

    expect(await listRecent()).toHaveLength(1);
  });

  it("should keep a row per dictionary for the same word", async () => {
    await rememberLookup({ word: "kitchen", source: "collins" });
    await rememberLookup({ word: "kitchen", source: "wiktionary" });

    expect(await listRecent()).toHaveLength(2);
  });

  it("should show the newest lookup first", async () => {
    await rememberLookup({ word: "first", source: "wiktionary" });
    await rememberLookup({ word: "second", source: "wiktionary" });

    expect((await listRecent()).map(row => row.word)).toEqual(["second", "first"]);
  });

  it("should stop growing at the row limit", async () => {
    for (let index = 0; index <= RECENT_LIMIT; index += 1) {
      await rememberLookup({ word: `word-${index}`, source: "wiktionary" });
    }

    expect(await listRecent()).toHaveLength(RECENT_LIMIT);
  });

  it("should forget a row the reader removes", async () => {
    await rememberLookup({ word: "kitchen", source: "collins" });
    await forgetLookup("kitchen", "collins");

    expect(await listRecent()).toEqual([]);
  });

  it("should keep a row for every dictionary the app defines, so a new one cannot vanish unnoticed", async () => {
    for (const source of SOURCE_IDS) {
      await rememberLookup({ word: `word-${source}`, source });
    }

    expect((await listRecent()).map(row => row.source).sort()).toEqual([...SOURCE_IDS].sort());
  });
});

describe("clearing and filtering recent words", () => {
  it("should forget every word when the reader clears the list", async () => {
    await rememberLookup({ word: "run", source: "wiktionary" });
    await rememberLookup({ word: "walk", source: "collins" });
    await clearRecent();
    expect(await listRecent()).toEqual([]);
  });

  it("should keep only the words that start with what is typed, ignoring case", async () => {
    await rememberLookup({ word: "Ephemeral", source: "wiktionary" });
    await rememberLookup({ word: "epic", source: "collins" });
    await rememberLookup({ word: "resilient", source: "wiktionary" });
    const recent = await listRecent();
    const words = (text: string) => matchingRecent(recent, text, "merriam-webster").map(item => item.word);
    expect(words("eph")).toEqual(["Ephemeral"]);
    expect(words(" EP ")).toEqual(["epic", "Ephemeral"]);
    expect(words("")).toEqual(["resilient", "epic", "Ephemeral"]);
  });

  it("should leave out the typed word in the current dictionary, which the search row already opens", async () => {
    await rememberLookup({ word: "run", source: "wiktionary" });
    await rememberLookup({ word: "run", source: "collins" });
    const sources = matchingRecent(await listRecent(), "Run", "collins").map(item => item.source);
    expect(sources).toEqual(["wiktionary"]);
  });
});

describe("recent words changed at the same moment", () => {
  it("should keep both words when two lookups are remembered at once", async () => {
    await Promise.all([
      rememberLookup({ word: "run", source: "wiktionary" }),
      rememberLookup({ word: "walk", source: "collins" }),
    ]);
    expect((await listRecent()).map(item => item.word).sort()).toEqual(["run", "walk"]);
  });

  it("should stay empty when a clear follows a lookup that is still being remembered", async () => {
    const remembering = rememberLookup({ word: "run", source: "wiktionary" });
    const clearing = clearRecent();
    await Promise.all([remembering, clearing]);
    expect(await listRecent()).toEqual([]);
  });
});
