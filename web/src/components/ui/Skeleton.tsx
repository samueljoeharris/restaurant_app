import { cn } from "../../lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-sm bg-gradient-to-r from-border via-surface-muted to-border bg-[length:200%_100%] animate-[shimmer_1.2s_ease-in-out_infinite]",
        className,
      )}
    />
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <ul className="m-0 grid list-none gap-3 p-0">
      {Array.from({ length: count }, (_, i) => (
        <li
          key={i}
          className="grid gap-2 rounded-md border border-border bg-surface p-4"
        >
          <Skeleton className="h-4 w-[55%]" />
          <Skeleton className="h-3 w-[85%]" />
        </li>
      ))}
    </ul>
  );
}
