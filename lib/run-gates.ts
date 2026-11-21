export type RunGates<Gate extends string> = {
  set: (gate: Gate, open: boolean) => void;
  sync: () => void;
  isOpen: () => boolean;
};

export function createRunGates<Gate extends string>(
  initial: Record<Gate, boolean>,
  onChange: (open: boolean) => void,
): RunGates<Gate> {
  const gates: Record<string, boolean> = { ...initial };
  let open = false;

  function sync() {
    const next = Object.values(gates).every(Boolean);
    if (next === open) return;
    open = next;
    onChange(open);
  }

  return {
    set(gate, isGateOpen) {
      gates[gate] = isGateOpen;
      sync();
    },
    sync,
    isOpen: () => open,
  };
}
