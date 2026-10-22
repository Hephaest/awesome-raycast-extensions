import { Action, ActionPanel, Detail, Keyboard } from "@raycast/api";
import type { DictionarySource, Entry, Picture } from "../api/types";
import { pictureMarkdown, pictureUrl } from "../utils/markdown";

interface PictureDetailProps {
  source: DictionarySource;
  entry: Entry;
  picture: Picture;
}

export function PictureDetail({ source, entry, picture }: PictureDetailProps) {
  const url = pictureUrl(picture);
  return (
    <Detail
      navigationTitle="Picture"
      markdown={pictureMarkdown(entry, picture, source.attribution)}
      actions={
        <ActionPanel>
          <Action.OpenInBrowser title="Open Picture in Browser" url={url} shortcut={Keyboard.Shortcut.Common.Open} />
          <Action.CopyToClipboard title="Copy Picture URL" content={url} shortcut={Keyboard.Shortcut.Common.Copy} />
        </ActionPanel>
      }
    />
  );
}
