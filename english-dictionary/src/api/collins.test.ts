import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NetworkError } from "./request";
import type { HttpClient } from "./request";
import type { CollinsCredentials, CollinsDictionary, Entry } from "./types";
import { createCollinsSource } from "./collins";

const API = "https://api.collinsdictionary.com/api/v1/dictionaries";
const CREDENTIALS: CollinsCredentials = { apiKey: "test-key", dictionary: "english-learner" };
const CHALLENGE_PAGE = "<!DOCTYPE html><html><head><title>Just a moment...</title></head><body></body></html>";
const ENGLISH_CREDENTIALS: CollinsCredentials = { ...CREDENTIALS, dictionary: "english" };

function fixture(name: string): string {
  return readFileSync(path.join(__dirname, "../../tests/fixtures/collins", `${name}.json`), "utf8");
}

type Route = { status: number; body: string; contentType?: string };

function httpServing(routes: Record<string, Route>) {
  const calls: Array<{ url: string; headers?: Record<string, string> }> = [];
  return {
    calls,
    async fetchText(url: string, headers?: Record<string, string>) {
      calls.push({ url, headers });
      const route = routes[url];
      if (!route) throw new NetworkError(url, new Error("no route"));
      return { status: route.status, url, contentType: route.contentType ?? "application/json", body: route.body };
    },
  };
}

function searchUrl(word: string, dictionary: CollinsDictionary = CREDENTIALS.dictionary): string {
  return `${API}/${dictionary}/search/first?q=${encodeURIComponent(word)}&format=html`;
}

function suggestUrl(word: string): string {
  return `${API}/${CREDENTIALS.dictionary}/search/didyoumean?q=${encodeURIComponent(word)}&entrynumber=5`;
}

function serving(word: string, name = word, credentials: CollinsCredentials = CREDENTIALS) {
  return httpServing({ [searchUrl(word, credentials.dictionary)]: { status: 200, body: fixture(name) } });
}

function answering(word: string, route: Route) {
  return httpServing({ [searchUrl(word)]: route });
}

async function lookupFound(word: string, credentials: CollinsCredentials = CREDENTIALS): Promise<Entry> {
  const source = createCollinsSource(serving(word, word, credentials));
  const result = await source.lookup(word, { collins: credentials });
  if (result.status !== "found") throw new Error(`expected found, got ${result.status}`);
  return result.entry;
}

