import { expect, type Page, test } from '@playwright/test';

const FIXED_NOW = new Date('2026-11-02T15:00:00Z');
const VIEWPORTS = [
  { name: '320', width: 320, height: 700 },
  { name: '390', width: 390, height: 844 },
  { name: '768', width: 768, height: 1024 },
  { name: '1280', width: 1280, height: 720 },
] as const;
const PROPOSE_LABEL = 'PROPOSE_IN_MESSAGE ↙';
const SEARCH_LABEL = 'Search your city or timezone';
const MESSAGE_LABEL = '$ message:';
const FOCUS_LINK_LABEL = 'edit message ↑';
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 720 };
const CLOCK_PATTERN = /^\d{2}:\d{2}:\d{2}$/;
const TICK_TIMEOUT_MS = 5_000;
const ERROR_STATUS_FLOOR = 400;
const SCROLL_MARGIN_PX = 100;

type Findings = { consoleErrors: string[]; failedRequests: string[] };

function watch(page: Page): Findings {
  const findings: Findings = { consoleErrors: [], failedRequests: [] };
  page.on('console', (message) => {
    if (message.type() === 'error') findings.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => findings.consoleErrors.push(error.message));
  page.on('requestfailed', (request) =>
    findings.failedRequests.push(
      `${request.method()} ${request.url()} ${request.failure()?.errorText}`,
    ),
  );
  page.on('response', (response) => {
    if (response.status() >= ERROR_STATUS_FLOOR) {
      findings.failedRequests.push(`${response.status()} ${response.url()}`);
    }
  });
  return findings;
}

async function openPanel(page: Page) {
  await page.goto('/');
  await page.evaluate(
    (margin) =>
      window.scrollTo(
        0,
        (document.querySelector('.contact-timezone') as HTMLElement).getBoundingClientRect().top +
          window.scrollY -
          margin,
      ),
    SCROLL_MARGIN_PX,
  );
  const panel = page.getByTestId('contact-timezone');
  await expect(panel).toBeVisible();
  await panel.scrollIntoViewIfNeeded();
  return panel;
}

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    const panel = document.querySelector('[data-testid="contact-timezone"]');
    const box = panel?.getBoundingClientRect();
    return {
      pageOverflow: document.documentElement.scrollWidth - viewport,
      panelLeft: box?.left ?? 0,
      panelRight: (box?.right ?? 0) - viewport,
    };
  });
}

