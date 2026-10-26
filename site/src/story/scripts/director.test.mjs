import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

const compile = async (name) => ts.transpileModule(await readFile(new URL(name, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const director = await compile('./director.ts');
const sequence = await compile('./sequence.ts');
const flush = async () => { for (let turn = 0; turn < 8; turn += 1) await Promise.resolve(); };

function environment({ reduced = false, stacked = false, fonts = true } = {}) {
  let now = 0;
  let timerId = 0;
  let fontsLoaded;
  const timers = new Map();
  const canvases = new Map();
  const events = new Map();
  const observers = [];
  const media = [reduced, stacked].map((matches) => ({ matches, addEventListener(_, callback) { this.changed = callback; } }));
  const fontsReady = fonts ? Promise.resolve() : new Promise((resolve) => { fontsLoaded = resolve; });
  const context = vm.createContext({
    exports: {}, console, innerHeight: 2000,
    performance: { now: () => now },
    matchMedia: (query) => media[query.includes('reduced-motion') ? 0 : 1],
    setTimeout: (callback, delay) => { timers.set(++timerId, { callback, at: now + delay }); return timerId; },
    clearTimeout: (id) => timers.delete(id),
    addEventListener: (name, callback) => events.set(name, callback),
    getComputedStyle: () => ({ getPropertyValue: () => '68px' }),
    IntersectionObserver: class {
      constructor(callback) { this.callback = callback; observers.push(this); }
      observe() {}
      disconnect() { this.disconnected = true; }
    },
    ResizeObserver: class { observe() {} },
    MutationObserver: class { observe() {} disconnect() {} },
    document: {
      fonts: { ready: fontsReady }, documentElement: {}, body: { append() {} },
      createElement: () => ({ style: {}, getBoundingClientRect: () => ({ height: 68 }), remove() {} }),
      querySelector: (selector) => canvases.get(selector),
    },
  });
  context.window = context;
  vm.runInContext(director, context);
  const log = [];
  function register(id, top, hero = false) {
    const scene = {};
    const canvas = {
      top,
      getBoundingClientRect() { return { top: this.top, bottom: this.top + 600, height: 600 }; },
      querySelector: (selector) => (selector === '.canvas__stage' ? scene : null),
      closest: () => hero ? null : { hasAttribute: () => true },
    };
    const state = { canvas, builds: 0, plays: 0, cancelled: 0, finish: null };
    canvases.set(`.canvas[data-scene="${id}"]`, canvas);
    context.exports.registerDemo(id, () => {
      state.builds += 1;
      let finished = Promise.resolve();
      return {
        reset() {},
        play() {
          state.plays += 1;
          log.push(id);
          finished = new Promise((resolve) => { state.finish = resolve; });
        },
        get finished() { return finished; },
        cancel() { state.cancelled += 1; state.finish?.(); },
      };
    });
    return state;
  }
  return {
    register, log,
    fontsLoaded: async () => { fontsLoaded(); await flush(); },
    observe: () => observers.filter((observer) => !observer.disconnected).forEach((observer) => observer.callback()),
    resize: () => events.get('resize')(),
    motion(index, value) { media[index].matches = value; media[index].changed(); },
    async advance(milliseconds) {
      await flush();
      const end = now + milliseconds;
      let pending;
      while ((pending = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0])) {
        timers.delete(pending[0]);
        now = pending[1].at;
        pending[1].callback();
        await flush();
      }
      now = end;
      await flush();
    },
  };
}

test('waits for reveal and stable visibility, then never autoplays again after leaving', async () => {
  const page = environment();
  const demo = page.register('sprint', 100);
  await page.advance(659);
  assert.equal(demo.plays, 0);
  await page.advance(100);
  demo.canvas.top = 2100;
  page.observe();
  await page.advance(200);
  assert.equal(demo.plays, 0);
  demo.canvas.top = 100;
  page.observe();
  await page.advance(149);
  assert.equal(demo.plays, 0);
  await page.advance(2);
  assert.equal(demo.plays, 1);
  demo.canvas.top = 0;
  page.observe();
  await flush();
  assert.equal(demo.cancelled, 1);
  demo.canvas.top = 100;
  page.observe();
  await page.advance(1000);
  assert.equal(demo.plays, 1);
});

test('plays the uppermost eligible demo first and only one at a time', async () => {
  const page = environment();
  const lower = page.register('words', 900);
  const upper = page.register('sprint', 100);
  await page.advance(812);
  assert.deepEqual(page.log, ['sprint']);
  await page.advance(3000);
  assert.equal(lower.plays, 0);
  upper.finish();
  await flush();
  assert.deepEqual(page.log, ['sprint', 'words']);
});

test('retains played state across resize, so a rebuilt demo never autoplays again', async () => {
  const page = environment();
  const demo = page.register('sprint', 100);
  await page.advance(812);
  page.resize();
  await page.advance(1000);
  assert.equal(demo.plays, 1);
  assert.equal(demo.builds, 1);
});

for (const mode of ['reduced', 'stacked']) {
  test(`${mode} shows final frames and never builds a demo`, async () => {
    const page = environment({ [mode]: true });
    const demo = page.register('sprint', 100);
    await page.advance(2000);
    assert.equal(demo.builds, 0);
    assert.equal(demo.plays, 0);
  });
}

test('hero waits for fonts and visibility without the stage reveal delay', async () => {
  const page = environment({ fonts: false });
  const hero = page.register('hero', 100, true);
  await page.advance(1000);
  assert.equal(hero.plays, 0);
  await page.fontsLoaded();
  await page.advance(149);
  assert.equal(hero.plays, 0);
  await page.advance(2);
  assert.equal(hero.plays, 1);
});

test('enabling reduced motion immediately cancels an autoplaying demo', async () => {
  const page = environment();
  const demo = page.register('handover', 100);
  await page.advance(812);
  assert.equal(demo.plays, 1);
  page.motion(0, true);
  assert.equal(demo.cancelled, 1);
  page.motion(0, false);
  await page.advance(1000);
  assert.equal(demo.plays, 1);
});

test('allows only two percent of the preview above the navigation line', async () => {
  const page = environment();
  const demo = page.register('sprint', 55);
  await page.advance(1000);
  assert.equal(demo.plays, 0);
  demo.canvas.top = 56;
  page.observe();
  await page.advance(151);
  assert.equal(demo.plays, 1);
});

test('the sequencer settles finished after every step finishes or cancellation', async () => {
  const context = vm.createContext({ exports: {}, document: { timeline: { currentTime: 0 } } });
  vm.runInContext(sequence, context);
  const animations = [];
  const target = { animate() {
    let resolve;
    let reject;
    const animation = {
      finished: new Promise((yes, no) => { resolve = yes; reject = no; }),
      persist() {}, pause() {}, play() {}, cancel() { reject(new Error('cancelled')); },
      finish() { resolve(); },
    };
    animations.push(animation);
    return animation;
  } };
  const demo = context.exports.build([
    { target, at: 0, duration: 100, keyframes: [{ opacity: 0 }, { opacity: 1 }] },
    { target, at: 100, duration: 100, keyframes: [{ opacity: 1 }, { opacity: 0 }] },
  ]);
  demo.play();
  let finished = false;
  demo.finished.then(() => { finished = true; });
  animations[0].finish();
  await flush();
  assert.equal(finished, false);
  demo.cancel();
  await demo.finished;
  assert.equal(finished, true);
});
