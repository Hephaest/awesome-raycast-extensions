import { environment, showToast, Toast } from "@raycast/api";
import path from "node:path";
import { curlClient } from "../api/curl";
import { httpClient } from "../api/request";
import type { HttpClient } from "../api/request";
import type { Entry, EntrySection } from "../api/types";
import { findPronunciation } from "../api/types";
import { createAudioPlayer } from "./audioPlayer";
import type { AudioChoice } from "./pronunciation";
import { VARIANT_NAMES } from "./pronunciation";

// Collins clips come from the Cloudflare-fronted API host, so they go through curl.
const COLLINS_MEDIA_HOST = "api.collinsdictionary.com";

function clientFor(url: string): Pick<HttpClient, "fetchBytes"> {
  try {
    return new URL(url).host === COLLINS_MEDIA_HOST ? curlClient : httpClient;
  } catch {
    return httpClient;
  }
}

export const audioPlayer = createAudioPlayer({
  directory: path.join(environment.supportPath, "audio"),
  http: { fetchBytes: url => clientFor(url).fetchBytes(url) },
});

// Raycast hides whichever toast is on screen, so only the latest playback may hide its own.
let latestPlayback = 0;

async function playWithFeedback(title: string, playback: () => Promise<void>): Promise<void> {
  const ticket = ++latestPlayback;
  const toast = await showToast({ style: Toast.Style.Animated, title });
  try {
    await playback();
    if (ticket === latestPlayback) await toast.hide();
  } catch (error) {
    toast.style = Toast.Style.Failure;
    toast.title = "Couldn't Play the Pronunciation";
    toast.message = error instanceof Error ? error.message : String(error);
  }
}

export async function pronounce(choice: AudioChoice, entry: Entry, section: EntrySection): Promise<void> {
  if (choice === "voice") {
    await playWithFeedback("Speaking with macOS Voice", () => audioPlayer.speak(entry.headword));
    return;
  }
  const url = findPronunciation(section, choice)?.audioUrl;
  if (!url) return;
  await playWithFeedback(`Playing ${VARIANT_NAMES[choice]} Pronunciation`, () => audioPlayer.play(url));
}
