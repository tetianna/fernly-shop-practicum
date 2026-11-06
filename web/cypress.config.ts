import { plugin as cypressGrepPlugin } from '@cypress/grep/plugin';
import { defineConfig } from 'cypress';
import appViteConfig from './vite.config';

/** App dev uses 5173 (`vite.config.ts`). Component CT must use another port or `/__cypress/*` hits the shop server and fails to load support/spec modules. */
const componentDevPort = 5180;

export default defineConfig({
  video: false,
  component: {
    devServer: {
      framework: 'react',
      bundler: 'vite',
      viteConfig: {
        ...appViteConfig,
        server: {
          ...appViteConfig.server,
          port: componentDevPort,
          strictPort: false,
          proxy: undefined,
        },
      },
    },
    specPattern: 'cypress/component/**/*.cy.tsx',
    supportFile: 'cypress/support/component.tsx',
    setupNodeEvents(_on, config) {
      cypressGrepPlugin(config);
      return config;
    },
  },
  e2e: {
    baseUrl: 'http://localhost:5173',
    specPattern: 'cypress/ui/**/*.cy.ts',
    supportFile: 'cypress/support/ui.ts',
    setupNodeEvents(_on, config) {
      cypressGrepPlugin(config);
      return config;
    },
  },
});
