import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NotFound from '@/app/(en)/[...missing]/not-found';
import PtNotFound from '@/app/(pt)/pt/[...missing]/not-found';
import { errorsContent } from '@/content/errors';
import { SITE_LOCALE } from '@/content/site-locale';

const pathnameMock = vi.fn<() => string | null>();

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  usePathname: () => pathnameMock(),
}));

const COMMAND_SELECTOR = '.cmd-line';

describe('404 page names the path the visitor asked for', () => {
  beforeEach(() => {
    pathnameMock.mockReset();
  });

  it('prints the requested path in the command and in the shell error', () => {
    pathnameMock.mockReturnValue('/no/such/page');
    const { container } = render(<NotFound />);
    const line = container.querySelector(COMMAND_SELECTOR);
    expect(line?.textContent).toContain('cd /no/such/page');
    expect(line?.textContent).toContain('bash: /no/such/page: no such file or directory');
    expect(line?.textContent).not.toContain('/route');
  });

  it('prints the pt path with the pt error text', () => {
    pathnameMock.mockReturnValue('/pt/nada');
    const { container } = render(<PtNotFound />);
    const line = container.querySelector(COMMAND_SELECTOR);
    expect(line?.textContent).toContain('cd /pt/nada');
    expect(line?.textContent).toContain('bash: /pt/nada: arquivo ou diretório inexistente');
  });

  it('decodes an encoded path and shows it as plain text, never as markup', () => {
    pathnameMock.mockReturnValue('/%3Cb%3Ex%3C%2Fb%3E');
    const { container } = render(<NotFound />);
    const line = container.querySelector(COMMAND_SELECTOR);
    expect(line?.textContent).toContain('cd /<b>x</b>');
    expect(line?.querySelector('b')).toBeNull();
  });

  it('keeps a malformed escape readable instead of throwing', () => {
    pathnameMock.mockReturnValue('/bad%E0%A4%A');
    const { container } = render(<NotFound />);
    expect(container.querySelector(COMMAND_SELECTOR)?.textContent).toContain('cd /bad%E0%A4%A');
  });

  it('shortens a very long path so the panel stays inside the viewport', () => {
    pathnameMock.mockReturnValue(`/${'a'.repeat(500)}`);
    const { container } = render(<NotFound />);
    const text = container.querySelector(COMMAND_SELECTOR)?.textContent ?? '';
    expect(text.length).toBeLessThan(300);
    expect(text).toContain('...');
  });

  it('falls back to the generic route when the router gives no path', () => {
    pathnameMock.mockReturnValue(null);
    render(<NotFound />);
    expect(screen.getByText(/bash: \/route: no such file or directory/)).not.toBeNull();
  });

  it('keeps the fallback path in content, one per language', () => {
    expect(errorsContent[SITE_LOCALE.en].notFound.pathFallback).toBe('/route');
    expect(errorsContent[SITE_LOCALE.pt].notFound.pathFallback).toBe('/rota');
  });
});
