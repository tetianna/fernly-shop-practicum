import { PopularList, type PopularItem } from '../../src/components/PopularList';

const fiveItems: PopularItem[] = [
  { id: 'pl-a', name: 'Alpha Fern', unitsSold: 200 },
  { id: 'pl-b', name: 'Beta Palm', unitsSold: 150 },
  { id: 'pl-c', name: 'Cedar Vine', unitsSold: 128 },
  { id: 'pl-d', name: 'Delta Fig', unitsSold: 90 },
  { id: 'pl-e', name: 'Echo Moss', unitsSold: 40 },
];

describe('PopularList', () => {
  // PP-06 — heading, links, sold copy, exclude currentId, max four, a11y name
  it('PP-06: shows Popular right now with up to four links excluding currentId', { tags: '@component' }, () => {
    cy.mount(<PopularList items={fiveItems} currentId="pl-a" />);

    cy.findByRole('heading', { name: 'Popular right now' });
    cy.findByRole('region', { name: 'Popular right now' }).within(() => {
      cy.findAllByRole('link').should('have.length', 4);
      cy.findByRole('link', { name: 'Alpha Fern' }).should('not.exist');
      cy.findByRole('link', { name: 'Beta Palm' }).should('have.attr', 'href', '/plants/pl-b');
      cy.findByText('150 sold this month');
      cy.findByRole('link', { name: 'Cedar Vine' }).should('have.attr', 'href', '/plants/pl-c');
      cy.findByText('128 sold this month');
      cy.findByRole('link', { name: 'Delta Fig' });
      cy.findByRole('link', { name: 'Echo Moss' });
      cy.findByRole('link', { name: 'Echo Moss' }).focus();
      cy.findByRole('link', { name: 'Echo Moss' }).should('be.focused');
    });

    cy.mount(<PopularList items={[{ id: 'pl-only', name: 'Only Plant', unitsSold: 1 }]} currentId="pl-only" />);
    cy.findByRole('heading', { name: 'Popular right now' }).should('not.exist');
  });
});
