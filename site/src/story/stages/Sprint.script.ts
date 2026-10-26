import { registerDemo } from '../scripts/director';
import { build, easeOut, select, show, strike, type Step } from '../scripts/sequence';

/*
 * 09:10. The window is already open on root search, as the hero leaves it.
 * Return pushes My Filters, the rows appear, Down moves the selection to FRT-142,
 * and Return pushes its details. The root search and the list are visible only while the demo plays.
 */

/** Visible from the demo's start until `to`, then back to its CSS opacity 0, as one transient animation. */
function visibleUntil(target: Element, to: number, fadeOut = 160): Step {
  return {
    at: 0,
    target,
    duration: to,
    easing: 'linear',
    transient: true,
    keyframes: [
      { opacity: 1, offset: 0 },
      { opacity: 1, offset: 1 - fadeOut / to, easing: easeOut },
      { opacity: 0, offset: 1 },
    ],
  };
}

/** Visible from `from` to `to` and back to its CSS opacity 0 outside, as one transient animation. */
function visibleDuring(target: Element, from: number, to: number, enterFrom = 'none', fadeIn = 160, fadeOut = 160): Step {
  const duration = to - from;
  return {
    at: from,
    target,
    duration,
    easing: 'linear',
    transient: true,
    keyframes: [
      { opacity: 0, transform: enterFrom, offset: 0, easing: easeOut },
      { opacity: 1, transform: 'none', offset: fadeIn / duration },
      { opacity: 1, transform: 'none', offset: 1 - fadeOut / duration, easing: easeOut },
      { opacity: 0, transform: 'none', offset: 1 },
    ],
  };
}

/** The pushed view slides in a little from the right, as Raycast pushes a view. */
function push(target: Element, at: number): Step {
  return {
    at,
    target,
    duration: 320,
    easing: easeOut,
    keyframes: [
      { opacity: 0, transform: 'translateX(16px)' },
      { opacity: 1, transform: 'none' },
    ],
  };
}

registerDemo('sprint', (scene: HTMLElement) => {
  const find = (selector: string) => {
    const element = scene.querySelector(selector);
    if (!element) throw new Error(`Sprint stage is missing ${selector}`);
    return element;
  };
  const appearing = [...scene.querySelectorAll('.sprint-stage__appear')];
  // Down walks from the first row to the pre-selected FRT-142, one press per row.
  const rows = [...scene.querySelectorAll('[data-layer="list"] [data-row]')];
  const path = rows.slice(0, rows.indexOf(find('[data-layer="list"] [data-row][data-selected="true"]')) + 1);

  // Return on My Filters; the list is up within 1.1 seconds, the key beat.
  const openAt = 250;
  const listAt = openAt + 170;
  const downAt = path.slice(1).map((_, index) => 1500 + 450 * index);
  const detailsAt = 3100;
  const detailAt = detailsAt + 180;

  const steps: Step[] = [
    visibleDuring(find('[data-keystroke="return"]'), openAt - 150, openAt + 450),
    strike(find('[data-key="sprint-return"]'), openAt),
    ...['root', 'root-search', 'root-actions'].map((layer) => visibleUntil(find(`[data-layer="${layer}"]`), listAt + 120, 120)),

    visibleDuring(find('[data-layer="list"]'), listAt, detailAt + 100, 'translateX(16px)', 320, 100),
    visibleDuring(find('[data-layer="list-search"]'), listAt, detailAt + 100, 'translateX(16px)', 320, 100),
    visibleDuring(find('[data-layer="list-actions"]'), listAt, detailAt + 100, 'none', 200, 100),
    ...appearing.map((element, index) => show(element, listAt + 60 + index * 45, { duration: 300, easing: 'linear' })),

    visibleDuring(find('[data-keystroke="down"]'), downAt[0] - 120, downAt[downAt.length - 1] + 420),
    ...downAt.flatMap((at, index) => [strike(find('[data-key="sprint-down"]'), at), ...select(path[index], path[index + 1], at + 60)]),

    visibleDuring(find('[data-keystroke="return"]'), detailsAt - 120, detailsAt + 600),
    strike(find('[data-key="sprint-return"]'), detailsAt),
    push(find('[data-layer="detail"]'), detailAt),
    push(find('[data-layer="detail-search"]'), detailAt),
    push(find('[data-layer="detail-actions"]'), detailAt),
  ];
  return build(steps);
});
