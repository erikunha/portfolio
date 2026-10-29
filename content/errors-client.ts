import type { ErrorsClientContent } from './schemas';

export const errorsClientContent: ErrorsClientContent = {
  chrome: {
    brand: 'erik_cunha.sh',
    brandHref: '/',
    navLabel: 'Site navigation',
    skipLabel: 'Skip to main content',
    nav: [
      { label: 'WORK', href: '/#sec-projects' },
      { label: 'CAREER', href: '/#sec-git-log' },
      { label: 'CONTACT', href: '/#sec-contact' },
      { label: 'LINKS', href: '/links' },
      { label: 'DESIGN_SYSTEM', href: '/design-system' },
    ],
  },
  serverError: {
    code: '500',
    message: 'Something broke on our side. Try again in a minute.',
    retryLabel: 'Try again',
    home: { label: 'Go home', href: '/' },
    refLabel: 'ref:',
    copyLabel: 'COPY',
    copyAriaLabel: 'Copy reference id',
    copiedAnnouncement: 'Reference id copied',
  },
};
