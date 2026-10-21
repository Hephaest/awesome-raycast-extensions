import { Icon, List } from "@raycast/api";
import { getAvatarIcon, useCachedPromise } from "@raycast/utils";
import { getWorkflowTask, type WorkflowTask, type WorkflowTaskBuild } from "../api/workflows";
import { formatTime } from "../formatTime";
import { getStatusColor } from "../statusColor";

type WorkflowTaskDetailProps = {
  task: WorkflowTask;
};

// ! Commit messages and branch names are written by anyone who can push, so markdown is escaped to stop injected images or links, and only the first line is kept.
const toTableCell = (text: string) => text.split("\n")[0].replace(/[\\`*_[\]()!<>#|~]/g, "\\$&") || "-";

const toBuildTable = (builds: WorkflowTaskBuild[]) =>
  [
    "| **Repository** | **Branch** | **Commit** |",
    "| --- | --- | --- |",
    ...builds.map(
      build =>
        `| ${toTableCell(build.repoName)} | ${toTableCell(build.branch)} | \`${build.commitId.slice(0, 7)}\` ${toTableCell(build.commitMessage)} |`,
    ),
  ].join("\n");

export default function WorkflowTaskDetail({ task }: WorkflowTaskDetailProps) {
  const { data: detail, isLoading } = useCachedPromise(getWorkflowTask, [task.workflow_key, task.task_id]);

  return (
    <List.Item.Detail
      isLoading={isLoading}
      markdown={detail && detail.builds.length > 0 ? toBuildTable(detail.builds) : undefined}
      metadata={
        <List.Item.Detail.Metadata>
          {detail?.choices.map(choice => (
            <List.Item.Detail.Metadata.Label
              key={choice.name}
              title={choice.name}
              icon={Icon.Layers}
              text={choice.value}
            />
          ))}
          <List.Item.Detail.Metadata.Label
            title="Executor"
            icon={getAvatarIcon(task.task_creator)}
            text={task.task_creator}
          />
          <List.Item.Detail.Metadata.Separator />
          <List.Item.Detail.Metadata.Label title="Created Time" icon={Icon.Clock} text={formatTime(task.create_time)} />
          <List.Item.Detail.Metadata.Label title="Started Time" icon={Icon.Clock} text={formatTime(task.start_time)} />
          <List.Item.Detail.Metadata.Label title="Ended Time" icon={Icon.Clock} text={formatTime(task.end_time)} />
          {detail && detail.stages.length > 0 && (
            <>
              <List.Item.Detail.Metadata.Separator />
              <List.Item.Detail.Metadata.TagList title="Stages">
                {detail.stages.map(stage => (
                  <List.Item.Detail.Metadata.TagList.Item
                    key={stage.name}
                    text={stage.name}
                    color={getStatusColor(stage.status)}
                  />
                ))}
              </List.Item.Detail.Metadata.TagList>
            </>
          )}
        </List.Item.Detail.Metadata>
      }
    />
  );
}
