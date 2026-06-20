import { Button } from "../ui/Button";

export function ModerationActions({
  busy,
  onApprove,
  onReject,
  onEscalate,
}: {
  busy?: boolean;
  onApprove: () => void;
  onReject: () => void;
  onEscalate: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" disabled={busy} onClick={onApprove}>
        Approve
      </Button>
      <Button type="button" variant="ghost" disabled={busy} onClick={onEscalate}>
        Escalate
      </Button>
      <Button type="button" variant="danger" disabled={busy} onClick={onReject}>
        Reject
      </Button>
    </div>
  );
}
