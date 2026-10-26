// One workday, with shared fixtures for every demo.

export interface Person {
  name: string;
  initials: string;
  /** oklch hue for the avatar circle. */
  hue: number;
  /** The GitHub login and the identicon GitHub serves for it (github.com/identicons/<login>.png): 5 rows of 5 cells. */
  github: { login: string; identicon: { grid: readonly string[]; color: string } };
}

// The reader plays Mateus through the whole day.
export const you = {
  name: 'Mateus Costa',
  initials: 'MC',
  hue: 150,
  github: { login: 'mateus-costa', identicon: { grid: ['01010', '01110', '10101', '00100', '10101'], color: '#d36097' } },
} as const;

export const team = {
  priya: {
    name: 'Priya Raman',
    initials: 'PR',
    hue: 300,
    github: { login: 'priya-raman', identicon: { grid: ['01110', '01010', '10101', '11011', '00000'], color: '#8bd5e2' } },
  },
  hana: {
    name: 'Hana Kobayashi',
    initials: 'HK',
    hue: 40,
    github: { login: 'hanakobayashi', identicon: { grid: ['10101', '11011', '11111', '00100', '00000'], color: '#978ed7' } },
  },
  kwame: {
    name: 'Kwame Asante',
    initials: 'KA',
    hue: 210,
    github: { login: 'kwame-asante', identicon: { grid: ['11011', '00000', '01110', '01010', '11011'], color: '#cb5fce' } },
  },
} satisfies Record<string, Person>;

type IssueType = 'story' | 'task' | 'bug';
type IssueStatus = 'To Do' | 'In Progress' | 'In Review' | 'Ready For Testing' | 'Done';

interface Epic {
  key: string;
  summary: string;
}

export interface Issue {
  key: string;
  summary: string;
  type: IssueType;
  status: IssueStatus;
  parent: Epic;
  assignee: Person | null;
  priority: 'high' | 'medium' | 'low';
  updated: string;
}

export const epics = {
  bookingForm: { key: 'FRT-118', summary: 'Booking form v2' },
  tracking: { key: 'FRT-119', summary: 'Shipment tracking' },
  charges: { key: 'FRT-120', summary: 'Container charges' },
} satisfies Record<string, Epic>;

export const jira = {
  projectName: 'Harbourline Booking',
  filter: 'My active sprint work',
  excludedStatuses: ['Ready For Testing', 'Done'] as IssueStatus[],
  placeholder: 'Filter by key, summary, status, type, assignee or priority',
};

/** The list as it reads at 09:10, in the order the filter returns it. */
export const issuesAtMorning: Issue[] = [
  { key: 'FRT-139', summary: 'Validate contact details on new bookings', type: 'story', status: 'In Review', parent: epics.bookingForm, assignee: you, priority: 'high', updated: '2h' },
  { key: 'FRT-140', summary: 'Save booking drafts between sessions', type: 'story', status: 'In Progress', parent: epics.bookingForm, assignee: you, priority: 'high', updated: '1h' },
  { key: 'FRT-142', summary: 'Show demurrage charges on the booking summary', type: 'story', status: 'To Do', parent: epics.charges, assignee: you, priority: 'medium', updated: '1d' },
  { key: 'FRT-143', summary: 'Show the transshipment port on tracking', type: 'story', status: 'To Do', parent: epics.tracking, assignee: you, priority: 'medium', updated: '1d' },
  { key: 'FRT-144', summary: 'Booking summary misaligned in Safari', type: 'bug', status: 'To Do', parent: epics.bookingForm, assignee: you, priority: 'low', updated: '2d' },
  { key: 'FRT-145', summary: 'Tracking page times out on long voyages', type: 'bug', status: 'To Do', parent: epics.tracking, assignee: you, priority: 'medium', updated: '1d' },
];

export const storyTicket = issuesAtMorning.find((issue) => issue.key === 'FRT-142')!;

/**
 * The title and parent tag My Filters draws for an issue, by the extension's own rule (jira/src/components/IssueListItem.tsx):
 * when title, parent, status and key run past 76 characters, the title is cut to 24 and the parent to what is left.
 */
export function issueRowText(issue: Issue) {
  const ellipsize = (text: string, length: number) => (text.length <= length ? text : `${text.slice(0, length - 3)}...`);
  const parent = `${issue.parent.key}: ${issue.parent.summary}`;
  if (issue.summary.length + parent.length + issue.status.length + issue.key.length <= 76) return { title: issue.summary, parent };
  const title = ellipsize(issue.summary, 24);
  return { title, parent: ellipsize(parent, 76 - title.length - issue.status.length - issue.key.length) };
}

// Both features were merged between chapters; the saved filter still needs their Jira statuses updated.
export const mergedIssueKeys = ['FRT-139', 'FRT-142'];
export const issuesAtEvening: Issue[] = issuesAtMorning.map((issue) =>
  issue.key === storyTicket.key ? { ...issue, status: 'In Review', assignee: you, updated: '10m' } : issue,
);
export const issuesAfterHandover = issuesAtEvening
  .map((issue): Issue => mergedIssueKeys.includes(issue.key) ? { ...issue, status: 'Ready For Testing' } : issue)
  .filter((issue) => !jira.excludedStatuses.includes(issue.status));

