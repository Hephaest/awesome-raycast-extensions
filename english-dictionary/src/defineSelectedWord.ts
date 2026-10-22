import { Clipboard, getSelectedText, launchCommand, LaunchType, showToast, Toast } from "@raycast/api";
import type { SearchLaunchContext } from "./utils/launch";
import { chooseLookupTarget, cleanSelection, MAX_PHRASE_WORDS } from "./utils/words";

async function readTarget(): Promise<SearchLaunchContext | undefined> {
  try {
    const selected = await getSelectedText();
    if (selected.trim()) {
      const target = chooseLookupTarget(selected);
      if (!target) return undefined;
      const note = target.substitutedFrom
        ? { reason: "shortened" as const, original: target.substitutedFrom }
        : undefined;
      return { word: target.word, note };
    }
  } catch {
    // Nothing selected: fall through to the clipboard.
  }
  const clipboard = cleanSelection((await Clipboard.readText()) ?? "");
  if (!clipboard || clipboard.split(" ").length > MAX_PHRASE_WORDS) return undefined;
  return { word: clipboard, note: { reason: "clipboard" } };
}

// A toast becomes a HUD once Raycast's window closes, so each title must stand on its own.
export default async function DefineSelectedWordCommand() {
  const context = await readTarget();
  if (!context) {
    await showToast({
      style: Toast.Style.Failure,
      title: "No Word Selected or Copied",
      message: "Select a word, or copy a short phrase, then run Define Selected Word again.",
    });
    return;
  }
  try {
    await launchCommand({ name: "searchWord", type: LaunchType.UserInitiated, context });
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Couldn't Open Search Word",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
