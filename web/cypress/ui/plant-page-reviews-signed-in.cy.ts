const TOKEN = 'fixture-token';
const PLANT_ID = 'pl-fixture-reviews';
const NEW_REVIEW_TEXT = 'Posted from the Cypress plant page review form.';

function stubSignedInUser() {
  cy.intercept('GET', '**/api/auth/me', { fixture: 'user-me.json' }).as('authMe');
  cy.intercept('GET', '**/api/cart', { fixture: 'cart-empty.json' }).as('cart');
}

function stubPlantAndCatalog() {
  cy.intercept('GET', `**/api/plants/${PLANT_ID}`, { fixture: 'plant-detail-reviews.json' }).as('plant');
  cy.intercept('GET', '**/api/plants?pageSize=48', { fixture: 'plants-browse-positive.json' }).as('allPlants');
}

function visitPlantSignedIn(waitAliases: string[] = ['plant', 'reviews']) {
  cy.visit(`/plants/${PLANT_ID}`, {
    onBeforeLoad(win) {
      win.localStorage.setItem('fernly_token', TOKEN);
    },
  });
  cy.wait('@authMe');
  for (const alias of waitAliases) {
    cy.wait(`@${alias}`);
  }
}

describe('Plant page Reviews (signed in)', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
  });

  it('PR10-01: shows Reviews heading, average/count, and review copy', { tags: '@ui' }, () => {
    stubSignedInUser();
    stubPlantAndCatalog();
    cy.intercept('GET', `**/api/plants/${PLANT_ID}/reviews`, { fixture: 'plant-reviews-list.json' }).as('reviews');
    visitPlantSignedIn();

    cy.findByRole('heading', { name: 'Reviews' });
    cy.findByText('4.7 out of 5 · 2 reviews');
    cy.findByText('Ava Tester');
    cy.findByText('Thriving on my windowsill after two weeks.');
    cy.findByText('Sam Green');
    cy.findByText('Easy care and still looking lush.');
  });

  it('PR10-02: successful POST shows toast and new review in the list', { tags: '@ui' }, () => {
    stubSignedInUser();
    stubPlantAndCatalog();
    cy.intercept('GET', `**/api/plants/${PLANT_ID}/reviews`, { fixture: 'plant-reviews-list.json' }).as('reviews');
    visitPlantSignedIn();

    cy.intercept('POST', `**/api/plants/${PLANT_ID}/reviews`, { fixture: 'plant-review-created.json' }).as('postReview');
    cy.intercept('GET', `**/api/plants/${PLANT_ID}/reviews`, { fixture: 'plant-reviews-after-post.json' }).as(
      'reviewsAfterPost',
    );

    cy.findByRole('radio', { name: '5 stars' }).click();
    cy.findByLabelText('Your review').type(NEW_REVIEW_TEXT);
    cy.findByRole('button', { name: 'Post review' }).click();

    cy.wait('@postReview').its('request.body').should('deep.equal', { rating: 5, text: NEW_REVIEW_TEXT });
    cy.findByText('Thanks for your review!');
    // Product: review appears in the list right away (slot should refetch reviews after POST).
    cy.wait('@reviewsAfterPost');
    cy.findByText(NEW_REVIEW_TEXT);
  });

  it('PR10-03: reviews load failure shows error and Try again', { tags: '@ui' }, () => {
    stubSignedInUser();
    stubPlantAndCatalog();
    cy.intercept('GET', `**/api/plants/${PLANT_ID}/reviews`, {
      statusCode: 500,
      body: { detail: 'Internal server error' },
    }).as('reviewsFail');
    visitPlantSignedIn(['plant', 'reviewsFail']);

    cy.findByRole('alert').within(() => {
      cy.findByText("Reviews couldn't be loaded.");
      cy.findByRole('button', { name: 'Try again' });
    });
  });

  it('PR10-04: POST error detail appears in the form alert', { tags: '@ui' }, () => {
    stubSignedInUser();
    stubPlantAndCatalog();
    cy.intercept('GET', `**/api/plants/${PLANT_ID}/reviews`, { fixture: 'plant-reviews-list.json' }).as('reviews');
    visitPlantSignedIn();

    cy.intercept('POST', `**/api/plants/${PLANT_ID}/reviews`, {
      statusCode: 400,
      body: { detail: 'You already reviewed this plant.' },
    }).as('postFail');

    cy.findByRole('radio', { name: '4 stars' }).click();
    cy.findByLabelText('Your review').type(NEW_REVIEW_TEXT);
    cy.findByRole('button', { name: 'Post review' }).click();
    cy.wait('@postFail');

    cy.findByRole('alert').should('contain.text', 'You already reviewed this plant.');
  });

  it('PR10-05: shows Loading reviews… before the list arrives', { tags: '@ui' }, () => {
    stubSignedInUser();
    stubPlantAndCatalog();
    cy.intercept('GET', `**/api/plants/${PLANT_ID}/reviews`, {
      delay: 800,
      fixture: 'plant-reviews-list.json',
    }).as('reviewsSlow');

    cy.visit(`/plants/${PLANT_ID}`, {
      onBeforeLoad(win) {
        win.localStorage.setItem('fernly_token', TOKEN);
      },
    });
    cy.wait('@authMe');
    cy.wait('@plant');

    cy.findByText('Loading reviews…');
    cy.wait('@reviewsSlow');
    cy.findByText('4.7 out of 5 · 2 reviews');
  });

  it('PR10-06: empty reviews show invite copy and Write a review form', { tags: '@ui' }, () => {
    stubSignedInUser();
    stubPlantAndCatalog();
    cy.intercept('GET', `**/api/plants/${PLANT_ID}/reviews`, { fixture: 'plant-reviews-empty.json' }).as('reviews');
    visitPlantSignedIn();

    cy.findByText("No reviews yet. Be the first to share how it's growing.");
    cy.findByRole('heading', { name: 'Write a review' });
    cy.findByRole('button', { name: 'Post review' });
  });
});
