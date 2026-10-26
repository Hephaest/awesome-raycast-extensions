import { registerDemo } from '../scripts/director';
import { blink, build, hide, press, select, show, strike, type Step } from '../scripts/sequence';

/*
 * 15:20, in the order the real extension runs, measured from light captures: ↵ opens booking-dev-deploy's runs on
 * failed #417; ⌘K opens the actions, three Downs reach Retry Run and ↵ opens Raycast's confirm alert; ↵ confirms. The
 * footer pill shows "Retrying run #417", then "Retried run #417", and #417 turns running. Later, ⌘R shows it passed.
 */
function visibleDuring(target: Element, from: number, to: number): Step {
  return { at: from, target, duration: to - from, easing: 'steps(1, end)', transient: true, keyframes: [{ opacity: 1 }, { opacity: 1 }] };
}

registerDemo('subenvironment', (scene) => {
  const find = (selector: string) => {
    const element = scene.querySelector<HTMLElement>(selector);
    if (!element) throw new Error(`SubEnvironment stage is missing ${selector}`);
    return element;
  };
  const all = (selector: string) => [...scene.querySelectorAll<HTMLElement>(selector)];
  const chord = (id: string, at: number, hold = 700): Step[] => [
    visibleDuring(find(`[data-keystroke="${id}"]`), at - 100, at + hold),
    ...all(`[data-keystroke="${id}"] [data-key]`).map((key, index) => strike(key, at + index * 60)),
  ];
  const state = (id: string) => all(`[data-state="${id}"]`);
  const panel = find('[data-panel="workflow-actions"]');
  const actions = ['open', 'copy', 'refresh', 'retry'].map((id) => find(`[data-action="${id}"]`));
  const command = find('[data-layer="runs"] .rc-actionbar__command');

  const openAt = 400;
  const panelAt = 1500;
  const downAt = [2000, 2250, 2500];
  const pickAt = 2900;
  const confirmAt = 3700;
  const retriedAt = confirmAt + 1500;
  // A pause stands for the time the run takes before the later refresh.
  const refreshAt = retriedAt + 3500;

  return build([
    // The workflow list, then ↵ shows the runs on failed #417.
    ...all('[data-layer="workflow-list"]').map((element) => visibleDuring(element, 0, openAt + 100)),
    ...chord('open', openAt, 500),
    ...all('[data-layer="runs"]').map((element) => show(element, openAt + 100, { duration: 1 })),
    ...state('failed').map((element) => visibleDuring(element, 0, retriedAt)),
    ...state('passed').map((element) => hide(element, 0, 1)),

    // ⌘K, then three Downs walk the highlight from Open in Browser to Retry Run, and ↵ picks it.
    ...chord('actions', panelAt, 500),
    visibleDuring(panel, panelAt + 60, pickAt + 120),
    visibleDuring(find('[data-keystroke="down"]'), downAt[0] - 100, downAt[2] + 300),
    ...downAt.flatMap((at, index) => [strike(find('[data-key="down-0"]'), at), ...select(actions[index], actions[index + 1], at + 30)]),
    ...chord('return', pickAt, 400),
    blink(actions[3], pickAt + 40),

    // Raycast's confirm alert over a grey scrim; ↵ takes its default, Retry Run.
    visibleDuring(find('[data-confirm-scrim]'), pickAt + 120, confirmAt + 120),
    visibleDuring(find('[data-confirm]'), pickAt + 120, confirmAt + 120),
    ...chord('return', confirmAt, 400),
    press(find('[data-confirm-button]'), confirmAt),

    // The toast takes the footer's left pill: the animated one while the request runs, then the success one.
    visibleDuring(find('[data-toast="retrying"]'), confirmAt + 120, retriedAt),
    visibleDuring(find('[data-toast="retried"]'), retriedAt, retriedAt + 1900),
    { at: confirmAt + 120, target: command, duration: retriedAt + 1780 - confirmAt, easing: 'steps(1, end)', transient: true, keyframes: [{ opacity: 0 }, { opacity: 0 }] },
    ...state('running').map((element) => visibleDuring(element, retriedAt, refreshAt + 300)),

    // Retry acceptance is not completion: later, ⌘R fetches the passed result.
    ...chord('refresh', refreshAt, 500),
    ...state('passed').map((element) => show(element, refreshAt + 300, { duration: 200 })),
  ]);
});
