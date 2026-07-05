import { useState, type KeyboardEvent } from "react";

import { cn } from "../../lib/cn";

/**
 * Tag-style input (issue #85): chips with remove buttons plus a free-text
 * entry that commits on Enter, comma, or blur. Tags are lowercased and
 * whitespace-collapsed to match the API's cuisine tag normalization.
 */
export function TagInput({
  value,
  onChange,
  placeholder,
  maxTags = 20,
  className,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  maxTags?: number;
  className?: string;
}) {
  const [draft, setDraft] = useState("");

  function commitDraft() {
    const tag = draft.replace(/,/g, " ").split(/\s+/).filter(Boolean).join(" ").toLowerCase();
    setDraft("");
    if (!tag || value.includes(tag) || value.length >= maxTags) return;
    onChange([...value, tag]);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commitDraft();
    } else if (event.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div
      className={cn(
        "flex w-full flex-wrap items-center gap-1.5 rounded-md border border-border-strong bg-surface px-2 py-1.5",
        className,
      )}
    >
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-md bg-brand-soft px-2 py-1 text-xs font-semibold text-text"
        >
          {tag}
          <button
            type="button"
            className="cursor-pointer rounded-sm px-0.5 leading-none text-text-muted hover:text-text"
            aria-label={`Remove ${tag}`}
            onClick={() => onChange(value.filter((t) => t !== tag))}
          >
            ×
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commitDraft}
        placeholder={value.length === 0 ? placeholder : undefined}
        className="min-w-24 flex-1 !border-0 !bg-transparent !px-1 !py-1 !shadow-none"
      />
    </div>
  );
}
