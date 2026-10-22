import { describe, expect, it } from "vitest";
import { allSources, availableSources, browserOnlySources, resolveSource } from "./sources";
import type { CollinsCredentials, MerriamWebsterCredentials } from "./types";

const merriamWebsterKey: MerriamWebsterCredentials = { apiKey: "k", reference: "collegiate" };
const collinsKey: CollinsCredentials = { apiKey: "k", dictionary: "english" };

describe("availableSources", () => {
  it("should offer only Wiktionary while neither key is configured", () => {
    const ids = availableSources({}).map(source => source.id);
    expect(ids).toEqual(["wiktionary"]);
  });

  it("should add Collins alone while only its key is configured", () => {
    const ids = availableSources({ collins: collinsKey }).map(source => source.id);
    expect(ids).toEqual(["wiktionary", "collins"]);
  });

  it("should add Merriam-Webster alone while only its key is configured", () => {
    const ids = availableSources({ merriamWebster: merriamWebsterKey }).map(source => source.id);
    expect(ids).toEqual(["wiktionary", "merriam-webster"]);
  });

  it("should list every source in dropdown order once both keys are configured", () => {
    const ids = availableSources({ merriamWebster: merriamWebsterKey, collins: collinsKey }).map(source => source.id);
    expect(ids).toEqual(["wiktionary", "collins", "merriam-webster"]);
  });
});

describe("resolveSource", () => {
  it("should take the first candidate that is available and fall back to the first source", () => {
    const sources = availableSources({ collins: collinsKey });
    expect(resolveSource(sources, "merriam-webster", "collins").id).toBe("collins");
    expect(resolveSource(sources, "merriam-webster", undefined).id).toBe("wiktionary");
  });
});

describe("source attribution", () => {
  it("should carry the notice each source's terms require", () => {
    const attributions = Object.fromEntries(allSources.map(source => [source.id, source.attribution]));
    expect(attributions).toEqual({
      wiktionary: {},
      collins: { text: "www.collinsdictionary.com © HarperCollins Publishers Ltd 2025" },
      "merriam-webster": { logo: "merriam-webster-logo.png" },
    });
  });
});

describe("source license", () => {
  it("should name the adapted CC BY-SA license for Wiktionary only", () => {
    const licenses = Object.fromEntries(allSources.map(source => [source.id, source.license]));
    expect(licenses).toEqual({
      wiktionary: { name: "Adapted, CC BY-SA 4.0", url: "https://creativecommons.org/licenses/by-sa/4.0/" },
      collins: undefined,
      "merriam-webster": undefined,
    });
  });
});

describe("browserOnlySources", () => {
  const urlsFor = (word: string) =>
    Object.fromEntries(browserOnlySources.map(source => [source.title, source.entryUrl(word)]));

  it("should open each dictionary's own entry or search page for a phrase", () => {
    expect(urlsFor("  Give Up ")).toEqual({
      "Oxford Learner's": "https://www.oxfordlearnersdictionaries.com/definition/english/give-up",
      Cambridge: "https://dictionary.cambridge.org/dictionary/english/give-up",
      Longman: "https://www.ldoceonline.com/dictionary/give-up",
      "Vocabulary.com": "https://www.vocabulary.com/dictionary/give%20up",
      "Urban Dictionary": "https://www.urbandictionary.com/define.php?term=Give%20Up",
      OED: "https://www.oed.com/search/dictionary/?scope=Entries&q=Give%20Up",
    });
  });

  it("should encode punctuation so a word can never change the path or the query", () => {
    for (const url of Object.values(urlsFor("and/or?&x=1"))) {
      expect(url).not.toContain("and/or");
      expect(url).not.toContain("&x=1");
    }
  });
});
