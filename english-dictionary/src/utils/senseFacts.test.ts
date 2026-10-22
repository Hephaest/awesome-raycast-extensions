import { describe, expect, it } from "vitest";
import type { EntrySection, Sense } from "../api/types";
import { senseFacts } from "./senseFacts";

const sense: Sense = {
  id: "s1",
  number: "1",
  definition: "an invented meaning",
  examples: [],
  labels: [
    { kind: "grammar", text: "[intransitive]" },
    { kind: "label", text: "(informal)" },
  ],
};

const section: EntrySection = {
  id: "run-1",
  title: "verb",
  partOfSpeech: "verb",
  pronunciations: [
    { variant: "uk", text: "rʌn", notation: "ipa", audioUrl: "https://example.test/uk.mp3" },
    { variant: "us", text: "rʌn", notation: "ipa" },
  ],
  badges: [{ kind: "frequency", text: "●●○" }],
  senses: [sense],
};

describe("senseFacts", () => {
  it("should give each accent's transcription, US first, and say which has a recording", () => {
    expect(senseFacts(section, sense).pronunciations).toEqual([
      { accent: "US", text: "/rʌn/", hasRecording: false },
      { accent: "UK", text: "/rʌn/", hasRecording: true },
    ]);
  });

  it("should write a publisher respelling between backslashes", () => {
    const respelled = {
      ...section,
      pronunciations: [{ variant: "us" as const, text: "ˈrən", notation: "respelling" as const }],
    };
    expect(senseFacts(respelled, sense).pronunciations[0].text).toBe("\\ˈrən\\");
  });

  it("should route each label to its row without brackets", () => {
    const facts = senseFacts(section, sense);
    expect(facts.grammar).toEqual(["intransitive"]);
    expect(facts.usage).toEqual(["informal"]);
  });

  it("should name the Collins frequency band in its own row", () => {
    expect(senseFacts(section, sense).frequency).toBe("●●○");
  });

  it("should leave out every row the source has nothing for", () => {
    const bare = { ...section, partOfSpeech: undefined, pronunciations: [], badges: [] };
    expect(senseFacts(bare, { ...sense, labels: [] })).toEqual({
      pronunciations: [],
      partOfSpeech: undefined,
      usage: [],
      grammar: [],
      frequency: undefined,
    });
  });
});
