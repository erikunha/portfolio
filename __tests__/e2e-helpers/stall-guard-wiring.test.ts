import type { Page } from '@playwright/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type Annotation,
  createStallGuard,
  NAVIGATION_STALL_WINDOW_MS,
  WEBKIT_COOP_STALL_ANNOTATION,
} from '../../tests/e2e/_helpers/navigation-stall';

const TARGET = '/links/en';
const DOCUMENT_URL = 'http://localhost:3000/links/en';
const OK_STATUS = 200;

type Listener = (value: unknown) => void;

class FakePage {
  readonly listeners = new Map<string, Set<Listener>>();
  readonly frame = {};
  readonly gotoSpy = vi.fn<(url: string) => Promise<unknown>>();
  readonly goto = (url: string) => this.gotoSpy(url);
  readonly reload = vi.fn();
  readonly goBack = vi.fn();
  readonly goForward = vi.fn();
  readonly waitForURL = vi.fn();

  on(event: string, listener: Listener): void {
    const set = this.listeners.get(event) ?? new Set();
    set.add(listener);
    this.listeners.set(event, set);
  }

  off(event: string, listener: Listener): void {
    this.listeners.get(event)?.delete(listener);
  }

  emit(event: string, value: unknown): void {
    for (const listener of this.listeners.get(event) ?? []) listener(value);
  }

  listenerCount(): number {
    return [...this.listeners.values()].reduce((sum, set) => sum + set.size, 0);
  }

  url(): string {
    return 'about:blank';
  }

  mainFrame(): object {
    return this.frame;
  }

  documentRequest() {
    return { isNavigationRequest: () => true, frame: () => this.frame, url: () => DOCUMENT_URL };
  }

  answer(request: object) {
    const response = { request: () => request, status: () => OK_STATUS };
    this.emit('response', response);
    return response;
  }
}

function never<T>(): Promise<T> {
  return new Promise<T>(() => undefined);
}

function setup(browserName: string) {
  const annotations: Annotation[] = [];
  const testInfo = vi.fn(() => ({ annotations }));
  const guard = createStallGuard({
    browserName: () => browserName,
    testInfo,
    now: () => Date.now(),
  });
  const fake = new FakePage();
  const page = fake as unknown as Page;
  return { annotations, testInfo, guard, fake, page };
}

describe('the stall guard wiring', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('leaves a Chromium page unwrapped, so its goto errors point at the spec line', async () => {
    const { guard, fake, page, testInfo, annotations } = setup('chromium');
    fake.gotoSpy.mockImplementation(never);
    const original = page.goto;
    guard.guardNavigation(page);
    expect(page.goto).toBe(original);
    void page.goto(TARGET);
    expect(fake.listenerCount()).toBe(0);
    fake.emit('request', fake.documentRequest());
    await vi.advanceTimersByTimeAsync(NAVIGATION_STALL_WINDOW_MS * 4);
    expect(fake.gotoSpy).toHaveBeenCalledTimes(1);
    expect(testInfo).not.toHaveBeenCalled();
    expect(annotations).toEqual([]);
  });

  it('reads the test info only once the cheap stall checks pass', async () => {
    const { guard, fake, page, testInfo } = setup('webkit');
    let answer: (value: unknown) => void = () => undefined;
    fake.gotoSpy.mockImplementation(() => new Promise((resolve) => (answer = resolve)));
    guard.guardNavigation(page);
    const navigation = page.goto(TARGET);
    const request = fake.documentRequest();
    fake.emit('request', request);
    const response = fake.answer(request);
    await vi.advanceTimersByTimeAsync(NAVIGATION_STALL_WINDOW_MS);
    answer(response);
    await expect(navigation).resolves.toBe(response);
    expect(fake.gotoSpy).toHaveBeenCalledTimes(1);
    expect(testInfo).not.toHaveBeenCalled();
    expect(fake.listenerCount()).toBe(0);
  });

  it('guards the pages of a persistent context by the browser type it was launched from', () => {
    const { guard, fake, page } = setup('none');
    const pages: Page[] = [page];
    const context = { on: vi.fn(), pages: () => pages };
    const original = page.goto;
    guard.guardContext(context as unknown as Parameters<typeof guard.guardContext>[0], {
      name: () => 'webkit',
    });
    expect(page.goto).not.toBe(original);
    expect(context.on).toHaveBeenCalledWith('page', expect.any(Function));
    expect(fake.gotoSpy).not.toHaveBeenCalled();
  });

  it('navigates a stalled WebKit goto once more and annotates the elapsed time and status', async () => {
    const { guard, fake, page, annotations } = setup('webkit');
    fake.gotoSpy.mockImplementationOnce(never).mockImplementationOnce(async () => {
      const request = fake.documentRequest();
      fake.emit('request', request);
      return fake.answer(request);
    });
    guard.guardNavigation(page);
    const navigation = page.goto(TARGET);
    fake.emit('request', fake.documentRequest());
    await vi.advanceTimersByTimeAsync(NAVIGATION_STALL_WINDOW_MS);
    await expect(navigation).resolves.toMatchObject({});
    expect(fake.gotoSpy).toHaveBeenCalledTimes(2);
    expect(annotations).toEqual([
      {
        type: WEBKIT_COOP_STALL_ANNOTATION,
        description: `${TARGET}; first attempt stalled ${NAVIGATION_STALL_WINDOW_MS} ms; recovered: status ${OK_STATUS}`,
      },
    ]);
    expect(fake.listenerCount()).toBe(0);
  });

  it('fails a recovered WebKit goto whose second document answers after the window', async () => {
    const { guard, fake, page, annotations } = setup('webkit');
    fake.gotoSpy.mockImplementationOnce(never).mockImplementationOnce(async () => {
      const request = fake.documentRequest();
      fake.emit('request', request);
      await vi.advanceTimersByTimeAsync(NAVIGATION_STALL_WINDOW_MS + 1);
      return fake.answer(request);
    });
    guard.guardNavigation(page);
    const navigation = page.goto(TARGET);
    const settled = expect(navigation).rejects.toThrow(/^slow first byte/);
    fake.emit('request', fake.documentRequest());
    await vi.advanceTimersByTimeAsync(NAVIGATION_STALL_WINDOW_MS);
    await settled;
    expect(annotations[0]?.description).toMatch(/recovered: failed, SlowFirstByteError$/);
  });

  it('wraps a page once, however often it is guarded', () => {
    const { guard, page } = setup('webkit');
    const wrapped = guard.guardNavigation(page).goto;
    expect(guard.guardNavigation(page).goto).toBe(wrapped);
  });

  it('hands out a guarded page from the page fixture', async () => {
    const { guard, fake, page } = setup('webkit');
    const original = page.goto;
    const use = vi.fn(async (_value: Page) => undefined);
    await guard.fixtures.page({ page }, use);
    expect(use).toHaveBeenCalledWith(fake);
    expect(page.goto).not.toBe(original);
  });

  it('leaves reload, goBack, goForward and waitForURL unwrapped: none starts from about:blank', () => {
    const { guard, fake, page } = setup('webkit');
    const untouched = [fake.reload, fake.goBack, fake.goForward, fake.waitForURL];
    guard.guardNavigation(page);
    expect([page.reload, page.goBack, page.goForward, page.waitForURL]).toEqual(untouched);
  });
});
