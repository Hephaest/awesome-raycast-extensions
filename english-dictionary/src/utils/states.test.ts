import { describe, expect, it } from "vitest";
import type { DictionarySource } from "../api/types";
import { lookupNoteText, lookupResultTitle } from "./states";

const source = { title: "Collins" } as DictionarySource;

describe("lookupResultTitle", () => {
  it("should use the printed headword for a found entry", () => {
    const result = {
      status: "found" as const,
      entry: { source: "wiktionary" as const, headword: "Kitchen", url: "", sections: [] },
    };
    expect(lookupResultTitle(source, "kitchen", result)).toBe("Kitchen");
  });

  it("should name the word and the source for a miss", () => {
    expect(lookupResultTitle(source, "serendipty", { status: "not-found", suggestions: [] })).toBe(
      "No Entry for “serendipty” in Collins",
    );
  });

  it("should give each unavailable reason its own headline", () => {
    const titles = (["network", "blocked", "format-changed", "missing-key", "rejected-key"] as const).map(reason =>
      lookupResultTitle(source, "run", { status: "unavailable", reason, message: "" }),
    );
    expect(titles).toEqual([
      "Couldn't Reach Collins",
      "Collins Refused the Request",
      "Couldn't Read the Collins Page",
      "Collins Needs an API Key",
      "Collins Rejected Your API Key",
    ]);
  });
});

describe("lookupNoteText", () => {
  it("should say a long selection was cut to its longest word", () => {
    expect(lookupNoteText({ reason: "shortened", original: "it ran very fast down the hill" }, "fast")).toBe(
      "Looked up “fast”, the longest word in your selection.",
    );
  });

  it("should say the word came from the clipboard", () => {
    expect(lookupNoteText({ reason: "clipboard" }, "serendipity")).toBe("Looked up “serendipity” from your clipboard.");
  });

  it("should say a phrase had no entry before naming the word shown instead", () => {
    expect(lookupNoteText({ reason: "fallback", original: "ran fast" }, "fast")).toBe(
      "No entry for “ran fast”. Showing “fast” instead.",
    );
  });
});
