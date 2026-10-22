import { LocalStorage } from "@raycast/api";
import { z } from "zod";
import { SOURCE_IDS } from "../api/types";
import type { SourceId } from "../api/types";

export const RECENT_LIMIT = 20;
const STORAGE_KEY = "recent-lookups";

// NOTE: Only the typed word, the dictionary and the time are stored; API terms forbid keeping entry content on disk.
const recentLookupSchema = z.object({
  word: z.string().min(1),
  source: z.enum(SOURCE_IDS),
  lookedUpAt: z.string(),
});

export type RecentLookup = z.infer<typeof recentLookupSchema>;

export async function listRecent(): Promise<RecentLookup[]> {
  const raw = await LocalStorage.getItem<string>(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap(row => {
      const result = recentLookupSchema.safeParse(row);
      return result.success ? [result.data] : [];
    });
  } catch {
    return [];
  }
}

// Writes run one at a time, or a late remember could undo a clear.
let pendingWrite: Promise<unknown> = Promise.resolve();

function serialized(write: () => Promise<void>): Promise<void> {
  const run = pendingWrite.then(write, write);
  pendingWrite = run.catch(() => undefined);
  return run;
}

export function rememberLookup(lookup: Omit<RecentLookup, "lookedUpAt">): Promise<void> {
  return serialized(async () => {
    const others = (await listRecent()).filter(item => !(item.word === lookup.word && item.source === lookup.source));
    const next = [{ ...lookup, lookedUpAt: new Date().toISOString() }, ...others].slice(0, RECENT_LIMIT);
    await LocalStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  });
}

export function forgetLookup(word: string, source: SourceId): Promise<void> {
  return serialized(async () => {
    const remaining = (await listRecent()).filter(item => !(item.word === word && item.source === source));
    await LocalStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
  });
}

export function clearRecent(): Promise<void> {
  return serialized(() => LocalStorage.removeItem(STORAGE_KEY));
}

export function matchingRecent(recent: RecentLookup[], text: string, currentSource: SourceId): RecentLookup[] {
  const prefix = text.trim().toLowerCase();
  if (!prefix) return recent;
  return recent.filter(
    item =>
      item.word.toLowerCase().startsWith(prefix) &&
      !(item.word.toLowerCase() === prefix && item.source === currentSource),
  );
}
