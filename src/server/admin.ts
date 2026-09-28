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

/** USD per 1M tokens, as the admin page shows and edits. */
export type ModelPrice = {
  id: string;
  input: number;
  output: number;
  /** Null when the model has no cache rate configured. */
  cache: number | null;
};

function ratioMap(raw: string | undefined): Record<string, number> {
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
 * The retail price of every model that currently has a ratio.
 *
 * The three option maps hold ratios, not dollars. Input is `ratio × 2`;
 * output multiplies input by the completion ratio; cache read multiplies
 * input by the cache ratio. Models with no ratio are simply absent.
 */
export async function getModelPrices(accessToken: string): Promise<Map<string, ModelPrice>> {
  const options = await getOptions(accessToken);
  const ratios = ratioMap(options.get("ModelRatio"));
  const completions = ratioMap(options.get("CompletionRatio"));
  const caches = ratioMap(options.get("CacheRatio"));

  const prices = new Map<string, ModelPrice>();
  for (const [id, ratio] of Object.entries(ratios)) {
    const input = ratio * USD_PER_RATIO_POINT;
    const completion = completions[id] ?? 1;
    const cache = caches[id];
    prices.set(id, {
      id,
      input: round(input),
      output: round(input * completion),
      cache: cache === undefined ? null : round(input * cache),
    });
  }
  return prices;
}

/**
 * Writes prices back as ratios.
 *
 * The three maps are read first and merged, so a save only changes the models
 * it was given and never drops an unrelated model or one of new-api's built-in
 * defaults.
 */
export async function setModelPrices(
  accessToken: string,
  entries: ModelPrice[],
): Promise<void> {
  const options = await getOptions(accessToken);
  const ratios = ratioMap(options.get("ModelRatio"));
  const completions = ratioMap(options.get("CompletionRatio"));
  const caches = ratioMap(options.get("CacheRatio"));

  for (const entry of entries) {
    if (!(entry.input > 0)) {
      // A zero or missing input price would make the model unusable, so it is
      // treated as "leave alone" rather than written.
      continue;
    }
    ratios[entry.id] = round(entry.input / USD_PER_RATIO_POINT);
    if (entry.output > 0) {
      completions[entry.id] = round(entry.output / entry.input);
    }
    if (entry.cache !== null && entry.cache >= 0) {
      caches[entry.id] = round(entry.cache / entry.input);
    }
  }

  await setOption(accessToken, "ModelRatio", JSON.stringify(ratios));
  await setOption(accessToken, "CompletionRatio", JSON.stringify(completions));
  await setOption(accessToken, "CacheRatio", JSON.stringify(caches));
}
