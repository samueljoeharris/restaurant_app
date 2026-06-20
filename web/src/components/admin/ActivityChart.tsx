import type { AdminActivityDay } from "../../types";

export function ActivityChart({ days }: { days: AdminActivityDay[] }) {
  const max = Math.max(
    1,
    ...days.flatMap((d) => [d.ttf_count, d.attribute_count, d.note_count]),
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-4 text-xs text-text-muted">
        <span>
          <i className="mr-1 inline-block h-[0.6rem] w-[0.6rem] rounded-full bg-brand align-middle" />{" "}
          Speed
        </span>
        <span>
          <i className="mr-1 inline-block h-[0.6rem] w-[0.6rem] rounded-full bg-accent align-middle" />{" "}
          Attributes
        </span>
        <span>
          <i className="mr-1 inline-block h-[0.6rem] w-[0.6rem] rounded-full bg-[#6366f1] align-middle" />{" "}
          Notes
        </span>
      </div>
      <div className="flex min-h-40 items-end gap-2 overflow-x-auto pb-2">
        {days.map((day) => (
          <div key={day.day} className="flex min-w-8 flex-1 flex-col items-center gap-2" title={day.day}>
            <div className="flex h-32 w-full items-end gap-0.5">
              <div
                className="min-h-0.5 flex-1 rounded-t-sm bg-brand"
                style={{ height: `${(day.ttf_count / max) * 100}%` }}
              />
              <div
                className="min-h-0.5 flex-1 rounded-t-sm bg-accent"
                style={{ height: `${(day.attribute_count / max) * 100}%` }}
              />
              <div
                className="min-h-0.5 flex-1 rounded-t-sm bg-[#6366f1]"
                style={{ height: `${(day.note_count / max) * 100}%` }}
              />
            </div>
            <span className="text-[0.65rem] text-text-muted">
              {new Date(`${day.day}T12:00:00`).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
