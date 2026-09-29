import Link from "next/link";
import { BookOpen, Braces, Wallet } from "lucide-react";
import { API_BASE } from "@/lib/site";
import { CodeBlock } from "@/components/docs/code-block";
import { Callout } from "@/components/docs/callout";
import { H2, Step, Steps } from "@/components/docs/section";
import { KeyValue, Ref } from "@/components/docs/doc-facts";
import { DocCell, DocRow, DocTable } from "@/components/docs/doc-table";

const apiBase = `https://${API_BASE}`;

const CARDS = [
  {
    href: "/docs/quickstart/claude-code",
    icon: BookOpen,
    title: "Connect a coding tool",
    text: "Point Claude Code, Codex, Gemini CLI or any OpenAI-compatible client at VipAI with two environment variables.",
  },
  {
    href: "/docs/api-integration",
    icon: Braces,
    title: "Call the API directly",
    text: "Anthropic native, OpenAI Chat Completions, OpenAI Responses and Gemini native formats.",
  },
  {
    href: "/docs/billing",
    icon: Wallet,
    title: "Understand your bill",
    text: "Why one message produces several billing rows, how cache reads are priced, and when Fast mode costs more.",
  },
];

const PAGES: Array<[string, string, string]> = [
  ["/docs/quickstart/claude-code", "How do I get an agent tool talking to the router?", "4 min"],
  ["/docs/api-integration", "Which endpoint, header and body for each protocol?", "9 min"],
  ["/docs/models", "Which model ids exist and which protocol does each need?", "5 min"],
  ["/docs/rate-limits", "How many requests can I send on the free models?", "2 min"],
  ["/docs/billing", "Why is this invoice the size it is?", "4 min"],
];

export default function DocsOverviewPage() {
  return (
    <>
      <p className="doc-lede">
        One API key, four wire formats, and a router in front of every model provider. Start from what you
        are trying to do.
      </p>

      <div className="doc-cards">
        {CARDS.map((c) => {
          const I = c.icon;
          return (
            <Link key={c.href} className="doc-card" href={c.href}>
              <span className="doc-card-ico" aria-hidden="true">
                <I size={18} />
              </span>
              <b>{c.title}</b>
              <span>{c.text}</span>
              <span className="doc-card-go">Read →</span>
            </Link>
          );
        })}
      </div>

      <H2 id="first-request">Three steps to your first request</H2>
      <p>
        Nothing here needs a paid model. The complimentary lanes are enough to complete all three steps.
      </p>

      <Steps>
        <Step id="step-key" title="Create a key">
          <p>
            Sign in and open the API keys page in the dashboard. Keys start with <code>sk-vipai-</code> and
            are shown once — store it in a password manager or environment variable, never in a repository.
          </p>
        </Step>
        <Step id="step-point" title="Point one tool at the router">
          <p>
            Set the base URL and the key. If you already run an agent tool, follow the{" "}
            <Ref slug="/docs/quickstart/claude-code">Claude Code walkthrough</Ref> — it is the shortest path to a
            working setup.
          </p>
        </Step>
        <Step id="step-send" title="Send one request">
          <p>A <code>200</code> with a completion means the whole chain works.</p>
          <CodeBlock
            tabs={[
              {
                label: "cURL",
                file: "request.sh",
                lang: "bash",
                code: `curl ${apiBase}/v1/chat/completions \\
  -H "Authorization: Bearer $VIPAI_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-5.6-sol",
    "messages": [{ "role": "user", "content": "Say hello in one word." }]
  }'`,
              },
            ]}
          />
        </Step>
      </Steps>

      <H2 id="the-short-version">Everything you need to remember</H2>
      <KeyValue
        rows={[
          ["Base URL", <code key="a">{apiBase}</code>],
          [
            "OpenAI SDK base URL",
            <>
              <code key="a">{apiBase}/v1</code> — the OpenAI client appends <code>/v1</code> itself
            </>,
          ],
          [
            "Anthropic SDK base URL",
            <>
              <code key="a">{apiBase}</code> — no path suffix
            </>,
          ],
          [
            "Auth header",
            <>
              Anthropic <code key="a">x-api-key</code> · OpenAI and Gemini{" "}
              <code key="b">Authorization: Bearer</code>
            </>,
          ],
          ["Key prefix", <code key="a">sk-vipai-</code>],
          ["Server timeout", "600 s for completions, 300 s for image generation"],
        ]}
      />

      <Callout kind="info" title="One rule worth memorising">
        <p>
          Claude goes through the <strong>Anthropic protocol</strong>, Gemini through the <strong>Gemini
          protocol</strong>, and GPT through the <strong>OpenAI protocol</strong>. Routing Claude through the
          OpenAI-compatible format works, but it drops prompt caching and thinking, so it costs more and
          answers worse. The <Ref slug="/docs/models">protocol matrix</Ref> sets out which endpoint each
          family needs.
        </p>
      </Callout>

      <H2 id="page-index">Every page in this build</H2>
      <DocTable head={["Page", "What it answers", "Length"]}>
        {PAGES.map(([href, question, length]) => (
          <DocRow key={href}>
            <DocCell>
              <Link className="doc-ref" href={href}>
                {href === "/docs/quickstart/claude-code" ? "Connect Claude Code" : questionLabel(href)}
              </Link>
            </DocCell>
            <DocCell>{question}</DocCell>
            <DocCell mono>{length}</DocCell>
          </DocRow>
        ))}
      </DocTable>
    </>
  );
}

const LABELS: Record<string, string> = {
  "/docs/api-integration": "API integration",
  "/docs/models": "Models & routing",
  "/docs/rate-limits": "Rate limits",
  "/docs/billing": "Billing questions",
};

function questionLabel(href: string): string {
  return LABELS[href] ?? href;
}
