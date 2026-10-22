export const SOURCE_IDS = ["wiktionary", "collins", "merriam-webster"] as const;

export type SourceId = (typeof SOURCE_IDS)[number];

export type AccentVariant = "us" | "uk";

export type PronunciationNotation = "ipa" | "respelling";

export interface Pronunciation {
  variant: AccentVariant;
  text?: string;
  notation?: PronunciationNotation;
  audioUrl?: string;
}

export interface Picture {
  thumbUrl: string;
  fullUrl?: string;
  caption?: string;
}

export type BadgeKind = "frequency" | "grammar" | "label";

export interface Badge {
  kind: BadgeKind;
  text: string;
}

export interface Sense {
  id: string;
  number: string;
  definition: string;
  examples: string[];
  labels: Badge[];
}

export interface EntrySection {
  id: string;
  title: string;
  partOfSpeech?: string;
  pronunciations: Pronunciation[];
  badges: Badge[];
  senses: Sense[];
  picture?: Picture;
}

export interface Entry {
  source: SourceId;
  headword: string;
  url: string;
  sections: EntrySection[];
}

export type UnavailableReason = "missing-key" | "rejected-key" | "network" | "blocked" | "format-changed";

export type LookupResult =
  | { status: "found"; entry: Entry }
  | { status: "not-found"; suggestions: string[] }
  | { status: "unavailable"; reason: UnavailableReason; message: string };

export type MerriamWebsterReference = "learners" | "collegiate";

export interface MerriamWebsterCredentials {
  apiKey: string;
  reference: MerriamWebsterReference;
}

export type CollinsDictionary = "english" | "english-learner" | "american-learner";

export interface CollinsCredentials {
  apiKey: string;
  dictionary: CollinsDictionary;
}

export interface LookupOptions {
  merriamWebster?: MerriamWebsterCredentials;
  collins?: CollinsCredentials;
}

export interface Attribution {
  text?: string;
  logo?: string;
}

export interface License {
  name: string;
  url: string;
}

export interface DictionarySource {
  id: SourceId;
  title: string;
  requiresApiKey?: "merriamWebster" | "collins";
  // NOTE: Collins' terms forbid storing its results.
  cachingForbidden?: true;
  attribution: Attribution;
  license?: License;
  entryUrl(word: string): string;
  lookup(word: string, options: LookupOptions): Promise<LookupResult>;
}

export function findPronunciation(section: EntrySection, variant: AccentVariant): Pronunciation | undefined {
  return section.pronunciations.find(pronunciation => pronunciation.variant === variant);
}

export function pictureForSense(section: EntrySection, sense: Sense): Picture | undefined {
  return section.senses[0]?.id === sense.id ? section.picture : undefined;
}
