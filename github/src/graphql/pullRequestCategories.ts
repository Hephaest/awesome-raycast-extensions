import { ClientError } from "graphql-request";
import graphQLClient from "../integration/graphQLClient";
import { CATEGORY_IDS } from "../constants";
import { buildCategoryQuery } from "../util";
import { CategoryId, CategoryPulls, PullRequestShort } from "../types";
import {
  getSdk,
  PullRequestCategoriesQuery,
  PullRequestCategoriesQueryVariables,
  PullRequestSummaryFragment,
} from "./PullRequestCategories.generated";

type SearchNode = NonNullable<PullRequestCategoriesQuery[CategoryId]["nodes"]>[number];

const isPullRequest = (node: SearchNode): node is PullRequestSummaryFragment => node?.__typename === "PullRequest";

const toPullRequestShort = (node: PullRequestSummaryFragment): PullRequestShort => ({
  id: node.id,
  title: node.title,
  url: node.url,
  updatedAt: node.updatedAt,
  author: node.author ? { login: node.author.login, avatarUrl: node.author.avatarUrl } : null,
  repo: node.repository.nameWithOwner,
});

const buildVariables = (): PullRequestCategoriesQueryVariables =>
  CATEGORY_IDS.reduce(
    (variables, id) => ({ ...variables, [id]: buildCategoryQuery(id) }),
    {} as PullRequestCategoriesQueryVariables,
  );

const toCategories = (data: Partial<PullRequestCategoriesQuery>): Partial<CategoryPulls> =>
  CATEGORY_IDS.reduce((categoryPulls, id) => {
    const nodes = data[id]?.nodes;

    return nodes
      ? {
          ...categoryPulls,
          [id]: { pulls: nodes.filter(isPullRequest).map(toPullRequestShort), total: data[id]?.issueCount ?? 0 },
        }
      : categoryPulls;
  }, {} as Partial<CategoryPulls>);

const handleFetchDataError = (error: unknown): Partial<PullRequestCategoriesQuery> => {
  if (error instanceof ClientError && error.response.data) {
    console.debug("fetchPullRequestCategories: partial response", error.response.errors);

    return error.response.data as Partial<PullRequestCategoriesQuery>;
  }

  throw error;
};

const fetchPullRequestCategories = (): Promise<Partial<CategoryPulls>> =>
  Promise.resolve()
    .then(() => console.debug("fetchPullRequestCategories: start"))
    .then(() => getSdk(graphQLClient).PullRequestCategories(buildVariables()))
    .catch(handleFetchDataError)
    .then(toCategories)
    .then(categoryPulls => {
      console.debug(
        `fetchPullRequestCategories: ${CATEGORY_IDS.map(id => `${id}=${categoryPulls[id]?.pulls.length ?? "-"}`).join(" ")}`,
      );

      return categoryPulls;
    });

export default fetchPullRequestCategories;
