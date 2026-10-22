import { describe, expect, it } from "vitest";
import { launchRequest } from "./launch";

describe("launchRequest", () => {
  it("should open nothing on an ordinary launch", () => {
    expect(launchRequest({})).toBeUndefined();
    expect(launchRequest({ arguments: { word: "  " }, fallbackText: "" })).toBeUndefined();
  });

  it("should open the word typed as the command argument, trimmed", () => {
    expect(launchRequest({ arguments: { word: " ephemeral " } })).toEqual({ word: "ephemeral" });
  });

  it("should open the root-search text when Search Word runs as a fallback command", () => {
    expect(launchRequest({ arguments: {}, fallbackText: "serendipity" })).toEqual({ word: "serendipity" });
  });

  it("should prefer Define Selected Word's context, with its note, over any typed text", () => {
    const note = { reason: "clipboard" as const };
    expect(
      launchRequest({ launchContext: { word: "resilient", note }, arguments: { word: "other" }, fallbackText: "x" }),
    ).toEqual({ word: "resilient", note });
  });

  it("should prefer the argument over the fallback text", () => {
    expect(launchRequest({ arguments: { word: "run" }, fallbackText: "walk" })).toEqual({ word: "run" });
  });
});
