/**
 * Vendor marks, plus the copy and code samples the marketing pages use.
 *
 * The model catalogue is not here: the gateway supplies every row, every price
 * and all per-model presentation (see `src/server/pricing.ts` and
 * `src/server/model-meta.ts`). This file holds only what is static — the sprite
 * mark and brand colour per vendor, whose names come from the gateway.
 */

/** new-api vendor name -> the sprite mark and brand colour. */
export const vendorMarks: Record<string, { icon: string; color: string }> = {
  OpenAI: { icon: "ic-openai", color: "var(--p-gpt)" },
  Anthropic: { icon: "ic-claude", color: "#d97757" },
  Google: { icon: "ic-gemini", color: "#4285f4" },
  DeepSeek: { icon: "ic-deepseek", color: "#4d6bfe" },
  "智谱": { icon: "ic-glm", color: "#7a52c7" },
  xAI: { icon: "ic-xai", color: "var(--ink)" },
  Moonshot: { icon: "ic-moonshot", color: "var(--ink)" },
};

/** The VipAI brand mark. Rendered through `Icon` (which turns a URL into an
 *  <img>), and the fallback for a vendor the sheet has no logo for. */
export const brandMark = "/assets/logo.webp";

/** Fallback mark for a vendor the sheet has no logo for. */
export const vendorUnknown = { icon: brandMark, color: "#6b7280" };

/** The gateway names one vendor in its own language; the site brands it. */
export const vendorLabel: Record<string, string> = { "智谱": "GLM" };

/** One model as the pricing table needs it, priced from the gateway. */
export type Model = {
  /** new-api model id, as it appears in /api/pricing and in a request body. */
  id: string;
  /** Display name; the id itself when the sheet has no prettier one. */
  name: string;
  vendor: string;
  vendorIcon: string;
  vendorColor: string;
  /** Context window, or null when the sheet does not know it. */
  ctx: string | null;
  /** VipAI cache-read price per 1M tokens, or "—" when unset. */
  cache: string;
  /** Provider list price per 1M tokens, or null when unknown. */
  listIn: string | null;
  listOut: string | null;
  /** What VipAI charges per 1M tokens. */
  inNow: string;
  outNow: string;
  /** The discount as a positive whole percent, 0 when none. Formatted for the
   *  reader by the UI — see `common.discountOff` — rather than stored as a
   *  string, which would have made it English-only. */
  discPct: number;
  /** new-api endpoint types the model answers on. */
  endpoints: string[];
  /** Groups the model is enabled in. */
  groups: string[];
  featured?: boolean;
};

/** The pricing table and the live-discount list spell some models slightly
 *  differently ("Gemini 3.1 Pro (Preview)" vs "Gemini 3.1 Pro Preview"), so
 *  cross-section jumps match on a punctuation-free key. */
