import { describe, expect, it, vi } from 'vitest';
import { createRunGates } from './run-gates';

type Gate = 'motion' | 'visible' | 'calm';
const ALL_OPEN: Record<Gate, boolean> = { motion: true, visible: true, calm: true };
const GATES = Object.keys(ALL_OPEN) as Gate[];

function openGates() {
  const onChange = vi.fn<(open: boolean) => void>();
  const gates = createRunGates<Gate>(ALL_OPEN, onChange);
  gates.sync();
  onChange.mockClear();
  return { gates, onChange };
}

describe('createRunGates', () => {
  it('starts paused and runs on the first sync when every gate is open', () => {
    const onChange = vi.fn();
    const gates = createRunGates<Gate>(ALL_OPEN, onChange);
    expect(gates.isOpen(), 'nothing runs before the first sync').toBe(false);
    expect(onChange).not.toHaveBeenCalled();
    gates.sync();
    expect(gates.isOpen()).toBe(true);
    expect(onChange).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('stays paused on the first sync when a gate starts closed', () => {
    const onChange = vi.fn();
    const gates = createRunGates<Gate>({ ...ALL_OPEN, visible: false }, onChange);
    gates.sync();
    expect(gates.isOpen()).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each(GATES)('pauses when only the %s gate closes', (gate) => {
    const { gates, onChange } = openGates();
    gates.set(gate, false);
    expect(gates.isOpen()).toBe(false);
    expect(onChange).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('resumes only when every closed gate has reopened', () => {
    const { gates, onChange } = openGates();
    gates.set('motion', false);
    gates.set('calm', false);
    onChange.mockClear();
    gates.set('motion', true);
    expect(gates.isOpen(), 'calm is still closed').toBe(false);
    expect(onChange).not.toHaveBeenCalled();
    gates.set('calm', true);
    expect(gates.isOpen()).toBe(true);
    expect(onChange).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('notifies once per transition and not when the answer is unchanged', () => {
    const { gates, onChange } = openGates();
    gates.set('motion', true);
    gates.set('visible', false);
    gates.set('visible', false);
    gates.set('calm', false);
    gates.set('motion', false);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(false);
    gates.set('visible', true);
    gates.set('calm', true);
    gates.set('motion', true);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith(true);
  });

  it('keeps the initial record untouched', () => {
    const initial = { ...ALL_OPEN };
    const gates = createRunGates<Gate>(initial, vi.fn());
    gates.set('calm', false);
    expect(initial).toEqual(ALL_OPEN);
  });
});
