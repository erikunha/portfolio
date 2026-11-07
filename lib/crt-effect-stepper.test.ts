import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CRT_EFFECT_SELECTOR, createEffectStepper } from './crt-effect-stepper';

const EFFECT_CLASSES = ['crt-noise', 'crt-flicker', 'crt-scan-beam'];
const START_TIME_MS = 4000;

type FakeAnimation = { currentTime: number | null };

function withAnimations(el: HTMLElement): FakeAnimation[] {
  const animations: FakeAnimation[] = [{ currentTime: START_TIME_MS }];
  (el as unknown as { getAnimations: () => FakeAnimation[] }).getAnimations = () => animations;
  return animations;
}

describe('CRT effect stepper', () => {
  let effects: HTMLElement[];
  let animations: FakeAnimation[][];
  let bystander: HTMLElement;
  let bystanderAnimations: FakeAnimation[];

  beforeEach(() => {
    effects = EFFECT_CLASSES.map((name) => {
      const el = document.createElement('div');
      el.className = name;
      document.body.appendChild(el);
      return el;
    });
    animations = effects.map(withAnimations);
    bystander = document.createElement('div');
    bystander.className = 'crt-scanlines';
    document.body.appendChild(bystander);
    bystanderAnimations = withAnimations(bystander);
  });

  afterEach(() => {
    for (const el of [...effects, bystander]) el.remove();
  });

  const times = () => animations.map((list) => list[0]?.currentTime);

  it('selects exactly the three animated CRT layers', () => {
    expect([...document.querySelectorAll(CRT_EFFECT_SELECTOR)]).toEqual(effects);
  });

  it('leaves the animations where they are on the first step', () => {
    createEffectStepper().step(1000);
    expect(times()).toEqual([START_TIME_MS, START_TIME_MS, START_TIME_MS]);
  });

  it('moves every effect forward by the real time between steps', () => {
    const stepper = createEffectStepper();
    stepper.step(1000);
    stepper.step(1100);
    stepper.step(1400);
    expect(times(), 'a paused animation only advances when the stepper moves its clock').toEqual([
      START_TIME_MS + 400,
      START_TIME_MS + 400,
      START_TIME_MS + 400,
    ]);
  });

  it('skips the time spent on hold, so a hidden tab does not fast-forward the effects', () => {
    const stepper = createEffectStepper();
    stepper.step(0);
    stepper.step(100);
    stepper.hold();
    stepper.step(5000);
    expect(times()).toEqual([START_TIME_MS + 100, START_TIME_MS + 100, START_TIME_MS + 100]);
    stepper.step(5100);
    expect(times()).toEqual([START_TIME_MS + 200, START_TIME_MS + 200, START_TIME_MS + 200]);
  });

  it('pulls an animation that kept running back onto the stepped clock', () => {
    const stepper = createEffectStepper();
    stepper.step(0);
    stepper.step(100);
    const first = animations[0]?.[0];
    if (first) first.currentTime = (first.currentTime ?? 0) + 50;
    stepper.step(200);
    expect(
      first?.currentTime,
      'a browser that runs a paused animation after a time write must not make the effect run fast',
    ).toBe(START_TIME_MS + 200);
  });

  it('leaves every other element alone', () => {
    const stepper = createEffectStepper();
    stepper.step(0);
    stepper.step(250);
    expect(bystanderAnimations[0]?.currentTime).toBe(START_TIME_MS);
  });

  it('does nothing for an effect that has no running animation', () => {
    const stepper = createEffectStepper();
    (effects[0] as unknown as { getAnimations: () => FakeAnimation[] }).getAnimations = () => [];
    stepper.step(0);
    expect(() => stepper.step(250)).not.toThrow();
    expect(animations[1]?.[0]?.currentTime).toBe(START_TIME_MS + 250);
  });

  it('survives a browser without the animations API', () => {
    const stepper = createEffectStepper();
    for (const el of effects)
      (el as unknown as { getAnimations?: unknown }).getAnimations = undefined;
    stepper.step(0);
    expect(() => stepper.step(250)).not.toThrow();
  });

  it('treats an animation with no current time as starting from zero', () => {
    const stepper = createEffectStepper();
    const first = animations[0]?.[0];
    if (first) first.currentTime = null;
    stepper.step(0);
    stepper.step(250);
    expect(first?.currentTime).toBe(250);
  });
});
