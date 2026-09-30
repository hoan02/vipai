import type { Metadata } from "next";
import { API_BASE } from "@/lib/site";
import { CodeBlock } from "@/components/docs/code-block";
import { Callout } from "@/components/docs/callout";
import { Step, Steps } from "@/components/docs/section";
import { CtaPanel, Ref } from "@/components/docs/doc-facts";
import { DocCell, DocRow, DocTable } from "@/components/docs/doc-table";
import { DocJsonLd } from "@/components/docs/doc-jsonld";
import { pageMeta } from "@/lib/seo";

const DESCRIPTION =
  "Point Claude Code at VipAI with two environment variables, pin the models it uses, and verify the chain end to end.";

export const metadata: Metadata = {
  title: "Connect Claude Code",
  description: DESCRIPTION,
  ...pageMeta("/docs/quickstart/claude-code", "Connect Claude Code", DESCRIPTION),
};

const base = `https://${API_BASE}`;

const PINNED: Array<[string, string, string]> = [
  ["ANTHROPIC_DEFAULT_OPUS_MODEL", "claude-opus-5", "Deep reasoning, architecture work"],
  ["ANTHROPIC_DEFAULT_SONNET_MODEL", "claude-sonnet-5", "Everyday edits and tool calls"],
  ["ANTHROPIC_DEFAULT_HAIKU_MODEL", "claude-haiku-4-5", "Cheap background tasks and titles"],
];

export default function ClaudeCodePage() {
  return (
    <>
      <DocJsonLd slug="quickstart/claude-code" />
      <p className="doc-lede">
        Claude Code speaks the Anthropic protocol, so the whole integration is a base URL and a key. The
        tool itself needs no changes — and because the protocol is the provider&rsquo;s own, prompt caching
        and extended thinking keep working through the gateway.
      </p>

      <Callout kind="info" title="Before you start">
        <p>
          You need an VipAI API key and Node.js 18 or newer. If Claude Code is not installed yet, the first
          step covers it.
        </p>
      </Callout>

      <Steps>
        <Step id="cc-install" title="Install Claude Code">
          <p>Claude Code ships as an npm package. On macOS and Linux:</p>
          <CodeBlock
            tabs={[
              {
                label: "macOS / Linux",
                file: "Terminal",
                lang: "bash",
                code: `npm install -g @anthropic-ai/claude-code
claude --version`,
              },
            ]}
          />
          <p>
            On Windows, install <strong>Git for Windows</strong> first so <code>bash</code> and{" "}
            <code>curl</code> are available, then run the same two commands in Git Bash. There is no separate
            Windows installer.
          </p>
        </Step>

        <Step id="cc-point" title="Point it at VipAI">
          <p>
            Claude Code reads these at startup, so nothing inside the tool has to be edited. Open a new
            terminal afterwards, or the shell will keep the old values.
          </p>
          <CodeBlock
            tabs={[
              {
                label: "macOS / Linux",
                file: "~/.zshrc",
                lang: "bash",
                code: `export ANTHROPIC_BASE_URL="${base}"
export ANTHROPIC_API_KEY="YOUR_API_KEY"`,
              },
              {
                label: "PowerShell",
                file: "$PROFILE",
                lang: "powershell",
                code: `$env:ANTHROPIC_BASE_URL = "${base}"
$env:ANTHROPIC_API_KEY = "YOUR_API_KEY"`,
              },
              {
                label: ".env",
                file: ".env",
                lang: "env",
                code: `ANTHROPIC_BASE_URL=${base}
ANTHROPIC_API_KEY=YOUR_API_KEY`,
              },
            ]}
          />
        </Step>

        <Step id="cc-pin" title="Pin the models Claude Code uses">
          <p>
            Left alone, the CLI resolves its own defaults and may pick a model the router does not carry.
            Pinning all three makes the choice explicit and priced, and keeps the <code>/model</code> menu
            inside the session predictable.
          </p>
          <CodeBlock
            tabs={[
              {
                label: "macOS / Linux",
                file: "~/.zshrc",
                lang: "bash",
                code: `export ANTHROPIC_DEFAULT_OPUS_MODEL="claude-opus-5"
export ANTHROPIC_DEFAULT_SONNET_MODEL="claude-sonnet-5"
export ANTHROPIC_DEFAULT_HAIKU_MODEL="claude-haiku-4-5"`,
              },
              {
                label: "PowerShell",
                file: "$PROFILE",
                lang: "powershell",
                code: `$env:ANTHROPIC_DEFAULT_OPUS_MODEL = "claude-opus-5"
$env:ANTHROPIC_DEFAULT_SONNET_MODEL = "claude-sonnet-5"
$env:ANTHROPIC_DEFAULT_HAIKU_MODEL = "claude-haiku-4-5"`,
              },
            ]}
          />
          <DocTable head={["Variable", "Model id", "Used for"]}>
            {PINNED.map(([v, m, use]) => (
              <DocRow key={v}>
                <DocCell>
                  <code>{v}</code>
                </DocCell>
                <DocCell>
                  <code>{m}</code>
                </DocCell>
                <DocCell>{use}</DocCell>
              </DocRow>
            ))}
          </DocTable>
          <Callout kind="plain" title="These three are optional">
            <p>
              They matter because they make the CLI&rsquo;s model choices explicit. Skip them and it falls back
              to its own defaults, which may not be in the catalogue at all.
            </p>
          </Callout>
        </Step>

        <Step id="cc-verify" title="Verify the chain">
          <p>Start the CLI and ask for something that forces a real completion:</p>
          <CodeBlock
            tabs={[{ label: "Terminal", file: "Terminal", lang: "bash", code: "claude" }]}
          />
          <p>Then, inside the session:</p>
          <CodeBlock
            tabs={[
              {
                label: "Prompt",
                file: "claude",
                lang: "bash",
                code: "> Summarise the VipAI base URL and the auth header in one line each.",
              },
            ]}
          />
          <p>
            A correct answer names <code>{base}</code> and <code>x-api-key</code>. Anything else means the
            environment variables did not load.
          </p>
        </Step>

        <Step id="cc-usage" title="Confirm usage is landing">
          <p>
            Open the usage view in the dashboard. The first Claude Code request should appear within a
            minute, tagged with the model id you pinned. If the row is missing, the CLI is still calling
            Anthropic directly — check that the shell you launched <code>claude</code> from is the one you
            exported the variables in.
          </p>
        </Step>
      </Steps>

      <Callout kind="warn" title="If Claude Code rejects the key">
        <ul>
          <li>Check the key is complete and has no trailing whitespace.</li>
          <li>
            Check <code>ANTHROPIC_BASE_URL</code> has no <code>/v1</code> suffix. The Anthropic client adds
            its own paths, and a doubled prefix returns 404.
          </li>
          <li>Check the key still exists in the dashboard. A deleted key returns 401 immediately.</li>
          <li>
            Check you are not still running an old shell. <code>export</code> in one terminal does not reach
            another.
          </li>
        </ul>
      </Callout>

      <CtaPanel
        title="Ready to bill this?"
        text="Claude Code is usually the highest-volume client people run. Check the per-model rates before pointing it at a large repository."
        primary={{ label: "Create an API key", href: "/dashboard/api-keys" }}
        secondary={{ label: "See model pricing", href: "/docs/models" }}
      />
    </>
  );
}
