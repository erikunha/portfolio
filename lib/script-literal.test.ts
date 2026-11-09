import { describe, expect, it } from 'vitest';
import { MOTION_BOOTSTRAP_SCRIPT } from './motion-bootstrap';
import { scriptLiteral } from './script-literal';

const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);
const LINE_BREAKERS = new RegExp(`[${LS}${PS}]`);

describe('scriptLiteral', () => {
  it('escapes every character that can end or break an inline script', () => {
    const hostile = `</script><!--<script>${LS}${PS}`;
    const out = scriptLiteral(hostile);
    expect(out).not.toMatch(/[<>/]/);
    expect(out).not.toMatch(LINE_BREAKERS);
    expect(JSON.parse(out)).toBe(hostile);
  });

  it('round-trips structured values through JSON.parse', () => {
    const value = { name: 'a/b<c>', list: [`x${LS}y`] };
    expect(JSON.parse(scriptLiteral(value))).toEqual(value);
  });

  it('evaluates to the same value when placed in script source', () => {
    const hostile = `</script>${LS}x`;
    expect(new Function(`return ${scriptLiteral(hostile)};`)()).toBe(hostile);
  });
});

describe('MOTION_BOOTSTRAP_SCRIPT', () => {
  it('contains no character that could close the script element or split a line', () => {
    expect(MOTION_BOOTSTRAP_SCRIPT).not.toContain('</');
    expect(MOTION_BOOTSTRAP_SCRIPT).not.toMatch(LINE_BREAKERS);
  });
});
