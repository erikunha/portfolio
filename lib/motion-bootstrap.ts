import { MOTION_BODY_STATE, MOTION_CHOICE, MOTION_STORAGE_KEY } from './motion-change';
import { scriptLiteral } from './script-literal';

const STORAGE_KEY_LITERAL = scriptLiteral(MOTION_STORAGE_KEY);
const OFF_LITERAL = scriptLiteral(MOTION_CHOICE.off);
const FULL_LITERAL = scriptLiteral(MOTION_BODY_STATE.full);
const REDUCE_LITERAL = scriptLiteral(MOTION_BODY_STATE.reduce);

export const MOTION_BOOTSTRAP_SCRIPT = `(function(){try{document.body.dataset.motion=localStorage.getItem(${STORAGE_KEY_LITERAL})===${OFF_LITERAL}?${REDUCE_LITERAL}:${FULL_LITERAL}}catch(e){document.body.dataset.motion=${FULL_LITERAL}}})();`;
