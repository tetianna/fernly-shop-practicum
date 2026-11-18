# How Fernly should behave

This is the product description: what the shop promises its customers. Tests check the app against it. The API's own contract — every endpoint, field and status code — is the OpenAPI document at `http://localhost:8100/docs` (Swagger UI) and `http://localhost:8100/openapi.json`.

When the app and this page disagree, the page wins: that's a bug to report, not a test to change. When neither says what should happen, write the question down.

## The shop at a glance

| Page | Path | Who |
| --- | --- | --- |
| Browse | `/` | Everyone |
| Plant | `/plants/:plantId` | Everyone |
| Sign in, create an account | `/login`, `/register` | Everyone |
| Cart | `/cart` | Signed-in customers |
| Checkout | `/checkout` | Signed-in customers |
| Orders, one order | `/orders`, `/orders/:orderId` | Signed-in customers |

Two customers exist after every start or reset (see `.env.example`). The catalog has 21 plants.

## Browsing

- **Search** matches a plant's name or Latin name, ignoring upper and lower case.
- **Light** filters can be combined: choosing Low and Bright shows plants for either.
- **Pet-safe plants only** shows only plants that are safe for cats and dogs.
- **Sort by:** Featured (the shop's order), Price: low to high, **Price: high to low (most expensive first)**, Name: A to Z, Best rated (highest first).
- Twelve plants per page, with Previous and Next.
- If the catalog can't be loaded, the page says so and offers **Try again**. It never pretends there are no plants.

## A plant

- Every price is shown in dollars with **two decimals**, everywhere: `$12.50`, never `$12.5`.
- **Care level** has three steps: 1 **Easy**, 2 **Moderate**, 3 **Expert**.
- Sizes: Small is the base price; Medium and Large add the amount shown.
- **Quantity** starts at 1 and can never go above the stock left: at the stock limit, the **+** button is disabled. Out-of-stock plants can't be added at all.
- The plant page always shows the plant in the address bar, including after following a "Likes the same light" link.
- Adding to the cart needs a signed-in customer; otherwise the shop asks you to sign in first.

## The cart

- Adding the same plant and size again increases that line.
- A line can never hold more than the plant's stock.
- **Shipping costs $6.95, and is free when the subtotal is $50.00 or more.** An empty cart has no shipping.
- The cart badge in the header shows how many plants are in the cart.

## Checkout and orders

- Checkout needs a full name, a street address, a city and a postal code.
- Placing an order charges the cart as it is, lowers the stock, and empties the cart.
- **An order is private:** only the customer who placed it can see it. Anyone else gets "Order not found".
- Orders are listed newest first.

## Accounts

- Passwords have at least 8 characters; an email can have only one account.
- Signing out forgets the session on this device.

## Accessibility

Fernly aims for **WCAG 2.1 level AA** on every page:

- every button and form field has a name a screen reader can announce;
- every meaningful image has alternative text;
- text has enough contrast against its background (4.5:1 for normal text);
- everything works with the keyboard alone, and focus is always visible.

