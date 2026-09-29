import "server-only";

import { getOptions } from "./gateway";

/**
 * Per-model presentation metadata, held in the gateway.
 *
 * The gateway is the only source for what the site shows: its public
 * `/api/pricing` supplies the models and what they cost, and this option,
 * `vipai.meta`, supplies the display name, the context window, whether a model
 * is featured, and the provider list price the discount is measured against —
 * none of which the pricing endpoint carries. Reading an option needs root, so
 * this uses a personal access token from the environment rather than a
 * visitor's session; until the option is written a model shows under its own id,
 * with no discount and not featured.
 */

export const META_OPTION = "vipai.meta";

export type ModelMeta = {
  name?: string;
  ctx?: string;
  featured?: boolean;
  /** Provider list price, USD per 1M input tokens — the discount baseline. */
  listIn?: number;
  /** Provider list price, USD per 1M output tokens. */
  listOut?: number;
};

type Cache = { at: number; ttl: number; value: Map<string, ModelMeta> };

let cache: Cache | null = null;

/** A load that worked is trusted for minutes; one that failed is retried sooner. */
const OK_TTL_MS = 5 * 60 * 1000;
const RETRY_TTL_MS = 60 * 1000;

/** Parses the `vipai.meta` option: `{ "<model>": { name, ctx, featured, in, out } }`. */
function parse(raw: string | undefined): Map<string, ModelMeta> {
  const map = new Map<string, ModelMeta>();
  if (!raw) return map;
  try {
    const parsed = JSON.parse(raw) as Record<string, Record<string, unknown>>;
    for (const [id, value] of Object.entries(parsed)) {
      if (!value || typeof value !== "object") continue;
      const entry: ModelMeta = {};
      if (typeof value.name === "string" && value.name.trim()) entry.name = value.name.trim();
      if (typeof value.ctx === "string" && value.ctx.trim()) entry.ctx = value.ctx.trim();
      if (value.featured === true) entry.featured = true;
      const listIn = Number(value.in);
      const listOut = Number(value.out);
      if (Number.isFinite(listIn) && listIn > 0) entry.listIn = listIn;
      if (Number.isFinite(listOut) && listOut > 0) entry.listOut = listOut;
      map.set(id, entry);
    }
  } catch {
    // A malformed option reads as no metadata rather than crashing the page.
  }
  return map;
}

/**
 * The gateway's per-model metadata. Memoised in-process, since the page is
 * rendered on demand and every render would otherwise read the whole option map.
 */
export async function getModelMeta(): Promise<Map<string, ModelMeta>> {
  const now = Date.now();
  if (cache && now - cache.at < cache.ttl) return cache.value;

  const token = process.env.NEW_API_SERVICE_TOKEN;
  if (!token) {
    const value = new Map<string, ModelMeta>();
    cache = { at: now, ttl: OK_TTL_MS, value };
    return value;
  }

  try {
    const options = await getOptions(token);
    const value = parse(options.get(META_OPTION));
    cache = { at: now, ttl: OK_TTL_MS, value };
    return value;
  } catch {
    // Gateway down or the token rejected: keep the last good set, retry sooner.
    const value = cache?.value ?? new Map<string, ModelMeta>();
    cache = { at: now, ttl: RETRY_TTL_MS, value };
    return value;
  }
}

/** Drops the memo after the admin writes a new option. */
export function invalidateModelMeta(): void {
  cache = null;
}
