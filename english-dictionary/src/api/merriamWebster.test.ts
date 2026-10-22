import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NetworkError } from "./request";
import type { HttpClient } from "./request";
import type { Entry, MerriamWebsterCredentials } from "./types";
import { createMerriamWebsterSource, stripFormattingTokens } from "./merriamWebster";

const API = "https://www.dictionaryapi.com/api/v3/references/collegiate/json";
const CREDENTIALS: MerriamWebsterCredentials = { apiKey: "test-key", reference: "collegiate" };

function fixture(name: string): string {
  return readFileSync(path.join(__dirname, "../../tests/fixtures/merriam-webster", `${name}.json`), "utf8");
}

type Route = { status: number; body: string; contentType?: string };

function httpServing(routes: Record<string, Route>): Pick<HttpClient, "fetchText"> {
  return {
    async fetchText(url) {
      const route = routes[url];
      if (!route) throw new NetworkError(url, new Error("no route"));
      return { status: route.status, url, contentType: route.contentType ?? "application/json", body: route.body };
    },
  };
}

function answering(word: string, route: Route): Pick<HttpClient, "fetchText"> {
  return httpServing({ [`${API}/${word}?key=${CREDENTIALS.apiKey}`]: route });
}

function serving(word: string, name = word): Pick<HttpClient, "fetchText"> {
  return httpServing({ [`${API}/${word}?key=${CREDENTIALS.apiKey}`]: { status: 200, body: fixture(name) } });
}

async function lookupFound(word: string): Promise<Entry> {
  const result = await createMerriamWebsterSource(serving(word)).lookup(word, { merriamWebster: CREDENTIALS });
  if (result.status !== "found") throw new Error(`expected found, got ${result.status}`);
  return result.entry;
}

