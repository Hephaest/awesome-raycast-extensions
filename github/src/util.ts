import TimeAgo from "javascript-time-ago";
import en from "javascript-time-ago/locale/en.json";
import { environment, LaunchType, getPreferenceValues } from "@raycast/api";
import { CATEGORIES } from "./constants";
import { CategoryId } from "./types";

const { owners } = getPreferenceValues<{ owners?: string }>();

TimeAgo.addDefaultLocale(en);
const timeAgo = new TimeAgo("en-US");

const ownerFilter = (owners ?? "")
  .split(",")
  .map(owner => owner.trim())
  .filter(Boolean)
  .map(owner => `user:${owner}`)
  .join(" ");

export function formatDate(input: Date | string) {
  const date = typeof input === "string" ? new Date(input) : input;
  return timeAgo.format(date, "twitter") as string;
}

export const isActionUserInitiated = () => {
  const userInitiated = environment.launchType === LaunchType.UserInitiated;

  console.debug(`isActionUserInitiated: ${userInitiated}`);

  return userInitiated;
};

export const buildCategoryQuery = (id: CategoryId): string =>
  [CATEGORIES[id].query, ownerFilter].filter(Boolean).join(" ");
