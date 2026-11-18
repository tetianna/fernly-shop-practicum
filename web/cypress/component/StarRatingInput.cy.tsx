import { useState } from 'react';
import { StarRatingInput } from '../../src/components/StarRatingInput';

const FILLED = 'rgb(211, 155, 28)';
const EMPTY = 'rgb(201, 211, 198)';

function ControlledStarRating({
  initial = 0,
  onChange,
}: {
  initial?: number;
  onChange?: (value: number) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <StarRatingInput
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

describe('StarRatingInput', () => {
  it('SR-01: clicking 4 stars calls onChange and fills stars 1–4', { tags: '@component' }, () => {
    const onChange = cy.spy().as('onChange');
    cy.mount(<ControlledStarRating onChange={onChange} />);

    cy.findByRole('radio', { name: '4 stars' }).click();
    cy.get('@onChange').should('have.been.calledWith', 4);

    cy.findByRole('radio', { name: '1 star' }).then(($star) =>
      expect(getComputedStyle($star[0]).color, '1 star filled').to.eq(FILLED),
    );
    cy.findByRole('radio', { name: '2 stars' }).then(($star) =>
      expect(getComputedStyle($star[0]).color, '2 stars filled').to.eq(FILLED),
    );
    cy.findByRole('radio', { name: '3 stars' }).then(($star) =>
      expect(getComputedStyle($star[0]).color, '3 stars filled').to.eq(FILLED),
    );
    cy.findByRole('radio', { name: '4 stars' }).then(($star) =>
      expect(getComputedStyle($star[0]).color, '4 stars filled').to.eq(FILLED),
    );
    cy.findByRole('radio', { name: '5 stars' }).then(($star) =>
      expect(getComputedStyle($star[0]).color, '5 stars empty').to.eq(EMPTY),
    );
  });

  it('SR-02: radiogroup and radio names for keyboard/screen readers', { tags: '@component' }, () => {
    cy.mount(<StarRatingInput value={0} onChange={cy.spy()} />);

    cy.findByRole('radiogroup', { name: 'Your rating' });
    cy.findByRole('radio', { name: '1 star' });
    cy.findByRole('radio', { name: '2 stars' });
    cy.findByRole('radio', { name: '3 stars' });
    cy.findByRole('radio', { name: '4 stars' });
    cy.findByRole('radio', { name: '5 stars' });
  });

  it('SR-03: arrow keys move selection like a radio group', { tags: '@component' }, () => {
    cy.mount(<ControlledStarRating initial={3} />);

    cy.findByRole('radio', { name: '3 stars' }).then(($star) => {
      expect($star.attr('aria-checked'), '3 stars selected').to.eq('true');
      expect($star.attr('tabindex'), '3 stars roving tabindex').to.eq('0');
    });

    cy.findByRole('radiogroup', { name: 'Your rating' }).focus();
    cy.findByRole('radiogroup', { name: 'Your rating' }).type('{rightarrow}');

    cy.findByRole('radio', { name: '4 stars' }).then(($star) => {
      expect($star.attr('aria-checked'), '4 stars selected after arrow').to.eq('true');
      expect($star.attr('tabindex'), '4 stars has roving tabindex').to.eq('0');
    });
    cy.findByRole('radio', { name: '3 stars' }).then(($star) => {
      expect($star.attr('aria-checked'), '3 stars no longer selected').to.eq('false');
    });
  });
});