export function modelKey(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * A URL-safe slug for a model id: `kimi-k3[1M]` -> `kimi-k3-1m`.
 *
 * The id cannot be used raw in a path (it can carry brackets), and it must be
 * reversible without guessing, so `/models/[slug]` resolves a model by matching
 * this function against every id rather than decoding the URL.
 */
export function modelSlug(id: string): string {
  return id
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The model whose slug matches, or undefined. See `modelSlug`. */
export function modelBySlug<T extends { id: string }>(models: T[], slug: string): T | undefined {
  return models.find((m) => modelSlug(m.id) === slug);
}

/** Fired by the pricing table so the live section can select the same model. */
export const PICK_MODEL_EVENT = "vipai:pick-model";
export type PickModelDetail = { key: string; vendor: string };

/**
 * Leaderboard rows.
 *
 * Names are products and models, so they stay as written; the figures are raw,
 * and the units around them ("requests", "success", "tokens") are translated at
 * render. Embedding the unit in the string here would have made it translatable
 * only by duplicating the number in every locale.
 */
export type RankRow = {
  n: string;
  tok: string;
  delta: string;
  /** Requests handled this week — agents only. */
  requests?: string;
  /** Time to first token, in ms, and success rate, in percent — models only. */
  ttft?: string;
  success?: string;
};

export const agents: RankRow[] = [
  { n: "Codex Desktop", requests: "9817.1K", tok: "1170.1B", delta: "↗ 30.2%" },
  { n: "Claude CLI", requests: "1793.1K", tok: "268.2B", delta: "↗ 75.1%" },
  { n: "VSCode", requests: "863.8K", tok: "107.4B", delta: "↗ 45.4%" },
  { n: "Claude Desktop", requests: "517.5K", tok: "56.9B", delta: "↗ 104.3%" },
  { n: "OpenClaw", requests: "189.1K", tok: "19.9B", delta: "↗ 151.2%" },
];

export const topModels: RankRow[] = [
  { n: "GPT-5.6 Sol", ttft: "1908", success: "99.46", tok: "1068.3B", delta: "↗ 31.8%" },
  { n: "GPT-5.6 Terra", ttft: "2133", success: "98.56", tok: "251.6B", delta: "↗ 99.5%" },
  { n: "GPT-5.5", ttft: "1562", success: "98.70", tok: "136.8B", delta: "↘ 19.3%" },
  { n: "Claude Opus 4.8", ttft: "2371", success: "99.35", tok: "109.1B", delta: "↗ 122.6%" },
  { n: "GPT-5.6 Luna", ttft: "2074", success: "98.93", tok: "97.7B", delta: "↗ 57.6%" },
];

export type CodeSnippet = { file: string; model: string; code: string };

export const codeSnippets: Record<string, CodeSnippet> = {
  python: {
    file: "main.py",
    model: "GPT-5.6 Sol",
    code: `from openai import OpenAI

client = OpenAI(
    base_url="https://api.vipai.site/v1",
    api_key="YOUR_API_KEY",
)

stream = client.chat.completions.create(
    model="gpt-5.6-sol",
    messages=[{"role": "user", "content": "Ship it."}],
    stream=True,
)
for chunk in stream:
    # the rest of your code stays the same
    print(chunk.choices[0].delta.content or "", end="")`,
  },
  typescript: {
    file: "main.ts",
    model: "GPT-5.6 Sol",
    code: `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://api.vipai.site/v1",
  apiKey: "YOUR_API_KEY",
});

const stream = await client.chat.completions.create({
  model: "gpt-5.6-sol",
  messages: [{ role: "user", content: "Ship it." }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0].delta.content ?? "");
}`,
  },
  curl: {
    file: "request.sh",
    model: "GPT-5.6 Sol",
    code: `curl https://api.vipai.site/v1/chat/completions \\
  -H "Authorization: Bearer $VIPAI_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '
  {
    "model": "gpt-5.6-sol",
    "messages": [{ "role": "user", "content": "Ship it." }]
  }'`,
  },
  go: {
    file: "main.go",
    model: "GPT-5.6 Sol",
    code: `package main

import (
    "context"
    "fmt"
    openai "github.com/openai/openai-go"
)

func main() {
    client := openai.NewClient("YOUR_API_KEY")
    client.BaseURL = "https://api.vipai.site/v1"
    // the rest of your code stays the same
    fmt.Println("ready")
}`,
  },
  java: {
    file: "Main.java",
    model: "GPT-5.6 Sol",
    code: `import com.openai.client.OpenAIClient;
import com.openai.client.okhttp.OpenAIOkHttpClient;

public class Main {
  public static void main(String[] args) {
    OpenAIClient client = OpenAIOkHttpClient.builder()
        .baseUrl("https://api.vipai.site/v1")
        .apiKey("YOUR_API_KEY")
        .build();
    // the rest of your code stays the same
    System.out.println("ready");
  }
}`,
  },
  rust: {
    file: "main.rs",
    model: "GPT-5.6 Sol",
    code: `use async_openai::{Client, config::OpenAIConfig};

#[tokio::main]
async fn main() {
    let config = OpenAIConfig::new()
        .with_api_base("https://api.vipai.site/v1")
        .with_api_key("YOUR_API_KEY");
    let _client = Client::with_config(config);
    // the rest of your code stays the same
    println!("ready");
}`,
  },
  php: {
    file: "main.php",
    model: "GPT-5.6 Sol",
    code: `<?php
// the rest of your code stays the same
$client = OpenAI::client("YOUR_API_KEY");
$client->baseUri = "https://api.vipai.site/v1";

echo "ready";`,
  },
  ruby: {
    file: "main.rb",
    model: "GPT-5.6 Sol",
    code: `require "openai"

client = OpenAI::Client.new(
  access_token: "YOUR_API_KEY",
  uri_base: "https://api.vipai.site/v1",
)

# the rest of your code stays the same
puts "ready"`,
  },
};

export const quickstartLangs = ["python", "typescript", "curl", "go", "java", "rust", "php", "ruby"] as const;

export const quickstartTabs = [
  { id: "api", label: "API" },
  { id: "codex", label: "Codex Desktop" },
  { id: "claude", label: "Claude Desktop" },
  { id: "cli", label: "CLI" },
  { id: "other", label: "Other" },
];

export const quickstartSubs = [
  { id: "claude-code", label: "Claude Code" },
  { id: "codex-cli", label: "Codex CLI" },
];

export const protocols = [
  { id: "openai", path: "/v1", label: "OpenAI API" },
  { id: "anthropic", path: "", label: "Anthropic API" },
  { id: "gemini", path: "", label: "Gemini API" },
  { id: "typesafe", path: "", label: "TypeSafe (Jev)" },
];

export const languages = [
  { id: "en", label: "English" },
  { id: "vi", label: "Tiếng Việt" },
];

/* The FAQ list moved to `src/lib/faq.ts` + `messages/<locale>.json`: its text is
   content, so it lives with the other translations and feeds both the rendered
   accordion and the FAQPage structured data. */

export const topupAmounts = [
  { amt: 10, key: "amountStarter" },
  { amt: 20, key: "amountBasic" },
  { amt: 50, key: "amountPopular" },
  { amt: 200, key: "amountPro" },
] as const;

