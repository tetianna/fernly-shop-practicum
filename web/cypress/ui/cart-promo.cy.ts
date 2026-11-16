const TOKEN = 'fixture-token';

function stubSignedInUser() {
  cy.intercept('GET', '**/api/auth/me', { fixture: 'user-me.json' }).as('authMe');
}

/** Auth resolves before cart query runs (useCart is enabled only when user is set). */
function visitCartAsSignedIn(cartAlias = 'cart') {
  cy.visit('/cart', {
    onBeforeLoad(win) {
      win.localStorage.setItem('fernly_token', TOKEN);
    },
  });
  cy.wait('@authMe');
  cy.wait(`@${cartAlias}`);
}

function stubCartFromFixture(alias: string, fixture: string) {
  cy.intercept('GET', '**/api/cart', { fixture }).as(alias);
}

describe('Cart / promo code', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
  });

  it('CPR-01: shows promo code field and Apply under order summary', { tags: '@ui' }, () => {
    stubSignedInUser();
    stubCartFromFixture('cart', 'cart-promo-no-code.json');
    visitCartAsSignedIn();

    cy.findByRole('region', { name: /order summary/i });
    cy.findByText('Have a promo code?');
    cy.findByRole('textbox');
    cy.findByRole('button', { name: 'Apply' });
  });

  it('CPR-02: Apply updates summary with Discount (LEAFY10) and mock total', { tags: '@ui' }, () => {
    stubSignedInUser();
    stubCartFromFixture('cart', 'cart-promo-no-code.json');
    visitCartAsSignedIn();

    cy.intercept('POST', '**/api/cart/promo', { fixture: 'cart-promo-leafy10.json' }).as('applyPromo');

    cy.findByRole('textbox').type('LEAFY10');
    cy.findByRole('button', { name: 'Apply' }).click();
    cy.wait('@applyPromo').its('request.body').should('deep.equal', { code: 'LEAFY10' });

    cy.findByRole('region', { name: /order summary/i }).within(() => {
      cy.findByText('Discount (LEAFY10)');
      cy.findByText('−$0.99');
      cy.findByText(/^Total$/i);
      cy.findByText('$15.95');
    });
  });

  it('CPR-03: Remove clears discount line and restores promo input', { tags: '@ui' }, () => {
    stubSignedInUser();
    stubCartFromFixture('cart', 'cart-promo-leafy10.json');
    visitCartAsSignedIn();

    cy.findByRole('region', { name: /order summary/i }).within(() => {
      cy.findByText('Discount (LEAFY10)');
    });
    // Copy is split across nodes: "Code <strong>LEAFY10</strong> applied"
    cy.findByText((_content, el) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim() === 'Code LEAFY10 applied');
    cy.findByRole('button', { name: 'Remove' });

    cy.intercept('DELETE', '**/api/cart/promo', { fixture: 'cart-promo-no-code.json' }).as('removePromo');

    cy.findByRole('button', { name: 'Remove' }).click();
    cy.wait('@removePromo');

    cy.findByRole('region', { name: /order summary/i }).within(() => {
      cy.findByText(/^Discount/).should('not.exist');
      cy.findByText('$16.94');
    });
    cy.findByText('Have a promo code?');
    cy.findByRole('textbox');
    cy.findByRole('button', { name: 'Apply' });
  });

  it('CPR-04: shows error when Apply returns 400 with detail', { tags: '@ui' }, () => {
    stubSignedInUser();
    stubCartFromFixture('cart', 'cart-promo-no-code.json');
    visitCartAsSignedIn();

    cy.intercept('POST', '**/api/cart/promo', {
      statusCode: 400,
      fixture: 'cart-promo-invalid-error.json',
    }).as('applyFail');

    cy.findByRole('textbox').type('NOPE');
    cy.findByRole('button', { name: 'Apply' }).click();
    cy.wait('@applyFail');

    cy.findByText("We don't recognize this code.");
  });

  it('CPR-05: Apply is disabled while the promo request is pending', { tags: '@ui' }, () => {
    stubSignedInUser();
    stubCartFromFixture('cart', 'cart-promo-no-code.json');
    visitCartAsSignedIn();

    cy.intercept('POST', '**/api/cart/promo', {
      delay: 1500,
      fixture: 'cart-promo-leafy10.json',
    }).as('applyPromoSlow');

    cy.findByRole('textbox').type('LEAFY10');
    cy.findByRole('button', { name: 'Apply' }).click();

    cy.findByRole('button', { name: 'Apply' }).then(($btn) =>
      expect($btn, 'Apply while promo request pending').to.be.disabled,
    );

    cy.wait('@applyPromoSlow');
  });
});
