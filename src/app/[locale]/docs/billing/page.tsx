import type { Metadata } from "next";
import { H2 } from "@/components/docs/section";
import { CtaPanel, Ref } from "@/components/docs/doc-facts";
import { Callout } from "@/components/docs/callout";
import { Link } from "@/i18n/navigation";
import { DocJsonLd } from "@/components/docs/doc-jsonld";
import { pageMeta } from "@/lib/seo";

const DESCRIPTION =
  "Why one message produces several billing rows, how cache reads and writes are priced, and when Fast mode costs more than you expect.";

export const metadata: Metadata = {
  title: "Billing questions",
  description: DESCRIPTION,
  ...pageMeta("/docs/billing", "Billing questions", DESCRIPTION),
};

export default function BillingPage() {
  return (
    <>
      <DocJsonLd slug="billing" />
      <p className="doc-lede">
        The questions that actually reach support, answered without a sales call. If yours is not here,{" "}
        <Ref slug="/docs/api-integration">the API reference</Ref> covers the request side.
      </p>

      <H2 id="several-rows">Why do I see several billing rows after sending one message</H2>
      <p>A single operation in an agent tool can trigger several real model calls behind the scenes:</p>
      <ul>
        <li>The tool asks the model to understand the task.</li>
        <li>It calls another model to read files and plan edits.</li>
        <li>It calls the model again after tool execution.</li>
        <li>Some clients also retry, or split long work into several requests.</li>
      </ul>
      <Callout kind="plain" title="One operation, several calls">
        <p>
          Each model call that actually happened is recorded and billed. The row count reflects real usage,
          not a billing artefact — and a routing policy that quietly used a cheaper supporting model is
          exactly the kind of thing you should be able to see.
        </p>
      </Callout>

      <H2 id="model-swap">Why did I choose one model and see a different one in billing</H2>
      <p>
        Some clients, agents and routing policies call a smaller model for auxiliary work: classification,
        planning, summarisation, short file summaries. That is not your main model selection failing — part
        of the workflow simply used a different model for a supporting call. The{" "}
        <Ref slug="/docs/models">catalogue</Ref> shows the price of each so you can tell a supporting call
        from a substitution.
      </p>

      <H2 id="cache">What are cache reads and cache writes, and why is the price different</H2>
      <p>
        Many providers prompt-cache aggressively. A <strong>cache write</strong> is the provider storing
        reusable context — long system prompts, project files, previous conversation. A <strong>cache
        read</strong> is the provider re-serving context it already has.
      </p>
      <p>
        Writes usually cost more than reads, because the provider has to process and store the context. Reads
        are usually cheaper. This is the single biggest reason two agents on the same model can produce very
        different bills: the one with warm cache reads is being served mostly cached context.
      </p>

      <H2 id="few-input-tokens">Why do some requests have few input tokens but still cost more</H2>
      <p>Usually one of four things:</p>
      <ul>
        <li>The request triggered cache writes.</li>
        <li>The model used a higher unit price.</li>
        <li>The client made multiple hidden calls around the visible action.</li>
        <li>Output or reasoning tokens were higher than expected.</li>
      </ul>
      <p>
        Read the model id, input tokens, output tokens, cache read tokens and cache write tokens together
        before drawing a conclusion from the input count alone.
      </p>

      <H2 id="rounding">Why do expected charge and actual deduction differ</H2>
      <p>
        Expected charge is derived from the model usage table. Actual deduction can differ because of
        rounding, discounts, cached billing rules, account-level settlement rules, or provider-side
        adjustments. A small gap is expected; if it looks abnormal, keep the request id and contact support.
      </p>

      <H2 id="fast-mode">Why does Fast mode use more balance</H2>
      <p>
        In Fast mode the model list price is 2× the standard-mode price, while your existing account discount
        is unchanged. So the effective cost roughly doubles per token — but so does the speed, up to 2.5× on
        GPT-5.6 Sol. <Ref slug="/docs/api-integration">Fast mode in the API reference</Ref> covers how to
        turn it on and when the response still reports the legacy <code>priority</code> value.
      </p>
      <p>
        A Fast hit in billing means the request was processed with Fast mode enabled. If you did not expect
        that, check whether a client library is setting <code>service_tier</code> on your behalf.
      </p>

      <H2 id="balance-growth">Why is my balance consumed faster over time</H2>
      <p>
        Agent tools send larger context as a project grows. Long conversations, more files and repeated tool
        calls all increase token usage — and each new turn re-establishes context.
      </p>
      <p>To reduce cost:</p>
      <ul>
        <li>Start a new conversation when the old context is no longer needed.</li>
        <li>Avoid asking the agent to read the whole project unless it genuinely has to.</li>
        <li>Prefer smaller models for simple tasks, and pin them — see <Ref slug="/docs/quickstart/claude-code">pinning models in Claude Code</Ref>.</li>
        <li>Use streaming for perceived latency. It does not reduce token usage.</li>
        <li>Watch the cache write rows. Frequent rewrites raise cost.</li>
        <li>Set a budget ceiling in the dashboard so a runaway loop cannot drain the balance quietly.</li>
      </ul>

      <H2 id="expiry">Do credits expire</H2>
      <p>
        No. Buy credits when you want and use them whenever. There is no subscription and no expiry — see the
        FAQ on the <Link className="doc-ref" href="/#faq">home page</Link> for the rest of the billing questions
        that are not request-specific.
      </p>

      <H2 id="when-to-ask">When should I contact support</H2>
      <p>Reach out if you see:</p>
      <ul>
        <li>Requests you did not make.</li>
        <li>A model id that is clearly not the one you configured.</li>
        <li>An actual deduction far from the usage details.</li>
        <li>Requests that failed but still appear as charged.</li>
        <li>You need help reading cache or token records.</li>
      </ul>
      <p>
        Please include the request time, model id, request id, and a screenshot of the billing record. With
        the request id the answer is usually immediate.
      </p>

      <CtaPanel
        title="Still unclear?"
        text="Bring the request id to Telegram — it is the fastest way to get a specific billing row explained."
        primary={{ label: "Open the dashboard", href: "/dashboard" }}
        secondary={{ label: "See model pricing", href: "/docs/models" }}
      />
    </>
  );
}
