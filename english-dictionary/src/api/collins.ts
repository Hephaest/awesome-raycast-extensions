import * as cheerio from "cheerio";
import type { Cheerio, CheerioAPI } from "cheerio";
import type { Element } from "domhandler";
import { z } from "zod";
import { NetworkError } from "./request";
import type { HttpClient } from "./request";
import { hyphenatedSlug } from "../utils/words";
import { curlClient } from "./curl";
import type {
  AccentVariant,
  Badge,
  EntrySection,
  LookupResult,
  Pronunciation,
  Sense,
  UnavailableReason,
} from "./types";
import type { CollinsCredentials, CollinsDictionary, DictionarySource, LookupOptions } from "./types";

const SITE_BASE = "https://www.collinsdictionary.com";
const API_BASE = "https://api.collinsdictionary.com/api/v1/dictionaries";

// NOTE: Collins' API terms require this line, unchanged, wherever its content is shown.
const ATTRIBUTION = "www.collinsdictionary.com © HarperCollins Publishers Ltd 2025";

const SUGGESTION_COUNT = 5;

const MAX_SERVER_REASON_LENGTH = 200;

const MISSING_KEY_MESSAGE =
  "Collins needs a key from the Collins Dictionary API portal. Paste it into the Collins API Key preference.";
const REJECTED_KEY_MESSAGE =
  "Collins refused the key. Check the Collins API Key preference, and make sure the Collins Dictionary preference names a dictionary the key is subscribed to.";
const BOT_WALL_MESSAGE =
  "The Collins API host turned this request away before it reached Collins, so the key is not at fault. Try again.";

// TODO(collins-american-path): No separate Advanced American page could be confirmed, so both Cobuild codes open the British one.
const PUBLIC_DICTIONARY_PATHS: Record<CollinsDictionary, string> = {
  english: "english",
  "english-learner": "english-cobuild-learners",
  "american-learner": "english-cobuild-learners",
};

const SELECTORS = {
  entry: "div.entry",
  headword: "h1.hwd",
  frequencyBand: "span.lbfreq",
  pronunciation: "span.pron",
  playbackControls: "a.playback, img, audio",
  audioSource: "audio source",
  homograph: "div.hom",
  senseNumber: "span.sensenum",
  partOfSpeech: "span.gramGrp span.pos",
  grammarLabel: "span.gramGrp span.lbl",
  sense: "div.sense",
  definition: "span.def",
  example: "span.cit span.quote",
  nestedForms: "div.formTypeInfl, span.re",
} as const;

const entrySchema = z.object({
  entryId: z.string().optional(),
  entryLabel: z.string().optional(),
  entryContent: z.string(),
});

const suggestionsSchema = z.object({ suggestions: z.array(z.string()) });

const serverErrorSchema = z.object({
  errorCode: z.union([z.number(), z.string()]).optional(),
  errorMessage: z.string().optional(),
});

type EntryPayload = z.infer<typeof entrySchema>;

function parseJson<T>(schema: z.ZodType<T>, body: string): T | undefined {
  try {
    return schema.parse(JSON.parse(body));
  } catch {
    return undefined;
  }
}

function normalizeWord(word: string): string {
  return word.trim().toLowerCase();
}

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function cleanText(element: Cheerio<Element>): string {
  return collapse(element.text());
}

// NOTE: Collins always answers JSON, so an HTML 401 or 403 is the Cloudflare challenge in front of it, not a rejected key.
function isBotWall(contentType: string): boolean {
  return !contentType.toLowerCase().includes("json");
}

function serverReason(body: string): string | undefined {
  const text = collapse(parseJson(serverErrorSchema, body)?.errorMessage ?? "");
  if (!text || text.length > MAX_SERVER_REASON_LENGTH) return undefined;
  return text;
}

function bareSenseNumber(text: string): string {
  return text.replace(/[^\p{L}\p{N}]+$/u, "");
}

function own($: CheerioAPI, nodes: Cheerio<Element>): Cheerio<Element> {
  return nodes.filter((_, element) => $(element).closest(SELECTORS.nestedForms).length === 0);
}

function accentOf(entry: Cheerio<Element>): AccentVariant {
  return (entry.attr("class") ?? "").split(/\s+/).includes("lang_en-us") ? "us" : "uk";
}

