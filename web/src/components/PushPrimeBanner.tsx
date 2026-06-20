import { useState } from "react";

import { userStorage } from "../lib/userStorage";
import { Button } from "./ui/Button";

interface PushPrimeBannerProps {
  visible: boolean;
  onDismiss: () => void;
  onEnable: () => void;
}

export function PushPrimeBanner({ visible, onDismiss, onEnable }: PushPrimeBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (!visible || dismissed) return null;

  function handleDismiss() {
    const state = userStorage.getPushPrimeState();
    userStorage.setPushPrimeState({ ...state, osPromptDeferred: true });
    setDismissed(true);
    onDismiss();
  }

  return (
    <div className="mb-4 rounded-lg border border-brand/25 bg-brand-soft px-4 py-3 text-sm">
      <p className="m-0 font-semibold text-brand">Get a gentle weekly digest</p>
      <p className="mt-1 text-text-muted">
        We bundle updates from saved spots — never one ping per review. You can turn this off anytime.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={onEnable}>
          Enable notifications
        </Button>
        <Button size="sm" variant="ghost" onClick={handleDismiss}>
          Not now
        </Button>
      </div>
    </div>
  );
}
