import { Icon } from "@raycast/api";
import type { CategoryId, Category } from "./types";

export const CATEGORIES: Record<CategoryId, Category> = {
  needsYourReview: {
    title: "Needs your review",
    query: "is:pr user-review-requested:@me state:open archived:false sort:updated-desc",
    icon: Icon.Bell,
  },

  yourDrafts: {
    title: "Your drafts",
    query: "is:pr author:@me is:draft state:open archived:false sort:updated-desc",
    icon: Icon.MugSteam,
  },

  waitingForReview: {
    title: "Waiting for review/checks",
    query:
      "is:pr author:@me state:open -is:draft archived:false -review:approved -review:changes_requested -status:failure sort:updated-desc",
    icon: Icon.Hourglass,
  },

  changesRequested: {
    title: "Changes requested",
    query: "is:pr author:@me state:open review:changes_requested archived:false sort:updated-desc -is:draft",
    icon: Icon.Bug,
  },

  failingChecks: {
    title: "Failing checks",
    query: "is:pr author:@me state:open status:failure archived:false sort:updated-desc -is:draft",
    icon: Icon.XMarkCircle,
  },

  readyToMerge: {
    title: "Ready to merge",
    query:
      "is:pr author:@me state:open -is:draft review:approved -review:changes_requested -status:failure -is:queued archived:false sort:updated-desc",
    icon: Icon.Checkmark,
  },
};

export const INBOUND_CATEGORY_IDS = ["needsYourReview"] as const satisfies readonly CategoryId[];

export const OUTBOUND_CATEGORY_IDS = [
  "yourDrafts",
  "waitingForReview",
  "changesRequested",
  "failingChecks",
  "readyToMerge",
] as const satisfies readonly CategoryId[];

export const CATEGORY_IDS = [...INBOUND_CATEGORY_IDS, ...OUTBOUND_CATEGORY_IDS] as const;
