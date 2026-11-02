import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TOPBAR_NAV } from '@/content/nav';
import { NAVIGATION } from '@/content/navigation';
import { topbarChrome } from '@/content/terminal-chrome';
import { SectionNavigationProvider } from '../SectionNavigation';
import { DesktopTopbar } from './DesktopTopbar.client';

const RIGHT_PUSH_CLASS = 'ml-auto';
const GROUP_GAP_CLASS = 'gap-3';

function classNames(element: Element | null | undefined): string[] {
  return (element?.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
}

function childrenOf(element: Element | null | undefined): Element[] {
  return element ? Array.from(element.children) : [];
}

function spansOf(element: Element | null | undefined): HTMLElement[] {
  return element ? Array.from(element.querySelectorAll('span')) : [];
}

function brandLabelIn(element: Element | null | undefined): HTMLElement | null {
  for (const span of spansOf(element)) {
    if (span.textContent === topbarChrome.brandLabel) return span;
  }
  return null;
}

function renderTopbar() {
  return render(
    <SectionNavigationProvider>
      <DesktopTopbar />
    </SectionNavigationProvider>,
  );
}

function topbarParts() {
  const { container } = renderTopbar();
  const row = container.querySelector('.desktop-topbar > div');
  const indexTrigger = row?.querySelector('.index-trigger') ?? null;
  const group = indexTrigger?.parentElement ?? null;
  const nav = group?.querySelector('nav') ?? null;
  const brandLabel = brandLabelIn(group);
  const badge = brandLabel?.parentElement ?? null;

  return { row, indexTrigger, group, nav, brandLabel, badge };
}

describe('DesktopTopbar', () => {
  it('orders the INDEX trigger, the brand badge and the nav as one right-hand group', () => {
    const { row, indexTrigger, group, nav, badge } = topbarParts();
    const groupChildren = childrenOf(group);

    expect(
      group,
      'the INDEX trigger must share one group with the brand badge and the nav',
    ).not.toBeNull();
    expect(
      row?.lastElementChild,
      'the group must be the last element of the row, so the pair is the right-most block',
    ).toBe(group);
    expect(
      groupChildren,
      'the group must hold exactly the INDEX trigger, the brand badge and the nav',
    ).toHaveLength(3);
    expect(groupChildren[0], 'the INDEX trigger leads the group').toBe(indexTrigger);
    expect(groupChildren[1], 'the brand badge follows the INDEX trigger').toBe(badge);
    expect(groupChildren[2], 'the nav follows the brand badge immediately').toBe(nav);
  });

  it('pushes the group right and leaves the nav without a push of its own', () => {
    const { group, nav } = topbarParts();

    expect(
      classNames(group),
      'the group must carry the right push that used to sit on the nav',
    ).toContain(RIGHT_PUSH_CLASS);
    expect(
      classNames(nav),
      'the nav must not push itself right, or the pair is split from it',
    ).not.toContain(RIGHT_PUSH_CLASS);
    expect(
      classNames(group),
      'the brand badge must sit 12px before the nav, the spacing the layout table sets',
    ).toContain(GROUP_GAP_CLASS);
  });

  it('reads the INDEX label and the brand badge from content and opens with ABOUT', () => {
    const { indexTrigger, nav, brandLabel } = topbarParts();

    expect(indexTrigger?.textContent ?? '').toContain(NAVIGATION.copy.indexLabel);
    expect(brandLabel?.textContent ?? '').toBe(topbarChrome.brandLabel);
    expect(nav?.querySelector('a')?.textContent?.trim() ?? '').toBe(TOPBAR_NAV[0]?.label);
  });
});
