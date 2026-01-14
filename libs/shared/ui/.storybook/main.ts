import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { StorybookConfig } from '@storybook/react-vite';

import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import react from '@vitejs/plugin-react';
import { mergeConfig } from 'vite';

const config: StorybookConfig = {
  stories: ['**/*.@(mdx|stories.@(js|jsx|ts|tsx))'],
  addons: [getAbsolutePath('@storybook/addon-a11y')],
  framework: {
    name: getAbsolutePath('@storybook/react-vite'),
    options: {},
  },

  viteFinal: async (config) =>
    mergeConfig(config, {
      plugins: [react(), nxViteTsPaths()],
    }),
};

function getAbsolutePath(value: string): string {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}

export default config;

// To customize your Vite configuration you can use the viteFinal field.
// Check https://storybook.js.org/docs/react/builders/vite#configuration
// and https://nx.dev/recipes/storybook/custom-builder-configs
