import { Action, ActionPanel, Icon, Keyboard } from "@raycast/api";
import { browserOnlySources } from "../api/sources";

export function BrowserOnlySubmenu({ word }: { word: string }) {
  return (
    <ActionPanel.Submenu
      title="Open in Other Dictionary…"
      icon={Icon.Globe}
      shortcut={Keyboard.Shortcut.Common.OpenWith}
    >
      {browserOnlySources.map(source => (
        <Action.OpenInBrowser key={source.title} title={source.title} url={source.entryUrl(word)} />
      ))}
    </ActionPanel.Submenu>
  );
}
