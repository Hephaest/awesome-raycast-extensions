import type { LookupNote } from "./states";

export interface SearchLaunchContext {
  word?: string;
  note?: LookupNote;
}

export interface LaunchInput {
  launchContext?: SearchLaunchContext;
  arguments?: { word?: string };
  fallbackText?: string;
}

export function launchRequest(input: LaunchInput): { word: string; note?: LookupNote } | undefined {
  const contextWord = input.launchContext?.word?.trim();
  if (contextWord) return { word: contextWord, note: input.launchContext?.note };
  const word = input.arguments?.word?.trim() || input.fallbackText?.trim();
  return word ? { word } : undefined;
}