export const prd = {
  reporter: team.kwame,
  /** The description as it reads on the Jira issue and in Raycast's detail. */
  paragraphs: [
    'Importers see the container charges on the booking summary before they pay. Today the summary leaves out what a late pickup costs, so the first invoice after arrival surprises them.',
    'The demurrage charge for each container shows as its own line, with the days of free time left. Demurrage starts to accrue when the consignee has not collected the container by the end of free time.',
  ],
};

/** A guide on the docs of Keelson, a fictional shipping-data API that Harbourline calls; `selection` is the text the reader selects. */
export const documentation = {
  vendor: 'Keelson',
  title: 'Retrying API requests',
  address: 'docs.keelson.example/guides/retries',
  sentence: 'Consolidation merges retries that share an idempotency key into one request, so the operation runs once.',
  selection: 'Consolidation',
};

/** Wiktionary's English entry as the extension shows it; neither pronunciation has a recording. The second sense is selected. */
export const dictionaryEntry = {
  word: 'consolidation',
  url: 'https://en.wiktionary.org/wiki/consolidation#English',
  partOfSpeech: 'noun',
  pronunciations: [
    { accent: 'US', text: '/kənˌsɑləˈdeɪʃən/' },
    { accent: 'UK', text: '/kənˌsɒlɪˈdeɪʃ(ə)n/' },
  ],
  senses: [
    'The act or process of consolidating, making firm, or uniting; the state of being consolidated.',
    'The combination of several actions into one.',
    'A solidification into a firm dense mass. It is usually applied to induration (swelling or hardening of normally soft tissue) of a normally aerated lung.',
  ],
  highlightedSense: 1,
};

export const github = {
  branches: { 'FRT-139': 'feature/FRT-139-contact-validation', 'FRT-142': 'feature/FRT-142-demurrage-summary' },
};

interface PullRequest {
  id: string;
  number: number;
  branch: string;
  title: string;
  repository: string;
  author: Person | typeof you;
}

export interface MenuCategory {
  id: 'recent' | 'needs-review' | 'drafts' | 'waiting' | 'changes-requested' | 'failing' | 'ready';
  title: string;
  pullRequests: PullRequest[];
}

const prFRT139: PullRequest = { id: 'booking-412', number: 412, branch: github.branches['FRT-139'], title: 'FRT-139 Validate contact details on new bookings', repository: 'harbourline/booking', author: you };
const prNode22: PullRequest = { id: 'booking-410', number: 410, branch: 'chore/node-22', title: 'Run CI on Node 22', repository: 'harbourline/booking', author: you };
export const reviewPullRequest: PullRequest = { id: 'booking-415', number: 415, branch: 'fix/carrier-rate-retries', title: 'Retry carrier rate lookups with backoff', repository: 'harbourline/booking', author: team.kwame };

function menu(counts: Partial<Record<MenuCategory['id'], PullRequest[]>>): MenuCategory[] {
  return [
    { id: 'recent', title: 'Recent', pullRequests: counts.recent ?? [] },
    { id: 'needs-review', title: 'Needs your review', pullRequests: counts['needs-review'] ?? [] },
    { id: 'drafts', title: 'Your drafts', pullRequests: counts.drafts ?? [] },
    { id: 'waiting', title: 'Waiting for review/checks', pullRequests: counts.waiting ?? [] },
    { id: 'changes-requested', title: 'Changes requested', pullRequests: counts['changes-requested'] ?? [] },
    { id: 'failing', title: 'Failing checks', pullRequests: counts.failing ?? [] },
    { id: 'ready', title: 'Ready to merge', pullRequests: counts.ready ?? [] },
  ];
}

/** The menu bar at 13:30. The title counts distinct pull requests: 5. */
export const menuAtReviews = menu({
  'needs-review': [
    reviewPullRequest,
    { id: 'booking-416', number: 416, branch: 'fix/rate-cache', title: 'Expire the rate card cache on carrier update', repository: 'harbourline/booking', author: team.priya },
    { id: 'design-system-87', number: 87, branch: 'test/charges-table', title: 'Add stories for the charges table', repository: 'harbourline/design-system', author: team.hana },
  ],
  waiting: [prNode22],
  'changes-requested': [prFRT139],
});

export const menuAfterReview = menuAtReviews.map((category): MenuCategory => ({
  ...category,
  pullRequests: category.id === 'recent'
    ? [reviewPullRequest]
    : category.pullRequests.filter((pull) => pull.id !== reviewPullRequest.id),
}));

// FRT-139 was merged by the evening; the other two review requests and CI PR remain.
export const menuAtEvening = menuAfterReview.map((category): MenuCategory => ({
  ...category,
  pullRequests: category.pullRequests.filter((pull) => pull.id !== prFRT139.id),
}));

