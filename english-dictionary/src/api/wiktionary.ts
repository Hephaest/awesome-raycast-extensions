// NOTE: The REST definition endpoint is experimental, being retired, and drops pronunciation and labels, so the Action API is used.
import * as cheerio from "cheerio";
import type { Cheerio, CheerioAPI } from "cheerio";
import type { Element } from "domhandler";
import { httpClient, NetworkError } from "./request";
import type { HttpClient } from "./request";
import type { AccentVariant, Badge, DictionarySource, EntrySection, LookupResult, Pronunciation, Sense } from "./types";

const SITE_BASE = "https://en.wiktionary.org";
const API_URL = `${SITE_BASE}/w/api.php?action=parse&format=json&formatversion=2&prop=text&redirects=1&disableeditsection=1&disabletoc=1&page=`;

const ACCENTS: Record<string, AccentVariant> = {
  US: "us",
  "General American": "us",
  UK: "uk",
  "Received Pronunciation": "uk",
};

interface ParsePayload {
  parse?: { title?: string; text?: string };
  error?: { code?: string; info?: string };
}

interface Block {
  id: string;
  title: string;
  body: Cheerio<Element>;
}

function cleanText(element: Cheerio<Element>): string {
  return element.text().replace(/\s+/g, " ").trim();
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(value => value.length > 0))];
}

function englishNodes($: CheerioAPI): Element[] {
  const nodes = $(".mw-parser-output").first().children().toArray();
  const start = nodes.findIndex(node => $(node).is(".mw-heading2") && $(node).find("h2#English").length > 0);
  if (start === -1) return [];
  const rest = nodes.slice(start + 1);
  const end = rest.findIndex(node => $(node).is(".mw-heading2"));
  return end === -1 ? rest : rest.slice(0, end);
}

function blocksOf($: CheerioAPI, nodes: Element[]): Block[] {
  const blocks: Array<{ heading: Cheerio<Element>; body: Element[] }> = [];
  for (const node of nodes) {
    if ($(node).is(".mw-heading")) blocks.push({ heading: $(node).find("h3, h4, h5, h6").first(), body: [] });
    else blocks.at(-1)?.body.push(node);
  }
  return blocks.map(({ heading, body }) => ({
    id: heading.attr("id") ?? "",
    title: cleanText(heading),
    body: $(body),
  }));
}

function accentOf(text: string): AccentVariant | undefined {
  for (const [, group] of text.matchAll(/\(([^)]+)\)/g)) {
    const accent = group
      .split(",")
      .map(part => ACCENTS[part.trim()])
      .find(Boolean);
    if (accent) return accent;
  }
  return undefined;
}

function parsePronunciations($: CheerioAPI, blocks: Block[]): Pronunciation[] {
  const found = new Map<AccentVariant, Pronunciation>();
  for (const block of blocks.filter(block => block.title === "Pronunciation")) {
    block.body.find("li").each((_, item) => {
      const node = $(item);
      const variant = accentOf(cleanText(node));
      if (!variant) return;
      const pronunciation = found.get(variant) ?? { variant };
      const ipa = cleanText(node.find("span.IPA").first()).replace(/^\/|\/$/g, "");
      if (ipa && !pronunciation.text) {
        pronunciation.text = ipa;
        pronunciation.notation = "ipa";
      }
      // Commons serves every Ogg recording as an mp3 copy, and afplay plays mp3.
      const audio = node.find('audio source[type="audio/mpeg"]').first().attr("src");
      if (audio && !pronunciation.audioUrl) pronunciation.audioUrl = audio.startsWith("//") ? `https:${audio}` : audio;
      found.set(variant, pronunciation);
    });
  }
  return (["us", "uk"] as const).flatMap(variant => {
    const pronunciation = found.get(variant);
    return pronunciation ? [pronunciation] : [];
  });
}

