import { cn } from "../../lib/cn";

export function Toggle({
  checked,
  onChange,
  disabled,
  label,
  id,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  id?: string;
  className?: string;
}) {
  const switchId = id ?? (label ? `toggle-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined);

  const track = (
    <button
      type="button"
      role="switch"
      id={switchId}
      aria-checked={checked}
      disabled={disabled}
      className={cn(
        "relative h-6 w-[42px] shrink-0 cursor-pointer rounded-full border-0 p-0 transition-colors duration-fast ease-out",
        "shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)]",
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand/20",
        checked ? "bg-brand" : "bg-border-strong",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
      onClick={() => onChange(!checked)}
    >
      <span
        className={cn(
          "absolute top-[3px] h-[18px] w-[18px] rounded-full bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-[left] duration-fast ease-out",
          checked ? "left-[21px]" : "left-[3px]",
        )}
      />
    </button>
  );

  if (!label) return track;

  return (
    <label htmlFor={switchId} className="flex min-h-10 cursor-pointer items-center gap-3 font-normal">
      <span className="min-w-0 flex-1 text-sm font-bold leading-snug">{label}</span>
      {track}
    </label>
  );
}
