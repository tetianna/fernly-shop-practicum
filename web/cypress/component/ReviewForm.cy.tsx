import { ReviewForm } from '../../src/components/ReviewForm';

const longEnough = 'This plant is doing wonderfully on my shelf.';

describe('ReviewForm', () => {
  it('RF-01: valid submit calls onSubmit and clears the form', { tags: '@component' }, () => {
    const onSubmit = cy.spy().as('onSubmit');
    cy.mount(<ReviewForm onSubmit={onSubmit} />);

    cy.findByRole('radio', { name: '4 stars' }).click();
    cy.findByLabelText('Your review').type(longEnough);
    cy.findByRole('button', { name: 'Post review' }).click();

    cy.get('@onSubmit').should('have.been.calledOnce');
    cy.get('@onSubmit').should('have.been.calledWith', { rating: 4, text: longEnough });
    cy.findByLabelText('Your review').should('have.value', '');
    cy.findByRole('radio', { name: '4 stars' }).then(($star) => {
      expect(getComputedStyle($star[0]).color, '4 stars cleared after submit').to.eq('rgb(201, 211, 198)');
    });
  });

  it('RF-02: missing rating shows alert and does not submit', { tags: '@component' }, () => {
    const onSubmit = cy.spy().as('onSubmit');
    cy.mount(<ReviewForm onSubmit={onSubmit} />);

    cy.findByLabelText('Your review').type(longEnough);
    cy.findByRole('button', { name: 'Post review' }).click();

    cy.findByRole('alert').should('have.text', 'Choose a rating from 1 to 5 stars.');
    cy.get('@onSubmit').should('not.have.been.called');
  });

  it('RF-03: short text shows alert and does not submit', { tags: '@component' }, () => {
    const onSubmit = cy.spy().as('onSubmit');
    cy.mount(<ReviewForm onSubmit={onSubmit} />);

    cy.findByRole('radio', { name: '3 stars' }).click();
    cy.findByLabelText('Your review').type('   too short   ');
    cy.findByRole('button', { name: 'Post review' }).click();

    cy.findByRole('alert').should('have.text', 'Write at least 10 characters.');
    cy.get('@onSubmit').should('not.have.been.called');
  });

  it('RF-04: busy disables submit and shows Posting…', { tags: '@component' }, () => {
    cy.mount(<ReviewForm onSubmit={cy.spy()} busy />);

    cy.findByRole('button', { name: 'Posting…' }).then(($btn) =>
      expect($btn, 'Posting… while busy').to.be.disabled,
    );
  });

  it('RF-05: error prop is shown in an alert', { tags: '@component' }, () => {
    cy.mount(<ReviewForm onSubmit={cy.spy()} error="Server said no" />);

    cy.findByRole('alert').should('have.text', 'Server said no');
  });

  it('RF-06: textarea is labelled Your review', { tags: '@component' }, () => {
    cy.mount(<ReviewForm onSubmit={cy.spy()} />);

    cy.findByLabelText('Your review');
  });
});
