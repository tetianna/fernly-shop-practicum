import { OrderSummary } from '../../src/components/OrderSummary';

const typicalWithDiscount = {
  itemCount: 2,
  subtotal: 40,
  shipping: 5.99,
  total: 41.99,
  discount: 4,
  promoCode: 'LEAFY10',
} as const;

describe('OrderSummary', () => {
  it('OS-01: shows Discount (LEAFY10) with −$4.00', { tags: '@component' }, () => {
    cy.mount(<OrderSummary {...typicalWithDiscount} />);

    cy.findByText('Discount (LEAFY10)', { exact: true }).should('be.visible');
    cy.findByText('−$4.00', { exact: true }).should('be.visible');
  });

  it('OS-02: hides the discount row when discount is omitted or zero', { tags: '@component' }, () => {
    cy.mount(
      <OrderSummary itemCount={2} subtotal={40} shipping={5.99} total={45.99} />,
    );

    cy.findByText(/^Discount/).should('not.exist');

    cy.mount(
      <OrderSummary
        itemCount={2}
        subtotal={40}
        shipping={5.99}
        total={45.99}
        discount={0}
        promoCode="LEAFY10"
      />,
    );

    cy.findByText(/^Discount/).should('not.exist');
  });

  it('OS-03: shows Discount without a code when promoCode is null', { tags: '@component' }, () => {
    cy.mount(
      <OrderSummary
        itemCount={2}
        subtotal={40}
        shipping={5.99}
        total={41.99}
        discount={4}
        promoCode={null}
      />,
    );

    cy.findByText('Discount', { exact: true }).should('be.visible');
    cy.findByText(/Discount \(/).should('not.exist');
    cy.findByText('−$4.00', { exact: true }).should('be.visible');
  });

  it('OS-04: names the summary via heading and exposes readable money amounts', { tags: '@component' }, () => {
    cy.mount(<OrderSummary {...typicalWithDiscount} />);

    cy.findByRole('heading', { name: 'Order summary' }).should('be.visible');
    cy.findByRole('region', { name: 'Order summary' }).should('be.visible');

    cy.findByText('Discount (LEAFY10)', { exact: true }).should('be.visible');
    cy.findByText('−$4.00', { exact: true }).should('be.visible');
    cy.findByText('$40.00', { exact: true }).should('be.visible');
    cy.findByText('$5.99', { exact: true }).should('be.visible');
    cy.findByText('$41.99', { exact: true }).should('be.visible');
  });
});
