export const TO_TOP_SHOW_AFTER_PX = 400;
export const TO_TOP_MIN_DELTA_PX = 12;

export interface ToTopState {
  visible: boolean;
  anchor: number;
}

export function nextToTopState(state: ToTopState, y: number): ToTopState {
  if (y <= TO_TOP_SHOW_AFTER_PX) {
    return state.visible || state.anchor !== y ? { visible: false, anchor: y } : state;
  }
  const delta = y - state.anchor;
  if (Math.abs(delta) < TO_TOP_MIN_DELTA_PX) return state;
  return { visible: delta < 0, anchor: y };
}
