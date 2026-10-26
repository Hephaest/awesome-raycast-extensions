import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';

const compiled = ts.transpileModule(await readFile(new URL('./story.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const story = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('approving a teammate PR reduces the review queue and retains the visited PR in Recent', () => {
  const needsReview = (menu) => menu.find((category) => category.id === 'needs-review').pullRequests;
  assert.equal(story.menuTitle(story.menuAtReviews), 5);
  assert.equal(story.menuTitle(story.menuAfterReview), 4);
  assert.equal(needsReview(story.menuAtReviews).length, 3);
  assert.equal(needsReview(story.menuAfterReview).length, 2);
  assert.ok(needsReview(story.menuAtReviews).some((pull) => pull.id === story.reviewPullRequest.id));
  assert.ok(needsReview(story.menuAfterReview).every((pull) => pull.id !== story.reviewPullRequest.id));
  assert.ok(story.menuAfterReview.find((category) => category.id === 'recent').pullRequests.some((pull) => pull.id === story.reviewPullRequest.id));
  assert.notEqual(story.reviewPullRequest.author, story.you);
  assert.equal(story.review.reviewer, story.you);
});

test('menu totals count distinct PR identities rather than titles or Recent history', () => {
  const first = { ...story.reviewPullRequest, id: 'first' };
  const second = { ...first, id: 'second' };
  const recentOnly = { ...first, id: 'visited-only' };
  assert.equal(story.menuTitle([
    { id: 'needs-review', pullRequests: [first, second] },
    { id: 'waiting', pullRequests: [first] },
    { id: 'recent', pullRequests: [recentOnly] },
  ]), 2);
});

test('the evening filter drops both merged tickets and keeps the four unfinished issues', () => {
  assert.equal(story.issuesAtEvening.length, 6);
  assert.equal(story.issuesAfterHandover.length, 4);
  assert.ok(story.mergedIssueKeys.includes(story.storyTicket.key));
  assert.ok(story.issuesAtEvening.some((issue) => issue.key === story.storyTicket.key && issue.assignee === story.you && issue.status === 'In Review'));
  assert.deepEqual(story.issuesAfterHandover.map((issue) => issue.key), ['FRT-140', 'FRT-143', 'FRT-144', 'FRT-145']);
  assert.ok(story.issuesAfterHandover.every((issue) => !story.jira.excludedStatuses.includes(issue.status)));
});

test('my active sprint work lists only the reader\'s own tickets', () => {
  assert.ok(story.issuesAtMorning.every((issue) => issue.assignee === story.you));
});

test('every stage narration names its command exactly once, so the command can be set apart', () => {
  for (const stage of story.stages) assert.equal(stage.narration.split(stage.command).length, 2, stage.id);
});

test('the deployment targets the older feature rather than the new morning ticket', () => {
  assert.equal(story.zadig.run.branch, story.github.branches['FRT-139']);
  assert.equal(story.zadig.subEnvironment, 'frt-139');
  assert.notEqual(story.zadig.run.branch, story.github.branches[story.storyTicket.key]);
});

test('each stage clock points its hands at the stage time', () => {
  assert.deepEqual(story.clockHands('09:10'), { hour: 275, minute: 60 });
  assert.deepEqual(story.clockHands('13:30'), { hour: 45, minute: 180 });
  assert.deepEqual(story.clockHands('17:50'), { hour: 175, minute: 300 });
  for (const stage of story.stages) {
    const { hour, minute } = story.clockHands(stage.time);
    assert.ok(hour >= 0 && hour < 360 && minute >= 0 && minute < 360, `${stage.time} stays on the dial`);
  }
});
