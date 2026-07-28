import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Start without an R2 incremental cache. It can be enabled after the first production
// deployment without changing the public URL.
export default defineCloudflareConfig({});
