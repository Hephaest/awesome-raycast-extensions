import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NetworkError } from "./request";
import type { HttpClient } from "./request";
import type { Entry } from "./types";
import { createWiktionarySource } from "./wiktionary";

const API =
  "https://en.wiktionary.org/w/api.php?action=parse&format=json&formatversion=2&prop=text&redirects=1&disableeditsection=1&disabletoc=1&page=";

function fixture(name: string): string {
  return readFileSync(path.join(__dirname, "../../tests/fixtures/wiktionary", name), "utf8");
}

function parsed(title: string, page: string): string {
  return JSON.stringify({ parse: { title, pageid: 1, text: fixture(`${page}.html`) } });
}

type Route = { status: number; body: string };

function httpServing(routes: Record<string, Route>): Pick<HttpClient, "fetchText"> {
  return {
    async fetchText(url) {
      const route = routes[url];
      if (!route) throw new NetworkError(url, new Error("no route"));
      return { status: route.status, url, contentType: "application/json", body: route.body };
    },
  };
}

function answering(word: string, route: Route): Pick<HttpClient, "fetchText"> {
  return httpServing({ [`${API}${encodeURIComponent(word)}`]: route });
}

async function lookupFound(word: string, page = word): Promise<Entry> {
  const source = createWiktionarySource(answering(word, { status: 200, body: parsed(word, page) }));
  const result = await source.lookup(word, {});
  if (result.status !== "found") throw new Error(`expected found, got ${result.status}`);
  return result.entry;
}

describe("createWiktionarySource", () => {
  describe("entry parsing", () => {
    it("should read the headword, the entry URL, and one section per part of speech", async () => {
      const entry = await lookupFound("kitchen");
      expect(entry.source).toBe("wiktionary");
      expect(entry.headword).toBe("kitchen");
      expect(entry.url).toBe("https://en.wiktionary.org/wiki/kitchen#English");
      expect(entry.sections.map(section => [section.id, section.title, section.partOfSpeech])).toEqual([
        ["Noun", "noun", "noun"],
        ["Verb", "verb", "verb"],
      ]);
    });

    it("should read US and UK IPA and the mp3 copy of each recording", async () => {
      const entry = await lookupFound("kitchen");
      expect(entry.sections[0].pronunciations).toEqual([
        {
          variant: "us",
          text: "ˈkɪt͡ʃ(ə)n",
          notation: "ipa",
          audioUrl:
            "https://upload.wikimedia.org/wikipedia/commons/transcoded/e/e9/En-us-kitchen.ogg/En-us-kitchen.ogg.mp3",
        },
        {
          variant: "uk",
          text: "ˈkɪt͡ʃ(ɪ)n",
          notation: "ipa",
          audioUrl:
            "https://upload.wikimedia.org/wikipedia/commons/transcoded/f/f0/En-uk-kitchen.ogg/En-uk-kitchen.ogg.mp3",
        },
      ]);
    });

    it("should skip an accent that is neither US nor UK", async () => {
      const entry = await lookupFound("run");
      expect(entry.sections[0].pronunciations).toEqual([{ variant: "us", text: "ɹʌn", notation: "ipa" }]);
    });

    it("should keep the definition, its usage labels and its examples, without the quotations", async () => {
      const [first, second, third] = (await lookupFound("kitchen")).sections[0].senses;
      expect(first).toEqual({
        id: "Noun-1",
        number: "1",
        definition: "An invented room for making supper.",
        examples: ["We invented a kitchen recipe there."],
        labels: [],
      });
      expect(second).toMatchObject({
        definition: "An invented style of cooking.",
        labels: [{ kind: "label", text: "by extension" }],
      });
      expect(third).toMatchObject({ definition: "An invented section of an orchestra.", examples: [] });
    });

    it("should leave the date note out of the definition", async () => {
      const senses = (await lookupFound("kitchen")).sections[0].senses;
      expect(senses[2].definition).toBe("An invented section of an orchestra.");
    });

    it("should number a nested sense under the sense it belongs to", async () => {
      const senses = (await lookupFound("run")).sections[0].senses;
      expect(senses.map(sense => [sense.number, sense.definition])).toEqual([
        ["1", "To move in an invented way."],
        ["1.1", "To move forward on two invented feet."],
        ["1.2", "To cover an invented distance."],
        ["2", "To work an invented machine."],
      ]);
      expect(senses[1].examples).toEqual(["Run, and you might catch the invented train!"]);
    });

    it("should skip the empty list items Wiktionary leaves in a sense list", async () => {
      const senses = (await lookupFound("kitchen")).sections[0].senses;
      expect(senses.map(sense => sense.number)).toEqual(["1", "2", "3"]);
    });

    it("should number a part of speech that repeats across etymologies", async () => {
      const entry = await lookupFound("run");
      expect(entry.sections.map(section => section.title)).toEqual(["verb 1", "verb 2"]);
    });

    it("should leave out the senses of the next language", async () => {
      const entry = await lookupFound("run");
      const definitions = entry.sections.flatMap(section => section.senses.map(sense => sense.definition));
      expect(definitions).not.toContain("An invented Scots sense.");
    });
  });

  describe("unknown words", () => {
    it("should report not found when Wiktionary has no page for the word", async () => {
      const source = createWiktionarySource(answering("zzzq", { status: 200, body: fixture("miss.json") }));
      expect(await source.lookup("zzzq", {})).toEqual({ status: "not-found", suggestions: [] });
    });

    it("should report not found when the page has no English section", async () => {
      const source = createWiktionarySource(answering("küche", { status: 200, body: parsed("Küche", "no-english") }));
      expect(await source.lookup("küche", {})).toEqual({ status: "not-found", suggestions: [] });
    });
  });

  describe("unavailable responses", () => {
    it("should report a blocked request on HTTP 403", async () => {
      const source = createWiktionarySource(answering("kitchen", { status: 403, body: "" }));
      expect(await source.lookup("kitchen", {})).toMatchObject({ status: "unavailable", reason: "blocked" });
    });

    it("should report a blocked request when the rate limit answers HTTP 429", async () => {
      const source = createWiktionarySource(answering("kitchen", { status: 429, body: "" }));
      expect(await source.lookup("kitchen", {})).toMatchObject({ status: "unavailable", reason: "blocked" });
    });

    it("should report a network failure when the request never completes", async () => {
      const source = createWiktionarySource(httpServing({}));
      expect(await source.lookup("kitchen", {})).toMatchObject({ status: "unavailable", reason: "network" });
    });

    it("should report a format change when the body is not JSON", async () => {
      const source = createWiktionarySource(answering("kitchen", { status: 200, body: "<html></html>" }));
      expect(await source.lookup("kitchen", {})).toMatchObject({ status: "unavailable", reason: "format-changed" });
    });
  });

  describe("entry URL", () => {
    it("should lowercase the word and join a phrase with underscores", () => {
      expect(createWiktionarySource(httpServing({})).entryUrl(" Give Up ")).toBe(
        "https://en.wiktionary.org/wiki/give_up#English",
      );
    });
  });
});
