import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { PageShell } from "@/components/site/PageShell";
import { JsonLd } from "@/components/seo/json-ld";
import { pageMeta } from "@/lib/seo";
import { breadcrumbs, organizationSchema } from "@/lib/schema";
import { TELEGRAM_HANDLE, TELEGRAM_URL } from "@/lib/site";

const DESCRIPTION =
  "The terms that govern use of the VipAI AI API gateway: accounts and keys, acceptable use, per-token billing and credits, the model-accuracy refund, availability and liability.";

export const metadata: Metadata = {
  title: "Terms of service",
  description: DESCRIPTION,
  ...pageMeta("/legal/terms", "Terms of service", DESCRIPTION),
};

export const UPDATED = "30 September 2026";

/**
 * Terms that describe the product as it is actually sold: credits rather than a
 * subscription, live per-token prices, the model-accuracy refund already
 * promised in the FAQ, and support over Telegram.
 *
 * LEGAL REVIEW REQUIRED: this is an engineering draft, not advice. Counsel must
 * confirm the contracting entity, governing law, liability limits and consumer
 * rights before relying on it.
 */
export default function TermsPage() {
  return (
    <PageShell>
      <JsonLd
        data={[
          breadcrumbs([
            { name: "Home", path: "/" },
            { name: "Terms of service", path: "/legal/terms" },
          ]),
          organizationSchema(),
        ]}
      />

      <section className="section">
        <div className="prose-page">
          <h1>Terms of service</h1>
          <p className="updated">Last updated {UPDATED}</p>
          <p className="lede">
            These terms govern your use of the VipAI gateway and website. By creating an account or calling
            the API, you agree to them.
          </p>

          <h2>The service</h2>
          <p>
            VipAI is a router. It forwards requests you make to third-party model providers and meters what
            they cost. The models are the providers&rsquo; own; VipAI does not create or alter their output,
            and does not control their availability.
          </p>

          <h2>Your account and keys</h2>
          <ul>
            <li>You are responsible for keeping your API keys secret and for activity on your account.</li>
            <li>
              Keys can be revoked at any time from the dashboard, but cannot be un-revoked — create a new one.
            </li>
            <li>Do not share one key between unrelated parties; each is metered to the account that owns it.</li>
          </ul>

          <h2>Acceptable use</h2>
          <p>
            Do not use the service to break the law, to infringe others&rsquo; rights, to attack or overload
            the platform, to resell access in a way that misrepresents what you are selling, or to bypass rate
            limits with multiple accounts. We may suspend an account that does, and will usually tell you why.
          </p>

          <h2>Billing and credits</h2>
          <ul>
            <li>
              Billing is per million tokens, in USD, with input and output priced separately and priced at the
              rate in effect when the request is made.
            </li>
            <li>Prices are live and move with upstream provider costs; the pricing page is the reference.</li>
            <li>There is no subscription. You buy credits, and credits do not expire.</li>
            <li>
              When the balance reaches zero, requests stop. Balances are not a line of credit and cannot go
              negative.
            </li>
          </ul>

          <h2>The accuracy guarantee</h2>
          <p>
            Every call is proxied to the real provider endpoint — there is no simulation layer and no
            look-alike model. If a request was not served by the model you selected, tell us on Telegram with
            the request id. If we confirm it, the charge is refunded in full and credited back many times
            over, as stated on the pricing page and in the FAQ.
          </p>

          <h2>Availability</h2>
          <p>
            We aim to keep the gateway available continuously, but the service is provided as is, and
            upstream providers have outages we cannot prevent. Where a lane is unavailable, VipAI fails the
            request rather than substituting a different model.
          </p>

          <h2>Data</h2>
          <p>
            How we handle your data is described in <Link href="/legal/privacy">the privacy policy</Link>,
            which forms part of these terms.
          </p>

          <h2>Liability</h2>
          <p>
            To the extent permitted by law, VipAI is not liable for indirect or consequential losses, and
            liability is limited to the amount you have spent in the period giving rise to the claim. Nothing
            here excludes liability that cannot lawfully be excluded.
          </p>

          <h2>Changes</h2>
          <p>
            We may update these terms; the date above changes when we do. Continuing to use the service after
            a change means you accept the updated terms.
          </p>

          <h2>Contact</h2>
          <p>
            Support and legal notices run through Telegram at{" "}
            <a href={TELEGRAM_URL} target="_blank" rel="noreferrer noopener">
              {TELEGRAM_HANDLE}
            </a>
            .
          </p>
        </div>
      </section>
    </PageShell>
  );
}
