import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache";
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";
import kvTagCache from "@opennextjs/cloudflare/overrides/tag-cache/kv-next-tag-cache";
import memoryQueue from "@opennextjs/cloudflare/overrides/queue/memory-queue";
import queueCache from "@opennextjs/cloudflare/overrides/queue/queue-cache";

/**
 * Without an incremental cache, `export const revalidate` is inert.
 *
 * This file used to be `defineCloudflareConfig({})`, which leaves every override on
 * `"dummy"` — and the dummy incremental cache does not merely skip caching, it throws
 * `IgnorableError` from `get` and `set`. So every ISR route answered
 * `x-nextjs-cache: MISS` and re-rendered from scratch on every request, including the ~50
 * routes the build had already prerendered. `/[locale]/sitemap` (1.4 MB of HTML) and
 * `/sitemap.xml` (3.2 MB) each replayed ~30 sequential API reads — the guard caps a single
 * read at 100 rows — and built the whole payload in the isolate. Twelve concurrent
 * requests for `/en/sitemap` against production returned six
 * `1102 Worker exceeded resource limits`, and the failures were not confined to the heavy
 * URL: requests for `/en` sharing the isolate went down with it. (1102 covers both the
 * memory and the CPU ceiling; which one was hit was never established, and it does not
 * change the fix.)
 *
 * R2 is not enabled on the account, so KV is the durable store. `withRegionalCache` puts
 * the Cache API in front of it per data centre, and cache interception serves a cached ISR
 * response before the Next.js server is even constructed, which is where the CPU actually
 * goes. The tag cache is KV too, so `revalidatePath` from `app/admin/revalidate/route.ts`
 * still reaches published pages.
 *
 * The queue matters for the same reason, and fails more quietly. Now that entries are
 * really cached, something has to regenerate them when they go stale — and `"dummy"`
 * throws `FatalError` from `send`. Both call sites catch it (`routing/util.ts` logs
 * "Failed to revalidate stale page"; the interceptor falls through to the server), so
 * nothing 500s: ISR just stops regenerating, and every request after the hour is up pays
 * a full render again. `memoryQueue` re-requests the route through the
 * `WORKER_SELF_REFERENCE` binding already declared in `wrangler.jsonc`; `queueCache` wraps
 * it so a burst of stale hits in one region collapses into one revalidation.
 *
 * `enableCacheInterception` must go back to `false` if PPR is ever turned on in
 * `next.config.ts`.
 */
export default defineCloudflareConfig({
  incrementalCache: withRegionalCache(kvIncrementalCache, { mode: "long-lived" }),
  tagCache: kvTagCache,
  queue: queueCache(memoryQueue),
  enableCacheInterception: true,
});
