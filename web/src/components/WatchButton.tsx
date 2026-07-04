import { cn } from "../lib/cn";

interface WatchButtonProps {
  watched: boolean;
  busy?: boolean;
  onClick: () => void;
  size?: "sm" | "md";
  className?: string;
}

export function WatchButton({
  watched,
  busy = false,
  onClick,
  size = "md",
  className,
}: WatchButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "cursor-pointer rounded-full border font-bold transition-colors duration-fast",
        size === "sm" ? "px-2 py-1 text-xs pointer-coarse:min-h-11" : "min-h-11 px-3 py-2 text-sm",
        watched
          ? "border-brand bg-brand-soft text-brand"
          : "border-border bg-surface text-text-muted hover:border-brand/40 hover:text-brand",
        className,
      )}
      aria-pressed={watched}
      aria-label={watched ? "Unwatch restaurant" : "Watch restaurant"}
      disabled={busy}
      onClick={onClick}
    >
      {watched ? "♥ Saved" : "♡ Watch"}
    </button>
  );
}
