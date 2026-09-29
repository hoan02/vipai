import "server-only";

import {
  currentAccess,
  getOptions,
  getUser,
  listAdminLogs,
  persistSession,
  setOption,
  QUOTA_PER_USD,
  type GatewayUser,
} from "./gateway";
import { invalidateModelMeta, META_OPTION, type ModelMeta } from "./model-meta";

/**
 * The admin surface.
 *
 * The gateway splits its management API in two: channels need `AdminAuth`
 * (role ≥ 10) and options need `RootAuth` (role 100). This app can only offer
 * the pricing controls it wants from the root account, so the whole page is
 * gated on root and says so rather than failing halfway.
 */
export const ROOT_ROLE = 100;

export async function requireRoot(): Promise<{ token: string; user: GatewayUser }> {
  const access = await currentAccess();
  if (!access) throw new Error("Not signed in");

  const user = await getUser(access.token);
  if (user.role < ROOT_ROLE) throw new Error("Root access required");

  if (access.renewed) {
    try {
      await persistSession(access.renewed);
    } catch {
      // Outside a route handler; the token is still valid for this request.
    }
  }

  return { token: access.token, user };
}

/** new-api's ratio base: a model ratio of 1 costs $2 per 1M input tokens. */
const USD_PER_RATIO_POINT = 2;

/**
 * How a model is billed.
 *
 * Token models carry per-1M prices; image models carry a per-call price and no
 * token price. A model may have either, and the page renders both.
 */
export type ModelPrice = {
  id: string;
  /** USD per 1M input tokens. Zero when the model is billed per call. */
  input: number;
  output: number;
  /** USD per 1M cache-read tokens, or null when unset. */
  cache: number | null;
  /** USD per call, or null when the model is billed per token. */
  perCall: number | null;
};

function numberMap(raw: string | undefined): Record<string, number> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

const round = (value: number) => Math.round(value * 1e10) / 1e10;

/**
 * The retail price of every model that has one, token or per-call.
 *
 * The ratio maps hold ratios, not dollars. Input is `ratio × 2`; output
 * multiplies input by the completion ratio; cache read multiplies input by the
 * cache ratio. `ModelPrice` is already in dollars per call.
 */
export async function getModelPrices(accessToken: string): Promise<Map<string, ModelPrice>> {
  const options = await getOptions(accessToken);
  const ratios = numberMap(options.get("ModelRatio"));
  const completions = numberMap(options.get("CompletionRatio"));
  const caches = numberMap(options.get("CacheRatio"));
  const perCall = numberMap(options.get("ModelPrice"));

  const prices = new Map<string, ModelPrice>();

  for (const [id, ratio] of Object.entries(ratios)) {
    const input = ratio * USD_PER_RATIO_POINT;
    const cache = caches[id];
    prices.set(id, {
      id,
      input: round(input),
      output: round(input * (completions[id] ?? 1)),
      cache: cache === undefined ? null : round(input * cache),
      perCall: perCall[id] ?? null,
    });
  }

  for (const [id, price] of Object.entries(perCall)) {
    if (!prices.has(id)) {
      prices.set(id, { id, input: 0, output: 0, cache: null, perCall: price });
    }
  }

  return prices;
}

/**
 * Writes prices back as ratios and a per-call map.
 *
 * Every map is read first and merged, so a save only changes the models it was
 * given and never drops an unrelated model or one of new-api's built-in
 * defaults. A token model needs a positive input and output price; a per-call
 * model needs a positive per-call price. Anything else is left untouched.
 */
