import "server-only";

import { BACKEND_URL } from "./http";
import { models, type Model } from "@/lib/data";

/**
 * The public model list, priced from the gateway.
 *
 * `GET /api/pricing` is a public route that reports exactly what a request
 * costs, so the marketing table and the bill can never disagree. It is fetched
 * server-side and cached; at build time the gateway is not reachable, so the
 * static sheet in `data.ts` is the fallback until the first revalidation.
 *
 * `models` still supplies the presentation fields the gateway does not carry
 * (vendor, context window, provider list price). Only input, output and the
 * discount are overlaid. Cache pricing is not in `/api/pricing`, so the sheet's
 * cache figure is left as-is.
 */

type PricingRow = {
  model_name: string;
  quota_type: number;
  model_ratio: number;
  completion_ratio: number;
  model_price: number;
  enable_groups?: string[];
};

/** A model ratio of 1 costs $2 per 1M input tokens. */
const USD_PER_RATIO_POINT = 2;

function usd(value: number): string {
  const text = value >= 1 ? value.toFixed(2) : value.toFixed(4);
  return `$${text.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "")}`;
}

function discount(listPrice: string, now: number): string {
  const list = Number.parseFloat(listPrice.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(list) || list <= 0 || now <= 0) return "";
  const percent = Math.round((1 - now / list) * 100);
  return percent > 0 ? `${percent}% off` : "";
}

export async function getPublicModels(): Promise<Model[]> {
  let rows: PricingRow[] = [];

  try {
    const response = await fetch(`${BACKEND_URL.replace(/\/$/, "")}/api/pricing`, {
      headers: { accept: "application/json" },
      next: { revalidate: 60 },
    });
    if (response.ok) {
      const body = (await response.json()) as { data?: unknown } | unknown[];
      const data = Array.isArray(body) ? body : (body as { data?: unknown }).data;
      if (Array.isArray(data)) rows = data as PricingRow[];
    }
  } catch {
    // Build time, or the gateway is briefly down: keep the static sheet.
  }

  const byId = new Map(rows.map((row) => [row.model_name, row]));

  return models.map((model) => {
    const row = byId.get(model.id);
    // quota_type 0 is token pricing; anything else (per call) has no ratio.
    if (!row || row.quota_type !== 0 || !(row.model_ratio > 0)) return model;

    const input = row.model_ratio * USD_PER_RATIO_POINT;
    const output = input * (row.completion_ratio || 1);

    return {
      ...model,
      inNow: usd(input),
      outNow: usd(output),
      disc: discount(model.listIn, input),
    };
  });
}
