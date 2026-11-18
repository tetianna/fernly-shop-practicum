import { PromoCodeInput } from '../../src/components/PromoCodeInput';

describe('PromoCodeInput', () => {
  it('PI-01: typing LEAFY10 and Apply calls onApply with the trimmed code', { tags: '@component' }, () => {
    const onApply = cy.spy().as('onApply');
    cy.mount(
      <PromoCodeInput appliedCode={null} onApply={onApply} onRemove={cy.spy()} />,
    );

    cy.findByRole('textbox').type('  LEAFY10  ');
    cy.findByRole('button', { name: 'Apply' }).click();
    cy.get('@onApply').should('have.been.calledOnceWith', 'LEAFY10');
  });

  it('PI-02: applied code shows Remove and clicking it calls onRemove', { tags: '@component' }, () => {
    const onRemove = cy.spy().as('onRemove');
    cy.mount(
      <PromoCodeInput appliedCode="LEAFY10" onApply={cy.spy()} onRemove={onRemove} />,
    );

    cy.findByText((_content, element) => {
      if (!element || element.tagName.toLowerCase() !== 'span') return false;
      return /Code\s+LEAFY10\s+applied/.test(element.textContent ?? '');
    }).should('be.visible');
    cy.findByRole('button', { name: 'Remove' }).click();
    cy.get('@onRemove').should('have.been.calledOnce');
  });

  it('PI-03: Apply is disabled for empty or whitespace-only input and does not call onApply', { tags: '@component' }, () => {
    const onApply = cy.spy().as('onApply');
    cy.mount(
      <PromoCodeInput appliedCode={null} onApply={onApply} onRemove={cy.spy()} />,
    );

    cy.findByRole('button', { name: 'Apply' }).then(($btn) =>
      expect($btn, 'Apply with empty input').to.be.disabled,
    );

    cy.findByRole('textbox').type('   ');
    cy.findByRole('button', { name: 'Apply' }).then(($btn) =>
      expect($btn, 'Apply with whitespace-only input').to.be.disabled,
    );
    cy.findByRole('textbox').type('{enter}');
    cy.get('@onApply').should('not.have.been.called');
  });

  it('PI-04: refused-code error message is visible', { tags: '@component' }, () => {
    cy.mount(
      <PromoCodeInput
        appliedCode={null}
        onApply={cy.spy()}
        onRemove={cy.spy()}
        error="We don't recognize this code."
      />,
    );

    cy.findByText("We don't recognize this code.").should('be.visible');
  });

  it('PI-05: busy disables Apply and Remove', { tags: '@component' }, () => {
    cy.mount(
      <PromoCodeInput appliedCode={null} onApply={cy.spy()} onRemove={cy.spy()} busy />,
    );
    cy.findByRole('textbox').type('LEAFY10');
    cy.findByRole('button', { name: 'Apply' }).then(($btn) =>
      expect($btn, 'Apply while busy').to.be.disabled,
    );

    cy.mount(
      <PromoCodeInput appliedCode="LEAFY10" onApply={cy.spy()} onRemove={cy.spy()} busy />,
    );
    cy.findByRole('button', { name: 'Remove' }).then(($btn) =>
      expect($btn, 'Remove while busy').to.be.disabled,
    );
  });

  it('PI-06: code field has an accessible name and refused errors are announced', { tags: '@component' }, () => {
    cy.mount(
      <PromoCodeInput
        appliedCode={null}
        onApply={cy.spy()}
        onRemove={cy.spy()}
        error="We don't recognize this code."
      />,
    );

    cy.findByRole('textbox', { name: /promo code/i }).should('exist');

    cy.findByText("We don't recognize this code.").then(($el) => {
      const node = $el[0];
      const role = node.getAttribute('role');
      const live = node.getAttribute('aria-live');
      const announced =
        role === 'alert' ||
        live === 'polite' ||
        live === 'assertive' ||
        Boolean(node.closest('[role="alert"], [aria-live="polite"], [aria-live="assertive"]'));
      expect(announced, 'refused error announced via role=alert or aria-live').to.eq(true);
    });
  });
});
