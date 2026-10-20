import { Icon } from "@raycast/api";
import type { PullRequestCategoriesQuery } from "./graphql/PullRequestCategories.generated";

export type PullRequestShort = {
  id: string;
  title: string;
  url: string;
  updatedAt: string;
  author: UserShort | null;
  repo: string;
};

export type UserShort = {
  login: string;
  avatarUrl: string;
};

export type Category = {
  title: string;
  query: string;
  icon: Icon;
};

export type CategoryId = keyof PullRequestCategoriesQuery;

export type CategoryPulls = Record<CategoryId, { pulls: PullRequestShort[]; total: number }>;
