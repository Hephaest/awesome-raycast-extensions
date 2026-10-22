import { Icon, List } from "@raycast/api";
import type { DictionarySource, Entry } from "../api/types";
import type { SenseFacts } from "../utils/senseFacts";

interface SenseMetadataProps {
  source: DictionarySource;
  entry: Entry;
  facts: SenseFacts;
}

function TagRow({ title, values }: { title: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <List.Item.Detail.Metadata.TagList title={title}>
      {values.map(value => (
        <List.Item.Detail.Metadata.TagList.Item key={value} text={value} />
      ))}
    </List.Item.Detail.Metadata.TagList>
  );
}

export function SenseMetadata({ source, entry, facts }: SenseMetadataProps) {
  const hasFacts =
    facts.pronunciations.length > 0 ||
    [facts.partOfSpeech, facts.frequency].some(Boolean) ||
    facts.usage.length > 0 ||
    facts.grammar.length > 0;
  return (
    <List.Item.Detail.Metadata>
      {facts.pronunciations.map(pronunciation => (
        <List.Item.Detail.Metadata.Label
          key={pronunciation.accent}
          title={pronunciation.accent}
          text={pronunciation.text ?? "Recording only"}
          icon={pronunciation.hasRecording ? Icon.SpeakerHigh : undefined}
        />
      ))}
      <TagRow title="Part of Speech" values={facts.partOfSpeech ? [facts.partOfSpeech] : []} />
      <TagRow title="Usage" values={facts.usage} />
      <TagRow title="Grammar" values={facts.grammar} />
      {facts.frequency && <List.Item.Detail.Metadata.Label title="Frequency" text={facts.frequency} />}
      {hasFacts && <List.Item.Detail.Metadata.Separator />}
      <List.Item.Detail.Metadata.Link title="Source" text={source.title} target={entry.url} />
      {source.license && (
        <List.Item.Detail.Metadata.Link title="License" text={source.license.name} target={source.license.url} />
      )}
    </List.Item.Detail.Metadata>
  );
}
