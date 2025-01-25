import { List } from "@raycast/api";
import { MutatePromise } from "@raycast/utils";
import { format } from "date-fns";
import { useMemo } from "react";

import { Issue } from "../api/issues";
import { getUserAvatar } from "../helpers/avatars";
import { getStatusColor, getParentIssueColor } from "../helpers/issues";
import { ellipsize } from "../helpers/string";

import IssueActions from "./IssueActions";

type IssueListItemProps = {
  issue: Issue;
  mutate: MutatePromise<Issue[] | undefined>;
};

const MAX_DISPLAY_ISSUE_TITLE_LENGTH = 24;
const MAX_DISPLAY_ISSUE_TOTAL_LENGTH = 76;

export default function IssueListItem({ issue, mutate }: IssueListItemProps) {
  const updatedAt = new Date(issue.fields.updated);
  const assignee = issue.fields.assignee;
  const issueStatus = issue.fields.status.name;
  const issueKey = issue.key;
  const keywords = [issue.key, issueStatus, issue.fields.issuetype.name];
  const parentIssue = issue.fields.parent;

  const issueTitle = useMemo(() => issue.fields.summary || "Unknown issue title", [issue]);

  const parentTitle = useMemo(() => {
    if (!parentIssue) {
      return "";
    }

    const {
      key,
      fields: { summary },
    } = parentIssue;

    return `${key}: ${summary}`;
  }, [parentIssue]);

  const totalIssueInfoLength = useMemo(
    () => issueTitle.concat(parentTitle, issueStatus, issueKey).length,
    [issueTitle, parentTitle, issueStatus, issueKey],
  );

  const displayIssueTitle = useMemo(() => {
    if (totalIssueInfoLength <= MAX_DISPLAY_ISSUE_TOTAL_LENGTH) {
      return issueTitle;
    }

    return ellipsize(issueTitle, MAX_DISPLAY_ISSUE_TITLE_LENGTH);
  }, [issueTitle, totalIssueInfoLength]);

  const displayParentTitle = useMemo(() => {
    if (totalIssueInfoLength <= MAX_DISPLAY_ISSUE_TOTAL_LENGTH) {
      return parentTitle;
    }

    return ellipsize(
      parentTitle,
      MAX_DISPLAY_ISSUE_TOTAL_LENGTH - displayIssueTitle.length - issueStatus.length - issueKey.length,
    );
  }, [issueStatus, displayIssueTitle, parentTitle, totalIssueInfoLength]);

  if (issue.fields.priority) {
    keywords.push(issue.fields.priority.name);
  }

  if (issue.fields.assignee) {
    keywords.push(issue.fields.assignee.displayName);
  }

  const accessories = [];

  if (parentIssue) {
    accessories.push({
      tag: { value: displayParentTitle, color: getParentIssueColor(parentIssue.fields.issuetype.name) },
    });
  }

  accessories.push({
    text: {
      value: issueStatus,
      color: issue.fields.status.statusCategory
        ? getStatusColor(issue.fields.status.statusCategory.colorName)
        : undefined,
    },
  });

  accessories.push({
    icon: getUserAvatar(assignee),
    tooltip: `Assignee: ${assignee ? assignee.displayName : "Unassigned"}`,
  });

  accessories.push({
    date: updatedAt,
    tooltip: format(updatedAt, "EEEE d MMMM yyyy 'at' HH:mm"),
  });

  if (issue.fields.priority) {
    accessories.push({ icon: issue.fields.priority.iconUrl, tooltip: `Priority: ${issue.fields.priority.name}` });
  }

  return (
    <List.Item
      key={issue.id}
      keywords={keywords}
      icon={{ value: issue.fields.issuetype.iconUrl, tooltip: `Issue Type: ${issue.fields.issuetype.name}` }}
      title={displayIssueTitle}
      subtitle={issueKey}
      accessories={accessories}
      actions={<IssueActions issue={issue} mutate={mutate} showDetailsAction={true} />}
    />
  );
}
