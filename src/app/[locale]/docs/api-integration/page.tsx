import type { Metadata } from "next";
import { API_BASE } from "@/lib/site";
import { DocJsonLd } from "@/components/docs/doc-jsonld";
import { pageMeta } from "@/lib/seo";
import { CodeBlock } from "@/components/docs/code-block";
import { Callout } from "@/components/docs/callout";
import { H2, H3 } from "@/components/docs/section";
import { CtaPanel, Endpoint, Ref } from "@/components/docs/doc-facts";
import { DocCell, DocRow, DocTable, Pill } from "@/components/docs/doc-table";

const DESCRIPTION =
  "VipAI supports OpenAI, Anthropic and Gemini compatible API formats, so official SDKs can call Claude, Gemini, GPT and other models through one gateway.";

export const metadata: Metadata = {
  title: "API integration",
  description: DESCRIPTION,
  ...pageMeta("/docs/api-integration", "API integration", DESCRIPTION),
};

const base = `https://${API_BASE}`;

const AUTH_ROWS = [
  [
    "Anthropic",
    <>
      <code>x-api-key: YOUR_API_KEY</code> plus <code>anthropic-version: 2023-06-01</code>
    </>,
    <Pill key="p" tone="ok">
      none
    </Pill>,
  ],
  [
    "OpenAI",
    <>
      <code key="a">Authorization: Bearer YOUR_API_KEY</code>, suffix <code key="b">/v1</code>
    </>,
    <Pill key="p" tone="ok">
      as given
    </Pill>,
  ],
  [
    "Gemini",
    <>
      <code key="a">Authorization: Bearer YOUR_API_KEY</code>, or <code key="b">x-goog-api-key</code>
    </>,
    <Pill key="p" tone="ok">
      none
    </Pill>,
  ],
];

const AGENT_ROWS: Array<[string, string, string]> = [
  ["Claude Code, Claude Desktop", "Anthropic", "ANTHROPIC_BASE_URL, ANTHROPIC_API_KEY"],
  ["Codex CLI, Codex Desktop, Cline, Cherry Studio", "OpenAI", "OPENAI_BASE_URL, OPENAI_API_KEY"],
  ["Gemini CLI", "Gemini", "GOOGLE_GEMINI_BASE_URL, GEMINI_API_KEY, GEMINI_API_KEY_AUTH_MECHANISM"],
  ["OpenCode, OpenClaw, Trae, WorkBuddy", "OpenAI", "OPENAI_BASE_URL, OPENAI_API_KEY"],
];

