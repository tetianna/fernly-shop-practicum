# Fernly app map

Mapped from `CHALLENGE.md`, `docs/PRODUCT.md`, `http://localhost:8100/openapi.json`, `web/src/pages`, `web/src/components`, and a signed-in pass through `http://localhost:5173` as Ava (`ava@fernly.test`).

Every route is wrapped by `Layout` (`web/src/pages/Layout.tsx`): skip link, header (Shop, Orders when signed in, Cart badge, session), `<main>`, footer. If a token is stored, `AuthProvider` calls `GET /api/auth/me` once on load. When a user is signed in, Layout also calls `GET /api/cart` on every page for the header badge (`itemCount`).

## 1. Pages

| Path | What it shows | API calls it makes | States (loading, empty, error, signed out) |
| --- | --- | --- | --- |
| `/` | Browse: hero, search, light filters, pet-safe toggle, sort, plant grid (12 per page), Previous/Next. Heading reports `21 plants` on the seed catalog. | `GET /api/plants?search&light&petSafe&sort&page` (sort and page always sent). Layout: `GET /api/cart` if signed in. | **Loading:** “Loading plants…” and skeleton cards. **Empty:** “No plants match your filters” / “Try another search or clear a filter.” **Error:** same empty copy — no “Try again”. **Signed out:** full catalog; Cart/Sign in in the header. |
| `/plants/:plantId` | One plant: image, breadcrumb, name, Latin name, care/pet/light/rating, description, price, size radios, quantity, Add to cart, stock note, “Likes the same light” links. | `GET /api/plants/:plantId`; `GET /api/plants?pageSize=48` (names for similar links); `POST /api/cart/lines` on add. Signed-out add navigates to login instead of posting. | **Loading:** “Loading plant…”. **Empty/404:** “We couldn't find that plant” + Back to the shop. **Error (non-404):** “The plant couldn't be loaded.” + Try again. **Signed out:** page is public; Add to cart goes to `/login?next=/plants/:plantId`. **Out of stock:** quantity disabled, button “Out of stock”. **Success:** toast “Added N × Name to your cart.” |
| `/login` | “Sign in” form: email, password, Sign in, link to register. Honours `?next=`. | `POST /api/auth/login`. Then Layout fetches cart. | **Loading:** button “Signing in…”. **Empty:** n/a. **Error:** banner with API `detail` (e.g. bad credentials). **Signed out:** this is the signed-out destination; signed-in users can still open it. |
| `/register` | “Create an account”: name, email, password (hint: at least 8 characters), Create account, link to sign in. Honours `?next=`. | `POST /api/auth/register`. | **Loading:** button “Creating…”. **Empty:** n/a. **Error:** banner with API `detail` (validation or `email_taken`). **Signed out:** public. |
| `/cart` | “Your cart”: lines (image, name, size, unit price, stepper, line total, Remove), order summary (subtotal, shipping, total, free-shipping hint), Go to checkout. | `GET /api/cart`; `PATCH /api/cart/lines/:lineId`; `DELETE /api/cart/lines/:lineId`. | **Auth loading:** “Loading…”. **Cart loading:** “Loading your cart…”. **Empty:** “Your cart is empty” + Browse plants. **Error:** “Your cart couldn't be loaded.” + Try again. **Signed out:** redirect to `/login?next=/cart`. Observed with 1 × Aloe S: subtotal `$9.99`, shipping `$6.95`, total `$16.94`, badge `1`. |
| `/checkout` | “Checkout”: shipping form (full name, street address, city, postal code) and order summary; Place order. | `GET /api/cart`; `POST /api/orders` `{ shippingAddress }`. | **Auth loading:** “Loading…”. **Cart loading:** “Loading your cart…”. **Empty cart:** “Your cart is empty” / “Add a plant before you check out.” **Cart error:** “Your cart couldn't be loaded.” + Try again. **Place error:** banner with API `detail`. **Pending:** “Placing order…”. **Signed out:** redirect to `/login?next=/checkout`. Success navigates to `/orders/:orderId?placed=1`. |
| `/orders` | “Your orders”: list of Order id, date, line count, total. | `GET /api/orders`. | **Auth loading:** “Loading…”. **Loading:** “Loading your orders…”. **Empty:** “No orders yet”. **Error:** “Your orders couldn't be loaded.” + Try again. **Signed out:** redirect to `/login?next=/orders`. After placing Aloe: one row `Order ord-…`, 1 line, `$16.94`. |
| `/orders/:orderId` | Optional “Thank you! Your order is placed.” when `?placed=1`; order id, date, ship-to name/city; lines; “Paid” summary. | `GET /api/orders/:orderId`. | **Auth loading:** “Loading…”. **Loading:** “Loading order…”. **Empty/404:** “Order not found” + Back to your orders. **Error (non-404):** “The order couldn't be loaded.” + Try again. **Signed out:** redirect to `/login?next=/orders/:orderId`. |
| `*` | “Page not found” + Back to the shop. | None besides Layout. | No loading/empty/error variants. **Signed out:** still reachable. |

## 2. Components

