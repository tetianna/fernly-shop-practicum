import { Link } from 'react-router';
import { PlantCardSlot } from '../slots/Slot';
import type { PlantSummary } from '../types';
import { CareLevelBadge } from './CareLevelBadge';
import { PetSafeTag } from './PetSafeTag';
import { PriceTag } from './PriceTag';
import styles from './PlantCard.module.css';

interface PlantCardProps {
  plant: PlantSummary;
  saved?: boolean;
  onToggleSave?: (plantId: string) => void;
}

export function PlantCard({ plant, saved = false, onToggleSave }: PlantCardProps) {
  const outOfStock = plant.stock === 0;
  return (
    <article className={styles.card}>
      <Link to={`/plants/${plant.id}`} className={styles.imageLink}>
        <img src={plant.imageUrl} alt={plant.name} className={styles.image} />
        {outOfStock ? <span className={styles.soldOut}>Out of stock</span> : null}
      </Link>
      {onToggleSave ? (
        <button
          type="button"
          className={`${styles.save} ${saved ? styles.saved : ''}`}
          aria-label={saved ? `Remove ${plant.name} from saved` : `Save ${plant.name}`}
          aria-pressed={saved}
          onClick={() => onToggleSave(plant.id)}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              d="M12 21s-7.5-4.6-9.5-9.2C1.2 8.6 3.3 5 6.8 5c2 0 3.4 1.1 4.2 2.3C11.8 6.1 13.2 5 15.2 5c3.5 0 5.6 3.6 4.3 6.8C19.5 16.4 12 21 12 21z"
              fill={saved ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="1.8"
            />
          </svg>
        </button>
      ) : null}
      <div className={styles.body}>
        <h3 className={styles.name}>
          <Link to={`/plants/${plant.id}`}>{plant.name}</Link>
        </h3>
        <p className={styles.latin}>{plant.latinName}</p>
        <div className={styles.tags}>
          <CareLevelBadge level={plant.careLevel} />
          <PetSafeTag petSafe={plant.petSafe} />
          <PlantCardSlot plant={plant} />
        </div>
        <div className={styles.footer}>
          <PriceTag amount={plant.price} />
          <span className={styles.rating}>
            <span aria-hidden="true">★</span> {plant.rating.toFixed(1)}
            <span className="visually-hidden"> out of 5</span>
          </span>
        </div>
      </div>
    </article>
  );
}
