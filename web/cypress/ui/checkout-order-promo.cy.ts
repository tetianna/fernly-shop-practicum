const TOKEN = 'fixture-token';

function stubSignedInUser() {
  cy.intercept('GET', '**/api/auth/me', { fixture: 'user-me.json' }).as('authMe');
}

/** Auth resolves before cart query runs (useCart is enabled only when user is set). */
function visitAsSignedIn(path: string, waitAliases: string[]) {
  cy.visit(path, {
    onBeforeLoad(win) {
      win.localStorage.setItem('fernly_token', TOKEN);
    },
  });
  cy.wait('@authMe');
  for (const alias of waitAliases) {
    cy.wait(`@${alias}`);
  }
}

describe('Checkout & order promo /', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
  });

  it('CO-01: checkout order summary shows discount line and total with promo', { tags: '@ui' }, () => {
    stubSignedInUser();
    cy.intercept('GET', '**/api/cart', { fixture: 'checkout-cart-promo-positive.json' }).as('cart');
    visitAsSignedIn('/checkout', ['cart']);

    cy.findByRole('heading', { level: 1, name: 'Checkout' });
    cy.findByRole('region', { name: /order summary/i }).within(() => {
      cy.findByText('Discount (LEAFY10)', { exact: true });
      // PRODUCT.md two decimals; formatPrice may truncate (BUG-003).
      cy.findByText('−$4.00', { exact: true });
      cy.findByText(/^Total$/i);
      cy.findByText('$42.95', { exact: true });
    });
  });

  it('CO-02: order detail Paid summary shows discount and promo code', { tags: '@ui' }, () => {
    stubSignedInUser();
    // Layout badge also fetches cart while viewing an order.
    cy.intercept('GET', '**/api/cart', { fixture: 'checkout-cart-no-discount.json' }).as('cart');
    cy.intercept('GET', '**/api/orders/ord-promo-1', { fixture: 'order-promo-positive.json' }).as('order');
    visitAsSignedIn('/orders/ord-promo-1', ['cart', 'order']);

    cy.findByRole('heading', { level: 1, name: 'Order ord-promo-1' });
    cy.findByRole('region', { name: /^Paid$/i }).within(() => {
      cy.findByRole('heading', { level: 2, name: 'Paid' });
      cy.findByText('Discount (LEAFY10)', { exact: true });
      // PRODUCT.md two decimals; formatPrice may truncate (BUG-003).
      cy.findByText('−$4.00', { exact: true });
      cy.findByText('$42.95', { exact: true });
    });
  });

  it('CO-03: no discount row on checkout or order when discount is zero or omitted', { tags: '@ui' }, () => {
    stubSignedInUser();
    cy.intercept('GET', '**/api/cart', { fixture: 'checkout-cart-no-discount.json' }).as('cart');
    visitAsSignedIn('/checkout', ['cart']);

    cy.findByRole('region', { name: /order summary/i }).within(() => {
      cy.findByText(/^Discount/).should('not.exist');
    });

    cy.intercept('GET', '**/api/orders/ord-nodisc-1', { fixture: 'order-no-discount.json' }).as('order');
    visitAsSignedIn('/orders/ord-nodisc-1', ['cart', 'order']);

    cy.findByRole('region', { name: /^Paid$/i }).within(() => {
      cy.findByText(/^Discount/).should('not.exist');
    });
  });
});
