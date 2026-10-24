import { afterEach, describe, expect, it } from 'vitest';
import { readmeCopy } from '@/content/readme';
import { type MountedClient, mountClient } from './helpers/render';

describe('ReadmeSection', () => {
  let mounted: MountedClient;

  afterEach(() => {
    mounted?.unmount();
  });

  async function render(panel = false) {
    const { ReadmeSection } = await import('@/components/sections/ReadmeSection/ReadmeSection');
    mounted = await mountClient(ReadmeSection({ panel }));
    return mounted.container;
  }

  it('renders the whoami header and intro', async () => {
    const container = await render();
    expect(container.querySelector('h2')?.textContent).toContain(readmeCopy.desktopH1);
    expect(container.textContent).toContain(readmeCopy.desktopIntro);
  });

  it('renders every operating principle as a list item under its heading', async () => {
    const container = await render();
    const items = [...container.querySelectorAll('li')].map((li) => li.textContent);
    expect(container.textContent).toContain(readmeCopy.principlesHeading);
    for (const principle of readmeCopy.desktopPrinciples) expect(items).toContain(principle);
  });

  it('renders the current status with every detail', async () => {
    const container = await render();
    const items = [...container.querySelectorAll('li')].map((li) => li.textContent);
    expect(container.textContent).toContain(readmeCopy.desktopStatusH2);
    expect(container.textContent).toContain(
      `${readmeCopy.currentStatus.prefix}[${readmeCopy.currentStatus.role}]${readmeCopy.currentStatus.suffix}`,
    );
    for (const detail of readmeCopy.statusDetails) expect(items).toContain(detail);
  });

  it('drops the standalone section label and icon when rendered as a panel', async () => {
    const standalone = await render();
    expect(standalone.querySelector('.sr-only')).not.toBeNull();
    mounted.unmount();
    const panel = await render(true);
    expect(panel.querySelector('.sr-only')).toBeNull();
    expect(panel.querySelector('svg')).toBeNull();
  });
});
