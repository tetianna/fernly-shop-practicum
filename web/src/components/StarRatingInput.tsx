import { useEffect, useRef, type KeyboardEvent } from 'react';
import styles from './StarRatingInput.module.css';

interface StarRatingInputProps {
  value: number;
  onChange: (value: number) => void;
}

export function StarRatingInput({ value, onChange }: StarRatingInputProps) {
  const starRefs = useRef<Array<HTMLSpanElement | null>>([]);

  useEffect(() => {
    const focusIndex = value > 0 ? value - 1 : 0;
    const active = document.activeElement;
    const group = active?.closest('[role="radiogroup"]');
    if (!group || !starRefs.current.some((el) => el === active || el === group)) return;
    starRefs.current[focusIndex]?.focus();
  }, [value]);

  function moveTo(next: number) {
    const clamped = Math.min(5, Math.max(1, next));
    onChange(clamped);
    queueMicrotask(() => starRefs.current[clamped - 1]?.focus());
  }

  function onGroupKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveTo((value || 0) + 1);
      return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault();
      moveTo((value || 1) - 1);
    }
  }

  function onStarKeyDown(event: KeyboardEvent<HTMLSpanElement>, star: number) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveTo(star + 1);
      return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault();
      moveTo(star - 1);
      return;
    }
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      onChange(star);
    }
  }

  return (
    <div
      className={styles.stars}
      role="radiogroup"
      aria-label="Your rating"
      tabIndex={-1}
      onKeyDown={onGroupKeyDown}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const checked = star === value;
        return (
          <span
            key={star}
            ref={(el) => {
              starRefs.current[star - 1] = el;
            }}
            role="radio"
            tabIndex={checked || (value === 0 && star === 1) ? 0 : -1}
            aria-checked={checked}
            aria-label={`${star} ${star === 1 ? 'star' : 'stars'}`}
            className={`${styles.star} ${star <= value ? styles.on : ''}`}
            onClick={() => onChange(star)}
            onKeyDown={(event) => onStarKeyDown(event, star)}
          >
            ★
          </span>
        );
      })}
    </div>
  );
}
