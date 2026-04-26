/**
 * Re-export of the proxy Zod schema for use in the main config schema.
 * The canonical definition lives in infra/net/proxy to keep it co-located
 * with the implementation, but the config schema imports it from here to keep
 * the config layer dependency graph clean.
 */
export { ProxyConfigSchema } from "../infra/net/proxy/proxy-config-schema.js";
export type { ProxyConfig } from "../infra/net/proxy/proxy-config-schema.js";
