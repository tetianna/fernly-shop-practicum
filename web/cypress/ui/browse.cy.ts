describe('Browse /', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
  });

  it('shows two plant cards and a heading count from a positive catalog', { tags: '@ui' }, () => {
    cy.intercept('GET', '/api/plants?*', { fixture: 'plants-browse-positive.json' }).as('plants');
    cy.visit('/');
    cy.wait('@plants');

    cy.findByRole('heading', { level: 2, name: '2 plants' });
    cy.findAllByRole('article').should('have.length', 2);
  });

  it('shows the empty state when the catalog has no plants', { tags: '@ui' }, () => {
    cy.intercept('GET', '/api/plants?*', { fixture: 'plants-browse-empty.json' }).as('plants');
    cy.visit('/');
    cy.wait('@plants');

    cy.findByRole('heading', { name: 'No plants match your filters' });
    cy.findByText('Try another search or clear a filter.');
  });

  it('keeps a very long plant name inside its card', { tags: '@ui' }, () => {
    const longName =
      'Supercalifragilisticexpialidocious Monstera Deliciosa Windowsill Companion Extraordinaire';

    cy.intercept('GET', '/api/plants?*', { fixture: 'plants-browse-long-name.json' }).as('plants');
    cy.visit('/');
    cy.wait('@plants');

    cy.findByRole('article').within(() => {
      cy.findByRole('heading', { level: 3, name: longName }).then(($heading) => {
        const card = $heading.closest('article')[0];
        const headingEl = $heading[0];
        const cardRect = card.getBoundingClientRect();
        const nameRect = headingEl.getBoundingClientRect();
        expect(nameRect.left, 'name left inside card').to.be.at.least(cardRect.left - 1);
        expect(nameRect.right, 'name right inside card').to.be.at.most(cardRect.right + 1);
        expect(nameRect.bottom, 'name bottom inside card').to.be.at.most(cardRect.bottom + 1);
      });
    });
  });

  it('shows a zero price as $0.00 on the card', { tags: '@ui' }, () => {
    cy.intercept('GET', '/api/plants?*', { fixture: 'plants-browse-price-zero.json' }).as('plants');
    cy.visit('/');
    cy.wait('@plants');

    cy.findByRole('article').within(() => {
      cy.findByText('$0.00');
    });
  });

  it('shows an error alert and Try again when the catalog request fails', { tags: '@ui' }, () => {
    cy.intercept('GET', '/api/plants?*', {
      statusCode: 500,
      body: { detail: 'Internal server error' },
    }).as('plants');
    cy.visit('/');
    cy.wait('@plants');

    cy.findByRole('alert').then(($alert) => {
      expect($alert.text(), 'catalog load failure message').to.match(/catalog|loaded|plants/i);
    });
    cy.findByRole('button', { name: 'Try again' });
  });
});
