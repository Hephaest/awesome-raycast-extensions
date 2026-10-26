/**
 * A tiny sequencer on the Web Animations API.
 * Every step is an `element.animate()` call with a delay, all sharing one start time,
 * so a demo can be played and reset as one unit.
 * The sequencer never changes DOM text: every state is pre-rendered and switched by opacity or visibility,
 * so the final frame is the CSS default and `reset` always agrees with the markup.
 * Scenes are scaled design canvases, so measured client lengths go through `scale()` before they become local px.
 */

export interface Step {
  /** Milliseconds from the demo's start. */
  at: number;
  target: Element;
  keyframes: Keyframe[];
  duration: number;
  easing?: string;
  /** A press or a click: it returns to where it started, so it never holds a fill. */
  transient?: boolean;
}

export interface Demo {
  readonly finished: Promise<void>;
  play(): void;
  reset(): void;
  /** Removes every animation, for a rebuild after a resize. */
  cancel(): void;
}

export const easeOut = 'cubic-bezier(0.16, 1, 0.3, 1)';

function properties(keyframes: Keyframe[]) {
  const names = new Set<string>();
  for (const frame of keyframes) {
    for (const key of Object.keys(frame)) {
      if (key !== 'offset' && key !== 'easing' && key !== 'composite') names.add(key);
    }
  }
  return [...names];
}

export function build(steps: Step[]): Demo {
  const sorted = [...steps].sort((a, b) => a.at - b.at);
  const seen = new Set<string>();
  const animations = sorted.map((step) => {
    // A step fills backwards only when none of its properties was animated on this element before,
    // so a later step's backwards fill never overrides the opening state.
    const keys = properties(step.keyframes).map((name) => `${name}|${elementId(step.target)}`);
    const first = keys.every((key) => !seen.has(key));
    for (const key of keys) seen.add(key);
    const fill: FillMode = step.transient ? 'none' : first ? 'both' : 'forwards';
    const animation = step.target.animate(step.keyframes, {
      delay: step.at,
      duration: step.duration,
      easing: step.easing ?? easeOut,
      fill,
    });
    // The browser removes a finished, filling animation once a later one covers its properties, and does not bring it
    // back when that later one is transient (fill none) and ends; persisting keeps the earlier end state in place.
    animation.persist();
    animation.pause();
    animation.currentTime = 0;
    return animation;
  });

  let finished = Promise.resolve();
  return {
    get finished() { return finished; },
    play() {
      const start = document.timeline.currentTime;
      for (const animation of animations) {
        animation.startTime = start;
        animation.play();
      }
      finished = Promise.allSettled(animations.map((animation) => animation.finished)).then(() => undefined);
    },
    reset() {
      for (const animation of animations) {
        animation.pause();
        animation.currentTime = 0;
      }
    },
    cancel() {
      for (const animation of animations) animation.cancel();
    },
  };
}

const ids = new WeakMap<Element, number>();
let nextId = 1;
function elementId(element: Element) {
  let id = ids.get(element);
  if (!id) {
    id = nextId++;
    ids.set(element, id);
  }
  return id;
}

/** The element's live scale in client px per design px. */
export function scale(scene: HTMLElement) {
  const width = scene.getBoundingClientRect().width;
  return width > 0 && scene.offsetWidth > 0 ? width / scene.offsetWidth : 1;
}

/**
 * A point on an element in the scene's design coordinates: `across` runs 0 to 1 along its width,
 * `down` 0 to 1 along its height, with optional design-px offsets. Use it for cursor waypoints.
 */
export function localPoint(scene: HTMLElement, element: Element, across = 0.5, down = 0.5, dx = 0, dy = 0): [number, number] {
  const k = scale(scene);
  const origin = scene.getBoundingClientRect();
  const box = element.getBoundingClientRect();
  return [(box.left - origin.left + box.width * across) / k + dx, (box.top - origin.top + box.height * down) / k + dy];
}

/* Helpers that produce steps. */

/** Shows an element: opacity 0 to 1, with an optional rise. */
export function show(target: Element, at: number, { duration = 350, rise = 0, easing = easeOut } = {}): Step {
  return {
    at,
    target,
    duration,
    easing,
    keyframes: [
      { opacity: 0, transform: rise ? `translateY(${rise}px)` : 'none' },
      { opacity: 1, transform: 'none' },
    ],
  };
}

/** The reverse of show, on the same properties, so the two chain with one forwards fill instead of a second backwards fill. */
export function hide(target: Element, at: number, duration = 200): Step {
  return { at, target, duration, easing: easeOut, keyframes: [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'none' }] };
}

