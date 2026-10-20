import { LocalStorage } from "@raycast/api";

import { CategoryPulls, PullRequestShort } from "../types";
import { CATEGORY_IDS } from "../constants";

const categoryPullsKey = "categoryPulls";
const recentlyVisitedPullsKey = "recentlyVisitedPulls";

// DEPRECATE: written by earlier versions and only deleted here.
// Drop this cleanup once no install can still be carrying them.
// `updatedPulls` kept one flat list instead of per-category results;
// `dashboardBuckets` kept per-category results under the name this code used before the rename;
// `githubLogin` and `githubAPITokenLastValue` cached the viewer's login back when Octokit fetched it.
const legacyKeys = ["updatedPulls", "dashboardBuckets", "githubLogin", "githubAPITokenLastValue"];

export type PullStore = {
  categoryPulls: CategoryPulls;
  recentlyVisitedPulls: PullRequestShort[];
};

const parseJson = <T>(serialized: LocalStorage.Value | undefined, fallback: T): T => {
  if (serialized === undefined) {
    return fallback;
  }

  try {
    return JSON.parse(serialized as string) as T;
  } catch (error) {
    console.error("Discarding unreadable stored value", error);

    return fallback;
  }
};

const parsePulls = (serialized: LocalStorage.Value | undefined): PullRequestShort[] => {
  const stored = parseJson<Partial<PullRequestShort>[]>(serialized, []);

  return Array.isArray(stored) ? stored.filter((pull): pull is PullRequestShort => typeof pull?.repo === "string") : [];
};

export const emptyCategoryPulls = (): CategoryPulls =>
  CATEGORY_IDS.reduce(
    (categoryPulls, id) => ({ ...categoryPulls, [id]: { pulls: [], total: 0 } }),
    {} as CategoryPulls,
  );

export const loadAllPullsFromStore = (): Promise<PullStore> =>
  Promise.resolve()
    .then(() => console.debug("loadAllPullsFromStore"))
    .then(() => Promise.all(legacyKeys.map(key => LocalStorage.removeItem(key))))
    .then(() => Promise.all([LocalStorage.getItem(categoryPullsKey), LocalStorage.getItem(recentlyVisitedPullsKey)]))
    .then(([categoryPulls, recentlyVisitedPulls]) => ({
      categoryPulls: parseCategoryPulls(categoryPulls),
      recentlyVisitedPulls: parsePulls(recentlyVisitedPulls),
    }))
    .then(store => {
      console.debug(
        `loadAllPullsFromStore pulls=${CATEGORY_IDS.map(id => store.categoryPulls[id].pulls.length).join("/")} ` +
          `recentlyVisited=${store.recentlyVisitedPulls.length}`,
      );

      return store;
    });

const parseCategoryPulls = (serialized: LocalStorage.Value | undefined): CategoryPulls => {
  const stored = parseJson<Partial<CategoryPulls>>(serialized, {});

  return CATEGORY_IDS.reduce(
    (categoryPulls, id) => ({
      ...categoryPulls,
      [id]: Array.isArray(stored?.[id]?.pulls) ? stored[id] : { pulls: [], total: 0 },
    }),
    {} as CategoryPulls,
  );
};

export const saveCategoryPullsToStore = (categoryPulls: CategoryPulls) =>
  Promise.resolve()
    .then(() => console.debug("saveCategoryPullsToStore"))
    .then(() => LocalStorage.setItem(categoryPullsKey, JSON.stringify(categoryPulls)))
    .then(() =>
      console.debug(
        `saveCategoryPullsToStore pulls=${CATEGORY_IDS.map(id => categoryPulls[id].pulls.length).join("/")}`,
      ),
    );

export const saveRecentVisitedPullsToStore = (recentlyVisitedPulls: PullRequestShort[]) =>
  Promise.resolve()
    .then(() => console.debug("saveRecentVisitedPullsToStore"))
    .then(() => LocalStorage.setItem(recentlyVisitedPullsKey, JSON.stringify(recentlyVisitedPulls)))
    .then(() => console.debug(`saveRecentVisitedPullsToStore updated=${recentlyVisitedPulls.length}`));
