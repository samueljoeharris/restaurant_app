export function Skeleton({ className }: { className?: string }) {
  return <div className={["ui-skeleton", className ?? ""].join(" ")} aria-hidden />;
}

export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <ul className="ui-skeleton-list" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="ui-skeleton-list__item">
          <Skeleton className="ui-skeleton--title" />
          <Skeleton className="ui-skeleton--line" />
        </li>
      ))}
    </ul>
  );
}
