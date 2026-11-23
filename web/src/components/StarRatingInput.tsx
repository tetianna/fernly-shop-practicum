import type { KeyboardEvent } from 'react';
import styles from './StarRatingInput.module.css';

interface StarRatingInputProps {
  value: number;
  onChange: (value: number) => void;
}

export function StarRatingInput({ value, onChange }: StarRatingInputProps) {
  function onKeyDown(event: KeyboardEvent<HTMLSpanElement>, star: number) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault();
      onChange(Math.min(5, star + 1));
      return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault();
      onChange(Math.max(1, star - 1));
      return;
    }
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      onChange(star);
    }
  }

  return (
    <div className={styles.stars} role="radiogroup" aria-label="Your rating">
      {[1, 2, 3, 4, 5].map((star) => {
        const checked = star === value;
        return (
          <span
            key={star}
            role="radio"
            tabIndex={checked || (value === 0 && star === 1) ? 0 : -1}
            aria-checked={checked}
            aria-label={`${star} ${star === 1 ? 'star' : 'stars'}`}
            className={`${styles.star} ${star <= value ? styles.on : ''}`}
            onClick={() => onChange(star)}
            onKeyDown={(event) => onKeyDown(event, star)}
          >
            ★
          </span>
        );
      })}
    </div>
  );
}
