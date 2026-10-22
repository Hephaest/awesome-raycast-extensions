import { describe, expect, it } from "vitest";
import type { Attribution, Entry, EntrySection } from "../api/types";
import { pictureMarkdown, senseClipboardText, senseMarkdown } from "./markdown";

const section: EntrySection = {
  id: "kitchen-1",
  title: "noun",
  partOfSpeech: "noun",
  pronunciations: [
    { variant: "us", text: "ˈkɪtʃɪn", notation: "ipa", audioUrl: "https://example.test/us.mp3" },
    { variant: "uk", text: "ˈkɪtʃɪn", notation: "ipa" },
  ],
  badges: [],
  picture: { thumbUrl: "https://example.test/thumb.png", fullUrl: "https://example.test/full.png" },
  senses: [
    {
      id: "s1",
      number: "1",
      definition: "an invented room for making supper",
      examples: ["We invented a recipe there.", "an invented example kitchen"],
      labels: [{ kind: "grammar", text: "[countable]" }],
    },
    { id: "s2", number: "2", definition: "an invented second meaning", examples: [], labels: [] },
  ],
};

const entry: Entry = {
  source: "collins",
  headword: "kitchen",
  url: "https://example.test/kitchen",
  sections: [section],
};

const collins: Attribution = { text: "www.collinsdictionary.com © HarperCollins Publishers Ltd 2025" };
const merriamWebster: Attribution = { logo: "merriam-webster-logo.png" };

describe("senseMarkdown", () => {
  it("should render the headword, the numbered definition, examples, and the picture after them", () => {
    const markdown = senseMarkdown(entry, section, section.senses[0], collins);
    expect(markdown).toContain("# kitchen");
    expect(markdown).toContain("**1.** an invented room for making supper");
    expect(markdown.indexOf("We invented a recipe there.")).toBeLessThan(markdown.indexOf("![noun]"));
    expect(markdown).toContain("![noun](https://example.test/full.png?raycast-width=340)");
  });

  it("should leave the pronunciation and the labels to the metadata", () => {
    const markdown = senseMarkdown(entry, section, section.senses[0], collins);
    expect(markdown).not.toContain("countable");
    expect(markdown).not.toContain("ˈkɪtʃɪn");
  });

  it("should list each example as its own italic item, since examples are not quotations", () => {
    const markdown = senseMarkdown(entry, section, section.senses[0], collins);
    expect(markdown).toContain("- *We invented a recipe there.*\n- *an invented example kitchen*");
    expect(markdown).not.toContain("> ");
  });

  it("should print the substitution note under the headword when a shorter word was looked up", () => {
    const markdown = senseMarkdown(entry, section, section.senses[1], collins, {
      note: "Looked up “kitchen” from your selection.",
    });
    expect(markdown.split("\n")[2]).toBe("*Looked up “kitchen” from your selection.*");
    expect(markdown).not.toContain("raycast-width=340");
  });

  it("should close with the source's notice in italics", () => {
    const markdown = senseMarkdown(entry, section, section.senses[0], collins);
    expect(markdown.split("\n").at(-1)).toBe("*www.collinsdictionary.com © HarperCollins Publishers Ltd 2025*");
  });

  it("should close with the source's logo from the assets folder at an approved size", () => {
    const markdown = senseMarkdown(entry, section, section.senses[0], merriamWebster);
    expect(markdown.split("\n").at(-1)).toBe("![](merriam-webster-logo.png?raycast-width=50&raycast-height=50)");
  });

  it("should put the logo above the notice when a source has both", () => {
    const markdown = senseMarkdown(entry, section, section.senses[0], { logo: "logo.png", text: "Notice" });
    expect(markdown.indexOf("logo.png")).toBeLessThan(markdown.indexOf("*Notice*"));
    expect(markdown.split("\n").at(-1)).toBe("*Notice*");
  });
});

describe("pictureMarkdown", () => {
  const picture = { thumbUrl: "https://example.test/thumb.png", caption: "A fitted kitchen" };

  it("should show the picture full width with its caption", () => {
    const markdown = pictureMarkdown(entry, picture, collins);
    expect(markdown).toContain("![A fitted kitchen](https://example.test/thumb.png?raycast-width=640)");
    expect(markdown).toContain("*A fitted kitchen*");
  });

  it("should close with the source's attribution", () => {
    expect(pictureMarkdown(entry, picture, collins).split("\n").at(-1)).toBe(
      "*www.collinsdictionary.com © HarperCollins Publishers Ltd 2025*",
    );
    expect(pictureMarkdown(entry, picture, merriamWebster)).toContain("merriam-webster-logo.png");
  });
});

describe("senseClipboardText", () => {
  it("should give the headword, the definition, indented examples, and the source's notice as plain text", () => {
    expect(senseClipboardText(entry, section, section.senses[0], collins)).toBe(
      "kitchen · noun\nan invented room for making supper\n  - We invented a recipe there.\n  - an invented example kitchen\nwww.collinsdictionary.com © HarperCollins Publishers Ltd 2025",
    );
  });

  it("should end on the last example when the source's notice is a logo only", () => {
    const text = senseClipboardText(entry, section, section.senses[0], merriamWebster);
    expect(text.split("\n").at(-1)).toBe("  - an invented example kitchen");
  });
});
