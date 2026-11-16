import { ReviewList, type ReviewItem } from '../../src/components/ReviewList';

const twoReviews: ReviewItem[] = [
  {
    id: 'rev-1',
    author: 'Ava Tester',
    rating: 5,
    text: 'Thriving on my windowsill after two weeks.',
    createdAt: '2025-03-15T12:00:00.000Z',
  },
  {
    id: 'rev-2',
    author: 'Sam Green',
    rating: 4,
    text: 'Easy care and still looking lush.',
    createdAt: '2025-02-01T09:30:00.000Z',
  },
];

describe('ReviewList', () => {
  it('RL-01: shows average summary and each review author, text, and date', { tags: '@component' }, () => {
    cy.mount(<ReviewList reviews={twoReviews} average={4.7} count={2} />);

    cy.findByText('4.7 out of 5 · 2 reviews');
    cy.findByText('Ava Tester');
    cy.findByText('Thriving on my windowsill after two weeks.');
    cy.findByText('Mar 15, 2025');
    cy.findByText('Sam Green');
    cy.findByText('Easy care and still looking lush.');
    cy.findByText('Feb 1, 2025');
  });

  it('RL-02: empty state invite with no average summary', { tags: '@component' }, () => {
    cy.mount(<ReviewList reviews={[]} average={0} count={0} />);

    cy.findByText("No reviews yet. Be the first to share how it's growing.");
    cy.findByText(/out of 5/).should('not.exist');
  });

  it('RL-03: singular “1 review” wording', { tags: '@component' }, () => {
    cy.mount(
      <ReviewList
        reviews={[
          {
            id: 'rev-solo',
            author: 'Ava Tester',
            rating: 5,
            text: 'Perfect plant for beginners.',
            createdAt: '2025-03-15T12:00:00.000Z',
          },
        ]}
        average={5}
        count={1}
      />,
    );

    cy.findByText('5.0 out of 5 · 1 review');
    cy.findByText(/1 reviews/).should('not.exist');
  });

  it('RL-04: decorative stars are aria-hidden with visually hidden rating text', { tags: '@component' }, () => {
    cy.mount(
      <ReviewList
        reviews={[
          {
            id: 'rev-a11y',
            author: 'Ava Tester',
            rating: 4,
            text: 'Four stars for steady growth indoors.',
            createdAt: '2025-03-15T12:00:00.000Z',
          },
        ]}
        average={4}
        count={1}
      />,
    );

    cy.findByText('4 out of 5').then(($label) => {
      const decorative = $label.prev('[aria-hidden="true"]');
      expect(decorative.length, 'decorative ★ sibling').to.eq(1);
      expect(decorative.attr('aria-hidden'), 'decorative ★ aria-hidden').to.eq('true');
      expect(decorative.text(), 'four filled stars').to.eq('★★★★');
    });
  });
});
