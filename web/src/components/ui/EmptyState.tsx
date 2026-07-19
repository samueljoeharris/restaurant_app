import { ButtonLink } from "./Button";
import { ScoutMascot } from "../ScoutMascot";

export function EmptyState({
  emoji,
  mascot,
  title,
  description,
  actionLabel,
  actionTo,
}: {
  emoji?: string;
  mascot?: boolean;
  title: string;
  description?: string;
  actionLabel?: string;
  actionTo?: string;
}) {
  return (
    <div className="paper-dot-bg px-5 py-10 text-center">
      {mascot ? (
        <ScoutMascot className="mx-auto mb-3 h-32 w-32 object-contain" size={128} />
      ) : (
        emoji && <span className="mb-3 block text-4xl">{emoji}</span>
      )}
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
