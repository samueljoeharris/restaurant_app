Little Scout's main button — rounded sky-blue brand fill; use for the primary action on any surface (Log a visit, Continue, Save).

```jsx
<Button onClick={save}>＋ Log a visit</Button>
<Button variant="secondary">Save spot</Button>
<Button variant="soft">＋ Add a kid</Button>
<Button variant="ghost">Skip for now</Button>
```

Variants: `primary` (sky fill + soft brand shadow), `secondary` (white, sky outline), `soft` (mango tint — for additive/optional actions), `ghost` (text only). Sizes `sm | md | lg`. One primary per view.
