import type { ReactNode } from "react";

import { formatTtfMedian, TTF_TIER_COLORS, TTF_TIER_LABELS, ttfTier, type TtfTier } from "../lib/ttfTier";
import type { TtfAggregate } from "../types";
import { Stat, StatGrid } from "./ui/Stat";

function previewTtfTier(ttf: TtfAggregate): TtfTier {
  const median = ttf.median_minutes;
  if (median === null) return "unknown";
  if (median <= 8) return "fast";
  if (median <= 15) return "ok";
  return "slow";
}

export function RestaurantTtfStats({
  ttf,
  empty,
  highlightMedian = true,
  showEarlySignal = false,
}: {
  ttf: TtfAggregate;
  empty?: ReactNode;
  highlightMedian?: boolean;
  showEarlySignal?: boolean;
}) {
  if (ttf.sample_size === 0) return empty ?? null;

  const confirmed = ttf.sample_size >= 3;
  const tier = ttfTier(ttf);
  const signalTier = confirmed ? tier : previewTtfTier(ttf);

  return (
    <>
      <StatGrid>
        <Stat label="Median" value={formatTtfMedian(ttf)} highlight={highlightMedian} />
        <Stat label="Quality" value={ttf.avg_quality?.toFixed(1) ?? "—"} />
        <Stat
          label="Visits"
          value={ttf.sample_size}
          hint={showEarlySignal && !confirmed ? "need 3 for tier" : undefined}
        />
      </StatGrid>
      {showEarlySignal && (
        <p className="m-0 flex items-center gap-2 text-sm text-text-muted">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: TTF_TIER_COLORS[signalTier] }}
          />
          {confirmed
            ? TTF_TIER_LABELS[tier]
            : `Early signal — ${ttf.sample_size} visit${ttf.sample_size === 1 ? "" : "s"} logged`}
        </p>
      )}
    </>
  );
}
