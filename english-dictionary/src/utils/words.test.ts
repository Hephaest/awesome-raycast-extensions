import { describe, expect, it } from "vitest";
import { chooseLookupTarget, cleanSelection, longestWord } from "./words";

describe("cleanSelection", () => {
  it("should collapse whitespace and drop the punctuation around the text", () => {
    expect(cleanSelection('  "serendipity,"  ')).toBe("serendipity");
    expect(cleanSelection("(kitchen).")).toBe("kitchen");
  });
});

describe("longestWord", () => {
  it("should pick the longest token and prefer the first one on a tie", () => {
    expect(longestWord("we met on the same train")).toBe("train");
  });

  it("should return an empty string when only punctuation is present", () => {
    expect(longestWord("!!!")).toBe("");
  });
});

describe("chooseLookupTarget", () => {
  it("should keep a single word as the target", () => {
    expect(chooseLookupTarget('  "serendipity," ')).toEqual({ word: "serendipity" });
  });

  it("should keep a short phrase whole so phrasal entries can match", () => {
    expect(chooseLookupTarget("give   up")).toEqual({ word: "give up" });
  });

  it("should fall back to the longest word of a sentence and say what it replaced", () => {
    const target = chooseLookupTarget("It was pure serendipity that we met on the same train today.");
    expect(target).toEqual({
      word: "serendipity",
      substitutedFrom: "It was pure serendipity that we met on the same train today",
    });
  });

  it("should return nothing when the selection is whitespace or punctuation only", () => {
    expect(chooseLookupTarget("  ... ")).toBeUndefined();
  });
});
