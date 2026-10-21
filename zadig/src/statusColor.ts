import { Color } from "@raycast/api";

// Covers workflow task, stage and environment statuses, which share one vocabulary in Zadig.
const STATUS_COLORS: Record<string, Color> = {
  passed: Color.Green,
  success: Color.Green,
  running: Color.Blue,
  updating: Color.Blue,
  created: Color.Yellow,
  waiting: Color.Yellow,
  creating: Color.Yellow,
  timeout: Color.Orange,
  unstable: Color.Orange,
  failed: Color.Red,
  deleting: Color.Red,
  sleeping: Color.Purple,
  cancelled: Color.SecondaryText,
};

export const getStatusColor = (status: string) => STATUS_COLORS[status] ?? Color.SecondaryText;
