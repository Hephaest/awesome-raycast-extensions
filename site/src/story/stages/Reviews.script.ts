import { registerDemo } from '../scripts/director';
import { blink, build, click, easeOut, hide, localPoint, moveCursor, scale, show, type, type Step } from '../scripts/sequence';

/*
 * 13:30. From an empty desktop: the GitHub item opens its dropdown, Needs your review opens its submenu, and the first
 * PR opens in Chrome. Files changed is read to the end of the file in two scrolls, the file is marked Viewed and folds,
 * then Review changes, a comment and Approve submit the review. Later the extension's
 * background refresh drops the count from 5 to 4 with no one touching the menu. Markup always holds the final frame.
 */

/** Holds `style` on the target from `from` to `to`, then lets it return to its CSS, as one transient animation. */
function hold(target: Element, from: number, to: number, style: Keyframe): Step {
  return { at: from, target, duration: to - from, easing: 'steps(1, end)', transient: true, keyframes: [style, style] };
}

registerDemo('reviews', (scene: HTMLElement) => {
  const find = (selector: string) => {
    const element = scene.querySelector<HTMLElement>(selector);
    if (!element) throw new Error(`Reviews stage is missing ${selector}`);
    return element;
  };
  const item = find('[data-menubar-item]');
  const dropdown = find('[data-dropdown="reviews"]');
  const submenu = find('[data-dropdown="reviews"] [data-submenu="needs-review"]');
  const needsReview = find('[data-dropdown="reviews"] [data-category="needs-review"]');
  const pull = find('[data-dropdown="reviews"] [data-pr="0"]');
  const browser = find('[data-browser="reviews"]');
  const cursor = find('[data-cursor="reviews"]');
  const filesTab = find('[data-files-tab]');
  const openReview = find('[data-open-review]');
  const approve = find('[data-approve-option]');
  const submit = find('[data-submit-review]');

  // macOS opens a status item's menu from the item's left edge, 3px further left, and slides it left to stay 6px inside the screen.
  const screen = dropdown.offsetParent;
  if (!(screen instanceof HTMLElement)) throw new Error('Reviews stage dropdown has no positioned ancestor');
  const menuWidth = find('[data-dropdown="reviews"] .mac-dropdown__menu').offsetWidth;
  dropdown.style.setProperty('--menu-left', `${Math.min(item.offsetLeft - 3, screen.clientWidth - menuWidth - 6)}px`);
  dropdown.style.setProperty('--menu-right', 'auto');

  // Measured before any animation exists, so the layout is the final frame's.
  const [originX, originY] = localPoint(scene, find('.reviews'), 0, 0);
  const point = (element: Element, across = 0.5): [number, number] => {
    const [x, y] = localPoint(scene, element, across, 0.5);
    return [x - originX - 2, y - originY - 1.5];
  };
  const onItem = point(item);
  const onGroup = point(needsReview, 0.4);
  const onPull = point(pull, 0.45);
  const onFiles = point(filesTab);
  const onOpen = point(openReview);
  const onApprove = point(approve);
  const onSubmit = point(submit);

  const openAt = 420;
  const groupAt = 950;
  const pullAt = 1450;
  const pickAt = 1750;
  const closeAt = 1900;
  const chromeAt = 2100;
  const accent: Keyframe = { backgroundColor: 'var(--menu-accent)', color: '#fff' };
  const parent: Keyframe = { backgroundColor: 'var(--menu-parent)' };
  const page = (at: number) => chromeAt + at;
  // The comment types at 45ms a character, slow enough to read; every step after it waits for the typing to finish.
  const perChar = 45;
  const comment = find('[data-review-comment]');
  // Reading the file comes before the review: every review step waits for the scrolls and the Viewed mark.
  const reading = 3450;
  const review = (at: number) => page(at + reading);
  const typed = (at: number) => review(at) + (comment.textContent ?? '').length * (perChar - 20);

  // The Files changed page as GitHub scrolls it, in the page's own px: the page slides up, the toolbar and the file
  // header pin under GitHub's compact header once they reach it, and the scroll ends at the bottom of the file.
  const root = find('.gh-pull');
  const pageLayer = find('[data-page]');
  const toolbar = find('[data-files-toolbar]');
  const fileHeader = find('[data-file-header]');
  const fileBody = find('[data-file-body]');
  const compactHeader = find('[data-files-sticky]');
  const viewedButton = find('[data-viewed-button]');
  const pageScale = root.getBoundingClientRect().height / root.offsetHeight;
  const topOf = (element: Element) => (element.getBoundingClientRect().top - pageLayer.getBoundingClientRect().top) / pageScale;
  const firstLine = fileBody.firstElementChild;
  if (!(firstLine instanceof HTMLElement)) throw new Error('Reviews stage file body is empty');
  const bodyHeight = firstLine.offsetHeight;
  // The scroll stops with the file's last line 16px above the viewport's bottom edge.
  const scrollEnd = Math.max(0, topOf(fileBody) + bodyHeight + 16 - root.offsetHeight);
  const compactHeight = compactHeader.offsetHeight;
  const toolbarPin = topOf(toolbar) - compactHeight;
  const headerPin = topOf(fileHeader) - compactHeight - toolbar.offsetHeight;
  const compactAt = topOf(find('.gh-tabs')) - compactHeight;
  const onDiff: [number, number] = [point(viewedButton)[0] - 260, point(viewedButton)[1] + 140];
  // Viewed is clicked while the file header is pinned, higher than where it rests in the final frame.
  const pinnedLift = (headerPin < scrollEnd ? topOf(fileHeader) - compactHeight - toolbar.offsetHeight : 0) * pageScale / scale(scene);
  const onViewed: [number, number] = [point(viewedButton)[0], point(viewedButton)[1] - pinnedLift];

  const scrolls = [
    { from: 0, to: scrollEnd * 0.55, start: page(1300), end: page(1900) },
    { from: scrollEnd * 0.55, to: scrollEnd, start: page(2700), end: page(3300) },
  ];
  const readStart = scrolls[0].start;
  const readEnd = scrolls[1].end;
  const eased = (progress: number) => 1 - (1 - progress) ** 3;
  const scrollAt = (time: number) => {
    for (const gesture of scrolls) {
      if (time <= gesture.start) return gesture.from;
      if (time <= gesture.end) return gesture.from + (gesture.to - gesture.from) * eased((time - gesture.start) / (gesture.end - gesture.start));
    }
    return scrollEnd;
  };
  const samples = Array.from({ length: 49 }, (_, index) => readStart + ((readEnd - readStart) * index) / 48);
  const scrolled = (target: Element, frame: (y: number) => Keyframe): Step => ({
    at: readStart,
    target,
    duration: readEnd - readStart,
    easing: 'linear',
    keyframes: samples.map((time) => ({ ...frame(scrollAt(time)), offset: (time - readStart) / (readEnd - readStart) })),
  });
  const viewedAt = page(3900);
  const foldEnd = viewedAt + 300;

  return build([
    hold(cursor, 0, typed(4000), { opacity: 1 }),
    moveCursor(cursor, [560, 300], onItem, 0, 400),
    click(item, openAt),

    // The menu: the item holds its open pill and the menu appears at once, then both clear as a PR is picked.
    hold(item, openAt + 30, closeAt, { backgroundColor: 'var(--menubar-open)' }),
    hold(dropdown, openAt + 30, closeAt + 150, { opacity: 1 }),
    { at: closeAt, target: dropdown, duration: 150, easing: easeOut, transient: true, keyframes: [{ opacity: 1 }, { opacity: 0 }] },
    moveCursor(cursor, onItem, onGroup, 650, 300),
    hold(needsReview, groupAt, pullAt, accent),
    hold(submenu, groupAt + 60, closeAt + 150, { opacity: 1 }),
    hold(needsReview, pullAt, closeAt + 150, parent),
    moveCursor(cursor, onGroup, onPull, 1150, 300),
    hold(pull, pullAt, closeAt + 150, accent),
    click(pull, pickAt),
    blink(pull, pickAt + 60),

    // Chrome opens on the PR, scaling up from 0.97 as macOS opens a window.
    {
      at: chromeAt,
      target: browser,
      duration: 220,
      easing: easeOut,
      keyframes: [{ opacity: 0, transform: 'scale(0.97)' }, { opacity: 1, transform: 'none' }],
    },
    hide(find('[data-awaiting-review]'), page(700), 100),
    moveCursor(cursor, onPull, onFiles, page(250), 350),
    click(filesTab, page(650)),
    { at: page(700), target: filesTab, duration: 1, keyframes: [{ borderColor: 'transparent' }, { borderColor: getComputedStyle(filesTab).borderColor }] },
    { at: page(700), target: find('[data-conversation-tab]'), duration: 1, keyframes: [{ borderColor: getComputedStyle(filesTab).borderColor }, { borderColor: 'transparent' }] },
    show(find('[data-review-files]'), page(700), { duration: 150 }),

    // Read the whole file: two wheel scrolls with a pause between, the toolbar and file header pinned on the way.
    moveCursor(cursor, onFiles, onDiff, page(900), 350),
    scrolled(pageLayer, (y) => ({ transform: `translateY(${-y}px)` })),
    scrolled(toolbar, (y) => ({ transform: `translateY(${Math.max(0, y - toolbarPin)}px)` })),
    scrolled(fileHeader, (y) => ({ transform: `translateY(${Math.max(0, y - headerPin)}px)` })),
    scrolled(compactHeader, (y) => ({ opacity: y > compactAt ? 1 : 0 })),
    { at: readStart, target: fileBody, duration: 1, keyframes: [{ blockSize: `${bodyHeight}px` }, { blockSize: `${bodyHeight}px` }] },
    { at: readStart, target: fileHeader, duration: 1, keyframes: [{ borderRadius: '6px 6px 0 0' }, { borderRadius: '6px 6px 0 0' }] },

    // Mark it Viewed: the box checks, the counter reads 1 / 1, and GitHub folds the file, so the page is back at its top.
    moveCursor(cursor, onDiff, onViewed, page(3450), 350),
    click(viewedButton, viewedAt),
    ...[...scene.querySelectorAll('[data-review-files] [data-viewed-before]')].map((element) => hide(element, viewedAt + 40, 120)),
    ...[...scene.querySelectorAll('[data-review-files] [data-viewed-done]')].map((element) => show(element, viewedAt + 40, { duration: 120 })),
    { at: viewedAt + 60, target: fileBody, duration: 240, easing: easeOut, keyframes: [{ blockSize: `${bodyHeight}px` }, { blockSize: '0px' }] },
    { at: foldEnd - 40, target: fileHeader, duration: 40, keyframes: [{ borderRadius: '6px 6px 0 0' }, { borderRadius: '6px' }] },
    ...[pageLayer, toolbar, fileHeader].map((element): Step => ({ at: foldEnd, target: element, duration: 1, keyframes: [{ transform: 'none' }, { transform: 'none' }] })),
    { at: foldEnd, target: compactHeader, duration: 1, keyframes: [{ opacity: 0 }, { opacity: 0 }] },

    moveCursor(cursor, onViewed, onOpen, review(900), 300),
    click(openReview, review(1250)),
    hold(find('[data-review-form]'), review(1350), typed(3650), { opacity: 1 }),
    ...type(comment, find('[data-review-caret]'), review(1550), perChar),
    moveCursor(cursor, onOpen, onApprove, typed(2550), 250),
    click(approve, typed(2850)),
    show(find('[data-approval-check]'), typed(2850), { duration: 100 }),
    moveCursor(cursor, onApprove, onSubmit, typed(3100), 250),
    click(submit, typed(3400)),
    show(find('[data-submitted-review]'), typed(3650), { duration: 180 }),

    // The background refresh: the title changes on its own, with no menu and no cursor.
    hide(find('[data-count="5"]'), typed(4700), 180),
    show(find('[data-count="4"]'), typed(4700), { duration: 180 }),
  ]);
});
