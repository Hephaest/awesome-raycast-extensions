import { extensionByFolder } from './extensions';

/** A paragraph, or a bulleted list of sentences. */
type FaqBlock = string | string[];

/** One question and its answer, as plain text the component lays out. */
interface FaqItem {
  question: string;
  answer: FaqBlock[];
}

const titleOf = (folder: string) => extensionByFolder(folder).title;

/** The author of the Store extension a fork began from. */
const upstreamAuthorOf = (folder: string) => {
  const { title, upstream } = extensionByFolder(folder);
  if (!upstream) throw new Error(`${title} is not a fork`);
  return upstream.author;
};

export const faq: FaqItem[] = [
  {
    question: 'Why aren\'t they in the Raycast Store?',
    answer: [
      'They started as tools for me and my team. I\'m working on getting Zadig into the Store, and the others may follow.',
      `${titleOf('jira')} began as a fork of ${upstreamAuthorOf('jira')}'s Store extension, and ${titleOf('github')} as a fork of ${upstreamAuthorOf('github')}'s. None of the four is affiliated with Raycast, Atlassian, GitHub or KodeRover.`,
    ],
  },
  {
    question: 'What do I need?',
    answer: [
      'A Mac with Raycast, and a Raycast account, since Import Extension only works when you\'re signed in. If you\'d rather build from source, you\'ll also need Git and Node.js 22.22.2 or newer.',
    ],
  },
  {
    question: 'Where do my tokens go?',
    answer: [
      'Anything you type in lives in Raycast\'s extension preferences, and each extension only talks to its own service:',
      [
        `${titleOf('jira')} signs you in with OAuth through Raycast and Atlassian, so there's no token to paste.`,
        `${titleOf('github')} sends your token only to api.github.com.`,
        `${titleOf('zadig')} sends your token only to the domain you set, and always over HTTPS.`,
        `${titleOf('english-dictionary')} sends the optional Collins and Merriam-Webster keys only to those two dictionaries.`,
      ],
    ],
  },
  {
    question: 'How do I update?',
    answer: [
      'Get the new version, then import its folder again with Import Extension:',
      [
        'If you use the zip, download the latest one from the extension\'s row.',
        'If you cloned the repo, pull and run npm install in the extension\'s folder first.',
      ],
    ],
  },
];
