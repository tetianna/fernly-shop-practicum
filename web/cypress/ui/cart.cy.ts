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

describe('Cart /', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
  });

  it('CP-01: shows a one-line cart, paid shipping, totals, and checkout', { tags: '@ui' }, () => {
    stubSignedInUser();
    stubCartFromFixture('cart', 'cart-one-line-paid-shipping.json');
    visitCartAsSignedIn();

    cy.findByRole('heading', { level: 1, name: 'Your cart' });
    cy.get('ul').within(() => {
      cy.findAllByRole('listitem').should('have.length', 1);
      cy.findByText('Snake Plant');
      cy.findByText(/Size\s+S/i);
    });
    cy.findByRole('region', { name: /order summary/i }).within(() => {
      cy.findByText(/Subtotal \(1 item\)/);
      // `dl` > `div` > `dt` may not map to role "term" in all engines; label is still visible text.
      cy.findByText(/^Shipping$/i);
      cy.findByText('$6.95');
    });
    cy.findByRole('link', { name: /go to checkout/i });
  });

  it('CP-02: shows multiple lines and Subtotal with total item count', { tags: '@ui' }, () => {
    stubSignedInUser();
    stubCartFromFixture('cart', 'cart-two-lines.json');
    visitCartAsSignedIn();

    cy.get('ul').within(() => {
      cy.findAllByRole('listitem').should('have.length', 2);
    });
    cy.findByRole('region', { name: /order summary/i }).within(() => {
      cy.findByText(/Subtotal \(3 items\)/);
    });
  });

  it('CP-03: shows free shipping at $50 subtotal with no hint', { tags: '@ui' }, () => {
    stubSignedInUser();
    stubCartFromFixture('cart', 'cart-subtotal-50-free-shipping.json');
    visitCartAsSignedIn();

    cy.findByRole('region', { name: /order summary/i }).within(() => {
      cy.findByText('Free');
      cy.findByText(/Add .* more for free shipping/i).should('not.exist');
    });
  });

  it('CP-04: shows add-more hint one cent below free shipping', { tags: '@ui' }, () => {
    stubSignedInUser();
    stubCartFromFixture('cart', 'cart-subtotal-49-99.json');
    visitCartAsSignedIn();

    cy.findByRole('region', { name: /order summary/i }).within(() => {
      cy.findByText(/Add\s+\$0\.01\s+more for free shipping/i);
    });
  });

  it('CP-05: shows empty cart with browse link and no checkout', { tags: '@ui' }, () => {
    stubSignedInUser();
    stubCartFromFixture('cart', 'cart-empty.json');
    visitCartAsSignedIn();

    cy.findByRole('heading', { name: 'Your cart is empty' });
    cy.findByText('Plants you add will show up here.');
    cy.findByRole('link', { name: 'Browse plants' }).should('have.attr', 'href', '/');
    cy.findByRole('link', { name: /go to checkout/i }).should('not.exist');
  });

  it('CP-06: shows cart load error and retries', { tags: '@ui' }, () => {
    stubSignedInUser();
    cy.intercept('GET', '**/api/cart', { statusCode: 500, body: { detail: 'Internal server error' } }).as('cartFail');
    visitCartAsSignedIn('cartFail');

    cy.findByRole('alert').within(() => {
      cy.findByText("Your cart couldn't be loaded.");
      cy.findByRole('button', { name: 'Try again' });
    });

    cy.intercept('GET', '**/api/cart', { fixture: 'cart-one-line-paid-shipping.json' }).as('cartOk');
    cy.findByRole('button', { name: 'Try again' }).click();
    cy.wait('@cartOk');
    cy.findByRole('heading', { level: 1, name: 'Your cart' });
  });

  it('CP-07: redirects signed-out visitors to login with next=/cart', { tags: '@ui' }, () => {
    cy.visit('/cart');
    cy.location('pathname').should('eq', '/login');
    cy.location('search').should('include', 'next=');
    cy.location('search').should('match', /next=%2Fcart|next=\/cart/);
  });

  it('CP-08: keeps a very long plant name inside its line', { tags: '@ui' }, () => {
    const longName =
      'Supercalifragilisticexpialidocious Monstera Deliciosa Windowsill Companion Extraordinaire';
    stubSignedInUser();
    stubCartFromFixture('cart', 'cart-long-name.json');
    visitCartAsSignedIn();

    cy.get('ul').within(() => {
      cy.findByRole('listitem').within(() => {
        cy.findByText(longName).then(($name) => {
          const item = $name.closest('li')[0];
          const nameEl = $name[0];
          const itemRect = item.getBoundingClientRect();
          const nameRect = nameEl.getBoundingClientRect();
          expect(nameRect.left, 'name left inside line').to.be.at.least(itemRect.left - 1);
          expect(nameRect.right, 'name right inside line').to.be.at.most(itemRect.right + 1);
          expect(nameRect.bottom, 'name bottom inside line').to.be.at.most(itemRect.bottom + 1);
        });
      });
    });
  });

  it('CP-09: PATCH increases quantity and refreshes totals', { tags: '@ui' }, () => {
    stubSignedInUser();
    stubCartFromFixture('cart', 'cart-one-line-qty-2.json');
    visitCartAsSignedIn();

    cy.intercept('PATCH', '**/api/cart/lines/*', { fixture: 'cart-one-line-qty-3-after-patch.json' }).as('patchQty');

    cy.findByRole('button', { name: 'Increase quantity' }).click();
    cy.wait('@patchQty').its('request.body').should('deep.equal', { quantity: 3 });

    cy.findByRole('group', { name: /Quantity of Snake Plant/i }).within(() => {
      cy.findByRole('status').should('contain.text', '3');
    });
  });

  it('CP-10: shows error toast when PATCH fails', { tags: '@ui' }, () => {
    stubSignedInUser();
    stubCartFromFixture('cart', 'cart-one-line-qty-2.json');
    visitCartAsSignedIn();

    cy.intercept('PATCH', '**/api/cart/lines/*', {
      statusCode: 500,
      body: { detail: 'Could not update line.' },
    }).as('patchFail');

    cy.findByRole('button', { name: 'Decrease quantity' }).click();
    cy.wait('@patchFail');

    // Toast and live regions can both use role="status"; assert the server error message in the toast copy.
    cy.findByText(/Could not update line/i);
    cy.findByRole('group', { name: /Quantity of Snake Plant/i }).within(() => {
      cy.findByRole('status').should('contain.text', '2');
    });
  });

  it('CP-11: DELETE removes line and shows empty state', { tags: '@ui' }, () => {
    stubSignedInUser();
    stubCartFromFixture('cart', 'cart-one-line-paid-shipping.json');
    visitCartAsSignedIn();

    cy.intercept('DELETE', '**/api/cart/lines/*', { fixture: 'cart-empty.json' }).as('deleteLine');

    cy.findByRole('button', { name: 'Remove Snake Plant' }).click();
    cy.wait('@deleteLine');

    cy.findByRole('heading', { name: 'Your cart is empty' });
    cy.findByRole('link', { name: 'Browse plants' });
  });

  it('CP-12: + disabled at stock max, − still enabled', { tags: ['@ui', '@known-bug'] }, () => {
    stubSignedInUser();
    stubCartFromFixture('cart', 'cart-at-stock-max.json');
    visitCartAsSignedIn();

    cy.findByRole('button', { name: 'Increase quantity' }).then(($btn) =>
      expect($btn, 'Increase at stock limit').to.be.disabled,
    );
    cy.findByRole('button', { name: 'Decrease quantity' }).then(($btn) =>
      expect($btn, 'Decrease at stock limit').not.to.be.disabled,
    );
  });

  it('CP-13: quantity group and remove name include plant name', { tags: '@ui' }, () => {
    stubSignedInUser();
    stubCartFromFixture('cart', 'cart-one-line-paid-shipping.json');
    visitCartAsSignedIn();

    cy.findByRole('group', { name: 'Quantity of Snake Plant' });
    cy.findByRole('button', { name: 'Remove Snake Plant' });
  });

  it('CP-14: order summary region and checkout link', { tags: '@ui' }, () => {
    stubSignedInUser();
    stubCartFromFixture('cart', 'cart-one-line-paid-shipping.json');
    visitCartAsSignedIn();

    cy.findByRole('region', { name: /order summary/i }).within(() => {
      cy.findByRole('heading', { level: 2, name: 'Order summary' });
    });
    cy.findByRole('link', { name: /go to checkout/i });
  });
});
