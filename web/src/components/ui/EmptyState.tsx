import { ButtonLink } from "./Button";

export function EmptyState({
  emoji,
  title,
  description,
  actionLabel,
  actionTo,
}: {
  emoji?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  actionTo?: string;
}) {
  return (
    <div className="px-5 py-10 text-center">
      {emoji && <span className="mb-3 block text-4xl">{emoji}</span>}
      <h2 className="mb-2 text-lg">{title}</h2>
      {description && (
        <p className="mx-auto mb-5 max-w-80 text-sm text-text-muted">{description}</p>
      )}
      {actionLabel && actionTo && (
        <ButtonLink to={actionTo} variant="primary">
          {actionLabel}
        </ButtonLink>
      )}
    </div>
  );
}
