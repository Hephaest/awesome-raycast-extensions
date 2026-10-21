import { getBaseUrl } from "./api/request";

// NOTE: The OpenAPI returns no web links, so these follow the routes of Zadig's web app.
export const getWorkflowTaskUrl = (projectKey: string, workflowKey: string, taskId: number) =>
  `${getBaseUrl()}/v1/projects/detail/${encodeURIComponent(projectKey)}/pipelines/custom/${encodeURIComponent(workflowKey)}/${taskId}?${new URLSearchParams({ status: "", id: "", display_name: workflowKey })}`;

export const getEnvironmentUrl = (projectKey: string, environmentKey: string) =>
  `${getBaseUrl()}/v1/projects/detail/${encodeURIComponent(projectKey)}/envs/detail?${new URLSearchParams({ envName: environmentKey })}`;
