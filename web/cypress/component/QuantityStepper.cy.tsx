import { QuantityStepper } from '../../src/components/QuantityStepper';

describe('QuantityStepper', () => {
  it('+ and − call onChange with the new value', { tags: '@component' }, () => {
    const onChange = cy.spy().as('onChange');
    cy.mount(<QuantityStepper value={2} max={5} onChange={onChange} />);

    cy.findByRole('button', { name: 'Increase quantity' }).click();
    cy.get('@onChange').should('have.been.calledWith', 3);

    cy.findByRole('button', { name: 'Decrease quantity' }).click();
    cy.get('@onChange').should('have.been.calledWith', 1);
  });

  it('− is disabled at the minimum', { tags: '@component' }, () => {
    cy.mount(<QuantityStepper value={1} max={5} onChange={cy.spy()} />);
    cy.findByRole('button', { name: 'Decrease quantity' }).then(($btn) =>
      expect($btn, 'Decrease quantity at minimum').to.be.disabled,
    );
  });

  it('+ is disabled at the stock limit', { tags: '@component' }, () => {
    cy.mount(<QuantityStepper value={3} max={3} onChange={cy.spy()} />);
    cy.findByRole('button', { name: 'Increase quantity' }).then(($btn) =>
      expect($btn, 'Increase quantity at stock limit').to.be.disabled,
    );
  });
});
