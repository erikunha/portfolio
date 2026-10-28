import { ErrorsContentSchema } from './schemas';

export const errorsContent = ErrorsContentSchema.parse({
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
  notFound: {
    metaTitle: '404 · erikunha.dev',
    code: '404',
    panelHeader: '[ NOT FOUND ]',
    prompt: '$',
    command: 'cd /route',
    output: 'bash: /route: no such file or directory',
    suggestionsLabel: 'TRY INSTEAD',
    suggestionsNavLabel: 'Suggested pages',
    suggestions: [
      { label: 'Projects', href: '/#sec-projects' },
      { label: 'Contact', href: '/#sec-contact' },
      { label: 'Links', href: '/links' },
    ],
    home: { label: 'Go home', href: '/' },
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
  noscript: {
    text: 'This site works best with JavaScript. Content below is complete; the shell and the contact form need it.',
  },
});