function parsePronunciations($: CheerioAPI, entry: Cheerio<Element>): Pronunciation[] {
  const block = own($, entry.find(SELECTORS.pronunciation)).first();
  if (block.length === 0) return [];
  const audioUrl = block.find(SELECTORS.audioSource).first().attr("src");
  const spoken = block.clone();
  spoken.find(SELECTORS.playbackControls).remove();
  const text = cleanText(spoken);
  if (!text && !audioUrl) return [];
  return [{ variant: accentOf(entry), text: text || undefined, notation: text ? "ipa" : undefined, audioUrl }];
}

function parseFrequencyBadges($: CheerioAPI, entry: Cheerio<Element>): Badge[] {
  const band = cleanText(own($, entry.find(SELECTORS.frequencyBand)).first());
  return band ? [{ kind: "frequency", text: band }] : [];
}

function parseGrammarBadges($: CheerioAPI, homograph: Cheerio<Element>): Badge[] {
  const seen = new Set<string>();
  const badges: Badge[] = [];
  own($, homograph.find(SELECTORS.grammarLabel)).each((_, element) => {
    const text = cleanText($(element));
    if (!text || seen.has(text)) return;
    seen.add(text);
    badges.push({ kind: "grammar", text });
  });
  return badges;
}

function quoteTexts($: CheerioAPI, quotes: Cheerio<Element>): string[] {
  return own($, quotes)
    .map((_, element) => cleanText($(element)))
    .get()
    .filter(example => example.length > 0);
}

function parseHomograph($: CheerioAPI, element: Element, sectionId: string, startNumber: number): Sense[] {
  const homograph = $(element);
  const badges = parseGrammarBadges($, homograph);
  const outsideSenses = (_: number, node: Element) => $(node).closest(SELECTORS.sense).length === 0;
  // Cobuild numbers the block itself, while the English dictionary numbers each sense inside it.
  const blockNumber = bareSenseNumber(
    cleanText(own($, homograph.find(SELECTORS.senseNumber)).filter(outsideSenses).first()),
  );
  const beside = quoteTexts($, homograph.find(SELECTORS.example).filter(outsideSenses));

  const senses: Sense[] = [];
  own($, homograph.find(SELECTORS.sense)).each((_, senseElement) => {
    const sense = $(senseElement);
    const definition = cleanText(own($, sense.find(SELECTORS.definition)).first());
    if (!definition) return;
    const number = startNumber + senses.length;
    senses.push({
      id: `${sectionId}-${number}`,
      number:
        bareSenseNumber(cleanText(own($, sense.find(SELECTORS.senseNumber)).first())) || blockNumber || String(number),
      definition,
      // A quote printed beside the senses belongs to the first sense of the block.
      examples: [...quoteTexts($, sense.find(SELECTORS.example)), ...(senses.length === 0 ? beside : [])],
      labels: badges,
    });
  });
  return senses;
}

interface SectionDraft {
  partOfSpeech: string;
  elements: Element[];
}

function groupByPartOfSpeech($: CheerioAPI, homographs: Cheerio<Element>): SectionDraft[] {
  const drafts: SectionDraft[] = [];
  homographs.each((_, element) => {
    const partOfSpeech = cleanText(own($, $(element).find(SELECTORS.partOfSpeech)).first());
    const current = drafts[drafts.length - 1];
    if (current && (!partOfSpeech || partOfSpeech === current.partOfSpeech)) current.elements.push(element);
    else drafts.push({ partOfSpeech, elements: [element] });
  });
  return drafts;
}

interface ParsedEntry {
  headword: string;
  sections: EntrySection[];
}

