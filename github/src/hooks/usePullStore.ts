import { useEffect, useRef, useState } from "react";
import { CategoryPulls, PullRequestShort } from "../types";
import {
  emptyCategoryPulls,
  loadAllPullsFromStore,
  saveCategoryPullsToStore,
  saveRecentVisitedPullsToStore,
} from "../store/pulls";

const recentlyVisitedLimit = 20;

const usePullStore = () => {
  const [isPullStoreLoading, setIsPullStoreLoading] = useState(true);
  const [categoryPulls, setCategoryPulls] = useState<CategoryPulls>(emptyCategoryPulls);
  const [recentlyVisitedPulls, setRecentlyVisitedPulls] = useState<PullRequestShort[]>([]);

  const categoryPullsRef = useRef(categoryPulls);

  useEffect(() => {
    loadAllPullsFromStore()
      .then(store => {
        categoryPullsRef.current = store.categoryPulls;
        setCategoryPulls(store.categoryPulls);
        setRecentlyVisitedPulls(store.recentlyVisitedPulls);
      })
      .catch(console.error)
      .finally(() => setIsPullStoreLoading(false));
  }, []);

  return {
    isPullStoreLoading,
    recentlyVisitedPulls,
    categoryPulls,

    visitPull: (pull: PullRequestShort) =>
      Promise.resolve()
        .then(() => [pull, ...recentlyVisitedPulls.filter(visited => visited.id !== pull.id)])
        .then(visited => visited.slice(0, recentlyVisitedLimit))
        .then(visited => {
          setRecentlyVisitedPulls(visited);

          return saveRecentVisitedPullsToStore(visited);
        }),

    // NOTE: merged onto what is already held so a category missing from a partial response keeps its last known contents rather than reading as empty.
    mergeCategoryPulls: (fetched: Partial<CategoryPulls>) => {
      const merged = { ...categoryPullsRef.current, ...fetched };

      categoryPullsRef.current = merged;
      setCategoryPulls(merged);

      return saveCategoryPullsToStore(merged);
    },
  };
};

export default usePullStore;
