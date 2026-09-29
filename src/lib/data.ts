/**
 * Presentation metadata for the gateway's model catalogue.
 *
 * The model list and every price come from the gateway's public `/api/pricing`
 * (see `src/server/pricing.ts`). This file only holds what that endpoint does
 * not carry: the vendor mark, a marketing display name, the context window and
 * the provider's published list price, which is what the discount is measured
 * against. A model the gateway serves but this sheet does not know still shows
 * up, under its own id and with no discount.
 */

/** new-api vendor name -> the sprite mark and brand colour. */
export const vendorMarks: Record<string, { icon: string; color: string }> = {
  OpenAI: { icon: "ic-openai", color: "#0b0a08" },
  Anthropic: { icon: "ic-claude", color: "#d97757" },
  Google: { icon: "ic-gemini", color: "#4285f4" },
  DeepSeek: { icon: "ic-deepseek", color: "#4d6bfe" },
  "智谱": { icon: "ic-glm", color: "#7a52c7" },
};

/** Fallback mark for a vendor the sheet has no logo for. */
export const vendorUnknown = { icon: "ic-vipai", color: "#6b7280" };

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
  /** "90% off", or "" when there is no list price to compare against. */
  disc: string;
  /** The discount as a positive whole percent, 0 when none. */
  discPct: number;
  /** new-api endpoint types the model answers on. */
  endpoints: string[];
  /** Groups the model is enabled in. */
  groups: string[];
  featured?: boolean;
};

/** Marketing extras the gateway does not carry, keyed by new-api model id. */
export type ModelMeta = {
  name: string;
  ctx?: string;
  listIn?: string;
  listOut?: string;
  featured?: boolean;
};

export const modelMeta: Record<string, ModelMeta> = {
  "gpt-5.6-sol": { name: "GPT-5.6 Sol", ctx: "1M", listIn: "$5.00", listOut: "$30.00", featured: true },
  "claude-fable-5": { name: "Claude Fable 5", ctx: "1M", listIn: "$10.00", listOut: "$50.00", featured: true },
  "claude-sonnet-5": { name: "Claude Sonnet 5", ctx: "1M", listIn: "$3.00", listOut: "$15.00", featured: true },
  "claude-opus-4-8": { name: "Claude Opus 4.8", ctx: "1M", listIn: "$5.00", listOut: "$25.00", featured: true },
  "gpt-5.5": { name: "GPT-5.5", ctx: "1M", listIn: "$5.00", listOut: "$30.00", featured: true },
  "gemini-3.1-pro-preview": { name: "Gemini 3.1 Pro (Preview)", ctx: "2M", listIn: "$2.00", listOut: "$12.00", featured: true },
  "gpt-5.6-terra": { name: "GPT-5.6 Terra", ctx: "1M", listIn: "$2.50", listOut: "$15.00" },
  "gpt-5.6-luna": { name: "GPT-5.6 Luna", ctx: "1M", listIn: "$1.00", listOut: "$6.00" },
  "gpt-5.4": { name: "GPT-5.4", ctx: "1M", listIn: "$2.50", listOut: "$15.00" },
  "gpt-5.4-mini": { name: "GPT-5.4 mini", ctx: "1M", listIn: "$0.75", listOut: "$4.50" },
  "deepseek-v4-pro": { name: "DS DeepSeek V4 Pro", ctx: "1M", listIn: "$0.435", listOut: "$0.87" },
  "glm-5.2": { name: "GLM GLM-5.2", ctx: "1M", listIn: "$1.40", listOut: "$4.40" },
  // Surfaced by the live pricing feed once their ratio is configured:
  "claude-opus-4-7": { name: "Claude Opus 4.7", ctx: "1M", listIn: "$5.00", listOut: "$25.00" },
  "claude-opus-4-6": { name: "Claude Opus 4.6", ctx: "1M", listIn: "$5.00", listOut: "$25.00" },
  "claude-haiku-4-5-20251001": { name: "Claude Haiku 4.5", ctx: "200K", listIn: "$1.00", listOut: "$5.00" },
};

