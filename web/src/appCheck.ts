import type { FirebaseApp } from "firebase/app";
import {
  type AppCheck,
  getToken,
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from "firebase/app-check";

const siteKey = import.meta.env.VITE_APP_CHECK_RECAPTCHA_SITE_KEY?.trim();
const enabled = import.meta.env.VITE_APP_CHECK_ENABLED !== "false";

export let appCheck: AppCheck | null = null;

export function initAppCheck(app: FirebaseApp): void {
  if (!siteKey || !enabled) return;
  appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

export async function getAppCheckToken(): Promise<string | null> {
  if (!appCheck) return null;
  try {
    const result = await getToken(appCheck, false);
    return result.token;
  } catch {
    return null;
  }
}
