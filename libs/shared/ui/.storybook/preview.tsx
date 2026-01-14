/**
 * Storybook Preview Configuration
 * Imports global styles and design tokens
 * Provides locale context for i18n-aware components
 */

/* eslint-disable @nx/enforce-module-boundaries */
import type { Decorator, Preview } from '@storybook/react';
import { useEffect, useState } from 'react';
import '../../styles/src/index.css';

/**
 * Locale Decorator - Provides i18n context to stories
 *
 * Allows switching between locales in Storybook toolbar
 * Useful for testing components that use translations
 */
const WithLocale: Decorator = (Story, context) => {
  const locale = context.globals.locale || 'en';
  const [, forceUpdate] = useState({});

  // Force re-render when locale changes
  useEffect(() => {
    forceUpdate({});
  }, [locale]);

  return (
    <div data-locale={locale} lang={locale === 'pt' ? 'pt-BR' : 'en'}>
      <Story />
    </div>
  );
};

const preview: Preview = {
  globalTypes: {
    locale: {
      name: 'Locale',
      description: 'Internationalization locale',
      defaultValue: 'en',
      toolbar: {
        icon: 'globe',
        items: [
          { value: 'en', title: 'English', right: '🇺🇸' },
          { value: 'pt', title: 'Português', right: '🇧🇷' },
        ],
        showName: true,
        dynamicTitle: true,
      },
    },
  },
  decorators: [WithLocale],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'dark',
      values: [
        {
          name: 'dark',
          value: '#000000',
        },
        {
          name: 'light',
          value: '#ffffff',
        },
        {
          name: 'matrix',
          value: '#0a0a0a',
        },
      ],
    },
    viewport: {
      viewports: {
        mobile: {
          name: 'Mobile',
          styles: {
            width: '375px',
            height: '667px',
          },
        },
        tablet: {
          name: 'Tablet',
          styles: {
            width: '768px',
            height: '1024px',
          },
        },
        desktop: {
          name: 'Desktop',
          styles: {
            width: '1440px',
            height: '900px',
          },
        },
        wide: {
          name: 'Wide Desktop',
          styles: {
            width: '1920px',
            height: '1080px',
          },
        },
      },
    },
    a11y: {
      config: {
        rules: [
          {
            id: 'color-contrast',
            enabled: true,
          },
          {
            id: 'label',
            enabled: true,
          },
        ],
      },
    },
    actions: { argTypesRegex: '^on[A-Z].*' },
    docs: {
      toc: true,
    },
  },
};

export default preview;