// TODO(collins-extras): Run-on derivatives (span.re) and etymology (div.etym) are skipped, as Entry has no field for them.
function parseEntry(payload: EntryPayload, word: string): ParsedEntry {
  const $ = cheerio.load(payload.entryContent);
  const entry = $(SELECTORS.entry).first();
  const headword =
    cleanText(entry.find(SELECTORS.headword).first()) || payload.entryLabel?.trim() || normalizeWord(word);
  const idBase = payload.entryId ?? normalizeWord(word);
  const pronunciations = parsePronunciations($, entry);
  const badges = parseFrequencyBadges($, entry);
  const drafts = groupByPartOfSpeech($, entry.find(SELECTORS.homograph));

  if (drafts.length === 0) {
    const plain = entry.clone();
    plain.find(SELECTORS.playbackControls).remove();
    const text = cleanText(plain);
    if (!text) return { headword, sections: [] };
    const sectionId = `${idBase}-1`;
    const sense: Sense = { id: `${sectionId}-1`, number: "1", definition: text, examples: [], labels: [] };
    return { headword, sections: [{ id: sectionId, title: headword, pronunciations, badges, senses: [sense] }] };
  }

  const sections: EntrySection[] = [];
  drafts.forEach((draft, index) => {
    const sectionId = `${idBase}-${index + 1}`;
    const senses: Sense[] = [];
    for (const element of draft.elements) senses.push(...parseHomograph($, element, sectionId, senses.length + 1));
    if (senses.length === 0) return;
    sections.push({
      id: sectionId,
      title: draft.partOfSpeech || headword,
      partOfSpeech: draft.partOfSpeech || undefined,
      pronunciations: [...pronunciations],
      badges: [...badges],
      senses,
    });
  });
  return { headword, sections };
}

function unavailable(reason: UnavailableReason, message: string): LookupResult {
  return { status: "unavailable", reason, message };
}

export function createCollinsSource(http: Pick<HttpClient, "fetchText"> = curlClient): DictionarySource {
  const entryUrl = (word: string, dictionary: CollinsDictionary = "english") =>
    `${SITE_BASE}/dictionary/${PUBLIC_DICTIONARY_PATHS[dictionary]}/${hyphenatedSlug(word)}`;

  function headersFor(credentials: CollinsCredentials): Record<string, string> {
    return { accessKey: credentials.apiKey, Accept: "application/json" };
  }

  async function suggestionsFor(word: string, credentials: CollinsCredentials): Promise<string[]> {
    const url =
      `${API_BASE}/${credentials.dictionary}/search/didyoumean` +
      `?q=${encodeURIComponent(normalizeWord(word))}&entrynumber=${SUGGESTION_COUNT}`;
    try {
      const response = await http.fetchText(url, headersFor(credentials));
      if (response.status !== 200) return [];
      return parseJson(suggestionsSchema, response.body)?.suggestions ?? [];
    } catch {
      return [];
    }
  }

  async function lookup(word: string, options: LookupOptions): Promise<LookupResult> {
    const credentials = options.collins;
    if (!credentials) return unavailable("missing-key", MISSING_KEY_MESSAGE);

    const url =
      `${API_BASE}/${credentials.dictionary}/search/first` +
      `?q=${encodeURIComponent(normalizeWord(word))}&format=html`;
    let response;
    try {
      response = await http.fetchText(url, headersFor(credentials));
    } catch (error) {
      if (error instanceof NetworkError) {
        return unavailable("network", error.timedOut ? "Collins timed out." : "Could not reach Collins.");
      }
      throw error;
    }

    if (response.status === 401 || response.status === 403) {
      if (isBotWall(response.contentType)) return unavailable("blocked", BOT_WALL_MESSAGE);
      return unavailable("rejected-key", REJECTED_KEY_MESSAGE);
    }
    if (response.status === 429) {
      return unavailable("blocked", `Collins refused the request (HTTP ${response.status}).`);
    }
    if (response.status === 404) return { status: "not-found", suggestions: await suggestionsFor(word, credentials) };
    // An outage is not a miss, so no billed call is spent on spelling suggestions.
    if (response.status !== 200) {
      const reason = serverReason(response.body);
      return unavailable("network", `Collins could not answer (HTTP ${response.status}).${reason ? ` ${reason}` : ""}`);
    }

    const payload = parseJson(entrySchema, response.body);
    if (!payload) return unavailable("format-changed", "Collins answered with something other than an entry.");

    const parsed = parseEntry(payload, word);
    if (parsed.sections.length === 0) return { status: "not-found", suggestions: [] };

    return {
      status: "found",
      entry: {
        source: "collins",
        headword: parsed.headword,
        url: entryUrl(parsed.headword, credentials.dictionary),
        sections: parsed.sections,
      },
    };
  }

  return {
    id: "collins",
    title: "Collins",
    attribution: { text: ATTRIBUTION },
    requiresApiKey: "collins",
    cachingForbidden: true,
    entryUrl,
    lookup,
  };
}
