import "server-only";

import {
  currentAccess,
  getOptions,
  getUser,
  persistSession,
  setOption,
  type GatewayUser,
} from "./gateway";

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
