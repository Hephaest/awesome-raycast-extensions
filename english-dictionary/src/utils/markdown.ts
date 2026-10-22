import type { Attribution, Entry, EntrySection, Picture, Sense } from "../api/types";
import { pictureForSense } from "../api/types";

const PICTURE_WIDTH = 340;

const FULL_PICTURE_WIDTH = 640;

// NOTE: Merriam-Webster approves its logo at 50, 100 or 125 px only.
const LOGO_SIZE = 50;

function escapeMarkdown(text: string): string {
  return text.replace(/([\\`*_{}[\]<>#+!|])/g, "\\$1");
}

export function pictureUrl(picture: Picture): string {
  return picture.fullUrl ?? picture.thumbUrl;
}

function pictureLines(picture: Picture, fallbackAlt: string, width: number): string[] {
  const url = pictureUrl(picture);
  const separator = url.includes("?") ? "&" : "?";
  const lines = [`![${escapeMarkdown(picture.caption ?? fallbackAlt)}](${url}${separator}raycast-width=${width})`];
  if (picture.caption) lines.push(`*${escapeMarkdown(picture.caption)}*`);
  return lines;
}

function exampleLines(sense: Sense): string[] {
  return sense.examples.map(example => `- *${escapeMarkdown(example)}*`);
}

function attributionMarkdown(attribution: Attribution): string {
  const lines: string[] = [];
  // Raycast resolves a bare file name against the assets folder.
  if (attribution.logo) lines.push(`![](${attribution.logo}?raycast-width=${LOGO_SIZE}&raycast-height=${LOGO_SIZE})`);
  if (attribution.text) lines.push(`*${escapeMarkdown(attribution.text)}*`);
  return lines.join("\n\n");
}

export function senseMarkdown(
  entry: Entry,
  section: EntrySection,
  sense: Sense,
  attribution: Attribution,
  options: { note?: string } = {},
): string {
  const lines: string[] = [`# ${escapeMarkdown(entry.headword)}`, ""];
  if (options.note) lines.push(`*${escapeMarkdown(options.note)}*`, "");
  lines.push(`**${sense.number}.** ${escapeMarkdown(sense.definition)}`, "");
  const examples = exampleLines(sense);
  if (examples.length > 0) lines.push(...examples, "");
  const picture = pictureForSense(section, sense);
  if (picture) lines.push(...pictureLines(picture, section.title, PICTURE_WIDTH), "");
  lines.push(attributionMarkdown(attribution));
  return lines.join("\n").trimEnd();
}

export function pictureMarkdown(entry: Entry, picture: Picture, attribution: Attribution): string {
  const lines = [
    `# ${escapeMarkdown(entry.headword)}`,
    "",
    ...pictureLines(picture, entry.headword, FULL_PICTURE_WIDTH),
  ];
  lines.push("", attributionMarkdown(attribution));
  return lines.join("\n").trimEnd();
}

export function senseClipboardText(
  entry: Entry,
  section: EntrySection,
  sense: Sense,
  attribution: Attribution,
): string {
  const heading = [entry.headword, section.partOfSpeech].filter(Boolean).join(" · ");
  const examples = sense.examples.map(example => `  - ${example}`);
  const lines = [heading, sense.definition, ...examples];
  if (attribution.text) lines.push(attribution.text);
  return lines.join("\n");
}