export async function setModelPrices(
  accessToken: string,
  entries: ModelPrice[],
): Promise<void> {
  const options = await getOptions(accessToken);
  const ratios = numberMap(options.get("ModelRatio"));
  const completions = numberMap(options.get("CompletionRatio"));
  const caches = numberMap(options.get("CacheRatio"));
  const perCall = numberMap(options.get("ModelPrice"));

  for (const entry of entries) {
    if (entry.perCall !== null && entry.perCall > 0) {
      perCall[entry.id] = round(entry.perCall);
    }
    if (entry.input > 0 && entry.output > 0) {
      ratios[entry.id] = round(entry.input / USD_PER_RATIO_POINT);
      completions[entry.id] = round(entry.output / entry.input);
      if (entry.cache !== null && entry.cache >= 0) {
        caches[entry.id] = round(entry.cache / entry.input);
      }
    }
  }

  await setOption(accessToken, "ModelRatio", JSON.stringify(ratios));
  await setOption(accessToken, "CompletionRatio", JSON.stringify(completions));
  await setOption(accessToken, "CacheRatio", JSON.stringify(caches));
  await setOption(accessToken, "ModelPrice", JSON.stringify(perCall));
}

/**
 * Cost and margin, per model.
 *
 * new-api knows what a customer pays, never what we pay, so the upstream cost
 * lives in our own option (`vipai.cost`). `margin` is a fraction: 0.2 means
 * the retail price is 20% above cost. The gateway ignores this key; only the
 * admin page reads and writes it.
 */
export type MarginConfig = {
  id: string;
  /** Upstream cost, USD per 1M input tokens. */
  in: number;
  /** Upstream cost, USD per 1M output tokens. */
  out: number;
  /** Markup over cost, as a fraction (0.2 = +20%). */
  margin: number;
  /** Display name for the pricing table. */
  name: string;
  /** Context window, e.g. "1M". */
  ctx: string;
  /** Shown in the featured cards at the top of the pricing table. */
  featured: boolean;
  /** Provider list price, USD per 1M input tokens — the discount baseline. */
  listIn: number;
  /** Provider list price, USD per 1M output tokens. */
  listOut: number;
};

const COST_OPTION = "vipai.cost";

type CostMap = Record<string, { in: number; out: number; margin: number }>;

function costMap(raw: string | undefined): CostMap {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, { in?: unknown; out?: unknown; margin?: unknown }>;
    const out: CostMap = {};
    for (const [id, value] of Object.entries(parsed)) {
      out[id] = {
        in: Number(value?.in) || 0,
        out: Number(value?.out) || 0,
        margin: Number(value?.margin) || 0,
      };
    }
    return out;
  } catch {
    return {};
  }
}

type MetaMap = Record<string, ModelMeta>;

/** The `vipai.meta` map: display name, context, featured flag and list price. */
function metaMap(raw: string | undefined): MetaMap {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as MetaMap;
    const out: MetaMap = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (value && typeof value === "object") out[id] = value;
    }
    return out;
  } catch {
    return {};
  }
}

export async function getMarginConfigs(accessToken: string): Promise<Map<string, MarginConfig>> {
  const options = await getOptions(accessToken);
  const costs = costMap(options.get(COST_OPTION));
  const metas = metaMap(options.get(META_OPTION));
  const map = new Map<string, MarginConfig>();
  for (const id of new Set([...Object.keys(costs), ...Object.keys(metas)])) {
    const cost = costs[id] ?? { in: 0, out: 0, margin: 0 };
    const meta = metas[id] ?? {};
    map.set(id, {
      id,
      ...cost,
      name: meta.name ?? "",
      ctx: meta.ctx ?? "",
      featured: meta.featured === true,
      listIn: meta.listIn ?? 0,
      listOut: meta.listOut ?? 0,
    });
  }
  return map;
}

/**
 * Saves per-model cost, margin and presentation, and optionally reprices.
 *
 * Cost and margin land in `vipai.cost`; the name, context window, featured flag
 * and provider list price land in `vipai.meta`, which is what the public table
 * reads (see model-meta.ts). With `apply`, retail is set to `cost × (1 + margin)`
 * through the same ratio path as the pricing tab, so the public table and the
 * bill both follow.
 */