/** The window's entry: Raycast scales in from .98 over 150ms. */
export function enter(target: Element, at: number): Step {
  return {
    at,
    target,
    duration: 150,
    easing: easeOut,
    keyframes: [
      { opacity: 0, transform: 'scale(0.98)' },
      { opacity: 1, transform: 'none' },
    ],
  };
}

/**
 * A typed key in a keystroke caption pops from dim to full white over 160ms. It fills, so a key waits dim until its
 * first strike and stays lit after, and a chord builds key by key as KeyCastr shows it.
 */
export function strike(target: Element, at: number): Step {
  return {
    at,
    target,
    duration: 160,
    easing: easeOut,
    keyframes: [
      { opacity: 0.45, transform: 'scale(1.15)' },
      { opacity: 1, transform: 'none' },
    ],
  };
}

/** A key sinks one pixel over 100ms and releases with its chord after 900ms. */
export function press(target: Element, at: number): Step {
  return {
    at,
    target,
    duration: 900,
    easing: 'linear',
    transient: true,
    keyframes: [
      { transform: 'none', boxShadow: getComputedStyle(target).boxShadow, offset: 0, easing: easeOut },
      { transform: 'translateY(1px)', boxShadow: 'none', offset: 100 / 900 },
      { transform: 'translateY(1px)', boxShadow: 'none', offset: 1 },
    ],
  };
}

/** Moves a row's selection: the selected class is pre-rendered on the end state, so this crossfades two rows. */
export function select(from: Element | null, to: Element, at: number): Step[] {
  const steps: Step[] = [
    { at, target: to, duration: 120, easing: easeOut, keyframes: [{ backgroundColor: 'transparent' }, { backgroundColor: 'var(--app-selection)' }] },
  ];
  if (from) {
    steps.push({ at, target: from, duration: 120, easing: easeOut, keyframes: [{ backgroundColor: 'var(--app-selection)' }, { backgroundColor: 'transparent' }] });
  }
  return steps;
}

/** A cursor move between waypoints in the scene's design coordinates, fast at first and settling at the end. */
export function moveCursor(cursor: Element, from: [number, number], to: [number, number], at: number, duration = 500): Step {
  return {
    at,
    target: cursor,
    duration,
    easing: easeOut,
    keyframes: [{ translate: `${from[0]}px ${from[1]}px` }, { translate: `${to[0]}px ${to[1]}px` }],
  };
}

/** A click: a short press scale on the target under the cursor. */
export function click(target: Element, at: number): Step {
  return {
    at,
    target,
    duration: 120,
    easing: easeOut,
    transient: true,
    keyframes: [{ transform: 'none' }, { transform: 'scale(0.97)', offset: 0.5 }, { transform: 'none' }],
  };
}

/** A native menu selection blinks off and returns after 100ms. */
export function blink(target: Element, at: number): Step {
  return { at, target, duration: 100, easing: 'steps(1, end)', transient: true, keyframes: [{ opacity: 0 }, { opacity: 1 }] };
}

/**
 * Types text that is already in the DOM, by revealing it one character at a time with a clip.
 * The element must hold the full text and sit inside a clipped, left-aligned box.
 * `caret` follows the revealed width. Widths are measured with a Range and converted to design px.
 */
export function type(text: HTMLElement, caret: Element | null, at: number, perChar = 55): Step[] {
  const content = text.textContent ?? '';
  const node = text.firstChild;
  if (!node || content.length === 0) return [];
  // The text's own rendered scale, so every scaled ancestor counts, such as a browser frame scaled inside its card.
  const k = scale(text);
  const range = document.createRange();
  const widths: number[] = [0];
  for (let index = 1; index <= content.length; index += 1) {
    range.setStart(node, 0);
    range.setEnd(node, index);
    widths.push(range.getBoundingClientRect().width / k);
  }
  const total = widths[widths.length - 1];
  const clipFrames: Keyframe[] = widths.map((width, index) => ({
    clipPath: `inset(0 ${Math.max(0, total - width)}px 0 0)`,
    offset: index / content.length,
    easing: 'steps(1, end)',
  }));
  const steps: Step[] = [{ at, target: text, duration: perChar * content.length, keyframes: clipFrames }];
  if (caret) {
    const caretFrames: Keyframe[] = widths.map((width, index) => ({
      translate: `${width}px 0`,
      offset: index / content.length,
      easing: 'steps(1, end)',
    }));
    steps.push({ at, target: caret, duration: perChar * content.length, keyframes: caretFrames });
    steps.push({ at: 0, target: caret, duration: at + perChar * content.length, transient: true, keyframes: [{ opacity: 1 }, { opacity: 1 }] });
  }
  return steps;
}
