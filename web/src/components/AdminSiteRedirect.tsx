import { useEffect } from "react";

import { ADMIN_APP_URL } from "../buildTarget";

/** Legacy app.dev/admin* bookmarks → operator console on admin.<env>. */
export function AdminSiteRedirect() {
  useEffect(() => {
    window.location.replace(ADMIN_APP_URL);
  }, []);

  return (
    <main className="page page--narrow">
      <p className="muted">Redirecting to the operator console…</p>
    </main>
  );
}
