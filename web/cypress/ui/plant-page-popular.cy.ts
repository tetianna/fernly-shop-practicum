const PLANT_ID = 'pl-fixture-popular';

function stubPlantPagePopular(popularFixture: string) {
  cy.intercept('GET', `**/api/plants/${PLANT_ID}`, { fixture: 'plant-detail-popular.json' }).as('plant');
  cy.intercept('GET', '**/api/plants?pageSize=48', { fixture: 'plants-browse-positive.json' }).as('allPlants');
  cy.intercept('GET', `**/api/plants/${PLANT_ID}/reviews`, { fixture: 'plant-reviews-empty.json' }).as('reviews');
  cy.intercept('GET', '**/api/popular?limit=5', { fixture: popularFixture }).as('popular');
}

describe('Plant page Popular right now', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
  });

  // PP-07 — mocked popular → section with up to four links; current plant omitted
  it('PP-07: Popular right now omits current plant and shows sold copy', { tags: '@ui' }, () => {
    stubPlantPagePopular('popular-with-current.json');
    cy.visit(`/plants/${PLANT_ID}`);
    cy.wait('@plant');
    cy.wait('@popular');

    cy.findByRole('heading', { name: 'Popular right now' });
    cy.findByRole('region', { name: 'Popular right now' }).within(() => {
      cy.findByRole('link', { name: 'Snake Plant' }).should('not.exist');
      cy.findAllByRole('link').should('have.length', 4);
      cy.findByRole('link', { name: 'Monstera Deliciosa' }).should(
        'have.attr',
        'href',
        '/plants/pl-monstera',
      );
      cy.findByText('400 sold this month');
      cy.findByRole('link', { name: 'Golden Pothos' });
      cy.findByRole('link', { name: 'ZZ Plant' });
      cy.findByRole('link', { name: 'Aloe Vera' });
      cy.findByRole('link', { name: 'Monstera Deliciosa' }).focus();
      cy.findByRole('link', { name: 'Monstera Deliciosa' }).should('be.focused');
    });
  });
});
