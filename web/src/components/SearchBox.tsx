import { useEffect, useState, type FormEvent } from 'react';
import styles from './SearchBox.module.css';

interface SearchBoxProps {
  value: string;
  onSearch: (value: string) => void;
}

export function SearchBox({ value, onSearch }: SearchBoxProps) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  function submit(event: FormEvent) {
    event.preventDefault();
    onSearch(draft.trim());
  }

  return (
    <form className={styles.form} role="search" onSubmit={submit}>
      <span className={styles.icon} aria-hidden="true">
        ⌕
      </span>
      {draft ? null : <span className={styles.hint}>Search plants</span>}
      <label className="visually-hidden" htmlFor="plant-search">
        Search plants
      </label>
      <input
        id="plant-search"
        className={styles.input}
        type="search"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      {draft ? (
        <button
          type="button"
          className={styles.clear}
          aria-label="Clear search"
          onClick={() => {
            setDraft('');
            onSearch('');
          }}
        >
          ×
        </button>
      ) : null}
      <button type="submit" className={styles.submit}>
        Search
      </button>
    </form>
  );
}