| Name | File | Props (TypeScript) | What it shows | Pages that use it |
| --- | --- | --- | --- | --- |
| `PlantCard` | `web/src/components/PlantCard.tsx` | `plant: PlantSummary`; `saved?: boolean`; `onToggleSave?: (plantId: string) => void` | Card: linked image (sold-out overlay), unsaved/saved heart, name, Latin name, care + pet-safe tags, price, rating. | Browse (`/`) |
| `SearchBox` | `web/src/components/SearchBox.tsx` | `value: string`; `onSearch: (value: string) => void` | Search form: overlay hint “Search plants”, text field, optional clear, Search submit. | Browse (`/`) |
| `LightFilter` | `web/src/components/LightFilter.tsx` | `value: Light[]`; `onChange: (value: Light[]) => void` | Fieldset “Light” with Low / Medium / Bright checkboxes (combinable). | Browse (`/`) |
| `SortSelect` | `web/src/components/SortSelect.tsx` | `value: Sort`; `onChange: (value: Sort) => void` | “Sort by” select: Featured, Price low to high, Price high to low, Name A to Z, Best rated. | Browse (`/`) |
| `CareLevelBadge` | `web/src/components/CareLevelBadge.tsx` | `{ level: 1 \| 2 \| 3 }` | Dots + “Easy/Moderate/Expert care”. | Browse (`/`) via `PlantCard`; Plant (`/plants/:plantId`) |
| `PetSafeTag` | `web/src/components/PetSafeTag.tsx` | `{ petSafe: boolean }` | “Pet safe” or “Not pet safe”. | Browse (`/`) via `PlantCard`; Plant (`/plants/:plantId`) |
| `PriceTag` | `web/src/components/PriceTag.tsx` | `amount: number`; `size?: 'sm' \| 'md' \| 'lg'`; `label?: string` | Formatted dollar amount; optional visually-hidden label. | Browse (`/`) via `PlantCard`; Plant; Cart (`CartLine`, `OrderSummary`); Checkout (`OrderSummary`); Orders; one order |
| `SizePicker` | `web/src/components/SizePicker.tsx` | `sizes: { label: SizeLabel; priceDelta: number }[]`; `value: SizeLabel`; `onChange: (size: SizeLabel) => void`; `name?: string` | Size radios: Small “Base price”, Medium/Large `+$n`. | Plant (`/plants/:plantId`) |
| `QuantityStepper` | `web/src/components/QuantityStepper.tsx` | `value: number`; `onChange: (value: number) => void`; `min?: number`; `max: number`; `disabled?: boolean`; `label?: string` | − / value / + group. − disabled at min (default 1); + disabled when `disabled` or `value > max`. | Plant (`/plants/:plantId`); Cart via `CartLine` |
| `CartLine` | `web/src/components/CartLine.tsx` | `line: CartLine`; `onQuantityChange: (lineId, quantity) => void`; `onRemove: (lineId) => void`; `busy?: boolean` | Line: image, name, size, unit price, stepper, line total, Remove. | Cart (`/cart`) |
| `OrderSummary` | `web/src/components/OrderSummary.tsx` | `itemCount: number`; `subtotal: number`; `shipping: number`; `total: number`; `title?: string` | Subtotal, Shipping (`Free` when shipping is 0 and there are items), Total; hint “Add $x more for free shipping” while under `$50`. | Cart (`/cart`); Checkout (`/checkout`); one order (`/orders/:orderId`) |
| `EmptyState` | `web/src/components/Feedback.tsx` | `title: string`; `message?: string`; `action?: ReactNode` | Seedling icon, title, optional message and action. | Browse, Plant (404), Cart, Checkout, Orders, one order (404), unknown route (`App`) |
| `ErrorBanner` | `web/src/components/Feedback.tsx` | `message: string`; `onRetry?: () => void` | Alert message; optional Try again. | Plant, Login, Register, Cart, Checkout, Orders, one order |
| `Toast` | `web/src/components/Feedback.tsx` | `message: string`; `tone?: 'success' \| 'error'`; `onClose: () => void`; `duration?: number` | Status toast that auto-dismisses (default 4s). | Plant (add-to-cart); Cart (line update/remove errors) |

## 3. API

From `http://localhost:8100/openapi.json`. Shop calls go through the Vite proxy as `/api/...`.

| Method and path | Used by which page | Needs sign-in? |
| --- | --- | --- |
| `GET /api/health` | None in the shop UI | No |
| `POST /api/admin/reset` | None in the shop UI | No |
| `GET /api/plants` | Browse (`/`); Plant (`/plants/:plantId`, `pageSize=48` for similar names) | No |
| `GET /api/plants/{plantId}` | Plant (`/plants/:plantId`) | No |
| `POST /api/auth/register` | Register (`/register`) | No |
| `POST /api/auth/login` | Login (`/login`) | No |
| `GET /api/auth/me` | All pages, once, if `fernly_token` is in localStorage | Yes |
| `GET /api/cart` | Layout on every page when signed in; Cart (`/cart`); Checkout (`/checkout`) | Yes |
| `POST /api/cart/lines` | Plant (`/plants/:plantId`) when signed in | Yes |
| `PATCH /api/cart/lines/{lineId}` | Cart (`/cart`) | Yes |
| `DELETE /api/cart/lines/{lineId}` | Cart (`/cart`) | Yes |
| `POST /api/orders` | Checkout (`/checkout`) | Yes |
| `GET /api/orders` | Orders (`/orders`) | Yes |
| `GET /api/orders/{orderId}` | One order (`/orders/:orderId`) | Yes |