test.describe('contact timezone panel, visitor in Berlin', () => {
  test.use({ timezoneId: 'Europe/Berlin', locale: 'en-US' });

  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(FIXED_NOW);
  });

  test('states where the visitor is and shows both map labels', async ({ page }) => {
    const findings = watch(page);
    const panel = await openPanel(page);

    await expect(panel.getByTestId('ctz-youare')).toContainText('You are in');
    await expect(panel.getByTestId('ctz-place')).toHaveText('Germany');
    await expect(panel.getByTestId('ctz-detected')).toContainText('auto-detected · Europe/Berlin');
    await expect(panel.getByRole('img', { name: /World map/ })).toBeVisible();
    await expect(panel.getByTestId('ctz-label-erik')).toBeVisible();
    await expect(panel.getByTestId('ctz-label-you')).toBeVisible();
    await expect(panel.getByTestId('ctz-label-you')).toContainText('BER');
    await expect(panel.getByTestId('ctz-pin-erik')).toBeVisible();
    await expect(panel.getByTestId('ctz-pin-you')).toBeVisible();
    await expect(panel.getByTestId('ctz-route')).toHaveCount(1);

    await expect(panel.getByTestId('ctz-clock-erik')).toHaveText('12:00:00');
    await expect(panel.getByTestId('ctz-clock-you')).toHaveText('16:00:00');
    await expect(panel.getByTestId('ctz-status')).toHaveAttribute('data-online', 'true');
    await expect(panel.getByTestId('ctz-overlap')).toContainText('5 hours overlap');
    await expect(panel.getByTestId('ctz-overlap')).toContainText('13:00 to 18:00 your time');
    await expect(page.locator('.ctz-footer .ctz-fact').first()).toBeVisible();

    expect(findings.consoleErrors, 'the panel logs no console error').toEqual([]);
    expect(findings.failedRequests, 'the panel causes no failed request').toEqual([]);
  });

  test('searching a city and picking it with the keyboard moves the visitor pin', async ({
    page,
  }) => {
    const findings = watch(page);
    const panel = await openPanel(page);
    const combobox = panel.getByRole('combobox', { name: SEARCH_LABEL });

    await combobox.click();
    await combobox.pressSequentially('tokyo');
    await expect(combobox).toHaveAttribute('aria-expanded', 'true');
    const option = panel.getByRole('option', { name: /Tokyo/ });
    await expect(option).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await expect(combobox).toHaveAttribute('aria-activedescendant', /.+/);
    await page.keyboard.press('Enter');

    await expect(combobox).toHaveAttribute('aria-expanded', 'false');
    await expect(combobox).toBeFocused();
    await expect(panel.getByTestId('ctz-place')).toHaveText('Japan');
    await expect(panel.getByTestId('ctz-detected')).toContainText('set by you · Asia/Tokyo');
    await expect(panel.getByTestId('ctz-label-you')).toContainText('TYO');
    await expect(panel.getByTestId('ctz-label-you')).toContainText('00:00');
    await expect(panel.getByTestId('ctz-label-erik')).toBeVisible();
    await expect(panel.getByRole('img', { name: /you in Japan/ })).toBeVisible();

    expect(findings.consoleErrors).toEqual([]);
    expect(findings.failedRequests).toEqual([]);
  });

  test('escape closes the list and keeps the typed search out of the choice', async ({ page }) => {
    const panel = await openPanel(page);
    const combobox = panel.getByRole('combobox', { name: SEARCH_LABEL });

    await combobox.click();
    await combobox.pressSequentially('lis');
    await expect(panel.getByRole('option').first()).toBeVisible();
    await page.keyboard.press('Escape');

    await expect(combobox).toHaveAttribute('aria-expanded', 'false');
    await expect(panel.getByTestId('ctz-place')).toHaveText('Germany');
  });

  test('propose appends the best slot to the contact message', async ({ page }) => {
    const findings = watch(page);
    const panel = await openPanel(page);
    const message = page.getByLabel(MESSAGE_LABEL);
    await expect(message).toBeVisible();
    await message.fill('Hello Erik, I would like to talk about a role.');

    await panel.getByRole('button', { name: PROPOSE_LABEL }).click();

    await expect(panel.getByTestId('ctz-proposed')).toBeVisible();
    await expect(message).toHaveValue(
      /Hello Erik, I would like to talk about a role\.\nProposed call: /,
    );
    await expect(message).toHaveValue(/\(Europe\/Berlin\)/);
    await expect(message).toHaveValue(/Erik time \(São Paulo\)/);

    await panel.getByRole('button', { name: PROPOSE_LABEL }).click();
    const value = await message.inputValue();
    expect(
      value.match(/Proposed call:/g),
      'proposing the same slot twice adds one line',
    ).toHaveLength(1);

    expect(findings.consoleErrors).toEqual([]);
    expect(findings.failedRequests).toEqual([]);
  });

  test('on a phone the added confirmation links back to the message field', async ({ page }) => {
    await page.setViewportSize(PHONE);
    const findings = watch(page);
    const panel = await openPanel(page);
    const message = page.getByLabel(MESSAGE_LABEL);

    await panel.getByRole('button', { name: PROPOSE_LABEL }).click();

    await expect(panel.getByTestId('ctz-proposed')).toBeVisible();
    const link = panel.getByRole('link', { name: FOCUS_LINK_LABEL });
    await expect(link).toBeVisible();
    await expect(message).not.toBeFocused();
    await link.click();
    await expect(message).toBeFocused();
    await expect(message).toHaveValue(/Proposed call: /);
    expect(page.url(), 'the link does not leave a hash behind').not.toContain('#');

    expect(findings.consoleErrors).toEqual([]);
    expect(findings.failedRequests).toEqual([]);
  });

  test('at 1280 the form sits beside the panel, so the confirmation shows no link', async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    const panel = await openPanel(page);

    await panel.getByRole('button', { name: PROPOSE_LABEL }).click();

    await expect(panel.getByTestId('ctz-proposed')).toBeVisible();
    await expect(panel.getByRole('link', { name: FOCUS_LINK_LABEL })).toBeHidden();
  });

  for (const viewport of VIEWPORTS) {
    test(`no horizontal overflow at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const panel = await openPanel(page);
      await expect(panel.getByTestId('ctz-label-erik')).toBeVisible();
      await expect(panel.getByTestId('ctz-label-you')).toBeVisible();

      const overflow = await horizontalOverflow(page);
      expect(
        overflow.pageOverflow,
        `the page does not scroll sideways at ${viewport.name}`,
      ).toBeLessThanOrEqual(0);
      expect(overflow.panelLeft, 'the panel starts inside the viewport').toBeGreaterThanOrEqual(0);
      expect(overflow.panelRight, 'the panel ends inside the viewport').toBeLessThanOrEqual(0);

      await panel.getByRole('combobox', { name: SEARCH_LABEL }).click();
      await panel.getByRole('combobox', { name: SEARCH_LABEL }).pressSequentially('a');
      await expect(panel.getByRole('option').first()).toBeVisible();
      const listed = await horizontalOverflow(page);
      expect(
        listed.pageOverflow,
        `the open list does not scroll sideways at ${viewport.name}`,
      ).toBeLessThanOrEqual(0);
    });
  }
});

test.describe('contact timezone panel, visitor in São Paulo', () => {
  test.use({ timezoneId: 'America/Sao_Paulo', locale: 'en-US' });

  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(FIXED_NOW);
  });

  test('keeps both pins and labels visible without a route when the visitor is near Erik', async ({
    page,
  }) => {
    const findings = watch(page);
    const panel = await openPanel(page);

    await expect(panel.getByTestId('ctz-youare')).toContainText('You are in');
    await expect(panel.getByTestId('ctz-place')).toHaveText('Brazil');
    await expect(panel.getByTestId('ctz-label-erik')).toBeVisible();
    await expect(panel.getByTestId('ctz-label-you')).toBeVisible();
    await expect(panel.getByTestId('ctz-pin-erik')).toBeVisible();
    await expect(panel.getByTestId('ctz-pin-you')).toBeVisible();
    await expect(panel.getByTestId('ctz-route')).toHaveCount(0);
    await expect(panel.getByTestId('ctz-clock-erik')).toHaveText('12:00:00');
    await expect(panel.getByTestId('ctz-clock-you')).toHaveText('12:00:00');

    const erik = await panel.getByTestId('ctz-label-erik').boundingBox();
    const you = await panel.getByTestId('ctz-label-you').boundingBox();
    expect(erik).not.toBeNull();
    expect(you).not.toBeNull();
    const separated =
      (erik?.x ?? 0) >= (you?.x ?? 0) + (you?.width ?? 0) ||
      (you?.x ?? 0) >= (erik?.x ?? 0) + (erik?.width ?? 0) ||
      (erik?.y ?? 0) >= (you?.y ?? 0) + (you?.height ?? 0) ||
      (you?.y ?? 0) >= (erik?.y ?? 0) + (erik?.height ?? 0);
    expect(separated, 'the two map labels do not overlap').toBe(true);

    expect(findings.consoleErrors).toEqual([]);
    expect(findings.failedRequests).toEqual([]);
  });

  test('picking another city replaces both the label and the place', async ({ page }) => {
    const panel = await openPanel(page);
    const combobox = panel.getByRole('combobox', { name: SEARCH_LABEL });

    await combobox.click();
    await combobox.pressSequentially('berlin');
    await panel.getByRole('option', { name: /Berlin/ }).click();

    await expect(panel.getByTestId('ctz-place')).toHaveText('Germany');
    await expect(panel.getByTestId('ctz-label-you')).toContainText('BER');
    await expect(panel.getByTestId('ctz-route')).toHaveCount(1);
  });
});

test.describe('contact timezone panel clocks', () => {
  test.use({ timezoneId: 'Europe/Berlin', locale: 'en-US' });

  test('the clocks tick while the panel is on screen', async ({ page }) => {
    const panel = await openPanel(page);
    const erik = panel.getByTestId('ctz-clock-erik');
    await expect(erik).toHaveText(CLOCK_PATTERN);
    const first = await erik.textContent();
    await expect.poll(async () => erik.textContent(), { timeout: TICK_TIMEOUT_MS }).not.toBe(first);
  });

  test('the live region announces minutes and never seconds', async ({ page }) => {
    const panel = await openPanel(page);
    await expect(panel.getByTestId('ctz-announce')).toHaveText(
      /^Erik local time \d{2}:\d{2}\. Your local time \d{2}:\d{2}\.$/,
    );
  });
});