describe("createCollinsSource", () => {
  describe("a Cobuild entry", () => {
    it("should read the headword, the source, and the browsable entry page", async () => {
      const entry = await lookupFound("lantern");
      expect(entry.source).toBe("collins");
      expect(entry.headword).toBe("lantern");
    });

    it("should open the entry on the Cobuild page rather than the English Dictionary page", async () => {
      expect((await lookupFound("lantern")).url).toBe(
        "https://www.collinsdictionary.com/dictionary/english-cobuild-learners/lantern",
      );
    });

    it("should build one section per part of speech from the numbered blocks", async () => {
      const entry = await lookupFound("lantern");
      expect(entry.sections.map(section => section.title)).toEqual(["countable noun", "verb"]);
      expect(entry.sections.map(section => section.partOfSpeech)).toEqual(["countable noun", "verb"]);
      expect(entry.sections.map(section => section.senses.length)).toEqual([2, 1]);
    });

    it("should keep the sense numbers Collins prints across the sections", async () => {
      const entry = await lookupFound("lantern");
      expect(entry.sections[0].senses.map(sense => sense.number)).toEqual(["1", "2"]);
      expect(entry.sections[1].senses.map(sense => sense.number)).toEqual(["3"]);
    });

    it("should read the definition without the headword markup Collins nests inside it", async () => {
      const [sense] = (await lookupFound("lantern")).sections[0].senses;
      expect(sense.definition).toBe(
        "A lantern is a small hooded lamp that a walker carries to light a narrow path at night.",
      );
    });

    it("should keep an example printed inside the sense", async () => {
      const [sense] = (await lookupFound("lantern")).sections[0].senses;
      expect(sense.examples).toEqual(["She hung the lantern on the gatepost and waited for the rain to stop."]);
    });

    it("should keep an example printed beside the sense rather than inside it", async () => {
      const sense = (await lookupFound("lantern")).sections[0].senses[1];
      expect(sense.examples).toEqual(["The lantern of the old market hall was rebuilt from the ledger drawings."]);
    });

    it("should leave out the example that belongs to a run-on derivative", async () => {
      const [sense] = (await lookupFound("lantern")).sections[1].senses;
      expect(sense.examples).toEqual(["They lanterned the towpath before the winter parcel run began."]);
    });

    it("should skip a sense that only cross-references another entry", async () => {
      const entry = await lookupFound("lantern");
      const definitions = entry.sections.flatMap(section => section.senses).map(sense => sense.definition);
      expect(definitions).toHaveLength(3);
      expect(definitions.some(definition => definition.includes("storm lantern"))).toBe(false);
    });
  });

  describe("pronunciation", () => {
    it("should read the IPA without the playback markup nested inside it", async () => {
      const [pronunciation] = (await lookupFound("lantern")).sections[0].pronunciations;
      expect(pronunciation.text).toBe("ˈlæntən");
      expect(pronunciation.notation).toBe("ipa");
    });

    it("should read the audio clip the entry embeds", async () => {
      const [pronunciation] = (await lookupFound("lantern")).sections[0].pronunciations;
      expect(pronunciation.audioUrl).toBe("https://api.collinsdictionary.com/media/sounds/fixture/lantern_gb_01.mp3");
    });

    it("should leave out the pronunciation an inflected form carries", async () => {
      const [section] = (await lookupFound("lantern")).sections;
      expect(section.pronunciations).toHaveLength(1);
      expect(section.pronunciations[0].audioUrl).toBe(
        "https://api.collinsdictionary.com/media/sounds/fixture/lantern_gb_01.mp3",
      );
      expect(section.pronunciations[0].text).toBe("ˈlæntən");
    });

    it("should read a British accent from the entry language class", async () => {
      const [pronunciation] = (await lookupFound("lantern")).sections[0].pronunciations;
      expect(pronunciation.variant).toBe("uk");
    });

    it("should read an American accent from the entry language class", async () => {
      const [pronunciation] = (await lookupFound("trellis", ENGLISH_CREDENTIALS)).sections[0].pronunciations;
      expect(pronunciation.variant).toBe("us");
      expect(pronunciation.text).toBe("ˈtrɛlɪs");
    });
  });

  describe("badges", () => {
    it("should map the frequency band to a frequency badge on every section", async () => {
      const entry = await lookupFound("lantern");
      expect(entry.sections.map(section => section.badges)).toEqual([
        [{ kind: "frequency", text: "●●○" }],
        [{ kind: "frequency", text: "●●○" }],
      ]);
    });

    it("should map a grammar label to a grammar badge on the senses of its block", async () => {
      const entry = await lookupFound("lantern");
      expect(entry.sections[0].senses[0].labels).toEqual([{ kind: "grammar", text: "[usu ADJ n]" }]);
      expect(entry.sections[1].senses[0].labels).toEqual([{ kind: "grammar", text: "[VERB noun]" }]);
    });

    it("should leave a pattern label printed inside an example off the badges", async () => {
      const sense = (await lookupFound("lantern")).sections[0].senses[1];
      expect(sense.labels).toEqual([]);
      expect(sense.examples.some(example => example.includes("[+ of]"))).toBe(false);
    });
  });

  describe("an english dictionary entry", () => {
    it("should read the single sense with the number Collins prints inside it", async () => {
      const entry = await lookupFound("trellis", ENGLISH_CREDENTIALS);
      expect(entry.sections).toHaveLength(1);
      expect(entry.sections[0].title).toBe("noun");
      expect(entry.sections[0].senses).toHaveLength(1);
      expect(entry.sections[0].senses[0].definition).toBe(
        "a light frame of crossed slats that a climbing plant is trained along",
      );
    });

    it("should drop the trailing period from the sense number Collins prints", async () => {
      const entry = await lookupFound("trellis", ENGLISH_CREDENTIALS);
      expect(entry.sections[0].senses[0].number).toBe("1");
    });

    it("should open the entry on the Collins English Dictionary page", async () => {
      expect((await lookupFound("trellis", ENGLISH_CREDENTIALS)).url).toBe(
        "https://www.collinsdictionary.com/dictionary/english/trellis",
      );
    });
  });

  describe("markup the adapter does not recognize", () => {
    it("should show the whole entry as one sense when no block matches", async () => {
      const entry = await lookupFound("parcel");
      expect(entry.headword).toBe("parcel");
      expect(entry.sections).toHaveLength(1);
      expect(entry.sections[0].senses).toHaveLength(1);
      expect(entry.sections[0].senses[0].definition).toContain(
        "A parcel is something wrapped in stiff paper and tied with string so that it can travel by post.",
      );
    });

    it("should keep the browser's audio fallback line out of the definition", async () => {
      const [sense] = (await lookupFound("parcel")).sections[0].senses;
      expect(sense.definition).not.toContain("does not support the audio element");
    });
  });

  describe("unknown words", () => {
    it("should report not found with the spellings Collins suggests", async () => {
      const http = httpServing({
        [searchUrl("lantren")]: { status: 404, body: '{"errorCode":404,"message":"Entry not found"}' },
        [suggestUrl("lantren")]: { status: 200, body: fixture("didyoumean-lantren") },
      });
      await expect(createCollinsSource(http).lookup("lantren", { collins: CREDENTIALS })).resolves.toEqual({
        status: "not-found",
        suggestions: ["lantern", "lantern jaw", "lantern fish", "lantern slide", "lanterns"],
      });
    });

    it("should report not found with no suggestions when Collins has none", async () => {
      const http = httpServing({
        [searchUrl("zzzqqqnotaword")]: { status: 404, body: '{"errorCode":404,"message":"Entry not found"}' },
        [suggestUrl("zzzqqqnotaword")]: { status: 200, body: fixture("didyoumean-none") },
      });
      await expect(createCollinsSource(http).lookup("zzzqqqnotaword", { collins: CREDENTIALS })).resolves.toEqual({
        status: "not-found",
        suggestions: [],
      });
    });
  });

  describe("unavailable responses", () => {
    it("should ask for the key by preference name when none is configured", async () => {
      const result = await createCollinsSource(httpServing({})).lookup("lantern", {});
      expect(result).toMatchObject({ status: "unavailable", reason: "missing-key" });
      if (result.status !== "unavailable") throw new Error("expected unavailable");
      expect(result.message).toContain("Collins API Key");
    });

    it("should report a rejected key when Collins answers HTTP 401", async () => {
      const source = createCollinsSource(answering("lantern", { status: 401, body: "" }));
      const result = await source.lookup("lantern", { collins: CREDENTIALS });
      expect(result).toMatchObject({ status: "unavailable", reason: "rejected-key" });
      if (result.status !== "unavailable") throw new Error("expected unavailable");
      expect(result.message).toContain("Collins API Key");
      expect(result.message).toContain("Collins Dictionary");
    });

    it("should report a rejected key when Collins answers HTTP 403", async () => {
      const source = createCollinsSource(answering("lantern", { status: 403, body: "" }));
      await expect(source.lookup("lantern", { collins: CREDENTIALS })).resolves.toMatchObject({
        status: "unavailable",
        reason: "rejected-key",
      });
    });

    it("should blame the host rather than the key when a 403 carries a challenge page", async () => {
      const source = createCollinsSource(
        answering("lantern", { status: 403, body: CHALLENGE_PAGE, contentType: "text/html; charset=UTF-8" }),
      );
      const result = await source.lookup("lantern", { collins: CREDENTIALS });
      expect(result).toMatchObject({ status: "unavailable", reason: "blocked" });
      if (result.status !== "unavailable") throw new Error("expected unavailable");
      expect(result.message).not.toContain("Collins API Key");
      expect(result.message).not.toContain("subscribed");
    });

    it("should charge one call for a turned-away request and tell the reader to try again", async () => {
      const http = answering("lantern", {
        status: 403,
        body: CHALLENGE_PAGE,
        contentType: "text/html; charset=UTF-8",
      });
      const source = createCollinsSource(http);
      const result = await source.lookup("lantern", { collins: CREDENTIALS });
      expect(http.calls).toHaveLength(1);
      expect(result).toMatchObject({ status: "unavailable", reason: "blocked" });
      if (result.status !== "unavailable") throw new Error("expected unavailable");
      expect(result.message).toContain("Try again");
    });

    it("should charge one call for a key Collins itself turned down", async () => {
      const http = answering("lantern", {
        status: 403,
        body: '{"errorCode":403,"errorMessage":"Forbidden"}',
        contentType: "application/json",
      });
      await createCollinsSource(http).lookup("lantern", { collins: CREDENTIALS });
      expect(http.calls).toHaveLength(1);
    });

    it("should blame the host rather than the key when a 401 carries a challenge page", async () => {
      const source = createCollinsSource(
        answering("lantern", { status: 401, body: CHALLENGE_PAGE, contentType: "text/html; charset=UTF-8" }),
      );
      await expect(source.lookup("lantern", { collins: CREDENTIALS })).resolves.toMatchObject({
        status: "unavailable",
        reason: "blocked",
      });
    });

    it("should still blame the key when Collins itself answers 403 as JSON", async () => {
      const source = createCollinsSource(
        answering("lantern", {
          status: 403,
          body: '{"errorCode":403,"errorMessage":"Forbidden"}',
          contentType: "application/json",
        }),
      );
      await expect(source.lookup("lantern", { collins: CREDENTIALS })).resolves.toMatchObject({
        status: "unavailable",
        reason: "rejected-key",
      });
    });

    it("should report a blocked request when the rate limit answers HTTP 429", async () => {
      const source = createCollinsSource(answering("lantern", { status: 429, body: "" }));
      await expect(source.lookup("lantern", { collins: CREDENTIALS })).resolves.toMatchObject({
        status: "unavailable",
        reason: "blocked",
        message: expect.stringContaining("429"),
      });
    });

    it("should report Collins as unavailable when it answers HTTP 500", async () => {
      const http = answering("lantern", {
        status: 500,
        body: '{"errorCode":500,"errorMessage":"The dictionary service is temporarily unavailable."}',
      });
      const result = await createCollinsSource(http).lookup("lantern", { collins: CREDENTIALS });
      expect(result).toMatchObject({ status: "unavailable" });
      if (result.status !== "unavailable") throw new Error("expected unavailable");
      expect(result.message).toContain("500");
      expect(result.message).toContain("The dictionary service is temporarily unavailable.");
    });

    it("should send no second request when Collins answers HTTP 500", async () => {
      const http = answering("lantern", { status: 500, body: "" });
      await createCollinsSource(http).lookup("lantern", { collins: CREDENTIALS });
      expect(http.calls.map(call => call.url)).toEqual([searchUrl("lantern")]);
    });

    it("should report Collins as unavailable when it answers an unexpected HTTP 418", async () => {
      const http = answering("lantern", { status: 418, body: "" });
      const result = await createCollinsSource(http).lookup("lantern", { collins: CREDENTIALS });
      expect(result).toMatchObject({ status: "unavailable" });
      expect(http.calls).toHaveLength(1);
    });

    it("should leave out a server message that is not the short reason Collins documents", async () => {
      const http = answering("lantern", {
        status: 500,
        body: JSON.stringify({ errorCode: 500, errorMessage: "x".repeat(400) }),
      });
      const result = await createCollinsSource(http).lookup("lantern", { collins: CREDENTIALS });
      if (result.status !== "unavailable") throw new Error("expected unavailable");
      expect(result.message).toBe("Collins could not answer (HTTP 500).");
    });

    it("should report a network failure without repeating the key when Collins cannot be reached", async () => {
      const result = await createCollinsSource(httpServing({})).lookup("lantern", { collins: CREDENTIALS });
      expect(result).toMatchObject({ status: "unavailable", reason: "network" });
      if (result.status !== "unavailable") throw new Error("expected unavailable");
      expect(result.message).toBe("Could not reach Collins.");
      expect(result.message).not.toContain(CREDENTIALS.apiKey);
    });

    it("should name a timeout rather than an unreachable host when the request times out", async () => {
      const timingOut: Pick<HttpClient, "fetchText"> = {
        async fetchText(url) {
          const cause = new Error("The operation was aborted due to timeout");
          cause.name = "TimeoutError";
          throw new NetworkError(url, cause);
        },
      };
      const result = await createCollinsSource(timingOut).lookup("lantern", { collins: CREDENTIALS });
      expect(result).toMatchObject({ status: "unavailable", reason: "network", message: "Collins timed out." });
    });

    it("should report a format change when the body carries no entry content", async () => {
      const source = createCollinsSource(answering("lantern", { status: 200, body: '{"dictionaryCode":"english"}' }));
      await expect(source.lookup("lantern", { collins: CREDENTIALS })).resolves.toMatchObject({
        status: "unavailable",
        reason: "format-changed",
      });
    });
  });

  describe("request headers", () => {
    it("should send the access key and ask Collins for JSON", async () => {
      const http = serving("lantern");
      await createCollinsSource(http).lookup("lantern", { collins: CREDENTIALS });
      expect(http.calls).toEqual([
        { url: searchUrl("lantern"), headers: { accessKey: "test-key", Accept: "application/json" } },
      ]);
    });
  });

  describe("source description", () => {
    it("should declare the key it needs, the caching ban, and the names the UI shows", () => {
      const source = createCollinsSource(httpServing({}));
      expect(source.id).toBe("collins");
      expect(source.title).toBe("Collins");
      expect(source.requiresApiKey).toBe("collins");
      expect(source.cachingForbidden).toBe(true);
    });

    it("should build an entry URL with the word encoded for the path", () => {
      expect(createCollinsSource(httpServing({})).entryUrl(" Lantern ")).toBe(
        "https://www.collinsdictionary.com/dictionary/english/lantern",
      );
    });

    it("should join a two-word entry with a hyphen rather than an encoded space", () => {
      expect(createCollinsSource(httpServing({})).entryUrl("storm lantern")).toBe(
        "https://www.collinsdictionary.com/dictionary/english/storm-lantern",
      );
    });
  });
});
