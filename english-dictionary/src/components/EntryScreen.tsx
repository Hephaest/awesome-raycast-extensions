import { Action, ActionPanel, Icon, Keyboard, List } from "@raycast/api";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLookup } from "../hooks/useLookup";
import { normalizeWord } from "../api/lookup";
import type { Entry, EntrySection, Sense, SourceId } from "../api/types";
import { pictureForSense } from "../api/types";
import { senseMarkdown } from "../utils/markdown";
import { senseFacts } from "../utils/senseFacts";
import { readPreferences } from "../utils/preferences";
import { rememberLookup } from "../utils/recent";
import { availableSources, findSource, resolveSource } from "../api/sources";
import { longestWord } from "../utils/words";
import { EntryActions, RecoveryActions } from "./EntryActions";
import { SourceDropdown } from "./SourceDropdown";
import { lookupNoteText, lookupResultTitle } from "../utils/states";
import type { LookupNote } from "../utils/states";
import { SenseMetadata } from "./SenseMetadata";

interface EntryScreenProps {
  initialWord: string;
  initialSourceId?: SourceId;
  initialNote?: LookupNote;
  onSourceChange?: (id: SourceId) => void;
  onLookedUp?: () => void;
}

interface SenseRow {
  id: string;
  section: EntrySection;
  sense: Sense;
}

function rowsOf(entry: Entry): SenseRow[] {
  return entry.sections.flatMap(section =>
    section.senses.map(sense => ({ id: `${section.id}:${sense.id}`, section, sense })),
  );
}

export function EntryScreen({
  initialWord,
  initialSourceId,
  initialNote,
  onSourceChange,
  onLookedUp,
}: EntryScreenProps) {
  const preferences = useMemo(readPreferences, []);
  const sources = useMemo(() => availableSources(preferences), [preferences]);
  // A pushed screen does not re-render from its parent, so it keeps its own choice and reports it back.
  const [sourceId, setSourceId] = useState<SourceId>(
    () => resolveSource(sources, initialSourceId, preferences.defaultSource).id,
  );
  const source = resolveSource(sources, sourceId, preferences.defaultSource);
  const [word, setWord] = useState(initialWord);
  const [note, setNote] = useState(initialNote);
  const lookupOptions = useMemo(
    () => ({ merriamWebster: preferences.merriamWebster, collins: preferences.collins }),
    [preferences],
  );
  const { result, resultSourceId, resultWord, isLoading, refresh } = useLookup(source, word, lookupOptions);
  const [selectedItemId, setSelectedItemId] = useState<string>();
  const selectedRow = useRef<{ id: string; partOfSpeech: string | undefined } | undefined>(undefined);
  const rememberedKey = useRef<string | undefined>(undefined);

  // A switch starts again from the word asked for, since a phrase may exist in the next dictionary.
  function switchSource(id: SourceId) {
    setSourceId(id);
    setWord(initialWord);
    setNote(initialNote);
    onSourceChange?.(id);
  }

  const current = resultSourceId === source.id && resultWord === normalizeWord(word);
  const found = result?.status === "found" ? result.entry : undefined;
  const problem = current && result && result.status !== "found" ? result : undefined;
  const shownSource = findSource(sources, resultSourceId) ?? source;
  const rows = found ? rowsOf(found) : [];
  const noteText = note ? lookupNoteText(note, word) : undefined;

  useEffect(() => {
    if (problem?.status !== "not-found" || !word.includes(" ") || note?.reason === "fallback") return;
    const fallback = longestWord(word);
    if (fallback && fallback !== word) {
      setNote({ reason: "fallback", original: word });
      setWord(fallback);
    }
  }, [problem, word, note]);

  useEffect(() => {
    if (result?.status !== "found") return;
    const entry = result.entry;
    if (resultWord) {
      const key = `${entry.source}:${resultWord}`;
      if (rememberedKey.current !== key) {
        rememberedKey.current = key;
        rememberLookup({ word: resultWord, source: entry.source }).then(() => onLookedUp?.());
      }
    }
    const entryRows = rowsOf(entry);
    const previous = selectedRow.current;
    const sameRow = previous && entryRows.find(row => row.id === previous.id);
    const samePartOfSpeech = previous && entryRows.find(row => row.section.partOfSpeech === previous.partOfSpeech);
    setSelectedItemId((sameRow ?? samePartOfSpeech ?? entryRows[0])?.id);
  }, [result]);

  return (
    <List
      navigationTitle={initialWord}
      isLoading={isLoading}
      isShowingDetail={Boolean(found)}
      searchBarPlaceholder="Filter meanings"
      selectedItemId={selectedItemId}
      onSelectionChange={id => {
        const row = rows.find(candidate => candidate.id === id);
        if (row) selectedRow.current = { id: row.id, partOfSpeech: row.section.partOfSpeech };
      }}
      searchBarAccessory={<SourceDropdown sources={sources} value={source.id} onChange={switchSource} />}
    >
      {found &&
        found.sections.map(section => (
          <List.Section key={section.id} title={section.title}>
            {section.senses.map(sense => {
              const facts = senseFacts(section, sense);
              return (
                <List.Item
                  key={`${section.id}:${sense.id}`}
                  id={`${section.id}:${sense.id}`}
                  title={`${sense.number}. ${sense.definition}`}
                  icon={pictureForSense(section, sense) ? { value: Icon.Image, tooltip: "Has a picture" } : undefined}
                  keywords={[...facts.usage, ...facts.grammar]}
                  detail={
                    <List.Item.Detail
                      markdown={senseMarkdown(found, section, sense, shownSource.attribution, { note: noteText })}
                      metadata={<SenseMetadata source={shownSource} entry={found} facts={facts} />}
                    />
                  }
                  actions={
                    <EntryActions
                      source={shownSource}
                      entry={found}
                      section={section}
                      sense={sense}
                      speakWhenNoRecording={preferences.speakWhenNoRecording}
                    />
                  }
                />
              );
            })}
          </List.Section>
        ))}
      {problem?.status === "not-found" && problem.suggestions.length > 0 && (
        <List.Section title="Did You Mean" subtitle={lookupResultTitle(source, word, problem)}>
          {problem.suggestions.map(suggestion => (
            <List.Item
              key={suggestion}
              title={suggestion}
              actions={
                <ActionPanel>
                  <Action.Push
                    title="Open Entry"
                    icon={Icon.Book}
                    target={
                      <EntryScreen
                        initialWord={suggestion}
                        initialSourceId={source.id}
                        onSourceChange={switchSource}
                        onLookedUp={onLookedUp}
                      />
                    }
                  />
                  <Action.OpenInBrowser
                    title={`Open in ${source.title}`}
                    url={source.entryUrl(suggestion)}
                    shortcut={Keyboard.Shortcut.Common.Open}
                  />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      )}
      {problem && (
        <List.EmptyView
          icon={problem.status === "not-found" ? Icon.MagnifyingGlass : Icon.ExclamationMark}
          title={lookupResultTitle(source, word, problem)}
          description={problem.status === "unavailable" ? problem.message : "Try another dictionary with ⌘P."}
          actions={
            <RecoveryActions
              source={source}
              word={word}
              onRefresh={refresh}
              showPreferences={
                problem.status === "unavailable" &&
                (problem.reason === "missing-key" || problem.reason === "rejected-key")
              }
              browserFirst={
                problem.status === "not-found" ||
                (problem.status === "unavailable" && problem.reason === "format-changed")
              }
            />
          }
        />
      )}
    </List>
  );
}
