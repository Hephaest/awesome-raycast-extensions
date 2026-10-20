import { useEffect, useRef, useState } from "react";
import usePullStore from "./usePullStore";
import fetchPullRequestCategories from "../graphql/pullRequestCategories";
import { isActionUserInitiated } from "../util";

const usePulls = () => {
  const { isPullStoreLoading, categoryPulls, recentlyVisitedPulls, visitPull, mergeCategoryPulls } = usePullStore();

  const [isRemotePullsLoading, setIsRemotePullsLoading] = useState(() => !isActionUserInitiated());

  // Re-entrancy lock, kept separate from isRemotePullsLoading (which starts true on a background launch and would self-block)
  // A ref write is synchronous, so overlapping calls can't race it.
  const isRefreshing = useRef(false);

  const runPullIteration = async () => {
    if (isRefreshing.current) {
      console.debug("runPullIteration: already refreshing, ignored");

      return;
    }

    isRefreshing.current = true;
    console.debug("runPullIteration >>>>>>>>>");
    setIsRemotePullsLoading(true);

    try {
      const fetched = await fetchPullRequestCategories();

      await mergeCategoryPulls(fetched);
    } catch (error) {
      console.error(error);
    } finally {
      isRefreshing.current = false;
      setIsRemotePullsLoading(false);
      console.debug("<<<<<<<<< runPullIteration");
    }
  };

  useEffect(() => {
    // Run effect only after we load from store.
    if (isPullStoreLoading) {
      return;
    }

    if (isActionUserInitiated()) {
      return;
    }

    runPullIteration();
  }, [isPullStoreLoading]);

  return {
    isLoading: isPullStoreLoading || isRemotePullsLoading,
    isReady: !isPullStoreLoading,
    categoryPulls,
    recentlyVisitedPulls,
    visitPull,
    runPullIteration,
  };
};

export default usePulls;
