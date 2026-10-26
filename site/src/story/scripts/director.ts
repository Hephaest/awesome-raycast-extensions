import type { Demo } from './sequence';

export type Factory = (scene: HTMLElement) => Demo | Promise<Demo>;

interface Playback {
  id: string;
  factory: Factory;
  canvas: HTMLElement;
  scene: HTMLElement;
  played: boolean;
  readyAt: number;
  visibleSince: number | null;
  demo?: Demo;
}

// The demos have no pause control, so the two that run past five seconds, 13:30 and 15:20, do not meet WCAG 2.2.2; reduced motion shows final frames instead.
const playbacks = new Map<string, Playback>();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const stacked = matchMedia('(width < 1150px), (height < 700px)');
let active: Playback | null = null;
let generation = 0;
let fontsReady = false;
let timer = 0;
let observer: IntersectionObserver;
let navLine = 68;

function eligible(playback: Playback) {
  const box = playback.canvas.getBoundingClientRect();
  const tolerance = box.height * .02;
  return box.height > 0 && box.top >= navLine - tolerance && box.bottom <= innerHeight + tolerance;
}

function stop() {
  generation += 1;
  if (!active) return;
  const playback = active;
  active = null;
  playback.demo?.cancel();
}

async function start(playback: Playback) {
  stop();
  active = playback;
  playback.played = true;
  const attempt = generation;
  try {
    await document.fonts.ready;
    if (active !== playback || attempt !== generation) return;
    const demo = playback.demo ?? await playback.factory(playback.scene);
    if (active !== playback || attempt !== generation) {
      demo.cancel();
      return;
    }
    playback.demo = demo;
    demo.reset();
    demo.play();
    await demo.finished;
    if (active !== playback || attempt !== generation) return;
    active = null;
    demo.cancel();
    schedule();
  } catch (error) {
    if (active === playback) stop();
    playback.played = true;
    console.error(`Could not play ${playback.id} demo`, error);
    schedule();
  }
}

function schedule() {
  clearTimeout(timer);
  if (active && !eligible(active)) stop();
  if (!fontsReady || reducedMotion.matches || stacked.matches) return;
  const now = performance.now();
  const waiting: Playback[] = [];
  let next = Infinity;
  for (const playback of playbacks.values()) {
    if (playback.played || !eligible(playback) || now < playback.readyAt) {
      playback.visibleSince = null;
      if (!playback.played && eligible(playback) && Number.isFinite(playback.readyAt)) next = Math.min(next, playback.readyAt - now);
      continue;
    }
    playback.visibleSince ??= now;
    const remaining = 150 - (now - playback.visibleSince);
    if (remaining <= 0) waiting.push(playback);
    else next = Math.min(next, remaining);
  }
  if (!active && waiting.length) {
    waiting.sort((a, b) => a.canvas.getBoundingClientRect().top - b.canvas.getBoundingClientRect().top);
    void start(waiting[0]);
  }
  if (next > 0 && Number.isFinite(next)) timer = window.setTimeout(schedule, next + 1);
}

export function registerDemo(id: string, factory: Factory) {
  const canvas = document.querySelector<HTMLElement>(`.canvas[data-scene="${id}"]`);
  const scene = canvas?.querySelector<HTMLElement>('.canvas__stage');
  if (!canvas || !scene) return;
  const section = canvas.closest<HTMLElement>('[data-stage]');
  const playback: Playback = { id, factory, canvas, scene, played: false, readyAt: section ? Infinity : 0, visibleSince: null };
  playbacks.set(id, playback);
  if (section) {
    const revealed = () => {
      if (!section.hasAttribute('data-revealed')) return false;
      playback.readyAt = performance.now() + 660;
      schedule();
      return true;
    };
    if (!revealed()) {
      const revealObserver = new MutationObserver(() => {
        if (revealed()) revealObserver.disconnect();
      });
      revealObserver.observe(section, { attributes: true, attributeFilter: ['data-revealed'] });
    }
  }
  observer?.observe(canvas);
  schedule();
}

function observe() {
  observer?.disconnect();
  const token = getComputedStyle(document.documentElement).getPropertyValue('--nav-line');
  const probe = document.createElement('div');
  probe.style.height = token;
  probe.style.position = 'absolute';
  document.body.append(probe);
  navLine = probe.getBoundingClientRect().height || 68;
  probe.remove();
  observer = new IntersectionObserver(schedule, { rootMargin: `-${navLine}px 0px 0px 0px`, threshold: [0, .98, 1] });
  for (const playback of playbacks.values()) observer.observe(playback.canvas);
}

/* Measure layout changes only, so the day gradient never needs a scroll handler. */
function measureDay() {
  const day = document.querySelector<HTMLElement>('#day');
  if (!day) return;
  const sections = [...day.querySelectorAll<HTMLElement>('[data-stage]')];
  if (sections.length !== 5) return;
  const origin = day.getBoundingClientRect().top;
  const top = (element: Element) => element.getBoundingClientRect().top - origin;
  const windowPreview = sections[3].querySelector<HTMLElement>('.stage__preview');
  const cardPreview = sections[4].querySelector<HTMLElement>('.stage__preview');
  if (!windowPreview || !cardPreview) return;
  // The previews' untransformed offsets, because their reveal scales them.
  const windowTop = top(sections[3]) + windowPreview.offsetTop;
  const cardTop = top(sections[4]) + cardPreview.offsetTop;
  const stops = {
    'dawn-stop': top(sections[0]),
    'morning-stop': top(sections[1]) - 96,
    'noon-stop': top(sections[2]) - 96,
    'afternoon-stop': top(sections[3]) - 96,
    'evening-start': windowTop,
    'evening-window-end': windowTop + windowPreview.offsetHeight,
    'evening-heading': top(sections[4]),
    'evening-card-start': cardTop,
    'evening-card-end': cardTop + cardPreview.offsetHeight,
  };
  for (const [name, position] of Object.entries(stops)) day.style.setProperty(`--${name}`, `${position}px`);
  day.setAttribute('data-day-measured', '');
  for (const card of day.querySelectorAll<HTMLElement>('.desktop-card__screen')) {
    const item = card.querySelector<HTMLElement>('[data-menubar-item]');
    if (item) card.style.setProperty('--menubar-github-end', `${card.offsetWidth - item.offsetLeft - item.offsetWidth}px`);
  }
}

let resizeTimer = 0;
addEventListener('resize', () => {
  stop();
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    for (const playback of playbacks.values()) {
      playback.demo?.cancel();
      playback.demo = undefined;
      playback.visibleSince = null;
    }
    observe();
    measureDay();
    schedule();
  }, 150);
});

function motionChanged() {
  stop();
  for (const playback of playbacks.values()) playback.visibleSince = null;
  schedule();
}

reducedMotion.addEventListener('change', motionChanged);
stacked.addEventListener('change', motionChanged);
observe();
const layoutObserver = new ResizeObserver(measureDay);
const day = document.querySelector<HTMLElement>('#day');
if (day) {
  layoutObserver.observe(day);
  for (const section of day.querySelectorAll('[data-stage]')) layoutObserver.observe(section);
}
void document.fonts.ready.then(() => {
  fontsReady = true;
  measureDay();
  schedule();
});