export async function setMarginConfigs(
  accessToken: string,
  entries: MarginConfig[],
  apply: boolean,
): Promise<void> {
  const options = await getOptions(accessToken);
  const costs = costMap(options.get(COST_OPTION));
  const metas = metaMap(options.get(META_OPTION));

  for (const entry of entries) {
    costs[entry.id] = { in: entry.in, out: entry.out, margin: entry.margin };
    const meta: ModelMeta = metas[entry.id] ?? {};
    meta.name = entry.name || undefined;
    meta.ctx = entry.ctx || undefined;
    meta.featured = entry.featured || undefined;
    meta.listIn = entry.listIn > 0 ? entry.listIn : undefined;
    meta.listOut = entry.listOut > 0 ? entry.listOut : undefined;
    metas[entry.id] = meta;
  }

  await setOption(accessToken, COST_OPTION, JSON.stringify(costs));
  await setOption(accessToken, META_OPTION, JSON.stringify(metas));
  invalidateModelMeta();

  if (apply) {
    const prices: ModelPrice[] = entries
      .filter((entry) => entry.in > 0 && entry.out > 0)
      .map((entry) => ({
        id: entry.id,
        input: round(entry.in * (1 + entry.margin)),
        output: round(entry.out * (1 + entry.margin)),
        cache: null,
        perCall: null,
      }));
    if (prices.length > 0) await setModelPrices(accessToken, prices);
  }
}

/** Per-model totals over the sampled usage window. */
export type ModelStat = {
  id: string;
  requests: number;
  tokensIn: number;
  tokensOut: number;
  revenueUsd: number;
  /** Null when this model has no cost configured. */
  costUsd: number | null;
  marginUsd: number | null;
};

export type AdminStats = {
  requests: number;
  tokensIn: number;
  tokensOut: number;
  revenueUsd: number;
  costUsd: number;
  marginUsd: number;
  /** True when every model in the sample has a cost, so the totals are exact. */
  costComplete: boolean;
  /** Rows aggregated, and the gateway's total row count. */
  sampled: number;
  total: number;
  byModel: ModelStat[];
};

/**
 * Revenue, cost and margin over recent usage.
 *
 * Revenue is the gateway's own charge (`quota / 500000`). Cost is token counts
 * times the upstream price from `vipai.cost`. Both are computed over the most
 * recent page of logs, which is enough for a live picture; `sampled` and
 * `total` say how complete the window is.
 */
export async function getAdminStats(accessToken: string, pageSize = 1000): Promise<AdminStats> {
  const [{ items, total }, costs] = await Promise.all([
    listAdminLogs(accessToken, pageSize),
    getMarginConfigs(accessToken),
  ]);

  const byModel = new Map<string, ModelStat>();
  let requests = 0;
  let tokensIn = 0;
  let tokensOut = 0;
  let revenueUsd = 0;
  let costUsd = 0;
  let costComplete = true;

  for (const log of items) {
    const id = log.model_name || "unknown";
    const rowIn = log.prompt_tokens ?? 0;
    const rowOut = log.completion_tokens ?? 0;
    const revenue = (log.quota ?? 0) / QUOTA_PER_USD;
    const cost = costs.get(id);
    const rowCost =
      cost && cost.in > 0 && cost.out > 0
        ? (rowIn * cost.in + rowOut * cost.out) / 1e6
        : null;

    const stat =
      byModel.get(id) ??
      { id, requests: 0, tokensIn: 0, tokensOut: 0, revenueUsd: 0, costUsd: 0 as number | null, marginUsd: 0 as number | null };

    stat.requests += 1;
    stat.tokensIn += rowIn;
    stat.tokensOut += rowOut;
    stat.revenueUsd += revenue;
    if (rowCost === null) {
      stat.costUsd = null;
      stat.marginUsd = null;
    } else if (stat.costUsd !== null) {
      stat.costUsd += rowCost;
      stat.marginUsd = (stat.marginUsd ?? 0) + (revenue - rowCost);
    }
    byModel.set(id, stat);

    requests += 1;
    tokensIn += rowIn;
    tokensOut += rowOut;
    revenueUsd += revenue;
    if (rowCost === null) costComplete = false;
    else costUsd += rowCost;
  }

  const list = [...byModel.values()].sort((a, b) => b.revenueUsd - a.revenueUsd);

  return {
    requests,
    tokensIn,
    tokensOut,
    revenueUsd,
    costUsd,
    marginUsd: revenueUsd - costUsd,
    costComplete,
    sampled: items.length,
    total,
    byModel: list,
  };
}
