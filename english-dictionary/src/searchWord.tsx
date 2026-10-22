import {
  Action,
  ActionPanel,
  Alert,
  closeMainWindow,
  confirmAlert,
  Icon,
  Keyboard,
  LaunchProps,
  List,
  PopToRootType,
  useNavigation,
} from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import { availableSources, findSource, resolveSource } from "./api/sources";
import type { DictionarySource, SourceId } from "./api/types";
import { BrowserOnlySubmenu } from "./components/BrowserOnlySubmenu";
import { EntryScreen } from "./components/EntryScreen";
import { SourceDropdown } from "./components/SourceDropdown";
import { launchRequest } from "./utils/launch";
import type { SearchLaunchContext } from "./utils/launch";
import { readPreferences } from "./utils/preferences";
import { clearRecent, forgetLookup, listRecent, matchingRecent } from "./utils/recent";
import type { RecentLookup } from "./utils/recent";

interface WordRowProps {
  word: string;
  source: DictionarySource;
  onSourceChange: (id: SourceId) => void;
  onLookedUp: () => void;
}

function WordRow({ word, source, onSourceChange, onLookedUp }: WordRowProps) {
  return (
    <List.Item
      title={word}
      icon={Icon.Book}
      actions={
        <ActionPanel>
          <Action.Push
            title="Open Entry"
            icon={Icon.Book}
            target={
              <EntryScreen
                initialWord={word}
                initialSourceId={source.id}
                onSourceChange={onSourceChange}
                onLookedUp={onLookedUp}
              />
            }
          />
          <Action.OpenInBrowser
            title={`Open in ${source.title}`}
            url={source.entryUrl(word)}
            shortcut={Keyboard.Shortcut.Common.Open}
          />
          <BrowserOnlySubmenu word={word} />
        </ActionPanel>
      }
    />
  );
}

interface RecentRowProps {
  item: RecentLookup;
  source: DictionarySource;
  onSourceChange: (id: SourceId) => void;
  onLookedUp: () => void;
  onRemove: () => void;
  onClear: () => void;
}

function RecentRow({ item, source, onSourceChange, onLookedUp, onRemove, onClear }: RecentRowProps) {
  return (
    <List.Item
      title={item.word}
      icon={Icon.Clock}
      accessories={[{ text: source.title }]}
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <Action.Push
              title="Open Entry"
              icon={Icon.Book}
              target={
                <EntryScreen
                  initialWord={item.word}
                  initialSourceId={item.source}
                  onSourceChange={onSourceChange}
                  onLookedUp={onLookedUp}
                />
              }
            />
            <Action.OpenInBrowser
              title={`Open in ${source.title}`}
              url={source.entryUrl(item.word)}
              shortcut={Keyboard.Shortcut.Common.Open}
            />
            <BrowserOnlySubmenu word={item.word} />
          </ActionPanel.Section>
          <ActionPanel.Section>
            <Action
              title="Remove from Recent"
              icon={Icon.Trash}
              style={Action.Style.Destructive}
              shortcut={Keyboard.Shortcut.Common.Remove}
              onAction={onRemove}
            />
            <Action
              title="Clear All Recent"
              icon={Icon.Trash}
              style={Action.Style.Destructive}
              shortcut={Keyboard.Shortcut.Common.RemoveAll}
              onAction={onClear}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}

export default function SearchWordCommand(
  props: LaunchProps<{ arguments: Arguments.SearchWord; launchContext?: SearchLaunchContext }>,
) {
  const preferences = useMemo(readPreferences, []);
  const sources = useMemo(() => availableSources(preferences), [preferences]);
  const [sourceId, setSourceId] = useState<SourceId>(() => resolveSource(sources, preferences.defaultSource).id);
  const source = resolveSource(sources, sourceId, preferences.defaultSource);
  const [query, setQuery] = useState("");
  const { push } = useNavigation();
  const { data: recent, isLoading, revalidate } = usePromise(listRecent, []);
  const launched = useRef(false);

  // A word handed over at launch opens its entry directly, so Escape closes Raycast instead of showing this list.
  useEffect(() => {
    const request = launchRequest(props);
    if (!request || launched.current) return;
    launched.current = true;
    push(
      <EntryScreen
        initialWord={request.word}
        initialNote={request.note}
        onSourceChange={setSourceId}
        onLookedUp={revalidate}
      />,
      () => void closeMainWindow({ popToRootType: PopToRootType.Immediate }),
    );
  }, [props, push, revalidate]);

  async function clearAll() {
    const confirmed = await confirmAlert({
      title: "Clear All Recent Words?",
      message: "Every word is removed from the recent list. This can't be undone.",
      primaryAction: { title: "Clear All", style: Alert.ActionStyle.Destructive },
    });
    if (confirmed) await clearRecent().then(revalidate);
  }

  const word = query.trim();
  const openableRecent = matchingRecent(recent ?? [], word, source.id).flatMap(item => {
    const itemSource = findSource(sources, item.source);
    return itemSource ? [{ item, source: itemSource }] : [];
  });

  return (
    <List
      filtering={false}
      searchText={query}
      onSearchTextChange={setQuery}
      searchBarPlaceholder="Search for a word or phrase"
      isLoading={isLoading}
      searchBarAccessory={<SourceDropdown sources={sources} value={source.id} onChange={setSourceId} />}
    >
      {word && (
        <List.Section>
          <WordRow word={word} source={source} onSourceChange={setSourceId} onLookedUp={revalidate} />
        </List.Section>
      )}
      {openableRecent.length > 0 && (
        <List.Section title="Recent">
          {openableRecent.map(({ item, source: itemSource }) => (
            <RecentRow
              key={`${item.source}:${item.word}`}
              item={item}
              source={itemSource}
              onSourceChange={setSourceId}
              onLookedUp={revalidate}
              onRemove={() => forgetLookup(item.word, item.source).then(revalidate)}
              onClear={clearAll}
            />
          ))}
        </List.Section>
      )}
      <List.EmptyView
        icon={Icon.Book}
        title="Look Up a Word"
        description="Type a word or phrase. Press ⌘P to change dictionary."
      />
    </List>
  );
}
