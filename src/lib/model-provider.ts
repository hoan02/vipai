/**
 * Which vendor a model id belongs to.
 *
 * Model ids arrive as free-form strings (`gpt-4o`, `claude-3-5-sonnet`,
 * `openrouter/anthropic/claude-3`, `deepseek-chat`), so the guess is made from
 * keywords and a couple of anchored patterns. It is only ever used to pick an
 * icon and a label — never for routing or billing, where being wrong would
 * matter.
 *
 * The rule set and the specific-before-generic ordering mirror new-api's
 * `lib/model-provider`, trimmed to the vendors this instance is likely to see.
 */

export type ModelProvider = {
  /** Stable id, used to look up the icon. */
  id: string;
  /** Human name shown as the group label. */
  name: string;
};

type Rule = {
  id: string;
  name: string;
  keywords?: readonly string[];
  pattern?: RegExp;
  /** Weaker signals, tried only when no strong signal matched. */
  fallbackKeywords?: readonly string[];
  fallbackPattern?: RegExp;
};

// Specific vendors come before broader families so, for example, Perplexity's
// Sonar wins over a plain "llama" substring inside another id.
const RULES: readonly Rule[] = [
  { id: "perplexity", name: "Perplexity", keywords: ["perplexity", "sonar-"] },
  { id: "nvidia", name: "NVIDIA", keywords: ["nvidia/", "nvidia.", "nemotron"] },
  {
    id: "openai",
    name: "OpenAI",
    keywords: [
      "openai/",
      "openai.",
      "gpt-",
      "chatgpt-",
      "codex-",
      "dall-e-",
      "whisper-",
      "omni-moderation-",
      "text-moderation-",
      "text-embedding-ada-",
      "text-embedding-3-",
      "text-ada-",
      "text-babbage-",
      "text-curie-",
      "davinci-",
      "babbage-",
      "computer-use-preview",
      "sora",
    ],
    pattern: /(?:^|[/.:])(?:o(?:1|3|4)(?=$|[-.:])|tts-)/,
    // Weaker signals, checked only after every strong rule. Kept here so an
    // embedding model like `text-embedding-v3` resolves to Qwen, not OpenAI.
    fallbackKeywords: ["text-embedding-", "omni-moderation", "dall-e", "whisper", "tts-"],
    fallbackPattern: /\bo[134](?:-|$)/,
  },
  { id: "anthropic", name: "Anthropic", keywords: ["anthropic", "claude"] },
  {
    id: "gemini",
    name: "Gemini",
    keywords: ["gemini", "gemma", "learnlm", "imagen", "veo", "nano-banana", "palm-"],
  },
  { id: "xai", name: "xAI", keywords: ["x-ai/", "xai/", "xai-", "grok"] },
  { id: "deepseek", name: "DeepSeek", keywords: ["deepseek"] },
  {
    id: "qwen",
    name: "Qwen",
    keywords: ["qwen", "qwq-", "qvq-", "tongyi", "gte-"],
    pattern: /(?:^|[/.:])text-embedding-v\d+(?:$|[-_.:])/,
  },
  { id: "moonshot", name: "Moonshot", keywords: ["moonshot", "kimi-"] },
  {
    id: "zhipu",
    name: "Zhipu",
    keywords: ["zhipu", "zai-org", "thudm", "chatglm", "cogview", "cogvideo"],
    pattern: /(?:^|[/._-])glm(?=$|[-._])/,
    fallbackKeywords: ["glm-"],
  },
  { id: "minimax", name: "MiniMax", keywords: ["minimax", "abab", "hailuo"] },
  {
    id: "mistral",
    name: "Mistral",
    keywords: ["mistral", "mixtral", "codestral", "ministral", "pixtral", "magistral"],
  },
  {
    id: "meta",
    name: "Meta",
    keywords: ["meta-llama", "llama-", "llama2", "llama3"],
    fallbackKeywords: ["meta-"],
  },
  {
    id: "cohere",
    name: "Cohere",
    keywords: ["cohere", "command-", "c4ai-aya", "aya-"],
    pattern: /(?:^|[/.:])command$/,
  },
  {
    id: "nousresearch",
    name: "Nous Research",
    keywords: ["nousresearch", "hermes-"],
  },
  {
    id: "microsoft",
    name: "Microsoft",
    keywords: ["microsoft/"],
    pattern: /(?:^|[/.:])phi(?=$|[-._])/,
  },
  {
    id: "amazon",
    name: "Amazon",
    keywords: ["amazon/", "amazon.", "nova-", "titan-"],
  },
  { id: "baidu", name: "Baidu", keywords: ["baidu", "wenxin", "ernie"] },
  { id: "alibaba", name: "Alibaba", keywords: ["alibaba", "alibabacloud"] },
  { id: "ollama", name: "Ollama", keywords: ["ollama/", "ollama-"] },
  { id: "lmstudio", name: "LM Studio", keywords: ["lmstudio", "lm-studio"] },
  { id: "huggingface", name: "Hugging Face", keywords: ["huggingface/", "hf.co/"] },
];

/**
 * Resolves a model id to its vendor, or null when nothing matches.
 *
 * Strong rules are checked across the whole list before the weaker fallbacks,
 * so a broad fallback on an early rule cannot shadow a precise keyword later.
 */
export function resolveModelProvider(modelName: string): ModelProvider | null {
  const model = modelName.trim().toLowerCase();
  if (!model) return null;

  const strong =
    RULES.find(
      (rule) =>
        rule.keywords?.some((keyword) => model.includes(keyword)) ||
        rule.pattern?.test(model),
    ) ??
    RULES.find(
      (rule) =>
        rule.fallbackKeywords?.some((keyword) => model.includes(keyword)) ||
        rule.fallbackPattern?.test(model),
    );

  return strong ? { id: strong.id, name: strong.name } : null;
}
