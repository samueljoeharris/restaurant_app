import type { AdminContributorDetail, AdminContributorRow } from "../types";

export function contributorRowFromDetail(detail: AdminContributorDetail): AdminContributorRow {
  return {
    firebase_uid: detail.firebase_uid,
    email: detail.email,
    display_name: detail.display_name,
    disabled: detail.disabled,
    trust_level: detail.trust_level,
    auto_publish: detail.auto_publish,
    ttf_count: detail.ttf_count,
    attribute_count: detail.attribute_count,
    note_count: detail.note_count,
    total_contributions: detail.total_contributions,
    last_active_at: detail.last_active_at,
  };
}

export function applyContributorMutation(
  rows: AdminContributorRow[],
  total: number,
  detail: AdminContributorDetail,
  trustFilter: string,
): { rows: AdminContributorRow[]; total: number } {
  const idx = rows.findIndex((r) => r.firebase_uid === detail.firebase_uid);
  const filteredOut = trustFilter && detail.trust_level !== trustFilter;

  if (filteredOut) {
    if (idx === -1) return { rows, total };
    return {
      rows: rows.filter((r) => r.firebase_uid !== detail.firebase_uid),
      total: Math.max(0, total - 1),
    };
  }

  const row = contributorRowFromDetail(detail);
  if (idx === -1) return { rows, total };
  return {
    rows: rows.map((r, i) => (i === idx ? row : r)),
    total,
  };
}
