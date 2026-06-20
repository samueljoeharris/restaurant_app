The product's hero metric — time-to-food for kids. Big Quicksand number + tier dot + tier pill.

```jsx
<SpeedBadge minutes={6} tier="fast" meta="12 visits · 4.2/5 quality" />
<SpeedBadge minutes={12} tier="ok" caption="Kid food speed · great for age 2" />
<SpeedBadge minutes={null} tier="none" />
```

`tier` is the semantic speed tier (`fast` green ≤8m, `ok` amber 9–15m, `slow` red >15m, `none` no data) — these colors never change with theme. Never shrink this below the page's other numbers.
