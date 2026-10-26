import { registerDemo } from '../scripts/director';
import { build, easeOut, select, strike, type Step } from '../scripts/sequence';

/*
 * 17:50. Both features are merged; change their Jira statuses the way the extension really does, measured from
 * captures: ⌘⇧S opens Change Status on the first transition, three Downs reach Ready For Testing, and Return closes
 * the panel. The row redraws at once while the footer pill shows the progress toast, then the success toast. The
 * extension then reloads the saved filter, which excludes Ready For Testing, so the row leaves on its own and the
 * selection drops to the next row.
 */

interface Visibility {
  fadeIn?: number;
  fadeOut?: number;
}

/** Visible from `start` to `end` and back to its CSS opacity 0 outside, as one transient animation. */
function visibleDuring(target: Element, start: number, end: number, { fadeIn = 180, fadeOut = 180 }: Visibility = {}): Step {
  const duration = end - start;
  // Short windows shrink both fades so the keyframe offsets stay in order.
  fadeIn = Math.min(fadeIn, duration / 2);
  fadeOut = Math.min(fadeOut, duration / 2);
  return {
    at: start,
    target,
    duration,
    easing: 'linear',
    transient: true,
    keyframes: [
      { opacity: 0, offset: 0, easing: easeOut },
      { opacity: 1, offset: fadeIn / duration },
      { opacity: 1, offset: 1 - fadeOut / duration, easing: easeOut },
      { opacity: 0, offset: 1 },
    ],
  };
}

function fade(target: Element, at: number, from: number, to: number, duration = 200): Step {
  return { at, target, duration, keyframes: [{ opacity: from }, { opacity: to }] };
}

registerDemo('handover', (scene: HTMLElement) => {
  const find = (selector: string) => {
    const element = scene.querySelector<HTMLElement>(selector);
    if (!element) throw new Error(`Handover stage is missing ${selector}`);
    return element;
  };
  const keystroke = (name: string) => find(`[data-keystroke="${name}"]`);
  const pressKey = (id: string, at: number) => strike(find(`[data-key="${id}"]`), at);
  const [firstKey, secondKey] = [...scene.querySelectorAll<HTMLElement>('[data-leaving]')].map((element) => element.dataset.leaving ?? '');
  const row = (id: string) => find(`[data-row="${id}"]`);
  const both = (key: string) => [row(key), row(`${key}-updated`)];
  // Visible rows in list order, without the hidden updated copies; the walk crosses those between the two tickets.
  const listRows = [...scene.querySelectorAll<HTMLElement>('[data-row]')].filter((element) => !element.dataset.row?.endsWith('-updated'));
  const keyOf = (element: Element) => element.getAttribute('data-row') ?? '';
  const between = listRows.slice(listRows.findIndex((element) => keyOf(element) === firstKey) + 1, listRows.findIndex((element) => keyOf(element) === secondKey));
  const rowHeight = listRows[0].offsetHeight;
  const [countBefore, countBetween, countAfter] = [...scene.querySelectorAll('[data-in-progress-count]')];
  const finalSelection = find('[data-row][data-selected="true"]');

  // A stacked pair moves its selection together, so the swap never shows a bare row: every row in `to` gains the
  // selection and every row in `from` loses it.
  const selectRows = (from: Element[] | null, to: Element[], at: number): Step[] => [
    ...to.flatMap((element) => select(null, element, at)),
    ...(from ?? []).map((element): Step => ({
      at,
      target: element,
      duration: 120,
      easing: easeOut,
      keyframes: [{ backgroundColor: 'var(--app-selection)' }, { backgroundColor: 'transparent' }],
    })),
  ];

  const changeStatus = (key: string, at: number, pace: number): { steps: Step[]; doneAt: number } => {
    const panel = find(`[data-panel="${key}"]`);
    const options = [...panel.querySelectorAll('[data-action]')];
    const downAt = [1, 2, 3].map((step) => at + 450 * pace + 250 * pace * step);
    const returnAt = downAt[2] + 400 * pace;
    const doneAt = returnAt + 900;
    return {
      doneAt,
      steps: [
        visibleDuring(keystroke('change-status'), at - 100, at + 500),
        pressKey('handover-command', at),
        pressKey('handover-shift', at + 60),
        pressKey('handover-s', at + 120),
        // The panel appears at once, as Raycast's does, on the first transition.
        visibleDuring(panel, at + 160, returnAt + 100, { fadeIn: 1, fadeOut: 100 }),
        visibleDuring(keystroke('down'), downAt[0] - 100, downAt[2] + 250),
        ...downAt.flatMap((downAtStep, index) => [pressKey('handover-down', downAtStep), ...select(options[index], options[index + 1], downAtStep + 30)]),
        visibleDuring(keystroke('return'), returnAt - 80, returnAt + 300),
        pressKey('handover-return', returnAt),
        // The row redraws with the new status at once; the toasts take the footer's left pill.
        fade(row(`${key}-updated`), returnAt + 100, 0, 1, 120),
        fade(row(key), returnAt + 100, 1, 0, 120),
        visibleDuring(find(`[data-toast="${key}-progress"]`), returnAt + 100, doneAt, { fadeIn: 120, fadeOut: 1 }),
        visibleDuring(find(`[data-toast="${key}-done"]`), doneAt, doneAt + 1500, { fadeIn: 1, fadeOut: 200 }),
      ],
    };
  };

  const collapse = (key: string, at: number): Step => ({
    at,
    target: find(`[data-leaving="${key}"]`),
    duration: 300,
    easing: easeOut,
    keyframes: [
      { blockSize: `${rowHeight}px`, opacity: 1 },
      { blockSize: '0px', opacity: 0 },
    ],
  });

  // The reload lands just after the success toast: the row collapses and the selection drops to the row after it.
  const reloadDelay = 350;
  const first = changeStatus(firstKey, 700, 1);
  const firstReload = first.doneAt + reloadDelay;
  // From the row after the first ticket, one Down per remaining row between them reaches the second.
  const walk = between.map((_, index) => firstReload + 700 + 250 * index);
  const second = changeStatus(secondKey, walk[walk.length - 1] + 650, 0.8);
  const secondReload = second.doneAt + reloadDelay;

  return build([
    ...selectRows(null, both(firstKey), 0),
    ...first.steps,
    collapse(firstKey, firstReload),
    fade(countBefore, firstReload, 1, 0),
    fade(countBetween, firstReload, 0, 1),
    ...selectRows(both(firstKey), [between[0]], firstReload),

    visibleDuring(keystroke('down'), walk[0] - 100, walk[walk.length - 1] + 300),
    ...walk.flatMap((at, index) => {
      const to = index === between.length - 1 ? both(secondKey) : [between[index + 1]];
      return [pressKey('handover-down', at), ...selectRows([between[index]], to, at + 30)];
    }),
    ...second.steps,
    collapse(secondKey, secondReload),
    fade(countBetween, secondReload, 1, 0),
    fade(countAfter, secondReload, 0, 1),
    ...selectRows(both(secondKey), [finalSelection], secondReload),
  ]);
});
