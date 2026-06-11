import type { AdminActivityDay } from "../../types";

export function ActivityChart({ days }: { days: AdminActivityDay[] }) {
  const max = Math.max(
    1,
    ...days.flatMap((d) => [d.ttf_count, d.attribute_count, d.note_count]),
  );

  return (
    <div className="admin-activity">
      <div className="admin-activity__legend">
        <span><i className="admin-activity__dot admin-activity__dot--ttf" /> Speed</span>
        <span><i className="admin-activity__dot admin-activity__dot--attr" /> Attributes</span>
        <span><i className="admin-activity__dot admin-activity__dot--note" /> Notes</span>
      </div>
      <div className="admin-activity__chart">
        {days.map((day) => (
          <div key={day.day} className="admin-activity__col" title={day.day}>
            <div className="admin-activity__bars">
              <div
                className="admin-activity__bar admin-activity__bar--ttf"
                style={{ height: `${(day.ttf_count / max) * 100}%` }}
              />
              <div
                className="admin-activity__bar admin-activity__bar--attr"
                style={{ height: `${(day.attribute_count / max) * 100}%` }}
              />
              <div
                className="admin-activity__bar admin-activity__bar--note"
                style={{ height: `${(day.note_count / max) * 100}%` }}
              />
            </div>
            <span className="admin-activity__label">
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
