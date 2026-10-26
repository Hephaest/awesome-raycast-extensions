import { registerDemo, type Factory } from '../scripts/director';
import { build, enter, show, type Step } from '../scripts/sequence';

/**
 * The hero's load sequence: the launcher scales in and the favorites fill in.
 * The final frame is the markup's default.
 */
const factory: Factory = (scene) => {
  const window = scene.querySelector<HTMLElement>('[data-window="hero"]');
  if (!window) throw new Error('Hero set is missing [data-window="hero"]');
  const rows = [...scene.querySelectorAll<HTMLElement>('.hero-set__row')];

  const steps: Step[] = [
    enter(window, 560),
    ...rows.map((row, index) => show(row, 760 + index * 70, { duration: 280, rise: 6 })),
  ];
  return build(steps);
};

registerDemo('hero', factory);
