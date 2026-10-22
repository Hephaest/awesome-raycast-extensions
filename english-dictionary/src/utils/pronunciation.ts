import type { AccentVariant, EntrySection } from "../api/types";
import { findPronunciation } from "../api/types";

export const VARIANT_NAMES: Record<AccentVariant, string> = { us: "US", uk: "UK" };

export type AudioChoice = AccentVariant | "voice";

export function audioChoices(section: EntrySection, speakWhenNoRecording: boolean): AudioChoice[] {
  const recorded = (["us", "uk"] as const).filter(variant => findPronunciation(section, variant)?.audioUrl);
  if (recorded.length > 0) return recorded;
  return speakWhenNoRecording ? ["voice"] : [];
}
