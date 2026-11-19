import { expect, type Page, test } from '@playwright/test';
import { openSectionMenu } from './_helpers/hydration';
import { installMockBackend } from './_helpers/mock-backend';

const DRAWER = '#section-drawer';
const SAMPLE_MS = 600;
const TYPED = 'Test Visitor';

type Frame = { open: boolean; exiting: boolean; modal: boolean };
type SamplerWindow = Window & { exitFrames?: Frame[]; exitDone?: boolean };

async function armSampler(page: Page): Promise<void> {
  await page.evaluate((sampleMs) => {
    const sampler = window as SamplerWindow;
    const drawer = document.querySelector('#section-drawer') as HTMLDialogElement;
    sampler.exitFrames = [];
    sampler.exitDone = false;
    drawer.addEventListener(
      'click',
      () => {
        const start = performance.now();
        const tick = () => {
          sampler.exitFrames?.push({
            open: drawer.open,
            exiting: !drawer.classList.contains('is-open'),
            modal: drawer.matches(':modal'),
          });
          if (performance.now() - start < sampleMs) requestAnimationFrame(tick);
          else sampler.exitDone = true;
        };
        requestAnimationFrame(tick);
      },
      { capture: true, once: true },
    );
  }, SAMPLE_MS);
}

test('the page takes input while the drawer slides out after a section is chosen @cross-browser', async ({
  page,
}) => {
  await installMockBackend(page, { log: 'accept', forget: 'happy' });
  await page.goto('/');
  await openSectionMenu(page);
  await expect(page.locator('body')).not.toHaveAttribute('data-motion', 'reduce');
  await armSampler(page);
  await page
    .locator(DRAWER)
    .getByRole('link', { name: /contact/i })
    .first()
    .click();
  const name = page.getByTestId('contact-form').getByLabel('$ name:');
  await name.fill(TYPED);
  await expect(name, 'typing during the slide-out reaches the field').toHaveValue(TYPED);
  await page.waitForFunction(() => (window as SamplerWindow).exitDone === true);
  const frames = await page.evaluate(() => (window as SamplerWindow).exitFrames ?? []);
  const sliding = frames.filter(({ open, exiting }) => open && exiting);
  expect(sliding.length, 'the sampler saw the slide-out').toBeGreaterThan(0);
  expect(
    sliding.filter(({ modal }) => modal),
    'a modal dialog keeps the page inert until the slide ends',
  ).toEqual([]);
  expect(frames.at(-1)?.open, 'the dialog closes once the slide is over').toBe(false);
});
