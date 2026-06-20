import { useState } from "react";

import { api } from "../api/client";
import { useAuth } from "../auth/useAuth";
import { Button } from "./ui/Button";

export function ReportContentButton({
  contentType,
  contentId,
}: {
  contentType: "note" | "ttf_observation" | "attribute_rating";
  contentId: string;
}) {
  const { idToken } = useAuth();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function report() {
    if (!idToken || busy || done) return;
    const reason = window.prompt("Why are you reporting this content?", "policy_violation");
    if (!reason) return;
    setBusy(true);
    try {
      await api.submitContentReport(idToken, {
        content_type: contentType,
        content_id: contentId,
        reason,
      });
      setDone(true);
    } catch {
      window.alert("Could not submit report. Try again later.");
    } finally {
      setBusy(false);
    }
  }

  if (!idToken) return null;

  return (
    <Button type="button" variant="ghost" size="sm" disabled={busy || done} onClick={() => void report()}>
      {done ? "Reported" : busy ? "Reporting…" : "Report"}
    </Button>
  );
}
