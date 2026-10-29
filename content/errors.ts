import { errorsClientContent } from './errors-client';
import type { ErrorsContent } from './schemas';

export const errorsContent: ErrorsContent = {
  ...errorsClientContent,
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
  noscript: {
    text: 'This site works best with JavaScript. Content below is complete; the shell and the contact form need it.',
  },
};