export function menuTitle(categories: MenuCategory[]) {
  return new Set(categories.filter((c) => c.id !== 'recent').flatMap((c) => c.pullRequests.map((p) => p.id))).size;
}

export const review = {
  reviewer: you,
  comment: 'Looks good. The retry limit and backoff are covered.',
};

export const zadig = {
  projectName: 'Harbourline Booking',
  workflow: 'booking-dev-deploy',
  /** Who last saved the workflow, shown as the row's avatar, and when. */
  updatedBy: 'kwame-asante',
  updatedOn: 'Oct 23',
  /** The workflow's choice parameter that picks the target environment, shown by its own name. */
  envChoice: 'env',
  /** What run #417 builds: the web app and its API on the feature branch, and the worker on main. */
  repositories: [
    { name: 'harbourline/booking', branch: github.branches['FRT-139'], commit: '9c41e2d', subject: 'fix(booking): validate contact details before submission' },
    { name: 'harbourline/booking-api', branch: github.branches['FRT-139'], commit: '5e8a1f4', subject: 'feat(api): reject bookings with an invalid contact email' },
    { name: 'harbourline/booking-worker', branch: 'main', commit: 'b20d7c6', subject: 'chore(worker): send the contact check result to the audit log' },
  ],
  /** The extension prints times with toLocaleString. */
  date: '10/23/2026',
  stages: ['Build', 'Deploy'],
  subEnvironment: 'frt-139',
  run: {
    number: 417,
    startedBy: 'webhook',
    branch: github.branches['FRT-139'],
    commit: '9c41e2d',
    subject: 'fix(booking): validate contact details before submission',
    createdAt: '15:12',
    failedAt: '15:18',
    retriedAt: '15:21',
    passedAt: '15:39',
  },
};

/**
 * The runs Search Workflows lists after the retry, newest first.
 */
export const zadigRuns = [
  { number: zadig.run.number, passed: true },
  { number: zadig.run.number - 1, passed: true },
  { number: zadig.run.number - 2, passed: true },
  { number: zadig.run.number - 3, passed: false },
  { number: zadig.run.number - 4, passed: true },
];

export interface Stage {
  id: 'sprint' | 'words' | 'reviews' | 'subenvironment' | 'handover';
  time: string;
  title: string;
  narration: string;
  /** The extension command the narration names, set slightly bolder; it appears in `narration` exactly once. */
  command: string;
  /** What a screen reader hears instead of the demo. */
  description: string;
}

export const stages: Stage[] = [
  {
    id: 'sprint',
    time: '09:10',
    title: 'Check the sprint.',
    narration: 'Open Jira’s My Filters and pick the next ticket to work on.',
    command: 'My Filters',
    description: 'My Filters lists six issues in My active sprint work, all assigned to Mateus Costa. FRT-142 is selected under To Do, and Show Details opens its brief.',
  },
  {
    id: 'words',
    time: '10:05',
    title: 'Keep reading.',
    narration: 'Select a word and run English Dictionary’s Define Selected Word.',
    command: 'Define Selected Word',
    description: 'Keelson\'s API guide titled Retrying API requests is open in the browser. The word consolidation is selected. Define Selected Word opens its Wiktionary entry in Raycast over the guide, and one press of Down moves to the second sense, the combination of several actions into one, with the US and UK pronunciation, source and license.',
  },
  {
    id: 'reviews',
    time: '13:30',
    title: 'Review the team’s code.',
    narration: 'Pick a PR from GitHub Review Requests’ My Pull Requests in the menu bar.',
    command: 'My Pull Requests',
    description: 'During the after-lunch review hour, Needs your review in the menu bar opens a teammate’s PR on GitHub. Files changed and Review changes lead to a comment and an approval. A few minutes later the menu bar total drops from 5 to 4 on its own, as the extension refreshes in the background.',
  },
  {
    id: 'subenvironment',
    time: '15:20',
    title: 'Unblock QA.',
    narration: 'Find the failed run in Zadig’s Search Workflows and press Retry Run.',
    command: 'Search Workflows',
    description: 'Search Workflows opens booking-dev-deploy and its failed run #417 for the older feature FRT-139, targeting frt-139. Retry Run is confirmed with the same inputs and commit. A success toast acknowledges the retry. Later, Refresh shows the run passed at 15:39.',
  },
  {
    id: 'handover',
    time: '17:50',
    title: 'Update the sprint.',
    narration: 'Move merged tickets to Ready For Testing from Jira’s My Filters.',
    command: 'My Filters',
    description: 'FRT-139 and the morning ticket FRT-142 have been merged between chapters. In My Filters, Change Status moves each to Ready For Testing; the row shows the new status at once, then the list reloads and the saved filter, which excludes testing work, drops it. Four issues remain in the sprint.',
  },
];

/** The angles of a clock's hands at a time such as '09:10', in degrees clockwise from twelve o'clock. */
export function clockHands(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return { hour: (hours % 12) * 30 + minutes / 2, minute: minutes * 6 };
}
