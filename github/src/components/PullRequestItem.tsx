import { Icon, Keyboard, MenuBarExtra } from "@raycast/api";
import { PullRequestShort } from "../types";

type PullRequestItemParams = {
  pull: PullRequestShort;
  onAction: () => void;
  index?: number;
};

const shortcutKeys: readonly Keyboard.KeyEquivalent[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

const PullRequestItem = ({ pull, index, onAction }: PullRequestItemParams) => {
  const shortcutKey = index === undefined ? undefined : shortcutKeys[index];

  return (
    <MenuBarExtra.Item
      icon={pull.author?.avatarUrl ?? Icon.PersonCircle}
      title={pull.title}
      subtitle={`(${pull.repo})`}
      onAction={onAction}
      shortcut={shortcutKey && { modifiers: ["cmd"], key: shortcutKey }}
    />
  );
};

export default PullRequestItem;
