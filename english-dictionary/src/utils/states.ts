import type { DictionarySource, LookupResult } from "../api/types";

export function lookupResultTitle(source: DictionarySource, word: string, result: LookupResult): string {
  if (result.status === "found") return result.entry.headword;
  if (result.status === "not-found") return `No Entry for “${word}” in ${source.title}`;
  switch (result.reason) {
    case "network":
      return `Couldn't Reach ${source.title}`;
    case "blocked":
      return `${source.title} Refused the Request`;
    case "format-changed":
      return `Couldn't Read the ${source.title} Page`;
    case "missing-key":
      return `${source.title} Needs an API Key`;
    case "rejected-key":
      return `${source.title} Rejected Your API Key`;
  }
}

export type NoteReason = "shortened" | "clipboard" | "fallback";

export interface LookupNote {
  reason: NoteReason;
  original?: string;
}

export function lookupNoteText(note: LookupNote, word: string): string {
  switch (note.reason) {
    case "shortened":
      return `Looked up “${word}”, the longest word in your selection.`;
    case "clipboard":
      return `Looked up “${word}” from your clipboard.`;
    case "fallback":
      return `No entry for “${note.original}”. Showing “${word}” instead.`;
  }
}
