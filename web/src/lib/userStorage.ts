const STORAGE_VERSION = 1;

export type ProfileCache = {
  version: number;
  kidsAges: number[];
  homeLabel: string | null;
  onboardingCompleted: boolean;
  inboxReadThrough: string | null;
};

export type PrefsCache = {
  version: number;
  cadence: "weekly" | "daily" | "realtime_bundle";
  quietHoursStart: string;
  quietHoursEnd: string;
  alertNewTtf: boolean;
  alertNewRating: boolean;
  alertNewNote: boolean;
  alertEveryReview: boolean;
  pushEnabled: boolean;
};

export type PushPrimeState = {
  firstSavePromptShown: boolean;
  osPromptDeferred: boolean;
};

const KEYS = {
  profile: "ls:profile:cache",
  prefs: "ls:prefs:cache",
  lastSeen: "ls:activity:lastSeenAt",
  stripDismissed: "ls:activity:stripDismissedAt",
  watchOptimistic: "ls:watch:optimistic",
  pushPrime: "ls:push:primeState",
  onboardingDraft: "ls:onboarding:draft",
  toastEvent: "ls:toast:lastEventId",
} as const;

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export const userStorage = {
  getProfileCache(): ProfileCache | null {
    return readJson<ProfileCache>(KEYS.profile);
  },
  setProfileCache(cache: Omit<ProfileCache, "version">) {
    writeJson(KEYS.profile, { version: STORAGE_VERSION, ...cache });
  },
  getPrefsCache(): PrefsCache | null {
    return readJson<PrefsCache>(KEYS.prefs);
  },
  setPrefsCache(cache: Omit<PrefsCache, "version">) {
    writeJson(KEYS.prefs, { version: STORAGE_VERSION, ...cache });
  },
  getLastSeenAt(): string | null {
    return localStorage.getItem(KEYS.lastSeen);
  },
  setLastSeenAt(iso: string) {
    localStorage.setItem(KEYS.lastSeen, iso);
  },
  getStripDismissedAt(): string | null {
    return localStorage.getItem(KEYS.stripDismissed);
  },
  setStripDismissedAt(iso: string) {
    localStorage.setItem(KEYS.stripDismissed, iso);
  },
  getWatchOptimistic(): Record<string, boolean> {
    return readJson<Record<string, boolean>>(KEYS.watchOptimistic) ?? {};
  },
  setWatchOptimistic(map: Record<string, boolean>) {
    writeJson(KEYS.watchOptimistic, map);
  },
  getPushPrimeState(): PushPrimeState {
    return readJson<PushPrimeState>(KEYS.pushPrime) ?? {
      firstSavePromptShown: false,
      osPromptDeferred: false,
    };
  },
  setPushPrimeState(state: PushPrimeState) {
    writeJson(KEYS.pushPrime, state);
  },
  getOnboardingDraft(): { kidsAges: number[] } | null {
    return readJson<{ kidsAges: number[] }>(KEYS.onboardingDraft);
  },
  setOnboardingDraft(draft: { kidsAges: number[] }) {
    writeJson(KEYS.onboardingDraft, draft);
  },
  clearOnboardingDraft() {
    localStorage.removeItem(KEYS.onboardingDraft);
  },
  getLastToastEventId(): string | null {
    return sessionStorage.getItem(KEYS.toastEvent);
  },
  setLastToastEventId(id: string) {
    sessionStorage.setItem(KEYS.toastEvent, id);
  },
};
