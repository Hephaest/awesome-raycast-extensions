import { request } from "./request";

export type Workflow = {
  workflow_key: string;
  workflow_name: string;
  type: string;
  update_by: string;
  update_time: number;
};

export type WorkflowTask = {
  task_id: number;
  workflow_key: string;
  task_creator: string;
  create_time: number;
  start_time: number;
  end_time: number;
  status: string;
};

type WorkflowTaskPage = {
  total: number;
  workflow_tasks: WorkflowTask[];
};

type WorkflowTaskResponse = {
  params: { name: string; type: string; value: string }[] | null;
  stages:
    | {
        name: string;
        status: string;
        jobs:
          | {
              type: string;
              spec?: {
                repos?: { repo_name: string; branch: string; commit_id: string; commit_message: string }[] | null;
              };
            }[]
          | null;
      }[]
    | null;
};

export type WorkflowTaskBuild = {
  repoName: string;
  branch: string;
  commitId: string;
  commitMessage: string;
};

export type WorkflowTaskDetail = {
  choices: { name: string; value: string }[];
  stages: { name: string; status: string }[];
  builds: WorkflowTaskBuild[];
};

// TODO(zadig-run-workflow): Start a run from a form built on GET /workflows/custom/:workflowKey/detail.

// NOTE: Only custom workflows have run endpoints in the OpenAPI.
export async function getWorkflows(projectKey: string) {
  const { workflows } = await request<{ workflows: Workflow[] }>("/workflows", { params: { projectKey } });

  return workflows.filter(workflow => workflow.type === "custom");
}

export const getWorkflowTasks = (projectKey: string, workflowKey: string, pageNum: number, pageSize: number) =>
  request<WorkflowTaskPage>(`/workflows/custom/${encodeURIComponent(workflowKey)}/tasks`, {
    params: { projectKey, pageNum, pageSize },
  });

export const cancelWorkflowTask = (workflowKey: string, taskId: number) =>
  request<void>("/workflows/custom/task", { method: "DELETE", params: { workflowKey, taskId } });

// Zadig reruns the same task in place rather than creating a new one.
export const retryWorkflowTask = (projectKey: string, workflowKey: string, taskId: number) =>
  request<void>(`/workflows/custom/${encodeURIComponent(workflowKey)}/task/${taskId}`, {
    method: "POST",
    params: { projectKey },
  });

// ! The response carries repository OAuth tokens in cleartext, so only the displayed fields leave this function and reach Raycast's cache.
export async function getWorkflowTask(workflowKey: string, taskId: number): Promise<WorkflowTaskDetail> {
  const task = await request<WorkflowTaskResponse>("/workflows/custom/task", { params: { workflowKey, taskId } });
  const stages = task.stages ?? [];

  return {
    // Choice parameters hold picked options such as the target environment, while free-text parameters may hold secrets.
    choices: (task.params ?? []).filter(param => param.type === "choice").map(({ name, value }) => ({ name, value })),
    stages: stages.map(({ name, status }) => ({ name, status })),
    builds: stages
      .flatMap(stage => stage.jobs ?? [])
      .filter(job => job.type === "zadig-build")
      .flatMap(job =>
        (job.spec?.repos ?? []).map(repo => ({
          repoName: repo.repo_name,
          branch: repo.branch,
          commitId: repo.commit_id,
          commitMessage: repo.commit_message,
        })),
      ),
  };
}
