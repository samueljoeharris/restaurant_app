export function StarRating({
  value,
  onChange,
  max = 5,
  label = "Rating",
}: {
  value: number;
  onChange: (value: number) => void;
  max?: number;
  label?: string;
}) {
  return (
    <div className="star-rating">
      <div className="star-row" role="group" aria-label={label}>
        {Array.from({ length: max }, (_, i) => i + 1).map((star) => (
          <button
            key={star}
            type="button"
            className={["star-btn", value >= star ? "star-btn--on" : ""].join(" ")}
            onClick={() => onChange(star)}
            aria-label={`${star} out of ${max}`}
            aria-pressed={value >= star}
          >
            ★
          </button>
        ))}
      </div>
      <span className="star-rating__value">
        {value} / {max}
      </span>
    </div>
  );
}