function parseSenses($: CheerioAPI, list: Cheerio<Element>, sectionId: string, prefix = ""): Sense[] {
  const senses: Sense[] = [];
  let count = 0;
  list
    .children("li")
    .not(".mw-empty-elt")
    .each((_, item) => {
      const node = $(item);
      const number = `${prefix}${++count}`;
      const own = node.clone();
      own.children("ol, ul, dl").remove();
      own.find("style, .reference, .defdate").remove();
      const labels: Badge[] = unique(
        own
          .find(".usage-label-sense .label-content")
          .map((_, label) => cleanText($(label)))
          .get(),
      ).map(text => ({ kind: "label", text }));
      own.find(".usage-label-sense").remove();
      const definition = cleanText(own);
      // Quotations sit in a separate list and are left out.
      const examples = unique(
        node
          .children("dl")
          .find(".h-usage-example .e-example")
          .map((_, example) => cleanText($(example)))
          .get(),
      );
      if (definition) senses.push({ id: `${sectionId}-${number}`, number, definition, examples, labels });
      senses.push(...parseSenses($, node.children("ol").first(), sectionId, `${number}.`));
    });
  return senses;
}

function parseSections($: CheerioAPI, blocks: Block[], pronunciations: Pronunciation[]): EntrySection[] {
  const sections = blocks.flatMap(block => {
    const list = block.body.filter("ol").first();
    if (block.body.find(".headword-line").length === 0 || list.length === 0) return [];
    const partOfSpeech = block.title.toLowerCase();
    const senses = parseSenses($, list, block.id);
    if (senses.length === 0) return [];
    return [{ id: block.id, title: partOfSpeech, partOfSpeech, pronunciations, badges: [], senses }];
  });
  const totals = new Map<string, number>();
  for (const section of sections) totals.set(section.title, (totals.get(section.title) ?? 0) + 1);
  const seen = new Map<string, number>();
  return sections.map(section => {
    if ((totals.get(section.title) ?? 0) < 2) return section;
    const index = (seen.get(section.title) ?? 0) + 1;
    seen.set(section.title, index);
    return { ...section, title: `${section.title} ${index}` };
  });
}

function unavailable(reason: "network" | "blocked" | "format-changed", message: string): LookupResult {
  return { status: "unavailable", reason, message };
}

export function createWiktionarySource(http: Pick<HttpClient, "fetchText"> = httpClient): DictionarySource {
  const entryUrl = (word: string) =>
    `${SITE_BASE}/wiki/${encodeURIComponent(word.trim().toLowerCase().replace(/\s+/g, "_"))}#English`;

  async function lookup(word: string): Promise<LookupResult> {
    let response;
    try {
      response = await http.fetchText(`${API_URL}${encodeURIComponent(word)}`);
    } catch (error) {
      if (error instanceof NetworkError) return unavailable("network", error.message);
      throw error;
    }
    if (response.status === 403 || response.status === 429) {
      return unavailable("blocked", `Wiktionary refused the request (HTTP ${response.status})`);
    }
    if (response.status !== 200) return unavailable("network", `Wiktionary answered HTTP ${response.status}`);

    let payload: ParsePayload;
    try {
      payload = JSON.parse(response.body) as ParsePayload;
    } catch {
      return unavailable("format-changed", "The entry loaded but could not be read.");
    }
    // TODO(wiktionary-suggestions): Offer spelling suggestions via action=opensearch after a miss.
    if (payload.error?.code === "missingtitle") return { status: "not-found", suggestions: [] };
    if (payload.error)
      return unavailable("network", `Wiktionary answered: ${payload.error.info ?? payload.error.code}`);
    if (typeof payload.parse?.text !== "string") {
      return unavailable("format-changed", "The entry loaded but could not be read.");
    }

    const $ = cheerio.load(payload.parse.text);
    const blocks = blocksOf($, englishNodes($));
    const sections = parseSections($, blocks, parsePronunciations($, blocks));
    if (sections.length === 0) return { status: "not-found", suggestions: [] };
    return {
      status: "found",
      entry: { source: "wiktionary", headword: payload.parse.title ?? word, url: entryUrl(word), sections },
    };
  }

  return {
    id: "wiktionary",
    title: "Wiktionary",
    // NOTE: The Source row credits Wiktionary; CC BY-SA still asks for the license and for saying the text was adapted.
    attribution: {},
    license: { name: "Adapted, CC BY-SA 4.0", url: "https://creativecommons.org/licenses/by-sa/4.0/" },
    entryUrl,
    lookup,
  };
}
