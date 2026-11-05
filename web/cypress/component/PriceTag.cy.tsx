import { PriceTag } from '../../src/components/PriceTag';

function assertPriceFontSizeRem(expectedRem: number) {
  cy.findByText(/\$\d/, { exact: true }).then(($el) => {
    const el = $el[0];
    const fontPx = parseFloat(window.getComputedStyle(el).fontSize);
    const rootPx = parseFloat(window.getComputedStyle(document.documentElement).fontSize);
    expect(fontPx / rootPx, `${expectedRem}rem size styling`).to.be.closeTo(expectedRem, 0.02);
  });
}

describe('PriceTag', () => {
  it('PT-01: shows a typical catalog price with two decimals', { tags: '@component' }, () => {
    cy.mount(<PriceTag amount={24.5} />);
    cy.findByText('$24.50', { exact: true }).should('be.visible');
  });

  it('PT-02: formats one decimal place in the input as two decimals', { tags: '@component' }, () => {
    cy.mount(<PriceTag amount={12.5} />);
    cy.findByText('$12.50', { exact: true }).should('be.visible');
    cy.findByText('$12.5', { exact: true }).should('not.exist');
  });

  it('PT-03: formats whole dollars with two decimals', { tags: '@component' }, () => {
    cy.mount(<PriceTag amount={22} />);
    cy.findByText('$22.00', { exact: true }).should('be.visible');
  });

  it('PT-04: formats sub-dollar amounts with two decimals', { tags: '@component' }, () => {
    cy.mount(<PriceTag amount={0.99} />);
    cy.findByText('$0.99', { exact: true }).should('be.visible');
  });

  it('PT-05: formats zero as $0.00', { tags: '@component' }, () => {
    cy.mount(<PriceTag amount={0} />);
    cy.findByText('$0.00', { exact: true }).should('be.visible');
  });

  it('PT-06: formats a large amount with two decimals', { tags: '@component' }, () => {
    cy.mount(<PriceTag amount={9999.99} />);
    cy.findByText('$9999.99', { exact: true }).should('be.visible');
  });

  it('PT-07: uses small size styling for size sm', { tags: '@component' }, () => {
    cy.mount(<PriceTag amount={9.99} size="sm" />);
    cy.findByText('$9.99', { exact: true }).should('be.visible');
    assertPriceFontSizeRem(0.9);
  });

  it('PT-08: uses default medium size styling', { tags: '@component' }, () => {
    cy.mount(<PriceTag amount={9.99} size="md" />);
    cy.findByText('$9.99', { exact: true }).should('be.visible');
    assertPriceFontSizeRem(1.05);
  });

  it('PT-09: uses large size styling for size lg', { tags: '@component' }, () => {
    cy.mount(<PriceTag amount={9.99} size="lg" />);
    cy.findByText('$9.99', { exact: true }).should('be.visible');
    assertPriceFontSizeRem(1.6);
  });

  it('PT-10: exposes a visually hidden context label for screen readers', { tags: '@component' }, () => {
    cy.mount(<PriceTag amount={16.94} label="Subtotal" />);
    cy.findByText(/Subtotal:/, { hidden: true });
    cy.findByText('$16.94', { exact: true }).should('be.visible');
  });

  it('PT-11: omits a hidden label when label is not provided', { tags: '@component' }, () => {
    cy.mount(<PriceTag amount={16.94} />);
    cy.get('.visually-hidden').should('not.exist');
    cy.findByText('$16.94', { exact: true }).should('be.visible');
  });

  it('PT-12: displays API-style two-decimal amounts correctly', { tags: '@component' }, () => {
    cy.mount(<PriceTag amount={12.5} />); // 12.50 in API-style data
    cy.findByText('$12.50', { exact: true }).should('be.visible');
  });
});
