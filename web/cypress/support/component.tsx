import { register as registerCypressGrep } from '@cypress/grep';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/cypress/add-commands';
import { mount } from 'cypress/react';
import { MemoryRouter } from 'react-router';
import '../../src/styles/global.css';

registerCypressGrep();

function mountWithProviders(...args: Parameters<typeof mount>) {
  const [component, options, rerenderKey] = args;
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return mount(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{component}</MemoryRouter>
    </QueryClientProvider>,
    options,
    rerenderKey,
  );
}

Cypress.Commands.add('mount', mountWithProviders);

declare global {
  namespace Cypress {
    interface Chainable {
      mount: typeof mount;
    }
  }
}

export {};
