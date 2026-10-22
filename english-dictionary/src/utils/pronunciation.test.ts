import { describe, expect, it } from "vitest";
import type { EntrySection, Pronunciation } from "../api/types";
import { audioChoices } from "./pronunciation";

function sectionWith(pronunciations: Pronunciation[]): EntrySection {
  return { id: "s", title: "noun", pronunciations, badges: [], senses: [] };
}

const usClip: Pronunciation = { variant: "us", text: "ˈkɪtʃɪn", audioUrl: "https://example.test/us.mp3" };
const ukClip: Pronunciation = { variant: "uk", text: "ˈkɪtʃɪn", audioUrl: "https://example.test/uk.mp3" };

describe("audioChoices", () => {
  it("should offer both recordings, US first, when the source has both", () => {
    expect(audioChoices(sectionWith([ukClip, usClip]), false)).toEqual(["us", "uk"]);
  });

  it("should offer only the accent that has a recording", () => {
    expect(audioChoices(sectionWith([ukClip]), false)).toEqual(["uk"]);
    expect(audioChoices(sectionWith([{ variant: "us", text: "ˈkɪtʃɪn" }, ukClip]), false)).toEqual(["uk"]);
  });

  it("should offer the macOS voice when there is no recording and the reader turned it on", () => {
    expect(audioChoices(sectionWith([{ variant: "us", text: "ˈkɪtʃɪn" }]), true)).toEqual(["voice"]);
  });

  it("should offer nothing when there is no recording and the voice is off", () => {
    expect(audioChoices(sectionWith([]), false)).toEqual([]);
  });

  it("should prefer a real recording over the macOS voice", () => {
    expect(audioChoices(sectionWith([usClip]), true)).toEqual(["us"]);
  });
});
