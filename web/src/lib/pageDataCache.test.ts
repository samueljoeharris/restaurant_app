import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * profileCacheKey/invalidateProfile/syncProfileIdentity (#136) share the
 * cache Map from useCachedResource plus syncProfileIdentity's own
 * module-level "last known uid" — reset modules between tests for isolation.
 */
describe("pageDataCache — profile:me", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("profileCacheKey is a stable literal, not derived from the token", async () => {
    const { profileCacheKey } = await import("./pageDataCache");
    expect(profileCacheKey()).toBe("profile:me");
    expect(profileCacheKey()).toBe(profileCacheKey());
  });

  it("invalidateProfile drops a cached profile:me entry so the next read re-fetches", async () => {
    const { profileCacheKey, invalidateProfile } = await import("./pageDataCache");
    const { getCachedResource } = await import("../hooks/useCachedResource");
    const fetcher = vi.fn().mockResolvedValue({ display_name: "A" });

    await getCachedResource(profileCacheKey(), fetcher);
    await getCachedResource(profileCacheKey(), fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1); // second read was served from cache

    invalidateProfile();

    await getCachedResource(profileCacheKey(), fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2); // cache was dropped, so this re-fetched
  });

  it("does not invalidate on repeated syncProfileIdentity calls with the same uid", async () => {
    const { profileCacheKey, syncProfileIdentity } = await import("./pageDataCache");
    const { getCachedResource } = await import("../hooks/useCachedResource");
    const fetcher = vi.fn().mockResolvedValue({ display_name: "A" });

    syncProfileIdentity("uid-1");
    await getCachedResource(profileCacheKey(), fetcher);

    // Simulates re-renders of the same signed-in page — identity unchanged.
    syncProfileIdentity("uid-1");
    syncProfileIdentity("uid-1");
    await getCachedResource(profileCacheKey(), fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("invalidates when a different uid signs in (account switch)", async () => {
    const { profileCacheKey, syncProfileIdentity } = await import("./pageDataCache");
    const { getCachedResource } = await import("../hooks/useCachedResource");
    const fetcher = vi.fn().mockResolvedValue({ display_name: "A" });

    syncProfileIdentity("uid-1");
    await getCachedResource(profileCacheKey(), fetcher);

    syncProfileIdentity("uid-2");
    await getCachedResource(profileCacheKey(), fetcher);

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("invalidates on logout (uid -> null) and again on the next sign-in", async () => {
    const { profileCacheKey, syncProfileIdentity } = await import("./pageDataCache");
    const { getCachedResource } = await import("../hooks/useCachedResource");
    const fetcher = vi.fn().mockResolvedValue({ display_name: "A" });

    syncProfileIdentity("uid-1");
    await getCachedResource(profileCacheKey(), fetcher);

    syncProfileIdentity(null); // logout
    syncProfileIdentity("uid-2"); // a different user signs back in
    await getCachedResource(profileCacheKey(), fetcher);

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("does not invalidate on the very first observation of a session", async () => {
    const { profileCacheKey, syncProfileIdentity } = await import("./pageDataCache");
    const { getCachedResource } = await import("../hooks/useCachedResource");
    const fetcher = vi.fn().mockResolvedValue({ display_name: "A" });

    // Warm the cache before any page has called syncProfileIdentity yet.
    await getCachedResource(profileCacheKey(), fetcher);
    syncProfileIdentity("uid-1"); // first observation this session — must not clear the warm cache
    await getCachedResource(profileCacheKey(), fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