/** The pricing table and the live-discount list spell some models slightly
 *  differently ("Gemini 3.1 Pro (Preview)" vs "Gemini 3.1 Pro Preview"), so
 *  cross-section jumps match on a punctuation-free key. */
export function modelKey(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Fired by the pricing table so the live section can select the same model. */
export const PICK_MODEL_EVENT = "vipai:pick-model";
export type PickModelDetail = { key: string; vendor: string };

export const agents = [
  { n: "Codex Desktop", req: "9817.1K requests", tok: "1170.1B", delta: "↗ 30.2%" },
  { n: "Claude CLI", req: "1793.1K requests", tok: "268.2B", delta: "↗ 75.1%" },
  { n: "VSCode", req: "863.8K requests", tok: "107.4B", delta: "↗ 45.4%" },
  { n: "Claude Desktop", req: "517.5K requests", tok: "56.9B", delta: "↗ 104.3%" },
  { n: "OpenClaw", req: "189.1K requests", tok: "19.9B", delta: "↗ 151.2%" },
];

export const topModels = [
  { n: "GPT-5.6 Sol", meta: "TTFT 1908ms · 99.46% success", tok: "1068.3B", delta: "↗ 31.8%" },
  { n: "GPT-5.6 Terra", meta: "TTFT 2133ms · 98.56% success", tok: "251.6B", delta: "↗ 99.5%" },
  { n: "GPT-5.5", meta: "TTFT 1562ms · 98.70% success", tok: "136.8B", delta: "↘ 19.3%" },
  { n: "Claude Opus 4.8", meta: "TTFT 2371ms · 99.35% success", tok: "109.1B", delta: "↗ 122.6%" },
  { n: "GPT-5.6 Luna", meta: "TTFT 2074ms · 98.93% success", tok: "97.7B", delta: "↗ 57.6%" },
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

export const faqs = [
  {
    q: "What is an LLM router?",
    a: "A single API that sits between your tools and model providers. You call one endpoint with one key; the router sends each request to Claude, GPT, Gemini or others, meters usage, and gives you one bill.",
  },
  {
    q: "Is VipAI OpenAI-compatible?",
    a: "Yes — both formats. The OpenAI-compatible endpoint works with official OpenAI SDKs and Codex by changing the base URL. Claude Code connects through the Anthropic-compatible endpoint with two environment variables.",
  },
  {
    q: "How can prices be up to {n}% off list?",
    a: "Volume. We commit to enterprise-scale usage with vetted providers and pass the difference through. Discounts vary per model and move with upstream costs — the pricing table above is live.",
  },
  {
    q: "Is my data used to train models?",
    a: "No. Prompts and completions are processed only for routing, metering, billing, abuse prevention and support. They are never used for training and never sold.",
  },
  {
    q: "Do credits expire?",
    a: "No. Buy credits when you want, use them whenever. No subscription required.",
  },
  {
    q: "Are these real models, or look-alike resellers?",
    a: "Real models. Every call is proxied straight to the provider API — no simulation layer, no look-alike endpoints. Response shape, headers and SDK behaviour are checked per model, so your client gets the real thing. You also get the model you asked for: if a lane is offline the request fails loudly instead of silently swapping in something cheaper.",
  },
  {
    q: "How can I verify the price I'm paying?",
    a: "Each pricing row shows the provider's official list price next to ours, so the discount is something you can check yourself against the published rate card. Prices, discounts and the models in rotation are all visible on this page — nothing is hidden behind a sales call.",
  },
  {
    q: "What if a request turns out not to be a real model?",
    a: "Tell us on Telegram with the request ID. If we confirm the request was not served by the model you selected, you get a full refund plus 10× the charge credited back to your balance.",
  },
];

export const topupAmounts = [
  { amt: 10, label: "Starter" },
  { amt: 20, label: "Basic" },
  { amt: 50, label: "Popular" },
  { amt: 200, label: "Pro" },
];

