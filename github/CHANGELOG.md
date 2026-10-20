# GitHub Review Requests Changelog

## [Menu Bar Icon Styling] - 2026-09-13

- The menu bar icon now adapts to the menu bar's actual light/dark appearance instead of a fixed color, so it matches the rest of your menu bar icons.
- Category icons no longer show a rich accent color when enabled — they now match the plain color of their bold title text.
- Disabled categories now show a dimmed icon that matches their dimmed title text, instead of a bold black one.

## [Menu Bar Revamp] - 2026-09-04

- Rebuilt the menu bar to mirror GitHub's own Pull Requests dashboard, so what you see here always matches github.com/pulls.
- Replaced the 5 old categories with 6: Needs your review, Your drafts, Waiting for review/checks, Changes requested, Failing checks, Ready to merge. Failing checks are now surfaced for the first time.
- Split GitHub's combined "Needs action" section into separate Changes requested and Failing checks categories.
- The menu bar badge now only counts PRs actually waiting on you.
- Each category shows a description and a link to open the same search on GitHub.
- Fixed submenu and badge counts silently capping at 25 PRs. Counts now always match GitHub's true total.
- Fixed the menu bar spinner getting stuck.
- Opening a PR from anywhere in the menu now adds it to Recent.
- Your own draft PRs now appear under "Your drafts".

## [Maintenance] - 2026-06-23

- Update dependencies to their latest versions (Raycast API, Octokit, GraphQL Request, GraphQL Code Generator, and types).
- Migrate ESLint to `@raycast/eslint-config` with the flat config format.
- Regenerate GraphQL types for `graphql-request` v7.

## [New Additions & Fixes] - 2024-03-18

- Add subtitle for menu bar item to improve readability.
- Fix counting issue of Wait For Review category.

## [Update] - 2024-03-17

- Add README file for readers.

## [New Additions & Refactor] - 2024-03-14

- Menubar: Reorganize menu item order.
- Menubar: Divide all PRs into 4 parts: Wait For Merge, Wait For Change, Wait For Review and New Review Requests.
- Preferences: Allow users to filter specific organizations/owners.
- Filter out draft PRs for all commands.

## [Update] - 2022-09-12

- Menubar; item now hides PR immediately after clicking on it
- Menubar; Added hotkeys to navigate through items (⌘+1-9);
- Menubar; Added a force-refresh option.
