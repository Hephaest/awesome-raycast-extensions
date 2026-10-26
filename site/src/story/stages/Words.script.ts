import { registerDemo } from '../scripts/director';
import { build, easeOut, enter, hide, localPoint, moveCursor, select, show, strike, type Step } from '../scripts/sequence';

/*
 * 10:05. Keelson's guide is already open; the cursor selects "Consolidation", the hotkey chord presses, and the dictionary
 * entry rises in front of the page on the first sense. One Down moves to the second sense, the one the guide means.
 */

type Point = [number, number];

/** Visible from `from` to `to` and back to its CSS opacity 0 outside, as one transient animation. */
function visibleDuring(target: Element, from: number, to: number, fade = 150): Step {
  const duration = to - from;
  return {
    at: from,
    target,
    duration,
    easing: 'linear',
    transient: true,
    keyframes: [
      { opacity: 0, offset: 0, easing: easeOut },
      { opacity: 1, offset: fade / duration },
      { opacity: 1, offset: 1 - fade / duration, easing: easeOut },
      { opacity: 0, offset: 1 },
    ],
  };
}

registerDemo('words', (scene: HTMLElement) => {
  const find = (selector: string) => {
    const element = scene.querySelector<HTMLElement>(selector);
    if (!element) throw new Error(`Words stage is missing ${selector}`);
    return element;
  };
  const stage = find('.words-stage');
  const cursor = find('[data-cursor="words"]');
  const selection = find('[data-selection]');
  const browser = find('[data-browser="words"]');

  // Measured before any animation exists, so the layout is the final frame's.
  // The cursor is positioned in the stage root, which stacked mode offsets below the narration, so points are taken from the root's origin.
  const [originX, originY] = localPoint(scene, stage, 0, 0);
  const onWord = (across: number): Point => {
    const [x, y] = localPoint(scene, selection, across, 0.5);
    // The I-beam's hotspot is its center, 4.5 by 9.
    return [x - originX - 4.5, y - originY - 9];
  };
  const wordStart = onWord(0);
  const wordEnd = onWord(1);
  const middle = wordStart[1];
  const resting: Point = [wordStart[0] - 70, middle + 60];

  const dragAt = 480;
  const chordAt = 820;
  const windowAt = 1000;
  const downAt = 1800;

  const steps: Step[] = [
    visibleDuring(cursor, 0, 1300),
    moveCursor(cursor, resting, wordStart, 80, 360),
    moveCursor(cursor, wordStart, wordEnd, dragAt, 300),
    // The selection grows under the drag; the word's own text never fades.
    {
      at: dragAt,
      target: selection,
      duration: 300,
      easing: 'linear',
      keyframes: [{ backgroundSize: '0% 100%' }, { backgroundSize: '100% 100%' }],
    },

    visibleDuring(find('[data-keystroke="hotkey"]'), chordAt - 120, chordAt + 900),
    strike(find('[data-key="words-control"]'), chordAt),
    strike(find('[data-key="words-option"]'), chordAt + 60),
    strike(find('[data-key="words-d"]'), chordAt + 120),

    enter(find('[data-window="words"]'), windowAt),
    // The guide blurs as the window rises; the final frame keeps the blur the stage CSS sets.
    { at: windowAt, target: browser, duration: 250, easing: easeOut, keyframes: [{ filter: 'none' }, { filter: getComputedStyle(browser).filter }] },

    visibleDuring(find('[data-keystroke="down"]'), downAt - 120, downAt + 420),
    strike(find('[data-key="words-down"]'), downAt),
    ...select(find('[data-row="sense-1"]'), find('[data-row="sense-2"]'), downAt + 60),
    hide(find('[data-sense="1"]'), downAt + 60, 120),
    show(find('[data-sense="2"]'), downAt + 60, { duration: 120 }),
  ];
  return build(steps);
});