export default function ApiIntegrationPage() {
  return (
    <>
      <DocJsonLd slug="api-integration" />
      <p className="doc-lede">
        VipAI accepts four wire formats. Point the official SDK at the base URL and your application
        code does not change — the requests, the streaming and the SDK behaviour are the provider&rsquo;s own.
      </p>

      <H2 id="authentication">Authentication</H2>
      <p>
        Each protocol expects a different header. Sending the wrong one is the single most common cause of a
        401, and it is worth getting right before anything else.
      </p>
      <DocTable head={["Protocol", "Header", "Base URL suffix"]}>
        {AUTH_ROWS.map((r, i) => (
          <DocRow key={i}>
            <DocCell>{r[0]}</DocCell>
            <DocCell>{r[1]}</DocCell>
            <DocCell>{r[2]}</DocCell>
          </DocRow>
        ))}
      </DocTable>

      <H2 id="available-models">Available models</H2>
      <p>
        Fetch the live list rather than hard-coding it — the catalogue rotates as providers add and retire
        models. <Ref slug="/docs/models">Models &amp; routing</Ref> lists the current set with prices.
      </p>
      <Endpoint method="GET" path={`${base}/v1/models`} auth="Bearer" />
      <CodeBlock
        tabs={[
          {
            label: "cURL",
            file: "request.sh",
            lang: "bash",
            code: `curl ${base}/v1/models \\
  -H "Authorization: Bearer $VIPAI_API_KEY"`,
          },
          {
            label: "Python",
            file: "models.py",
            lang: "python",
            code: `from openai import OpenAI

client = OpenAI(
    base_url="${base}/v1",
    api_key="YOUR_API_KEY",
)

for m in client.models.list():
    print(m.id)`,
          },
        ]}
      />

      <H2 id="anthropic">Anthropic native format</H2>
      <p>
        This is the correct protocol for Claude, and the only one that keeps prompt caching and extended
        thinking intact. Agent tools must be configured with it.
      </p>
      <Endpoint method="POST" path={`${base}/v1/messages`} auth="x-api-key" />

      <H3 id="anthropic-basic">Basic request</H3>
      <CodeBlock
        tabs={[
          {
            label: "cURL",
            file: "request.sh",
            lang: "bash",
            code: `curl ${base}/v1/messages \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "anthropic-version: 2023-06-01" \\
  -H "content-type: application/json" \\
  -d '{
    "model": "claude-fable-5-1",
    "max_tokens": 1024,
    "messages": [{ "role": "user", "content": "Introduce yourself in one sentence" }]
  }'`,
          },
          {
            label: "Python",
            file: "messages.py",
            lang: "python",
            code: `from anthropic import Anthropic

client = Anthropic(
    api_key="YOUR_API_KEY",
    base_url="${base}",
)

resp = client.messages.create(
    model="claude-fable-5-1",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello"}],
)
print(resp.content[0].text)`,
          },
          {
            label: "Response",
            file: "200 OK",
            lang: "json",
            code: `{
  "id": "msg_01KxDE",
  "type": "message",
  "role": "assistant",
  "model": "claude-fable-5-1",
  "content": [{ "type": "text", "text": "I am Claude." }],
  "stop_reason": "end_turn",
  "usage": { "input_tokens": 159, "output_tokens": 34 }
}`,
          },
        ]}
      />

      <H3 id="anthropic-streaming">Streaming with SSE</H3>
      <p>
        Add <code>&quot;stream&quot;: true</code>. The response becomes <code>text/event-stream</code> and the
        event order is fixed: <code>message_start</code> → <code>content_block_start</code> → repeated{" "}
        <code>content_block_delta</code> → <code>content_block_stop</code> → <code>message_delta</code> →{" "}
        <code>message_stop</code>.
      </p>
      <CodeBlock
        tabs={[
          {
            label: "cURL",
            file: "request.sh",
            lang: "bash",
            code: `curl ${base}/v1/messages \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "anthropic-version: 2023-06-01" \\
  -H "content-type: application/json" \\
  -d '{
    "model": "claude-fable-5-1",
    "max_tokens": 1024,
    "stream": true,
    "messages": [{ "role": "user", "content": "Write a short poem" }]
  }'`,
          },
        ]}
      />

      <H2 id="openai">OpenAI-compatible format</H2>
      <Endpoint method="POST" path={`${base}/v1/chat/completions`} auth="Bearer" />

      <H3 id="openai-chat">Chat Completions</H3>
      <CodeBlock
        tabs={[
          {
            label: "cURL",
            file: "request.sh",
            lang: "bash",
            code: `curl ${base}/v1/chat/completions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "content-type: application/json" \\
  -d '{
    "model": "gpt-5.6-sol",
    "max_tokens": 1024,
    "messages": [{ "role": "user", "content": "Hello" }]
  }'`,
          },
          {
            label: "TypeScript",
            file: "chat.ts",
            lang: "typescript",
            code: `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${base}/v1",
  apiKey: process.env.VIPAI_API_KEY,
});

const resp = await client.chat.completions.create({
  model: "gpt-5.6-sol",
  messages: [{ role: "user", content: "Hello" }],
});
console.log(resp.choices[0].message.content);`,
          },
          {
            label: "Response",
            file: "200 OK",
            lang: "json",
            code: `{
  "object": "chat.completion",
  "model": "gpt-5.6-sol",
  "choices": [
    {
      "index": 0,
      "message": { "role": "assistant", "content": "Hello." },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 214,
    "completion_tokens": 3,
    "total_tokens": 217
  }
}`,
          },
        ]}
      />
      <p>
        Add <code>&quot;stream&quot;: true</code> and VipAI returns standard OpenAI SSE chunks in the{" "}
        <code>data: &#123;…&#125;</code> form, terminated by <code>data: [DONE]</code>.
      </p>

      <H3 id="openai-responses">Responses API</H3>
      <p>
        If your application already speaks the Responses API, call it directly instead of translating down to
        Chat Completions.
      </p>
      <Endpoint method="POST" path={`${base}/v1/responses`} auth="GPT models only" />
      <CodeBlock
        tabs={[
          {
            label: "cURL",
            file: "request.sh",
            lang: "bash",
            code: `curl ${base}/v1/responses \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "content-type: application/json" \\
  -d '{
    "model": "gpt-5.6-sol",
    "input": "Introduce VipAI in one sentence"
  }'`,
          },
          {
            label: "Python",
            file: "responses.py",
            lang: "python",
            code: `from openai import OpenAI

client = OpenAI(
    base_url="${base}/v1",
    api_key="YOUR_API_KEY",
)

resp = client.responses.create(
    model="gpt-5.6-sol",
    input="Introduce VipAI in one sentence",
)
print(resp.output_text)`,
          },
        ]}
      />
      <Callout kind="warn" title="The Responses endpoint is GPT-only">
        <p>
          A Claude or Gemini model sent to <code>/v1/responses</code> returns <code>400</code>. Use{" "}
          <code>/v1/messages</code> for Claude and the Gemini native format for Gemini.
        </p>
      </Callout>

      <H3 id="openai-fast">Fast mode</H3>
      <p>
        Fast mode — formerly Priority processing — is available on the OpenAI-compatible endpoints. Add the
        service tier to a Chat Completions or Responses request:
      </p>
      <CodeBlock
        tabs={[
          { label: "Body field", file: "request.json", lang: "json", code: '"service_tier": "fast"' },
          {
            label: "Python",
            file: "fast.py",
            lang: "python",
            code: `from openai import OpenAI

client = OpenAI(
    base_url="${base}/v1",
    api_key="YOUR_API_KEY",
)

resp = client.responses.create(
    model="gpt-5.6-sol",
    input="Analyse this requirement for me.",
    service_tier="fast",
)
print(resp.output_text)`,
          },
        ]}
      />
      <p>
        <code>fast</code> is the current value; the legacy <code>priority</code> still works and behaves
        identically. Fast mode bills at <strong>2× the standard rate</strong> and runs GPT-5.6 Sol up to
        2.5× faster. On GPT-5.6 and earlier the response object may still report{" "}
        <code>&quot;priority&quot;</code> — that is expected, not a bug. <Ref slug="/docs/billing">Why Fast
        mode uses more balance</Ref> walks through the arithmetic.
      </p>

      <H2 id="gemini">Gemini native format</H2>
      <Endpoint method="POST" path={`${base}/v1beta/models/{model}:generateContent`} auth="Bearer" />

      <H3 id="gemini-basic">Basic request</H3>
      <CodeBlock
        tabs={[
          {
            label: "cURL",
            file: "request.sh",
            lang: "bash",
            code: `curl ${base}/v1beta/models/gemini-3.5-flash:generateContent \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "content-type: application/json" \\
  -d '{
    "contents": [
      { "role": "user", "parts": [{ "text": "Introduce yourself in one sentence" }] }
    ]
  }'`,
          },
          {
            label: "Response",
            file: "200 OK",
            lang: "json",
            code: `{
  "candidates": [
    {
      "content": { "role": "model", "parts": [{ "text": "I am Gemini." }] },
      "finishReason": "STOP"
    }
  ],
  "usageMetadata": {
    "promptTokenCount": 12,
    "candidatesTokenCount": 22,
    "totalTokenCount": 34
  }
}`,
          },
        ]}
      />

      <H3 id="gemini-streaming">Streaming with SSE</H3>
      <p>
        Switch the method to <code>streamGenerateContent</code> and add <code>alt=sse</code>:
      </p>
      <CodeBlock
        tabs={[
          {
            label: "cURL",
            file: "request.sh",
            lang: "bash",
            code: `curl "${base}/v1beta/models/gemini-3.5-flash:streamGenerateContent?alt=sse" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "content-type: application/json" \\
  -d '{
    "contents": [
      { "role": "user", "parts": [{ "text": "Write a short poem" }] }
    ]
  }'`,
          },
        ]}
      />

      <H3 id="gemini-env">Environment variables</H3>
      <p>
        Gemini SDKs disagree about how to spell a custom endpoint — the field may be <code>base_url</code>,{" "}
        <code>baseURL</code>, <code>apiEndpoint</code>, or an environment variable. The rule underneath is the
        same: point the base URL at VipAI and use your key.
      </p>
      <CodeBlock
        tabs={[
          {
            label: "Gemini CLI",
            file: "~/.zshrc",
            lang: "bash",
            code: `export GOOGLE_GEMINI_BASE_URL="${base}"
export GEMINI_API_KEY="YOUR_API_KEY"
export GEMINI_API_KEY_AUTH_MECHANISM="bearer"`,
          },
        ]}
      />

      <H2 id="images">Image generation</H2>
      <p>
        The image model <code>gpt-image-2</code> lives behind its own endpoints and authenticates with{" "}
        <code>Authorization: Bearer</code>. Raise the client timeout to 300 seconds — image calls routinely
        outlast a default 30-second budget and will fail against it.
      </p>
      <Endpoint method="POST" path={`${base}/v1/images/generations`} auth="Bearer" />
      <CodeBlock
        tabs={[
          {
            label: "cURL",
            file: "request.sh",
            lang: "bash",
            code: `curl ${base}/v1/images/generations \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "content-type: application/json" \\
  -d '{
    "model": "gpt-image-2",
    "prompt": "An orange cat typing on a keyboard, illustration style"
  }'`,
          },
          {
            label: "Response",
            file: "200 OK",
            lang: "json",
            code: `{
  "created": 1752345600,
  "data": [{ "b64_json": "iVBORw0KGgo" }]
}`,
          },
        ]}
      />
      <Endpoint method="POST" path={`${base}/v1/images/edits`} auth="multipart/form-data" />
      <CodeBlock
        tabs={[
          {
            label: "cURL",
            file: "request.sh",
            lang: "bash",
            code: `curl ${base}/v1/images/edits \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -F model="gpt-image-2" \\
  -F image="@photo.png" \\
  -F prompt="Replace the background with a starry sky"`,
          },
        ]}
      />

      <H2 id="agent-tools">Connect agent tools</H2>
      <p>
        Claude Code uses the Anthropic protocol, Codex uses the OpenAI protocol, Gemini CLI uses the Gemini
        protocol. In every case you set a base URL and a key — the tool itself is untouched. The{" "}
        <Ref slug="/docs/quickstart/claude-code">Claude Code walkthrough</Ref> goes deeper on pinning the
        models so the CLI&rsquo;s choices are explicit and priced.
      </p>
      <DocTable head={["Tool", "Protocol", "Variables"]}>
        {AGENT_ROWS.map(([tool, proto, vars]) => (
          <DocRow key={tool}>
            <DocCell>{tool}</DocCell>
            <DocCell>{proto}</DocCell>
            <DocCell>
              <code>{vars}</code>
            </DocCell>
          </DocRow>
        ))}
      </DocTable>
      <CodeBlock
        tabs={[
          {
            label: "Anthropic",
            file: "~/.zshrc",
            lang: "bash",
            code: `export ANTHROPIC_BASE_URL="${base}"
export ANTHROPIC_API_KEY="YOUR_API_KEY"`,
          },
          {
            label: "OpenAI",
            file: "~/.zshrc",
            lang: "bash",
            code: `export OPENAI_BASE_URL="${base}/v1"
export OPENAI_API_KEY="YOUR_API_KEY"`,
          },
          {
            label: "PowerShell",
            file: "$PROFILE",
            lang: "powershell",
            code: `$env:ANTHROPIC_BASE_URL = "${base}"
$env:ANTHROPIC_API_KEY = "YOUR_API_KEY"`,
          },
        ]}
      />

      <H2 id="faq">FAQ</H2>

      <H3 id="faq-401">Getting 401 / authentication failed</H3>
      <p>
        Check the protocol-to-header mapping first: Anthropic uses <code>x-api-key</code>, OpenAI and Gemini
        use <code>Authorization: Bearer</code>. Then confirm the key is complete (48 characters), has no
        stray whitespace, and still exists in the dashboard. Finally check
        the base URL: OpenAI SDKs need the <code>/v1</code> suffix and Anthropic SDKs must not have it.
      </p>

      <H3 id="faq-claude-via-openai">Calling Claude through the OpenAI format errors, costs more, or performs worse</H3>
      <p>
        Use the Anthropic native protocol for Claude whenever you can. Claude Code and other agent tools{" "}
        <strong>must</strong> be configured with it. The OpenAI-compatible shape can lose prompt caching and
        thinking, which raises cost and lowers answer quality; it is only appropriate for simple chat. The{" "}
        <code>/v1/responses</code> endpoint does not support Claude or Gemini at all and returns 400.
      </p>

      <H3 id="faq-model-unavailable">Model unavailable</H3>
      <p>
        Fetch the live list with <code>GET /v1/models</code> first. Check the id spelling, keep it
        lowercase, and mind <code>-</code> versus <code>.</code>. Also confirm the endpoint matches the model
        family — a Gemini id on the OpenAI endpoint will not resolve.
      </p>

      <H3 id="faq-timeout">Timeout or slow first token</H3>
      <p>
        Large reasoning models such as Opus and Fable can take several seconds to reach the first token.
        That is not a failure. In production set <code>&quot;stream&quot;: true</code> and raise the client
        read timeout; the server allows responses up to 600 seconds.
      </p>

      <H3 id="faq-key-security">Key security</H3>
      <p>
        Store keys in environment variables or a secret manager. Do not hard-code them, commit them, or
        bundle them into a browser client. If a key leaks, delete it in the dashboard and issue a
        replacement immediately.
      </p>

      <CtaPanel
        title="Need a hand getting set up?"
        text="The Claude Code guide is the fastest route from zero to a working agent tool, and rate limits covers what the complimentary models allow."
        primary={{ label: "Create an API key", href: "/dashboard/api-keys" }}
        secondary={{ label: "Read the Claude Code guide", href: "/docs/quickstart/claude-code" }}
      />
    </>
  );
}
