/**
 * Single source of truth for the documentation navigation.
 *
 * The rail, the breadcrumbs, the previous/next chain and the route group each
 * page belongs to are all derived from this list. Adding a page is one entry
 * here plus one `page.tsx`; nothing else needs to be kept in sync by hand.
 *
 * `status: "planned"` is deliberately a status rather than a missing href. A
 * planned page renders as a non-interactive row inside the "Planned" group, so
 * the rail never shows a link that goes nowhere.
 */

import {
  BookOpen,
  Braces,
  Gauge,
  LifeBuoy,
  LifeBuoy as Life,
  Terminal,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type DocGroupId = "start" | "agents" | "api" | "reference";

export type DocPage = {
  slug: string;
  href: string;
  title: string;
  group: DocGroupId;
  /** Minutes to read. Only meaningful for live pages. */
  minutes?: number;
  /** One line, used as the rail tooltip and the search result subtitle. */
  summary: string;
  status: "live" | "planned";
  /**
   * Keyword index for cross-page search. This is an index, not a copy of the
   * page body: a handful of the terms a reader would actually type. Full-text
   * search within the page you are on reads the rendered DOM instead.
   */
  keywords?: string[];
  /** Brand mark from the icon sprite, when the page is about a specific tool. */
  mark?: string;
  /** Lucide glyph, used when there is no brand mark. */
  glyph?: LucideIcon;
};

export const DOC_GROUPS: Array<{ id: DocGroupId; title: string }> = [
  { id: "start", title: "Start here" },
  { id: "agents", title: "Quick start for agents" },
  { id: "api", title: "API reference" },
  { id: "reference", title: "Reference" },
];

export const DOC_PAGES: DocPage[] = [
  {
    slug: "overview",
    href: "/docs",
    title: "Documentation",
    group: "start",
    minutes: 2,
    summary: "One key, four wire formats, and a router in front of every provider.",
    status: "live",
    keywords: ["base url", "api key", "sk-aigiare-", "auth", "first request", "quickstart", "protocol", "getting started"],
    glyph: BookOpen,
  },
  {
    slug: "quickstart/claude-code",
    href: "/docs/quickstart/claude-code",
    title: "Connect Claude Code",
    group: "agents",
    minutes: 4,
    summary: "Point the Anthropic protocol at AiGiare with two environment variables.",
    status: "live",
    keywords: ["claude code", "anthropic", "ANTHROPIC_BASE_URL", "ANTHROPIC_API_KEY", "node", "npm", "install", "env", "zshrc", "powershell", "model pinning", "401"],
    mark: "ic-claudecode",
  },
  {
    slug: "api-integration",
    href: "/docs/api-integration",
    title: "API integration",
    group: "api",
    minutes: 9,
    summary: "Which endpoint, header and body for each supported protocol.",
    status: "live",
    keywords: ["curl", "openai", "anthropic", "gemini", "chat completions", "responses", "streaming", "sse", "fast mode", "service_tier", "priority", "images", "401", "authentication", "x-api-key", "bearer", "python", "sdk", "timeout", "faq", "models list"],
    glyph: Braces,
  },
  {
    slug: "models",
    href: "/docs/models",
    title: "Models & routing",
    group: "api",
    minutes: 5,
    summary: "Every model id, the protocol it needs, and what you actually pay.",
    status: "live",
    keywords: ["model id", "catalogue", "pricing", "discount", "cache read", "context", "gpt", "claude", "gemini", "deepseek", "glm", "grok", "jev", "typesafe", "protocol matrix", "lane", "offline", "free"],
    glyph: Gauge,
  },
  {
    slug: "rate-limits",
    href: "/docs/rate-limits",
    title: "Rate limits",
    group: "api",
    minutes: 2,
    summary: "Personal daily allowances and platform-wide capacity on free models.",
    status: "live",
    keywords: ["rate limit", "allowance", "capacity", "429", "quota", "free", "daily", "reset", "utc+8", "first come first served", "deepseek lane", "glm lane"],
    glyph: Life,
  },
  {
    slug: "billing",
    href: "/docs/billing",
    title: "Billing questions",
    group: "reference",
    minutes: 4,
    summary: "Why one message produces several billing rows, and how cache is priced.",
    status: "live",
    keywords: ["billing", "invoice", "cache write", "cache read", "rounding", "expected charge", "deduction", "fast mode", "balance", "expire", "credits", "support", "request id", "refund"],
    glyph: Wallet,
  },

  /* ---- planned: the content backlog, deliberately not links ---- */
  { slug: "quickstart/codex-cli", href: "/docs/quickstart/codex-cli", title: "Codex CLI", group: "agents", summary: "OpenAI protocol via OPENAI_BASE_URL.", status: "planned", mark: "ic-codex" },
  { slug: "quickstart/codex-desktop", href: "/docs/quickstart/codex-desktop", title: "Codex Desktop", group: "agents", summary: "Same protocol, GUI configuration path.", status: "planned", mark: "ic-codex" },
  { slug: "quickstart/claude-desktop", href: "/docs/quickstart/claude-desktop", title: "Claude Desktop", group: "agents", summary: "Anthropic protocol from the desktop app.", status: "planned", mark: "ic-claude" },
  { slug: "quickstart/gemini-cli", href: "/docs/quickstart/gemini-cli", title: "Gemini CLI", group: "agents", summary: "Gemini native format and its three env vars.", status: "planned", mark: "ic-gemini" },
  { slug: "quickstart/opencode", href: "/docs/quickstart/opencode", title: "OpenCode", group: "agents", summary: "OpenAI-compatible provider block.", status: "planned", glyph: Terminal },
  { slug: "quickstart/openclaw", href: "/docs/quickstart/openclaw", title: "OpenClaw", group: "agents", summary: "OpenAI-compatible provider block.", status: "planned", mark: "ic-openclaw" },
  { slug: "quickstart/vscode-cline", href: "/docs/quickstart/vscode-cline", title: "VS Code + Cline", group: "agents", summary: "Cline provider settings inside VS Code.", status: "planned", glyph: Terminal },
  { slug: "quickstart/cherry-studio", href: "/docs/quickstart/cherry-studio", title: "Cherry Studio", group: "agents", summary: "Add AiGiare as a custom OpenAI provider.", status: "planned", glyph: Terminal },
  { slug: "quickstart/cc-switch", href: "/docs/quickstart/cc-switch", title: "CC Switch", group: "agents", summary: "Switch Claude Code between providers.", status: "planned", glyph: Terminal },
  { slug: "quickstart/trae", href: "/docs/quickstart/trae", title: "Trae", group: "agents", summary: "Custom model endpoint inside Trae.", status: "planned", glyph: Terminal },
  { slug: "quickstart/workbuddy", href: "/docs/quickstart/workbuddy", title: "WorkBuddy", group: "agents", summary: "OpenAI-compatible provider block.", status: "planned", glyph: Terminal },
  { slug: "quickstart/deepseek-harness", href: "/docs/quickstart/deepseek-harness", title: "DeepSeek Harness", group: "agents", summary: "DeepSeek-family models on the DeepSeek lane.", status: "planned", mark: "ic-deepseek" },
  { slug: "usage-billing", href: "/docs/usage-billing", title: "Usage & billing", group: "api", summary: "Reading the usage view and a billing record.", status: "planned", glyph: Wallet },
  { slug: "errors", href: "/docs/errors", title: "Errors & retries", group: "api", summary: "Status codes, lane errors and retry strategy.", status: "planned", glyph: LifeBuoy },
  { slug: "jev-api", href: "/docs/jev-api", title: "Jev (TypeSafe) API", group: "api", summary: "The TypeSafe lane on the Anthropic shape.", status: "planned", glyph: Braces },
  { slug: "images", href: "/docs/images", title: "GPT Image 2 API", group: "api", summary: "Generation and edit endpoints, and their timeouts.", status: "planned", glyph: Braces },
  { slug: "changelog", href: "/docs/changelog", title: "Changelog", group: "reference", summary: "What changed in the API and the catalogue.", status: "planned", glyph: BookOpen },
  { slug: "status", href: "/docs/status", title: "Status & incidents", group: "reference", summary: "Lane availability and past incidents.", status: "planned", glyph: LifeBuoy },
];

const bySlug = new Map(DOC_PAGES.map((p) => [p.slug, p]));
const byHref = new Map(DOC_PAGES.map((p) => [p.href, p]));

export function docBySlug(slug: string): DocPage | undefined {
  return bySlug.get(slug);
}

export function docByHref(href: string): DocPage | undefined {
  return byHref.get(href);
}

/** Pages grouped for the rail, in rail order, planned pages last. */
export function docGroups(): Array<{ id: DocGroupId; title: string; pages: DocPage[] }> {
  return DOC_GROUPS.map((g) => ({
    ...g,
    pages: DOC_PAGES.filter((p) => p.group === g.id && p.status === "live"),
  })).filter((g) => g.pages.length > 0);
}

/** The planned backlog, rendered as non-interactive rows. */
export function plannedGroups(): Array<{ id: DocGroupId; title: string; pages: DocPage[] }> {
  return DOC_GROUPS.map((g) => ({
    ...g,
    pages: DOC_PAGES.filter((p) => p.group === g.id && p.status === "planned"),
  })).filter((g) => g.pages.length > 0);
}

export const LIVE_PAGES = DOC_PAGES.filter((p) => p.status === "live");

/**
 * Previous / next across the live sequence, in rail order. The rail is the
 * table of contents for where a page sits, so this is the same ordering the
 * reader already sees on the left.
 */
export function docNeighbours(slug: string): { prev: DocPage | null; next: DocPage | null } {
  const i = LIVE_PAGES.findIndex((p) => p.slug === slug);
  if (i === -1) return { prev: null, next: null };
  return {
    prev: i > 0 ? LIVE_PAGES[i - 1] : null,
    next: i < LIVE_PAGES.length - 1 ? LIVE_PAGES[i + 1] : null,
  };
}

/** Crumb trail for a page: group titles leading to the page itself. */
export function docCrumbs(page: DocPage): Array<{ title: string; href: string | null }> {
  const trail: Array<{ title: string; href: string | null }> = [{ title: "Documentation", href: "/docs" }];
  const group = DOC_GROUPS.find((g) => g.id === page.group);
  if (group && page.group !== "start") {
    const first = DOC_PAGES.find((p) => p.group === page.group && p.status === "live");
    trail.push({ title: group.title, href: first && first.href !== page.href ? first.href : null });
  }
  trail.push({ title: page.title, href: null });
  return trail;
}
