const PLANT_ID = 'pl-fixture-reviews';

function stubPlantPageSignedOut() {
  cy.intercept('GET', `**/api/plants/${PLANT_ID}`, { fixture: 'plant-detail-reviews.json' }).as('plant');
  cy.intercept('GET', '**/api/plants?pageSize=48', { fixture: 'plants-browse-positive.json' }).as('allPlants');
  cy.intercept('GET', `**/api/plants/${PLANT_ID}/reviews`, { fixture: 'plant-reviews-list.json' }).as('reviews');
}

describe('Plant page Reviews (signed out)', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
  });

  it('PR03-01: Sign in link points to login with next plant path', { tags: '@ui' }, () => {
    stubPlantPageSignedOut();
    cy.visit(`/plants/${PLANT_ID}`);
    cy.wait('@plant');
    cy.wait('@reviews');

    cy.findByRole('heading', { name: 'Reviews' })
      .closest('section')
      .within(() => {
        cy.findByRole('link', { name: /sign in/i }).should(
          'have.attr',
          'href',
          `/login?next=/plants/${PLANT_ID}`,
        );
        cy.findByText(/to write a review/i);
      });
  });

  it('PR03-02: Write a review form is not shown when signed out', { tags: '@ui' }, () => {
    stubPlantPageSignedOut();
    cy.visit(`/plants/${PLANT_ID}`);
    cy.wait('@plant');
    cy.wait('@reviews');

    cy.findByRole('heading', { name: 'Write a review' }).should('not.exist');
    cy.findByRole('button', { name: 'Post review' }).should('not.exist');
  });

  it('PR03-03: Sign-in link is named and keyboard-reachable', { tags: '@ui' }, () => {
    stubPlantPageSignedOut();
    cy.visit(`/plants/${PLANT_ID}`);
    cy.wait('@plant');
    cy.wait('@reviews');

    cy.findByRole('heading', { name: 'Reviews' })
      .closest('section')
      .within(() => {
        cy.findByRole('link', { name: /sign in/i }).focus();
        cy.findByRole('link', { name: /sign in/i }).should('be.focused');
      });
  });
});
