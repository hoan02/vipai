import type { Metadata } from "next";
import { Braces } from "lucide-react";
import { models, type Model } from "@/lib/data";
import { CodeBlock } from "@/components/docs/code-block";
import { Callout } from "@/components/docs/callout";
import { H2 } from "@/components/docs/section";
import { CtaPanel, Ref } from "@/components/docs/doc-facts";
import { DocCell, DocRow, DocTable, Pill } from "@/components/docs/doc-table";

export const metadata: Metadata = {
  title: "Models & routing",
  description:
    "Every VipAI model id, the protocol each family needs, and list price beside ours so the discount can be checked against the published rate card.",
};

/**
 * API ids for the priced catalogue. Taken from the model list the API page has
 * always documented — the display names in lib/data are for the pricing table,
 * the ids below are what goes in a request body.
 */
const API_IDS: Record<string, string> = {
  "GPT-5.6 Sol": "gpt-5.6-sol",
  "GPT-5.6 Terra": "gpt-5.6-terra",
  "GPT-5.6 Luna": "gpt-5.6-luna",
  "GPT-5.5": "gpt-5.5",
  "GPT-5.4": "gpt-5.4",
  "GPT-5.4 mini": "gpt-5.4-mini",
  "Claude Opus 5": "claude-opus-5",
  "Claude Fable 5": "claude-fable-5",
  "Claude Sonnet 5": "claude-sonnet-5",
  "Claude Opus 4.8": "claude-opus-4-8",
  "Claude Haiku 4.5": "claude-haiku-4-5",
  "Gemini 3.1 Pro (Preview)": "gemini-3.1-pro-preview",
  "Gemini 3.5 Flash": "gemini-3.5-flash",
  "DS DeepSeek V4 Pro": "deepseek-v4-pro",
  "GLM GLM-5.2": "glm-5.2",
};

/** Discount derived from the two published prices, not hand-typed. */
function discount(m: Model): number | null {
  const list = parseFloat(m.listIn.replace(/[$,]/g, ""));
  const now = parseFloat(m.inNow.replace(/[$,]/g, ""));
  if (!Number.isFinite(list) || list <= 0) return null;
  return Math.round((1 - now / list) * 100);
}

const MATRIX: Array<[string, string, string, boolean]> = [
  ["Claude (Anthropic)", "/v1/messages", "none", false],
  ["GPT (OpenAI)", "/v1/chat/completions", "/v1", true],
  ["GPT Responses (OpenAI)", "/v1/responses", "/v1", true],
  ["Gemini (Google)", "/v1beta/models/{model}:generateContent", "none", false],
  ["TypeSafe (jev)", "/v1/messages", "none", false],
  ["GPT Image 2", "/v1/images/generations", "/v1", false],
];

const COMPLIMENTARY: Array<[string, string]> = [
  ["deepseek-flash-free", "DeepSeek lane"],
  ["deepseek-v4-flash-free", "DeepSeek lane"],
  ["glm-5.3-flash-free", "GLM lane"],
  ["jev", "TypeSafe lane"],
];

