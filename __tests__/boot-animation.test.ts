import { describe, expect, it } from 'vitest';
import {
  type BootClasses,
  buildLine,
  buildStaticCmdLine,
  buildStaticDialogLine,
  type LinePart,
} from '@/lib/boot-animation';

const cls: BootClasses = {
  bootOk: 'ok',
  bootEnc: 'enc',
  bootWelcome: 'welcome',
  bootPrompt: 'prompt',
  bootCmd: 'cmd',
  bootMatrixPrefix: 'prefix',
  bootMatrixOut: 'out',
  bootCursor: 'cursor',
  bootLine: 'line',
  shake: 'shake',
  shake2: 'shake2',
};

describe('buildLine', () => {
  it('creates a <span> with className from cls.bootLine', () => {
    const el = buildLine(['hello'], cls);
    expect(el.tagName).toBe('SPAN');
    expect(el.className).toBe('line');
  });

  it('sets data-testid="boot-line"', () => {
    const el = buildLine(['text'], cls);
    expect(el.dataset.testid).toBe('boot-line');
  });

  it('appends a text node for string parts', () => {
    const el = buildLine(['hello world'], cls);
    expect(el.childNodes[0]?.nodeType).toBe(Node.TEXT_NODE);
    expect(el.textContent).toBe('hello world');
  });

  it('appends a <span> with correct className and text for Span parts', () => {
    const parts: LinePart[] = [{ cls: 'bootOk', text: 'OK' }];
    const el = buildLine(parts, cls);
    const child = el.firstElementChild;
    expect(child?.tagName).toBe('SPAN');
    expect(child?.className).toBe('ok');
    expect(child?.textContent).toBe('OK');
  });

  it('handles mixed string and Span parts in order', () => {
    const parts: LinePart[] = ['Starting... ', { cls: 'bootOk', text: 'OK' }];
    const el = buildLine(parts, cls);
    expect(el.childNodes).toHaveLength(2);
    expect(el.childNodes[0]?.nodeType).toBe(Node.TEXT_NODE);
    expect(el.childNodes[1]?.nodeName).toBe('SPAN');
  });
});

describe('buildStaticCmdLine', () => {
  it('renders the prompt and command spans inside a boot-line span', () => {
    const el = buildStaticCmdLine(cls);
    expect(el.className).toBe('line');
    const spans = el.querySelectorAll('span');
    const classNames = Array.from(spans).map((s) => s.className);
    expect(classNames).toContain('prompt');
    expect(classNames).toContain('cmd');
  });

  it('prompt span contains the expected shell prompt text', () => {
    const el = buildStaticCmdLine(cls);
    const promptSpan = el.querySelector('.prompt');
    expect(promptSpan?.textContent).toBe('erik@portfolio:~$');
  });

  it('cmd span contains the expected command text', () => {
    const el = buildStaticCmdLine(cls);
    const cmdSpan = el.querySelector('.cmd');
    expect(cmdSpan?.textContent).toBe('run bio.exe --verbose');
  });
});

describe('buildStaticDialogLine', () => {
  it('renders prefix and output spans with correct text', () => {
    const el = buildStaticDialogLine('Wake up, Neo...', cls);
    const prefixSpan = el.querySelector('.prefix');
    const outSpan = el.querySelector('.out');
    expect(prefixSpan?.textContent).toBe('>');
    expect(outSpan?.textContent).toBe('Wake up, Neo...');
  });

  it('is wrapped in a boot-line span', () => {
    const el = buildStaticDialogLine('test', cls);
    expect(el.className).toBe('line');
  });
});
