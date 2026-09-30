import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { PageShell } from "@/components/site/PageShell";
import { JsonLd } from "@/components/seo/json-ld";
import { pageMeta } from "@/lib/seo";
import { breadcrumbs, organizationSchema } from "@/lib/schema";
import { TELEGRAM_HANDLE, TELEGRAM_URL } from "@/lib/site";

const DESCRIPTION =
  "How VipAI handles your data: what is collected for routing, metering, billing and abuse prevention, what is never done with prompts or completions, and how to exercise your rights.";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: DESCRIPTION,
  ...pageMeta("/legal/privacy", "Privacy policy", DESCRIPTION),
};

export const UPDATED = "30 September 2026";

/**
 * A plain-language privacy policy that matches how the product actually behaves
 * (see the FAQ's data-privacy answer and `docs/billing`). It is written to be
 * readable rather than to be maximally protective, and describes the same
 * practices the marketing pages already claim.
 *
 * LEGAL REVIEW REQUIRED: this is an engineering draft, not advice. Have counsel
 * confirm the sub-processor list, retention periods and the governing entity
 * before relying on it.
 */
export default function PrivacyPage() {
  return (
    <PageShell>
      <JsonLd
        data={[
          breadcrumbs([
            { name: "Home", path: "/" },
            { name: "Privacy policy", path: "/legal/privacy" },
          ]),
          organizationSchema(),
        ]}
      />

      <section className="section">
        <div className="prose-page">
          <h1>Privacy policy</h1>
          <p className="updated">Last updated {UPDATED}</p>
          <p className="lede">
            VipAI is an AI API gateway. This policy explains what we collect when you use it, why, and what
            we do not do with it.
          </p>

          <h2>Who we are</h2>
          <p>
            VipAI operates the gateway at <code>api.vipai.site</code> and the site at{" "}
            <code>vipai.site</code>. Questions about this policy, or a request about your data, go to{" "}
            <a href={TELEGRAM_URL} target="_blank" rel="noreferrer noopener">
              {TELEGRAM_HANDLE}
            </a>
            .
          </p>

          <h2>What we collect</h2>
          <ul>
            <li>
              <strong>Account data.</strong> The email address and password hash (or third-party sign-in
              identifier) you register with. Passwords are stored hashed, never in plain text.
            </li>
            <li>
              <strong>API keys.</strong> The keys you create, and their metadata — name, creation time, last
              use. A full key is shown once when created and is not readable afterwards.
            </li>
            <li>
              <strong>Usage records.</strong> For each request: the model, the token counts, the cost, the
              timestamp, a request id and the account the key belongs to. These are what your bill and the
              usage dashboard are built from.
            </li>
            <li>
              <strong>Request content.</strong> Prompts and completions pass through the gateway in order to
              be forwarded to the model provider. They are processed for routing and are not retained for
              any other purpose.
            </li>
            <li>
              <strong>Technical data.</strong> IP address and user-agent, used for rate limiting, abuse
              prevention and keeping the service available.
            </li>
          </ul>

          <h2>Why we process it</h2>
          <p>
            To deliver the request, to meter and bill it, to keep the platform free of abuse, and to answer
            your support questions. Prompt and completion content is processed only to the extent needed to
            route and measure a call.
          </p>

          <h2>What we do not do</h2>
          <ul>
            <li>We do not use your prompts or completions to train models.</li>
            <li>We do not sell your data.</li>
            <li>We do not share your traffic with other customers.</li>
          </ul>

          <h2>Who else is involved</h2>
          <p>
            A request you make is forwarded to the model provider that serves the model you selected — for
            example OpenAI, Anthropic, Google or DeepSeek — because that is what answering the request means.
            The provider&rsquo;s own terms govern its handling of that request. We also use hosting and
            infrastructure providers to run the gateway.
          </p>

          <h2>How long we keep it</h2>
          <p>
            Usage records and billing history are kept for as long as your account is open, because they are
            your invoice and your audit trail. Account data is kept while the account exists. Technical logs
            are kept for a short period for abuse prevention and then discarded.
          </p>

          <h2>Your choices</h2>
          <ul>
            <li>You can revoke any API key at any time from the dashboard, which stops further use.</li>
            <li>
              You can delete your account and ask for your data to be removed; contact us on Telegram and we
              will confirm what is deleted and what must be retained for billing integrity.
            </li>
            <li>You can ask for a copy of the account and usage data we hold about you.</li>
          </ul>

          <h2>Security</h2>
          <p>
            Traffic is encrypted in transit, keys are stored so a full key cannot be read back, and access to
            production systems is restricted. No system is perfect; if we become aware of a breach affecting
            your account we will tell you.
          </p>

          <h2>Changes</h2>
          <p>
            If this policy changes in a way that matters, we will update the date above and, for significant
            changes, tell you through the site or Telegram.
          </p>

          <p className="updated">
            See also <Link href="/legal/terms">the terms of service</Link>.
          </p>
        </div>
      </section>
    </PageShell>
  );
}
