import { cn } from "../../lib/cn";

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
    <div className="flex items-center justify-between gap-3">
      <div className="flex" role="group" aria-label={label}>
        {Array.from({ length: max }, (_, i) => i + 1).map((star) => (
          <button
            key={star}
            type="button"
            className={cn(
              "flex min-h-11 min-w-11 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-3xl leading-none transition-[color,transform] duration-fast hover:scale-110 hover:text-brand",
              value >= star ? "text-brand" : "text-border-strong",
            )}
            onClick={() => onChange(star)}
            aria-label={`${star} out of ${max}`}
            aria-pressed={value >= star}
          >
            ★
          </button>
        ))}
      </div>
      <span className="min-w-12 text-right text-sm font-bold text-brand">
        {value} / {max}
      </span>
    </div>
  );
}
