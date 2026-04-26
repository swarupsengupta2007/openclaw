/**
 * Network proxy module — public API surface.
 *
 * This module routes OpenClaw process HTTP traffic through an operator-managed
 * filtering forward proxy. The proxy must enforce destination filtering
 * at connect time; OpenClaw only owns process-wide routing into that proxy.
 *
 * Integration:
 *   1. Call startProxy(config?.proxy) early in daemon/CLI startup.
 *   2. The proxy injects HTTP_PROXY / HTTPS_PROXY env vars and resets the
 *      undici global dispatcher so subsequent HTTP traffic is routed through
 *      the configured proxy.
 *   3. On shutdown, call stopProxy(handle).
 *
 * Graceful degradation:
 *   If no external proxy URL is configured, startProxy() returns null and
 *   logs a warning. Application-level fetchWithSsrFGuard protections remain
 *   active as a defence-in-depth fallback.
 */

export { startProxy, stopProxy } from "./proxy-lifecycle.js";
export type { ProxyHandle } from "./proxy-lifecycle.js";

export { ProxyConfigSchema } from "./proxy-config-schema.js";
export type { ProxyConfig } from "./proxy-config-schema.js";
