import { Action, ActionPanel, Alert, confirmAlert, Icon, List, showToast, Toast, Keyboard } from "@raycast/api";
import { getAvatarIcon, useCachedPromise } from "@raycast/utils";
import {
  cancelWorkflowTask,
  getWorkflowTasks,
  retryWorkflowTask,
  type Workflow,
  type WorkflowTask,
} from "../api/workflows";
import { getStatusColor } from "../statusColor";
import { getWorkflowTaskUrl } from "../webUrls";
import WorkflowTaskDetail from "./WorkflowTaskDetail";

// Matches the default page size of Zadig's task list endpoint.
const PAGE_SIZE = 50;

const CANCELLABLE_STATUSES = ["created", "running", "waiting"];
const RETRYABLE_STATUSES = ["failed", "cancelled", "timeout"];

type WorkflowTaskListProps = {
  projectKey: string;
  workflow: Workflow;
};

export default function WorkflowTaskList({ projectKey, workflow }: WorkflowTaskListProps) {
  const {
    data: tasks,
    isLoading,
    pagination,
    revalidate,
  } = useCachedPromise(
    (projectKey: string, workflowKey: string) =>
      async ({ page }: { page: number }) => {
        const { total, workflow_tasks } = await getWorkflowTasks(projectKey, workflowKey, page + 1, PAGE_SIZE);

        return { data: workflow_tasks, hasMore: (page + 1) * PAGE_SIZE < total };
      },
    [projectKey, workflow.workflow_key],
  );

  async function confirmCancel(task: WorkflowTask) {
    const isConfirmed = await confirmAlert({
      title: `Cancel run #${task.task_id}?`,
      message: `This stops ${workflow.workflow_name} #${task.task_id} where it is.`,
      primaryAction: { title: "Cancel Run", style: Alert.ActionStyle.Destructive },
      dismissAction: { title: "Keep Running" },
    });

    if (!isConfirmed) {
      return;
    }

    const toast = await showToast({ style: Toast.Style.Animated, title: `Cancelling run #${task.task_id}` });

    try {
      await cancelWorkflowTask(task.workflow_key, task.task_id);
      toast.style = Toast.Style.Success;
      toast.title = `Cancelled run #${task.task_id}`;
      revalidate();
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = `Failed to cancel run #${task.task_id}`;
      toast.message = error instanceof Error ? error.message : undefined;
    }
  }

  // A retry runs every stage again, deploys included, so it is confirmed first.
  async function confirmRetry(task: WorkflowTask) {
    const isConfirmed = await confirmAlert({
      title: `Retry run #${task.task_id}?`,
      message: `This runs ${workflow.workflow_name} #${task.task_id} again with the same inputs, deploy stages included.`,
      primaryAction: { title: "Retry Run" },
    });

    if (!isConfirmed) {
      return;
    }

    const toast = await showToast({ style: Toast.Style.Animated, title: `Retrying run #${task.task_id}` });

    try {
      await retryWorkflowTask(projectKey, task.workflow_key, task.task_id);
      toast.style = Toast.Style.Success;
      toast.title = `Retried run #${task.task_id}`;
      revalidate();
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = `Failed to retry run #${task.task_id}`;
      toast.message = error instanceof Error ? error.message : undefined;
    }
  }

  return (
    <List
      isShowingDetail
      navigationTitle={workflow.workflow_name}
      isLoading={isLoading}
      pagination={pagination}
      searchBarPlaceholder="Filter loaded runs by number, creator or status"
    >
      {tasks?.map(task => {
        const taskUrl = getWorkflowTaskUrl(projectKey, task.workflow_key, task.task_id);

        return (
          <List.Item
            key={task.task_id}
            icon={Icon.Boat}
            title={String(task.task_id)}
            keywords={[task.task_creator, task.status]}
            accessories={[
              { tag: { value: task.status, color: getStatusColor(task.status) } },
              { icon: getAvatarIcon(task.task_creator), tooltip: task.task_creator },
            ]}
            // Retry reuses the task id, so the status in the key reloads the detail for the new attempt.
            detail={<WorkflowTaskDetail key={`${task.task_id}-${task.status}`} task={task} />}
            actions={
              <ActionPanel>
                <ActionPanel.Section>
                  <Action.OpenInBrowser url={taskUrl} />
                  <Action.CopyToClipboard title="Copy Link" content={taskUrl} />
                  <Action
                    title="Refresh"
                    icon={Icon.RotateClockwise}
                    shortcut={Keyboard.Shortcut.Common.Refresh}
                    onAction={revalidate}
                  />
                </ActionPanel.Section>
                <ActionPanel.Section title="Operations">
                  {RETRYABLE_STATUSES.includes(task.status) && (
                    <Action title="Retry Run" icon={Icon.Repeat} onAction={() => confirmRetry(task)} />
                  )}
                  {CANCELLABLE_STATUSES.includes(task.status) && (
                    <Action
                      title="Cancel Run"
                      icon={Icon.XMarkCircle}
                      style={Action.Style.Destructive}
                      onAction={() => confirmCancel(task)}
                    />
                  )}
                </ActionPanel.Section>
              </ActionPanel>
            }
          />
        );
      })}
    </List>
  );
}
