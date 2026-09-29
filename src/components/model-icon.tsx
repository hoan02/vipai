"use client";

import type { IconType } from "react-icons";
import {
  SiAlibabacloud,
  SiAnthropic,
  SiBaidu,
  SiDeepseek,
  SiGooglegemini,
  SiHuggingface,
  SiLmstudio,
  SiMeta,
  SiMinimax,
  SiMistralai,
  SiMoonshotai,
  SiNvidia,
  SiPerplexity,
  SiQwen,
  SiX,
} from "react-icons/si";
import { PiOpenAiLogoFill } from "react-icons/pi";
import { RiZhipuAiFill } from "react-icons/ri";
import { resolveModelProvider } from "@/lib/model-provider";

/**
 * A vendor mark for a model id.
 *
 * Icons come from react-icons' Simple Icons and Remix packs. They are imported
 * by name so a bundler keeps only the handful used here; a vendor with no mark
 * (Cohere, Microsoft, and others) falls back to its initial in a square, so a
 * model is never left without a leading mark in a list.
 */

const ICONS: Record<string, IconType> = {
  openai: PiOpenAiLogoFill,
  anthropic: SiAnthropic,
  gemini: SiGooglegemini,
  xai: SiX,
  deepseek: SiDeepseek,
  qwen: SiQwen,
  moonshot: SiMoonshotai,
  zhipu: RiZhipuAiFill,
  minimax: SiMinimax,
  mistral: SiMistralai,
  meta: SiMeta,
  perplexity: SiPerplexity,
  nvidia: SiNvidia,
  alibaba: SiAlibabacloud,
  baidu: SiBaidu,
  huggingface: SiHuggingface,
  lmstudio: SiLmstudio,
};

export function ModelIcon({
  model,
  size = 16,
  showFallback = true,
}: {
  model: string;
  size?: number;
  /** When false, an unknown vendor renders nothing instead of its initial. */
  showFallback?: boolean;
}) {
  const provider = resolveModelProvider(model);
  const Icon = provider ? ICONS[provider.id] : undefined;

  if (Icon) {
    return <Icon size={size} aria-hidden="true" />;
  }

  if (!showFallback) return null;

  const initial = (provider?.name ?? model).trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      className="model-icon-fallback"
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.62)) }}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}
