import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router';
import { usePlants, type PlantFilters } from '../api/queries';
import { EmptyState, ErrorBanner } from '../components/Feedback';
import { LightFilter } from '../components/LightFilter';
import { PlantCard } from '../components/PlantCard';
import { SearchBox } from '../components/SearchBox';
import { SortSelect } from '../components/SortSelect';
import type { Light, Sort } from '../types';
import styles from './Pages.module.css';

const SAVED_KEY = 'fernly_saved';

function readFilters(params: URLSearchParams): PlantFilters {
  return {
    search: params.get('search') ?? '',
    light: (params.get('light')?.split(',').filter(Boolean) ?? []) as Light[],
    petSafe: params.get('petSafe') === 'true',
    sort: (params.get('sort') as Sort | null) ?? 'featured',
    page: Number(params.get('page') ?? '1') || 1,
  };
}

function useSaved() {
  const [saved, setSaved] = useState<string[]>(() => JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]') as string[]);
  const toggle = useCallback((plantId: string) => {
    setSaved((current) => {
      const next = current.includes(plantId) ? current.filter((id) => id !== plantId) : [...current, plantId];
      localStorage.setItem(SAVED_KEY, JSON.stringify(next));
      return next;
    });
  }, []);
  return { saved, toggle };
}

export function BrowsePage() {
  const [params, setParams] = useSearchParams();
  const filters = readFilters(params);
  const plants = usePlants(filters);
  const { saved, toggle } = useSaved();

  function update(change: Partial<PlantFilters>) {
    const next = { ...filters, page: 1, ...change };
    const search = new URLSearchParams();
    if (next.search) search.set('search', next.search);
    if (next.light.length) search.set('light', next.light.join(','));
    if (next.petSafe) search.set('petSafe', 'true');
    if (next.sort !== 'featured') search.set('sort', next.sort);
    if (next.page > 1) search.set('page', String(next.page));
    setParams(search);
  }

  const data = plants.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className={styles.browse}>
      <section className={styles.hero}>
        <h1>Plants for every windowsill</h1>
        <p>Find a green friend that fits your light, your pets and your schedule.</p>
      </section>
      <div className={styles.browseLayout}>
        <aside className={styles.sidebar} aria-label="Filters">
          <SearchBox value={filters.search} onSearch={(search) => update({ search })} />
          <LightFilter value={filters.light} onChange={(light) => update({ light })} />
          <label className={styles.toggle}>
            <input type="checkbox" checked={filters.petSafe} onChange={(event) => update({ petSafe: event.target.checked })} />
            Pet-safe plants only
          </label>
          <SortSelect value={filters.sort} onChange={(sort) => update({ sort })} />
        </aside>
        <section aria-labelledby="results-title" className={styles.results}>
          <h2 id="results-title" className={styles.resultsTitle}>
            {plants.isLoading ? 'Loading plants…' : `${data?.total ?? 0} plants`}
          </h2>
          {plants.isLoading ? (
            <div className={styles.skeletonGrid} aria-hidden="true">
              {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className={styles.skeleton} />
              ))}
            </div>
          ) : plants.isError ? (
            <ErrorBanner message="The catalog couldn't be loaded." onRetry={() => void plants.refetch()} />
          ) : !data?.items.length ? (
            <EmptyState title="No plants match your filters" message="Try another search or clear a filter." />
          ) : (
            <>
              <ul className={styles.grid}>
                {data.items.map((plant) => (
                  <li key={plant.id}>
                    <PlantCard plant={plant} saved={saved.includes(plant.id)} onToggleSave={toggle} />
                  </li>
                ))}
              </ul>
              <nav className={styles.pagination} aria-label="Pages">
                <button type="button" disabled={filters.page <= 1} onClick={() => update({ page: filters.page - 1 })}>
                  Previous
                </button>
                <span>
                  Page {filters.page} of {pages}
                </span>
                <button type="button" disabled={filters.page >= pages} onClick={() => update({ page: filters.page + 1 })}>
                  Next
                </button>
              </nav>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
