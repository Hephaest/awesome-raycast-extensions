/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never };
import * as Types from "../schema.generated";

import { GraphQLClient, type RequestOptions } from "graphql-request";
import gql from "graphql-tag";
type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"];
export type PullRequestSummaryFragment = {
  __typename: "PullRequest";
  id: string;
  title: string;
  url: string;
  updatedAt: string;
  author:
    | { login: string; avatarUrl: string }
    | { login: string; avatarUrl: string }
    | { login: string; avatarUrl: string }
    | { login: string; avatarUrl: string }
    | { login: string; avatarUrl: string }
    | null;
  repository: { nameWithOwner: string };
};

export type PullRequestCategoriesQueryVariables = Exact<{
  needsYourReview: string;
  yourDrafts: string;
  waitingForReview: string;
  changesRequested: string;
  failingChecks: string;
  readyToMerge: string;
}>;

export type PullRequestCategoriesQuery = {
  needsYourReview: {
    issueCount: number;
    nodes: Array<
      | {
          __typename: "PullRequest";
          id: string;
          title: string;
          url: string;
          updatedAt: string;
          author:
            | { login: string; avatarUrl: string }
            | { login: string; avatarUrl: string }
            | { login: string; avatarUrl: string }
            | { login: string; avatarUrl: string }
            | { login: string; avatarUrl: string }
            | null;
          repository: { nameWithOwner: string };
        }
      | Record<PropertyKey, never>
      | null
    > | null;
  };
  yourDrafts: {
    issueCount: number;
    nodes: Array<
      | {
          __typename: "PullRequest";
          id: string;
          title: string;
          url: string;
          updatedAt: string;
          author:
            | { login: string; avatarUrl: string }
            | { login: string; avatarUrl: string }
            | { login: string; avatarUrl: string }
            | { login: string; avatarUrl: string }
            | { login: string; avatarUrl: string }
            | null;
          repository: { nameWithOwner: string };
        }
      | Record<PropertyKey, never>
      | null
    > | null;
  };
  waitingForReview: {
    issueCount: number;
    nodes: Array<
      | {
          __typename: "PullRequest";
          id: string;
          title: string;
          url: string;
          updatedAt: string;
          author:
            | { login: string; avatarUrl: string }
            | { login: string; avatarUrl: string }
            | { login: string; avatarUrl: string }
            | { login: string; avatarUrl: string }
            | { login: string; avatarUrl: string }
            | null;
          repository: { nameWithOwner: string };
        }
      | Record<PropertyKey, never>
      | null
    > | null;
  };
  changesRequested: {
    issueCount: number;
    nodes: Array<
      | {
          __typename: "PullRequest";
          id: string;
          title: string;
          url: string;
          updatedAt: string;
          author:
            | { login: string; avatarUrl: string }
            | { login: string; avatarUrl: string }
            | { login: string; avatarUrl: string }
            | { login: string; avatarUrl: string }
            | { login: string; avatarUrl: string }
            | null;
          repository: { nameWithOwner: string };
        }
      | Record<PropertyKey, never>
      | null
    > | null;
  };
  failingChecks: {
    issueCount: number;
    nodes: Array<
      | {
          __typename: "PullRequest";
          id: string;
          title: string;
          url: string;
          updatedAt: string;
          author:
            | { login: string; avatarUrl: string }
            | { login: string; avatarUrl: string }
            | { login: string; avatarUrl: string }
            | { login: string; avatarUrl: string }
            | { login: string; avatarUrl: string }
            | null;
          repository: { nameWithOwner: string };
        }
      | Record<PropertyKey, never>
      | null
    > | null;
  };
  readyToMerge: {
    issueCount: number;
    nodes: Array<
      | {
          __typename: "PullRequest";
          id: string;
          title: string;
          url: string;
          updatedAt: string;
          author:
            | { login: string; avatarUrl: string }
            | { login: string; avatarUrl: string }
            | { login: string; avatarUrl: string }
            | { login: string; avatarUrl: string }
            | { login: string; avatarUrl: string }
            | null;
          repository: { nameWithOwner: string };
        }
      | Record<PropertyKey, never>
      | null
    > | null;
  };
};

export const PullRequestSummaryFragmentDoc = gql`
  fragment PullRequestSummary on PullRequest {
    __typename
    id
    title
    url
    updatedAt
    author {
      login
      avatarUrl
    }
    repository {
      nameWithOwner
    }
  }
`;
export const PullRequestCategoriesDocument = gql`
  query PullRequestCategories(
    $needsYourReview: String!
    $yourDrafts: String!
    $waitingForReview: String!
    $changesRequested: String!
    $failingChecks: String!
    $readyToMerge: String!
  ) {
    needsYourReview: search(type: ISSUE, first: 50, query: $needsYourReview) {
      issueCount
      nodes {
        ...PullRequestSummary
      }
    }
    yourDrafts: search(type: ISSUE, first: 50, query: $yourDrafts) {
      issueCount
      nodes {
        ...PullRequestSummary
      }
    }
    waitingForReview: search(type: ISSUE, first: 50, query: $waitingForReview) {
      issueCount
      nodes {
        ...PullRequestSummary
      }
    }
    changesRequested: search(type: ISSUE, first: 50, query: $changesRequested) {
      issueCount
      nodes {
        ...PullRequestSummary
      }
    }
    failingChecks: search(type: ISSUE, first: 50, query: $failingChecks) {
      issueCount
      nodes {
        ...PullRequestSummary
      }
    }
    readyToMerge: search(type: ISSUE, first: 50, query: $readyToMerge) {
      issueCount
      nodes {
        ...PullRequestSummary
      }
    }
  }
  ${PullRequestSummaryFragmentDoc}
`;

export type SdkFunctionWrapper = <T>(
  action: (requestHeaders?: Record<string, string>) => Promise<T>,
  operationName: string,
  operationType?: string,
  variables?: any,
) => Promise<T>;

const defaultWrapper: SdkFunctionWrapper = (action, _operationName, _operationType, _variables) => action();

export function getSdk(client: GraphQLClient, withWrapper: SdkFunctionWrapper = defaultWrapper) {
  return {
    PullRequestCategories(
      variables: PullRequestCategoriesQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<PullRequestCategoriesQuery> {
      return withWrapper(
        wrappedRequestHeaders =>
          client.request<PullRequestCategoriesQuery>({
            document: PullRequestCategoriesDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "PullRequestCategories",
        "query",
        variables,
      );
    },
  };
}
export type Sdk = ReturnType<typeof getSdk>;
