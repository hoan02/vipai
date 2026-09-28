export const brands: Record<string, string> = {
  OpenAI: "#0b0a08",
  Anthropic: "#d97757",
  Google: "#4285f4",
  DeepSeek: "#4d6bfe",
  GLM: "#7a52c7",
};

export const brandIcon: Record<string, string> = {
  OpenAI: "ic-openai",
  Anthropic: "ic-claude",
  Google: "ic-gemini",
  DeepSeek: "ic-deepseek",
  GLM: "ic-glm",
};

export type Model = {
  /** new-api model id, as it appears in /api/pricing. */
  id: string;
  name: string;
  vendor: keyof typeof brands;
  ctx: string;
  cacheList: string;
  listIn: string;
  listOut: string;
  cache: string;
  inNow: string;
  outNow: string;
  disc: string;
  featured?: boolean;
};

export const models: Model[] = [
  { id: "gpt-5.6-sol", name: "GPT-5.6 Sol", vendor: "OpenAI", ctx: "1M", cacheList: "$0.50", listIn: "$5.00", listOut: "$30.00", cache: "$0.053", inNow: "$0.53", outNow: "$3.18", disc: "90% off", featured: true },
  { id: "claude-fable-5", name: "Claude Fable 5", vendor: "Anthropic", ctx: "1M", cacheList: "$1.00", listIn: "$10.00", listOut: "$50.00", cache: "$0.242", inNow: "$2.42", outNow: "$12.10", disc: "76% off", featured: true },
  { id: "claude-sonnet-5", name: "Claude Sonnet 5", vendor: "Anthropic", ctx: "1M", cacheList: "$0.30", listIn: "$3.00", listOut: "$15.00", cache: "$0.050", inNow: "$0.50", outNow: "$2.52", disc: "-84%", featured: true },
  { id: "claude-opus-4-8", name: "Claude Opus 4.8", vendor: "Anthropic", ctx: "1M", cacheList: "$0.50", listIn: "$5.00", listOut: "$25.00", cache: "$0.133", inNow: "$1.33", outNow: "$6.65", disc: "-74%", featured: true },
  { id: "gpt-5.5", name: "GPT-5.5", vendor: "OpenAI", ctx: "1M", cacheList: "$0.50", listIn: "$5.00", listOut: "$30.00", cache: "$0.055", inNow: "$0.55", outNow: "$3.30", disc: "-89%", featured: true },
  { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro (Preview)", vendor: "Google", ctx: "2M", cacheList: "$0.20", listIn: "$2.00", listOut: "$12.00", cache: "$0.029", inNow: "$0.29", outNow: "$1.73", disc: "-86%", featured: true },
  { id: "gpt-5.6-terra", name: "GPT-5.6 Terra", vendor: "OpenAI", ctx: "1M", cacheList: "$0.25", listIn: "$2.50", listOut: "$15.00", cache: "$0.027", inNow: "$0.27", outNow: "$1.61", disc: "90% off" },
  { id: "gpt-5.6-luna", name: "GPT-5.6 Luna", vendor: "OpenAI", ctx: "1M", cacheList: "$0.10", listIn: "$1.00", listOut: "$6.00", cache: "$0.011", inNow: "$0.11", outNow: "$0.64", disc: "90% off" },
  { id: "gpt-5.4", name: "GPT-5.4", vendor: "OpenAI", ctx: "1M", cacheList: "$0.25", listIn: "$2.50", listOut: "$15.00", cache: "$0.027", inNow: "$0.27", outNow: "$1.62", disc: "90% off" },
  { id: "gpt-5.4-mini", name: "GPT-5.4 mini", vendor: "OpenAI", ctx: "1M", cacheList: "$0.075", listIn: "$0.75", listOut: "$4.50", cache: "$0.009", inNow: "$0.09", outNow: "$0.51", disc: "-89%" },
  { id: "deepseek-v4-pro", name: "DS DeepSeek V4 Pro", vendor: "DeepSeek", ctx: "1M", cacheList: "$0.0036", listIn: "$0.435", listOut: "$0.87", cache: "$0.0036", inNow: "$0.435", outNow: "$0.87", disc: "" },
  { id: "glm-5.2", name: "GLM GLM-5.2", vendor: "GLM", ctx: "1M", cacheList: "$0.26", listIn: "$1.40", listOut: "$4.40", cache: "$0.26", inNow: "$1.40", outNow: "$4.40", disc: "" },
];

export const vendors = ["Featured", "OpenAI", "Anthropic", "Google", "DeepSeek", "GLM"] as const;
export type Vendor = (typeof vendors)[number];

export type DiscountModel = { n: string; v: string; d: number };

/** The pricing table and the live-discount list spell some models slightly
 *  differently ("Gemini 3.1 Pro (Preview)" vs "Gemini 3.1 Pro Preview"), so
 *  cross-section jumps match on a punctuation-free key. */
export function modelKey(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Fired by the pricing table so the live section can select the same model. */
export const PICK_MODEL_EVENT = "aigiare:pick-model";
export type PickModelDetail = { key: string; vendor: string };

export const discountModels: DiscountModel[] = [
  { n: "GPT-5.6 Sol", v: "OpenAI", d: 90 },
  { n: "GPT-5.6 Terra", v: "OpenAI", d: 90 },
  { n: "GPT-5.6 Luna", v: "OpenAI", d: 90 },
  { n: "GPT-5.5", v: "OpenAI", d: 89 },
  { n: "GPT-5.4", v: "OpenAI", d: 90 },
  { n: "GPT-5.4-Mini", v: "OpenAI", d: 88 },
  { n: "GPT Image 2", v: "OpenAI", d: 72 },
  { n: "Claude Opus 5", v: "Anthropic", d: 79 },
  { n: "Claude Fable 5", v: "Anthropic", d: 76 },
  { n: "Claude Opus 4.8", v: "Anthropic", d: 74 },
  { n: "Claude Opus 4.7", v: "Anthropic", d: 71 },
  { n: "Claude Opus 4.6", v: "Anthropic", d: 68 },
  { n: "Claude Sonnet 5", v: "Anthropic", d: 84 },
  { n: "Claude Sonnet 4.6", v: "Anthropic", d: 80 },
  { n: "Claude Haiku 4.5", v: "Anthropic", d: 66 },
  { n: "Gemini 3.8 Flash", v: "Google", d: 82 },
  { n: "Gemini 3.7 Flash", v: "Google", d: 81 },
  { n: "Gemini 3.6 Flash", v: "Google", d: 79 },
  { n: "Gemini 3.5 Flash Lite", v: "Google", d: 77 },
  { n: "Gemini 3.1 Pro Preview", v: "Google", d: 86 },
  { n: "Gemini 3.5 Flash", v: "Google", d: 80 },
  { n: "DeepSeek V4 Pro", v: "DeepSeek", d: 64 },
  { n: "DeepSeek V4 Flash", v: "DeepSeek", d: 70 },
  { n: "GLM-5.2", v: "GLM", d: 62 },
];

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
    base_url="https://api.aigiare.site/v1",
    api_key="sk-aigiare-...",
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
  baseURL: "https://api.aigiare.site/v1",
  apiKey: "sk-aigiare-...",
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
    code: `curl https://api.aigiare.site/v1/chat/completions \\
  -H "Authorization: Bearer $AIGIARE_API_KEY" \\
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
    client := openai.NewClient("sk-aigiare-...")
    client.BaseURL = "https://api.aigiare.site/v1"
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
        .baseUrl("https://api.aigiare.site/v1")
        .apiKey("sk-aigiare-...")
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
        .with_api_base("https://api.aigiare.site/v1")
        .with_api_key("sk-aigiare-...");
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
$client = OpenAI::client("sk-aigiare-...");
$client->baseUri = "https://api.aigiare.site/v1";

echo "ready";`,
  },
  ruby: {
    file: "main.rb",
    model: "GPT-5.6 Sol",
    code: `require "openai"

client = OpenAI::Client.new(
  access_token: "sk-aigiare-...",
  uri_base: "https://api.aigiare.site/v1",
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
    q: "Is AiGiare OpenAI-compatible?",
    a: "Yes — both formats. The OpenAI-compatible endpoint works with official OpenAI SDKs and Codex by changing the base URL. Claude Code connects through the Anthropic-compatible endpoint with two environment variables.",
  },
  {
    q: "How can prices be up to 90% off list?",
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

