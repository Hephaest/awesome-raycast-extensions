import type { ImageMetadata } from 'astro';

import dictionaryManifest from '../../../english-dictionary/package.json';
import zadigManifest from '../../../zadig/package.json';
import githubManifest from '../../../github/package.json';
import jiraManifest from '../../../jira/package.json';

import dictionaryIcon from '../../../english-dictionary/assets/icon.png';
import zadigIcon from '../../../zadig/assets/icon.png';
import githubIcon from '../../../github/assets/icon.png';
import jiraIcon from '../../../jira/assets/icon.png';

export const repositoryUrl = 'https://github.com/Hephaest/awesome-raycast-extensions';

/** The extension's README on GitHub, the page a row's arrow opens. */
export const readmeUrl = (folder: string) => `${repositoryUrl}/blob/main/${folder}/README.md`;

/** The zip the release workflow attaches for the folder; 404 until the first v* tag is pushed. */
export const releaseZipUrl = (folder: string) => `${repositoryUrl}/releases/latest/download/${folder}.zip`;

export interface Extension {
  /** The extension's folder name in the repository, which is also what Raycast imports. */
  folder: string;
  title: string;
  /** One line under the title in the extension list, from the user's side. */
  line: string;
  icon: ImageMetadata;
  /** A black mark on a clear ground, inverted on dark surfaces, as the GitHub mark is. */
  monochrome?: boolean;
  /** The icon's colour, as an oklch value, which the extension list's icon tile washes with. */
  tint: string;
  /** Set when the extension is a fork, so the page credits the original authors. */
  upstream?: { author: string };
}

/** In the story's order of first use. */
export const extensions: Extension[] = [
  {
    folder: 'jira',
    title: jiraManifest.title,
    line: 'Move, assign and prioritise issues straight from your saved filters.',
    icon: jiraIcon,
    tint: 'oklch(60% 0.18 255)',
    upstream: { author: 'thomaslombart' },
  },
  {
    folder: 'github',
    title: githubManifest.title,
    line: 'Reviews, drafts, failing checks and ready merges, live in your menu bar.',
    icon: githubIcon,
    monochrome: true,
    tint: 'oklch(45% 0.01 260)',
    upstream: { author: 'resessh' },
  },
  {
    folder: 'zadig',
    title: zadigManifest.title,
    line: 'Retry runs and restart services in a few keystrokes.',
    icon: zadigIcon,
    tint: 'oklch(62% 0.21 350)',
  },
  {
    folder: 'english-dictionary',
    title: dictionaryManifest.title,
    line: 'Every meaning, real pronunciations, one hotkey.',
    icon: dictionaryIcon,
    tint: 'oklch(50% 0.16 275)',
  },
];

export function extensionByFolder(folder: string) {
  const extension = extensions.find((each) => each.folder === folder);
  if (!extension) throw new Error(`No extension named ${folder}`);
  return extension;
}
