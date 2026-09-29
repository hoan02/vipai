import "server-only";

import { BACKEND_URL } from "./http";
import { modelMeta, vendorLabel, vendorMarks, vendorUnknown, type Model } from "@/lib/data";

/**
 * The public model list, priced from the gateway.
 *
 * `GET /api/pricing` is a public route that reports exactly what a request
 * costs, and it carries the model's vendor too, so the marketing table and the
 * bill can never disagree. Everything priced comes from here; `lib/data.ts`
 * only supplies the presentation the endpoint does not carry (a prettier name,
 * the context window, the provider list price that the discount is measured
 * against).
 *
 * A model is shown when it has a real token price. new-api answers 37.5 for a
 * model with no configured ratio — its unset fallback, $75 / 1M — and bills a
 * per-call or expression-priced model some other way, so neither has a figure
 * that belongs in a per-1M column and both are skipped.
 */

type PricingRow = {
  model_name: string;
  vendor_id?: number;
  quota_type: number;
  model_ratio: number;
  completion_ratio?: number;
  cache_ratio?: number;
  model_price: number;
  enable_groups?: string[];
  supported_endpoint_types?: string[];
};

type VendorRow = { id: number; name: string; icon?: string };

type PricingBody = {
  data?: PricingRow[];
  vendors?: VendorRow[];
  group_ratio?: Record<string, number>;
};

/** new-api's ratio base: a model ratio of 1 costs $2 per 1M input tokens. */
const USD_PER_RATIO_POINT = 2;

/** new-api's ratio for a model whose price was never configured. */
const UNSET_MODEL_RATIO = 37.5;

function usd(value: number): string {
  const text = value >= 1 ? value.toFixed(2) : value.toFixed(4);
  return `$${text.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "")}`;
}

/** The discount against the provider's published price, as text and a number. */
function discount(listPrice: string | null, now: number): { text: string; pct: number } {
  if (!listPrice) return { text: "", pct: 0 };
  const list = Number.parseFloat(listPrice.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(list) || list <= 0 || now <= 0) return { text: "", pct: 0 };
  const pct = Math.round((1 - now / list) * 100);
  return pct > 0 ? { text: `${pct}% off`, pct } : { text: "", pct: 0 };
}

export async function getPublicModels(): Promise<Model[]> {
  let body: PricingBody = {};

  try {
    const response = await fetch(`${BACKEND_URL.replace(/\/$/, "")}/api/pricing`, {
      headers: { accept: "application/json" },
      next: { revalidate: 60 },
    });
    if (response.ok) {
      const parsed = (await response.json()) as unknown;
      if (Array.isArray(parsed)) body = { data: parsed as PricingRow[] };
      else if (parsed && typeof parsed === "object") body = parsed as PricingBody;
    }
  } catch {
    // Gateway briefly down: serve an empty catalogue rather than a stale price.
  }

  const rows = Array.isArray(body.data) ? body.data : [];
  const vendors = new Map<number, VendorRow>((body.vendors ?? []).map((row) => [row.id, row]));

  const models: Model[] = [];
  for (const row of rows) {
    // Token pricing only, and only when a real ratio is configured.
    if (row.quota_type !== 0 || row.model_price > 0) continue;
    if (!(row.model_ratio > 0) || row.model_ratio === UNSET_MODEL_RATIO) continue;

    const meta = modelMeta[row.model_name];
    const vendorName = (row.vendor_id !== undefined ? vendors.get(row.vendor_id)?.name : undefined) ?? "";
    const mark = vendorMarks[vendorName] ?? vendorUnknown;

    const input = row.model_ratio * USD_PER_RATIO_POINT;
    const output = input * (row.completion_ratio || 1);
    const cache = row.cache_ratio ? input * row.cache_ratio : null;
    const disc = discount(meta?.listIn ?? null, input);

    models.push({
      id: row.model_name,
      name: meta?.name ?? row.model_name,
      vendor: vendorLabel[vendorName] ?? vendorName,
      vendorIcon: mark.icon,
      vendorColor: mark.color,
      ctx: meta?.ctx ?? null,
      cache: cache === null ? "—" : usd(cache),
      listIn: meta?.listIn ?? null,
      listOut: meta?.listOut ?? null,
      inNow: usd(input),
      outNow: usd(output),
      disc: disc.text,
      discPct: disc.pct,
      endpoints: row.supported_endpoint_types ?? [],
      groups: row.enable_groups ?? [],
      featured: meta?.featured,
    });
  }

  // Featured first, then by vendor and name, so the order is stable and does
  // not shuffle every time a channel is edited.
  return models.sort(
    (a, b) =>
      Number(b.featured ?? false) - Number(a.featured ?? false) ||
      a.vendor.localeCompare(b.vendor) ||
      a.name.localeCompare(b.name),
  );
}