export default function ModelsPage() {
  return (
    <>
      <p className="doc-lede">
        Every model id, the protocol it needs, and what you actually pay. The list column is the
        provider&rsquo;s published rate, so the discount is something you can check rather than take on
        trust.
      </p>

      <H2 id="protocol-matrix">Protocol matrix</H2>
      <p>
        The router does not translate protocols silently. Pick the endpoint that matches the model family —
        the reasoning for why is in <Ref slug="/docs/api-integration">the API reference</Ref>.
      </p>
      <DocTable head={["Model family", "Endpoint", "Base URL suffix", "Fast mode"]}>
        {MATRIX.map(([family, endpoint, suffix, fast]) => (
          <DocRow key={family}>
            <DocCell>{family}</DocCell>
            <DocCell>
              <code>{endpoint}</code>
            </DocCell>
            <DocCell>
              {suffix === "none" ? <Pill tone="ok">none</Pill> : <code>{suffix}</code>}
            </DocCell>
            <DocCell>{fast ? <Pill tone="ok">yes</Pill> : <Pill tone="no">no</Pill>}</DocCell>
          </DocRow>
        ))}
      </DocTable>

      <H2 id="catalogue">Catalogue and rates</H2>
      <p>
        Prices are per million tokens in USD. <strong>List</strong> is the provider&rsquo;s published rate;{" "}
        <strong>VipAI</strong> is what you are charged.
      </p>
      <DocTable
        head={["Model", "Id", "Context", "Cache read", "List in", "VipAI in", "VipAI out", "Discount"]}
      >
        {models.map((m) => {
          const d = discount(m);
          return (
            <DocRow key={m.name}>
              <DocCell>
                <b>{m.name}</b>
              </DocCell>
              <DocCell>
                <code>{API_IDS[m.name] ?? m.name.toLowerCase().replace(/\s+/g, "-")}</code>
              </DocCell>
              <DocCell mono>{m.ctx}</DocCell>
              <DocCell mono>{m.cache}</DocCell>
              <DocCell mono>{m.listIn}</DocCell>
              <DocCell mono>{m.inNow}</DocCell>
              <DocCell mono>{m.outNow}</DocCell>
              <DocCell mono>{d === null || d <= 0 ? "—" : `${d}%`}</DocCell>
            </DocRow>
          );
        })}
      </DocTable>
      <Callout kind="plain" title="Where the discount comes from">
        <p>
          Volume. VipAI commits to enterprise-scale usage with vetted providers and passes the difference
          through. Discounts move with upstream costs, so treat the pricing page as live and check it before a
          large run rather than budgeting from this table.
        </p>
      </Callout>

      <H2 id="complimentary">Complimentary models</H2>
      <p>
        Model ids ending in <code>-free</code>, plus <code>jev</code>, run at a 99% promotional discount as a
        limited daily offer. They are subject to both a personal allowance and a shared platform capacity —{" "}
        <Ref slug="/docs/rate-limits">rate limits</Ref> has the numbers.
      </p>
      <DocTable head={["Complimentary id", "Lane"]}>
        {COMPLIMENTARY.map(([id, lane]) => (
          <DocRow key={id}>
            <DocCell>
              <code>{id}</code>
            </DocCell>
            <DocCell>{lane}</DocCell>
          </DocRow>
        ))}
      </DocTable>

      <H2 id="listing-everything">Listing everything from code</H2>
      <p>
        Rather than hard-coding the list above, ask for it — the catalogue rotates as providers add and
        retire models.
      </p>
      <CodeBlock
        tabs={[
          {
            label: "Python",
            file: "models.py",
            lang: "python",
            code: `from openai import OpenAI

client = OpenAI(
    base_url="https://api.vipai.site/v1",
    api_key="sk-vipai-xxxxxx",
)

for m in client.models.list():
    print(m.id)`,
          },
          {
            label: "cURL",
            file: "request.sh",
            lang: "bash",
            code: `curl https://api.vipai.site/v1/models \\
  -H "Authorization: Bearer $VIPAI_API_KEY"`,
          },
        ]}
      />

      <H2 id="when-a-lane-is-offline">If a lane goes offline</H2>
      <p>
        The router fails loudly rather than substituting a cheaper model. If a request returns a lane error,
        the model you selected is genuinely unavailable at that moment — retry, or pin a different id.
        Nothing is silently swapped behind your back, which is the behaviour to rely on when you are
        validating output quality rather than chasing a green checkmark.
      </p>
      <Callout kind="ok" title="Every call is proxied to the provider">
        <p>
          No simulation layer, no look-alike endpoints. Response shape, headers and SDK behaviour are checked
          per model, so your client gets the real thing. If a request is ever not served by the model you
          selected, we refund it and credit 10× the charge back to your balance.
        </p>
      </Callout>

      <CtaPanel
        title="Ready to route real traffic?"
        text="Create a key, send one request, and watch it land in the usage view before you point an agent tool at it."
        primary={{ label: "Create an API key", href: "/dashboard/api-keys" }}
        secondary={{ label: "Read the API reference", href: "/docs/api-integration" }}
      />
    </>
  );
}
