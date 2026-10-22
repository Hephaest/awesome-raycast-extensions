import { Action, ActionPanel, Icon, Keyboard, openExtensionPreferences } from "@raycast/api";
import type { DictionarySource, Entry, EntrySection, Sense } from "../api/types";
import { pictureForSense } from "../api/types";
import { senseClipboardText } from "../utils/markdown";
import { pronounce } from "../utils/pronounce";
import { audioChoices, VARIANT_NAMES } from "../utils/pronunciation";
import type { AudioChoice } from "../utils/pronunciation";
import { BrowserOnlySubmenu } from "./BrowserOnlySubmenu";
import { PictureDetail } from "./PictureDetail";

interface RecoveryActionsProps {
  source: DictionarySource;
  word: string;
  onRefresh: () => void;
  showPreferences?: boolean;
  browserFirst?: boolean;
}

export function RecoveryActions({ source, word, onRefresh, showPreferences, browserFirst }: RecoveryActionsProps) {
  const browser = (
    <Action.OpenInBrowser
      title={`Open in ${source.title}`}
      url={source.entryUrl(word)}
      shortcut={Keyboard.Shortcut.Common.Open}
    />
  );
  const retry = (
    <Action title="Retry" icon={Icon.ArrowClockwise} shortcut={Keyboard.Shortcut.Common.Refresh} onAction={onRefresh} />
  );
  return (
    <ActionPanel>
      {browserFirst ? browser : retry}
      {showPreferences && (
        <Action title="Open Extension Preferences" icon={Icon.Gear} onAction={() => openExtensionPreferences()} />
      )}
      {browserFirst ? retry : browser}
      <BrowserOnlySubmenu word={word} />
    </ActionPanel>
  );
}

function audioActionTitle(choice: AudioChoice): string {
  return choice === "voice" ? "Speak with macOS Voice" : `Play ${VARIANT_NAMES[choice]} Pronunciation`;
}

interface EntryActionsProps {
  source: DictionarySource;
  entry: Entry;
  section: EntrySection;
  sense: Sense;
  speakWhenNoRecording: boolean;
}

export function EntryActions({ source, entry, section, sense, speakWhenNoRecording }: EntryActionsProps) {
  const picture = pictureForSense(section, sense);
  return (
    <ActionPanel>
      <ActionPanel.Section>
        {audioChoices(section, speakWhenNoRecording).map(choice => (
          <Action
            key={choice}
            title={audioActionTitle(choice)}
            icon={Icon.SpeakerHigh}
            onAction={() => pronounce(choice, entry, section)}
          />
        ))}
      </ActionPanel.Section>
      <ActionPanel.Section>
        <Action.CopyToClipboard
          title="Copy Definition"
          content={senseClipboardText(entry, section, sense, source.attribution)}
          shortcut={Keyboard.Shortcut.Common.Copy}
        />
      </ActionPanel.Section>
      <ActionPanel.Section>
        <Action.OpenInBrowser
          title={`Open in ${source.title}`}
          url={entry.url}
          shortcut={Keyboard.Shortcut.Common.Open}
        />
        {picture && (
          <Action.Push
            title="Show Picture"
            icon={Icon.Image}
            target={<PictureDetail source={source} entry={entry} picture={picture} />}
            shortcut={{ modifiers: ["cmd", "shift"], key: "i" }}
          />
        )}
        <BrowserOnlySubmenu word={entry.headword} />
      </ActionPanel.Section>
    </ActionPanel>
  );
}