describe("createMerriamWebsterSource", () => {
  describe("entry parsing", () => {
    it("should read the headword, the entry URL, and the part of speech", async () => {
      const entry = await lookupFound("serendipity");
      expect(entry.source).toBe("merriam-webster");
      expect(entry.headword).toBe("serendipity");
      expect(entry.url).toBe("https://www.merriam-webster.com/dictionary/serendipity");
      expect(entry.sections).toHaveLength(1);
      expect(entry.sections[0].title).toBe("noun");
      expect(entry.sections[0].partOfSpeech).toBe("noun");
      expect(entry.sections[0].picture).toBeUndefined();
    });

    it("should read the US respelling and the audio clip the response names", async () => {
      const entry = await lookupFound("serendipity");
      expect(entry.sections[0].pronunciations).toEqual([
        {
          variant: "us",
          text: "shən-ˈkan-lə-zəl",
          notation: "respelling",
          audioUrl: "https://media.merriam-webster.com/audio/prons/en/us/mp3/l/lanter56.mp3",
        },
      ]);
    });

    it("should never offer a UK pronunciation, which Merriam-Webster does not publish", async () => {
      const entry = await lookupFound("serendipity");
      const variants = entry.sections.flatMap(section => section.pronunciations).map(sound => sound.variant);
      expect(variants).toEqual(["us"]);
    });

    it("should fold a divided sense into the sense it continues", async () => {
      const [sense] = (await lookupFound("serendipity")).sections[0].senses;
      expect(sense.number).toBe("1");
      expect(sense.definition).toBe(
        "a low wall built to hold back loose earth also: a narrow path worn by repeated use",
      );
    });

    it("should keep the quoted examples as plain text", async () => {
      const [sense] = (await lookupFound("serendipity")).sections[0].senses;
      expect(sense.examples).toContain(
        "… the ledger showed every parcel sent that winter trellis we kept the lantern burning until the rain stopped.",
      );
      expect(sense.examples.every(example => !example.includes("{"))).toBe(true);
    });
  });

  describe("homograph pages", () => {
    it("should title each section with the part of speech and the homograph number", async () => {
      const entry = await lookupFound("kitchen");
      expect(entry.sections.map(section => section.title)).toEqual(["noun 1", "noun 2"]);
      expect(entry.sections.map(section => section.id)).toEqual(["kitchen:1", "kitchen:2"]);
    });

    it("should leave out the compounds the API returns alongside the word", async () => {
      const entry = await lookupFound("kitchen");
      const definitions = entry.sections.flatMap(section => section.senses).map(sense => sense.definition);
      expect(definitions).toHaveLength(4);
      expect(definitions.some(definition => definition.includes("the season when a field is left unplanted"))).toBe(
        false,
      );
    });

    it("should number the senses of a homograph from one when the response prints no sense number", async () => {
      const entry = await lookupFound("kitchen");
      expect(entry.sections[0].senses.map(sense => sense.number)).toEqual(["1", "2", "3"]);
      expect(entry.sections[1].senses.map(sense => sense.number)).toEqual(["1"]);
    });

    it("should keep the examples the response nests inside a usage note", async () => {
      const [sense] = (await lookupFound("kitchen")).sections[0].senses;
      expect(sense.examples).toEqual(
        expect.arrayContaining(["lantern parcel", "lantern trellis", "lantern lantern basket"]),
      );
    });

    it("should leave a homograph without pronunciation data empty rather than borrow another one's", async () => {
      const entry = await lookupFound("kitchen");
      expect(entry.sections[1].pronunciations).toEqual([]);
    });
  });

  describe("multiple parts of speech", () => {
    it("should build one section per part of speech, titled by the part of speech alone", async () => {
      const entry = await lookupFound("run");
      expect(entry.sections.map(section => section.title)).toEqual(["verb", "noun", "adjective"]);
    });

    it("should add the homograph number only to sections that share a part of speech", async () => {
      const payload = JSON.parse(fixture("run")) as Record<string, unknown>[];
      payload[1] = { ...payload[1], fl: "verb" };
      const result = await createMerriamWebsterSource(
        answering("run", { status: 200, body: JSON.stringify(payload) }),
      ).lookup("run", { merriamWebster: CREDENTIALS });
      if (result.status !== "found") throw new Error(`expected found, got ${result.status}`);
      expect(result.entry.sections.map(section => section.title)).toEqual(["verb 1", "verb 2", "adjective"]);
    });

    it("should badge the senses of a verb-divider block with that divider", async () => {
      const entry = await lookupFound("run");
      const senses = entry.sections[0].senses;
      expect(senses[0].labels).toContainEqual({ kind: "grammar", text: "intransitive verb" });
      expect(senses.some(sense => sense.labels.some(label => label.text === "transitive verb"))).toBe(true);
    });

    it("should keep a subject label on the sense that carries it", async () => {
      const entry = await lookupFound("run");
      const sense = entry.sections[0].senses.find(
        candidate => candidate.definition === "to fasten two edges so that they do not part",
      );
      expect(sense?.labels).toContainEqual({ kind: "label", text: "of a horse" });
    });

    it("should print the sense numbers the response gives, including nested ones", async () => {
      const entry = await lookupFound("run");
      const numbers = entry.sections[0].senses.map(sense => sense.number);
      expect(numbers.slice(0, 4)).toEqual(["1 a", "b", "c", "d"]);
      expect(numbers).toContain("(2)");
    });

    it("should carry a regional heading onto the sub-senses it governs and no further", async () => {
      const senses = (await lookupFound("run")).sections[1].senses;
      const australian = senses.filter(sense => sense.labels.some(label => label.text === "Australia"));
      expect(australian.map(sense => sense.number)).toEqual(["c (1)", "c (2)"]);
      expect(australian[0].definition).toBe("a tool for shaping soft metal by hand");
      const outsideHeading = "a shallow dish meant for holding water: a wooden frame that carries a climbing vine";
      expect(senses.find(sense => sense.definition === outsideHeading)?.labels).toEqual([]);
    });

    it("should read a sense that the response nests under a binding substitute", async () => {
      const entry = await lookupFound("run");
      const noun = entry.sections[1].senses.find(sense => sense.number === "4");
      expect(noun?.definition).toBe("a coarse cloth woven from undyed thread basket");
    });
  });

  describe("entry picture", () => {
    it("should attach the artwork and its caption to the section", async () => {
      const entry = await lookupFound("guitar");
      expect(entry.sections[0].picture).toEqual({
        thumbUrl: "https://www.merriam-webster.com/assets/mw/static/art/dict/guitar.gif",
        caption:
          "a fenced field seen from the ridge 1 a wooden trellis against a wall 2 a wooden trellis against a wall",
      });
    });
  });

  describe("digit-prefixed audio files", () => {
    it("should route the clip to the number subdirectory", async () => {
      const entry = await lookupFound("3d");
      expect(entry.sections[0].pronunciations[0].audioUrl).toBe(
        "https://media.merriam-webster.com/audio/prons/en/us/mp3/number/2ledger81.mp3",
      );
    });
  });

  describe("inflected forms", () => {
    it("should read the cross-reference an entry carries in place of a definition block", async () => {
      const entry = await lookupFound("ran");
      expect(entry.sections).toHaveLength(1);
      expect(entry.sections[0].senses.map(sense => sense.definition)).toEqual(["past tense of run"]);
    });

    it("should report not found when the matching entry has nothing to show", async () => {
      const source = createMerriamWebsterSource(
        answering("ran", {
          status: 200,
          body: JSON.stringify([
            { meta: { id: "ran" }, hwi: { hw: "ran" }, shortdef: [] },
            { meta: { id: "run:1" }, hwi: { hw: "run" }, shortdef: ["to go faster than a walk"] },
          ]),
        }),
      );
      await expect(source.lookup("ran", { merriamWebster: CREDENTIALS })).resolves.toEqual({
        status: "not-found",
        suggestions: ["run"],
      });
    });
  });

  describe("unknown words", () => {
    it("should report not found with the spelling suggestions the API returns", async () => {
      const source = createMerriamWebsterSource(serving("serendipty"));
      const result = await source.lookup("serendipty", { merriamWebster: CREDENTIALS });
      expect(result.status).toBe("not-found");
      expect(result).toMatchObject({ suggestions: expect.arrayContaining(["serendipity", "serendipitous"]) });
    });

    it("should report not found when every entry the API returns is a different headword", async () => {
      const source = createMerriamWebsterSource(
        httpServing({ [`${API}/kitchen?key=${CREDENTIALS.apiKey}`]: { status: 200, body: fixture("guitar") } }),
      );
      await expect(source.lookup("kitchen", { merriamWebster: CREDENTIALS })).resolves.toMatchObject({
        status: "not-found",
        suggestions: expect.arrayContaining(["guitar", "air guitar"]),
      });
    });

    it("should report not found without suggestions when the API returns nothing", async () => {
      const source = createMerriamWebsterSource(
        httpServing({ [`${API}/zzzqqq?key=${CREDENTIALS.apiKey}`]: { status: 200, body: "[]" } }),
      );
      await expect(source.lookup("zzzqqq", { merriamWebster: CREDENTIALS })).resolves.toEqual({
        status: "not-found",
        suggestions: [],
      });
    });
  });

  describe("unavailable responses", () => {
    it("should ask for the key by preference name when none is configured", async () => {
      const result = await createMerriamWebsterSource(httpServing({})).lookup("serendipity", {});
      expect(result).toMatchObject({ status: "unavailable", reason: "missing-key" });
      if (result.status !== "unavailable") throw new Error("expected unavailable");
      expect(result.message).toContain("Merriam-Webster API Key");
    });

    it("should treat the plain-text key errors the API answers with HTTP 200 as a rejected key", async () => {
      for (const body of ["Key is required.", "Invalid API key. Not subscribed for this reference."]) {
        const source = createMerriamWebsterSource(
          answering("serendipity", { status: 200, body, contentType: "text/plain; charset=utf-8" }),
        );
        const result = await source.lookup("serendipity", { merriamWebster: CREDENTIALS });
        expect(result).toMatchObject({ status: "unavailable", reason: "rejected-key" });
        if (result.status !== "unavailable") throw new Error("expected unavailable");
        expect(result.message).toContain("Merriam-Webster API Key");
        expect(result.message).toContain("Merriam-Webster Dictionary");
      }
    });

    it("should report a network failure without repeating the URL that carries the key", async () => {
      const result = await createMerriamWebsterSource(httpServing({})).lookup("serendipity", {
        merriamWebster: CREDENTIALS,
      });
      expect(result).toMatchObject({ status: "unavailable", reason: "network" });
      if (result.status !== "unavailable") throw new Error("expected unavailable");
      expect(result.message).not.toContain(CREDENTIALS.apiKey);
    });

    it("should report a blocked request on HTTP 403", async () => {
      const source = createMerriamWebsterSource(answering("serendipity", { status: 403, body: "" }));
      await expect(source.lookup("serendipity", { merriamWebster: CREDENTIALS })).resolves.toMatchObject({
        status: "unavailable",
        reason: "blocked",
      });
    });

    it("should report a blocked request when the daily quota answers HTTP 429", async () => {
      const source = createMerriamWebsterSource(answering("serendipity", { status: 429, body: "" }));
      await expect(source.lookup("serendipity", { merriamWebster: CREDENTIALS })).resolves.toMatchObject({
        status: "unavailable",
        reason: "blocked",
        message: expect.stringContaining("429"),
      });
    });

    it("should report a network failure when the API answers a server error", async () => {
      const source = createMerriamWebsterSource(answering("serendipity", { status: 500, body: "" }));
      await expect(source.lookup("serendipity", { merriamWebster: CREDENTIALS })).resolves.toMatchObject({
        status: "unavailable",
        reason: "network",
        message: expect.stringContaining("500"),
      });
    });

    it("should report a format change when the JSON is no longer an array of entries", async () => {
      const source = createMerriamWebsterSource(answering("serendipity", { status: 200, body: '[{"redesigned":1}]' }));
      await expect(source.lookup("serendipity", { merriamWebster: CREDENTIALS })).resolves.toMatchObject({
        status: "unavailable",
        reason: "format-changed",
      });
    });

    it("should report a format change, not a key problem, when the body is JSON but not an array", async () => {
      const source = createMerriamWebsterSource(
        answering("serendipity", { status: 200, body: '{"error":"something went wrong"}' }),
      );
      await expect(source.lookup("serendipity", { merriamWebster: CREDENTIALS })).resolves.toMatchObject({
        status: "unavailable",
        reason: "format-changed",
      });
    });

    it("should report a format change when the body starts like JSON but does not parse", async () => {
      const source = createMerriamWebsterSource(answering("serendipity", { status: 200, body: '[{"meta":' }));
      await expect(source.lookup("serendipity", { merriamWebster: CREDENTIALS })).resolves.toMatchObject({
        status: "unavailable",
        reason: "format-changed",
        message: expect.stringContaining("not JSON"),
      });
    });
  });

  describe("source description", () => {
    it("should declare the key it needs and the names the UI shows", () => {
      const source = createMerriamWebsterSource(httpServing({}));
      expect(source.id).toBe("merriam-webster");
      expect(source.title).toBe("Merriam-Webster");
      expect(source.requiresApiKey).toBe("merriamWebster");
    });

    it("should build an entry URL with the word encoded for the path", () => {
      expect(createMerriamWebsterSource(httpServing({})).entryUrl(" Kitchen Cabinet ")).toBe(
        "https://www.merriam-webster.com/dictionary/kitchen%20cabinet",
      );
    });
  });
});

describe("stripFormattingTokens", () => {
  it("should turn a bold colon into a leading definition and unwrap italic word tags", () => {
    expect(stripFormattingTokens("{bc}the ability to find {wi}valuable{/wi} things")).toBe(
      "the ability to find valuable things",
    );
  });

  it("should keep the target word of a cross-reference token and drop the rest of its fields", () => {
    expect(stripFormattingTokens("{bc}{sx|flee||}, {sx|retreat||}, {d_link|escape|escape:1}")).toBe(
      "flee, retreat, escape",
    );
  });

  it("should turn quote and break tokens into the characters they stand for", () => {
    expect(stripFormattingTokens("see {dxt|steel guitar||} {ldquo}slide{rdquo}{p_br}and more")).toBe(
      "see steel guitar “slide”\nand more",
    );
  });
});
