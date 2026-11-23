import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiRequestError } from '../api/client';
import { useAddToCart, useAllPlants, usePlant } from '../api/queries';
import { useAuth } from '../auth/AuthContext';
import { CareLevelBadge } from '../components/CareLevelBadge';
import { EmptyState, ErrorBanner, Toast } from '../components/Feedback';
import { PetSafeTag } from '../components/PetSafeTag';
import { PriceTag } from '../components/PriceTag';
import { QuantityStepper } from '../components/QuantityStepper';
import { SizePicker } from '../components/SizePicker';
import { PlantPageSlot } from '../slots/Slot';
import type { SizeLabel } from '../types';
import styles from './Pages.module.css';

const LIGHT: Record<string, string> = { low: 'Low light', medium: 'Medium light', bright: 'Bright light' };

export function PlantPage() {
  const { plantId = '' } = useParams();
  const plant = usePlant(plantId);
  const all = useAllPlants();
  const { user } = useAuth();
  const navigate = useNavigate();
  const addToCart = useAddToCart();
  const [size, setSize] = useState<SizeLabel>('S');
  const [quantity, setQuantity] = useState(1);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);

  if (plant.isLoading) return <p className={styles.loading}>Loading plant…</p>;
  if (plant.isError) {
    const missing = plant.error instanceof ApiRequestError && plant.error.status === 404;
    return missing ? (
      <EmptyState title="We couldn't find that plant" action={<Link to="/">Back to the shop</Link>} />
    ) : (
      <ErrorBanner message="The plant couldn't be loaded." onRetry={() => void plant.refetch()} />
    );
  }
  const data = plant.data;
  if (!data) return null;

  const option = data.sizes.find((candidate) => candidate.label === size) ?? data.sizes[0];
  const unitPrice = Math.round((data.price + option.priceDelta) * 100) / 100;
  const outOfStock = data.stock === 0;
  const names = new Map(all.data?.items.map((item) => [item.id, item.name]) ?? []);

  function add() {
    if (!user) {
      navigate(`/login?next=/plants/${plantId}`);
      return;
    }
    addToCart.mutate(
      { plantId: data!.id, size: option.label, quantity },
      {
        onSuccess: () => setToast({ message: `Added ${quantity} × ${data!.name} to your cart.`, tone: 'success' }),
        onError: (error) => setToast({ message: error.message, tone: 'error' }),
      },
    );
  }

  return (
    <article className={styles.plant}>
      <div className={styles.plantImage}>
        <img src={data.imageUrl} alt={data.name} className={styles.heroImage} />
      </div>
      <div className={styles.plantInfo}>
        <p className={styles.breadcrumb}>
          <Link to="/">Shop</Link> / {LIGHT[data.light]}
        </p>
        <h1 className={styles.plantName}>{data.name}</h1>
        <p className={styles.latin}>{data.latinName}</p>
        <div className={styles.tagRow}>
          <CareLevelBadge level={data.careLevel} />
          <PetSafeTag petSafe={data.petSafe} />
          <span className={styles.lightTag}>☀ {LIGHT[data.light]}</span>
          <span className={styles.ratingTag}>
            <span aria-hidden="true">★</span> {Number(data.rating).toFixed(1)}
            <span className="visually-hidden"> out of 5</span>
          </span>
        </div>
        <p className={styles.description}>{data.description}</p>
        <PriceTag amount={unitPrice} size="lg" label="Price" />
        <SizePicker sizes={data.sizes} value={option.label} onChange={setSize} />
        <div className={styles.buyRow}>
          <QuantityStepper value={quantity} max={data.stock} onChange={setQuantity} disabled={outOfStock} />
          <button type="button" className={styles.primary} disabled={outOfStock || addToCart.isPending} onClick={add}>
            {outOfStock ? 'Out of stock' : 'Add to cart'}
          </button>
        </div>
        <p className={styles.stockNote}>{outOfStock ? 'Out of stock right now.' : `${data.stock} in stock`}</p>
        <PlantPageSlot plant={data} />
        {data.similar.length ? (
          <section aria-labelledby="similar-title" className={styles.similar}>
            <h2 id="similar-title">Likes the same light</h2>
            <ul>
              {data.similar.map((id) => (
                <li key={id}>
                  <Link to={`/plants/${id}`}>{names.get(id) ?? id}</Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
      {toast ? <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} /> : null}
    </article>
  );
}
