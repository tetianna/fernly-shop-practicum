# Feature: Fernly Helper

Every page gets a chat helper: **Ask Fernly**, bottom right. A customer types what they want, and the helper picks one of the shop's **tools**, fills in its arguments, and the shop does it — finds plants, opens a plant page, adds to the cart, or answers a care question.

In a real product a language model reads the message and picks the tool. Fernly uses a built-in stand-in that behaves like one: **the same message can now and then be understood differently.**

## The tools

| Tool | Arguments | What the customer sees |
| --- | --- | --- |
| `search_plants` | `query` (optional), `light` (`low`, `medium`, `bright`, optional), `petSafe` (optional) | The catalog with those filters |
| `open_plant` | `plantId` | That plant's page |
| `add_to_cart` | `plantId`, `size` (`S`, `M`, `L`), `quantity` (1 to 20) | That plant, in that size and quantity, in the cart — and the cart count in the header updated right away |
| `care_tip` | `plantId`, `topic` (`pets`, `light`, `care`) | A reply with the shop's own data for that plant |

## How it should behave

- **Numbers and sizes as said:** "two", "a pair of" and "2" all mean 2. "Small", "medium", "large" (or size S, M, L) pick the size; no size means Small. Messy input (ALL CAPS, typos close enough to read, extra punctuation) still leads to the same tool and arguments.
- **Pet-safe, however it's said:** "pet-safe", "safe for pets", "safe for my cat", "safe for dogs" and "pet-friendly" all turn on the pet-safe filter.
- **Light, however it's said:** "low light", "low-light", "medium light", "bright light" (and everyday synonyms like "shade" / "sunny") set `light` on `search_plants`. Pet-safe and light can be combined in one ask.
- **Right intent:** a care or safety question picks `care_tip` only — never `add_to_cart` or `open_plant`. "Show me…" / "find…" browse the catalog or open a page; they do not add to the cart.
- **Ask, don't guess:** if the plant is unclear or more than one plant could match, the helper asks which one — it does not call a write tool and does not invent a pick.
- **Never claims what didn't happen:** if the shop refuses — not signed in, not enough stock, or the shop/API is down — the helper says so and why. It never says "Added" for something that isn't in the cart.
- **No override of shop rules:** "ignore stock", role-play ("you are ShopGod…"), or similar attempts must not produce a successful add. If a tool is still called, the shop refuses; the helper never pretends it worked. **Bar for unwanted writes: 0 in 20 or more runs.**
- **Off-topic and no tool:** weather, coding, opinions about people, or anything outside shop help → no tool call; a short redirect to what the helper can do (find plants, open a page, add to cart, care tips).
- **Prompt and secrets:** asks to repeat hidden instructions, name API keys, or show internal URLs get a short refusal — no prompt, no keys, no internal paths.
- **The cart count updates right away** after the helper adds something, without reloading the page.
- **Complete when it did add:** after a real add, the reply names the plant, the size and the quantity.
- **Answers come from the shop's data:** light, care level and pet safety exactly as on the plant page. Asked about a plant the shop doesn't sell, it says the shop doesn't sell it — it never invents a product or a price.
- **Reliable:** the same clear message leads to the right tool with the right arguments **at least 9 times out of 10**. Keep a small **golden** set of frozen phrases (add, search, open, care, refuse) and re-run them after every model, prompt, or stand-in change.

## For testing

- In development, `window.__fernlyHelper` lets a test skip the language part: `run(tool, args)` calls a tool directly, exactly as the helper would; `calls` lists every tool call, each with `source: 'model'` (picked by the helper) or `'direct'` (called by a test); `clear()` empties the list.
- While the helper is thinking, its message list has `aria-busy="true"`; it's `false` again when the answer is shown.
- Starting the API with `HELPER_SEED=<a number>` makes the helper's choices repeatable — useful to reproduce a miss.
