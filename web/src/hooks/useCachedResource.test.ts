import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * getCachedResource (#136) shares the module-level cache/inflight Maps used
 * by useCachedResource/prefetchCachedResource/invalidateCachedResource.
 * Reset modules between tests so each test starts from an empty cache.
 */
describe("getCachedResource", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("fetches once and serves the cached value on a second call", async () => {
    const { getCachedResource } = await import("./useCachedResource");
    const fetcher = vi.fn().mockResolvedValue({ ok: true });

    const first = await getCachedResource("k1", fetcher);
    const second = await getCachedResource("k1", fetcher);

    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("dedupes concurrent calls for the same key into one fetch", async () => {
    const { getCachedResource } = await import("./useCachedResource");
    let resolveFetch: (v: { ok: boolean }) => void = () => {};
    const fetcher = vi.fn(
      () =>
        new Promise<{ ok: boolean }>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const p1 = getCachedResource("k2", fetcher);
    const p2 = getCachedResource("k2", fetcher);
    resolveFetch({ ok: true });

    await expect(p1).resolves.toEqual({ ok: true });
    await expect(p2).resolves.toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("propagates fetcher errors without caching them", async () => {
    const { getCachedResource } = await import("./useCachedResource");
    const fetcher = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce({ ok: true });

    await expect(getCachedResource("k3", fetcher)).rejects.toThrow("boom");
    // A failed fetch isn't cached, so the next call retries.
    await expect(getCachedResource("k3", fetcher)).resolves.toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("re-fetches after invalidateCachedResource drops the key", async () => {
    const { getCachedResource, invalidateCachedResource } = await import("./useCachedResource");
    const fetcher = vi.fn().mockResolvedValue({ ok: true });

    await getCachedResource("prefix:a", fetcher);
    invalidateCachedResource("prefix:");
    await getCachedResource("prefix:a", fetcher);

    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
