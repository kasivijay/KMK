# Khane mein kya?

A daily family meal planner for the Kasi family.

## Structure

- `index.html` — UI shell, design tokens, layout
- `data.js` — menu data (dishes, vegetables, grains, pulses, slots)
- `app.js` — state, scoring, picking, and rendering

The site is static — no build step. Drop into any static host (Vercel, Netlify, GitHub Pages).

## Local dev

```sh
# Any static server works. For example:
npx serve .
# or
python3 -m http.server 8080
```

Then open <http://localhost:8080>.

## Editing the menu

All dishes live in `data.js` under the `MENU` array. Each entry:

```js
{ n: "Dish name",
  slot: "breakfast" | "tiffin" | "lunch" | "snack" | "dinner",
  cuisine: "Indian" | "Asian" | "Mexican" | "Italian" | "Continental",
  dairy: "none" | "light" | "heavy",
  protein: "low" | "med" | "high",
  veg: ["spinach", ...],
  grain: ["rice", ...],
  pulse: ["moong dal", ...],
  soak: true   // optional, set if it needs overnight soaking
}
```

Vegetable / grain / pulse chip options live in the same file. To split the
chip list into "show more" territory, drop a `"_more_"` sentinel string at
the point you want the divider.

## Tweaks (palette, density, days-ahead)

The little Tweaks panel at the bottom-right of the page (when running inside
the design tool) lets you preview palette and layout variants. In production
on Vercel it stays hidden — the messages it listens for never arrive.
