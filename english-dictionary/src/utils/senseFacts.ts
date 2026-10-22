import type { Badge, EntrySection, Pronunciation, Sense } from "../api/types";
import { findPronunciation } from "../api/types";
import { VARIANT_NAMES } from "./pronunciation";

export interface PronunciationFact {
  accent: string;
  text?: string;
  hasRecording: boolean;
}

export interface SenseFacts {
  pronunciations: PronunciationFact[];
  partOfSpeech?: string;
  usage: string[];
  grammar: string[];
  frequency?: string;
}

function transcription(pronunciation: Pronunciation): string | undefined {
  if (!pronunciation.text) return undefined;
  return pronunciation.notation === "respelling" ? `\\${pronunciation.text}\\` : `/${pronunciation.text}/`;
}

function unbracketed(text: string): string {
  return text.replace(/^[[(]\s*/, "").replace(/\s*[\])]$/, "");
}

function textsOf(badges: Badge[], kinds: Badge["kind"][]): string[] {
  const texts = badges.filter(badge => kinds.includes(badge.kind)).map(badge => unbracketed(badge.text));
  return [...new Set(texts)];
}

export function senseFacts(section: EntrySection, sense: Sense): SenseFacts {
  const pronunciations = (["us", "uk"] as const).flatMap(variant => {
    const pronunciation = findPronunciation(section, variant);
    if (!pronunciation) return [];
    return [
      {
        accent: VARIANT_NAMES[variant],
        text: transcription(pronunciation),
        hasRecording: Boolean(pronunciation.audioUrl),
      },
    ];
  });
  const all = [...section.badges, ...sense.labels];
  return {
    pronunciations,
    partOfSpeech: section.partOfSpeech,
    usage: textsOf(all, ["label"]),
    grammar: textsOf(all, ["grammar"]),
    frequency: textsOf(section.badges, ["frequency"])[0],
  };
}
