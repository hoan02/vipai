import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import { Callout } from "@/components/docs/callout";
import { H2, H3 } from "@/components/docs/section";
import { CtaPanel, Ref } from "@/components/docs/doc-facts";
import { DocCell, DocRow, DocTable, Pill } from "@/components/docs/doc-table";
import { DocJsonLd } from "@/components/docs/doc-jsonld";
import { pageMeta } from "@/lib/seo";

const DESCRIPTION =
  "Rate limits for complimentary models: personal daily allowances and platform-wide daily capacity, resetting at 00:00 (UTC+8).";

export const metadata: Metadata = {
  title: "Rate limits",
  description: DESCRIPTION,
  ...pageMeta("/docs/rate-limits", "Rate limits", DESCRIPTION),
};

const PERSONAL: Array<[string, string]> = [
  ["deepseek-flash-free", "200"],
  ["deepseek-v4-flash-free", "200"],
  ["glm-5.3-flash-free", "200"],
];

const CAPACITY: Array<[string, string]> = [
  ["DeepSeek lane, shared by deepseek-flash-free and deepseek-v4-flash-free", "~6 billion tokens"],
  ["GLM lane, glm-5.3-flash-free", "~2 billion tokens"],
];

export default function RateLimitsPage() {
  return (
    <>
      <DocJsonLd slug="rate-limits" />
      <p className="doc-lede">
        Rate limits govern how many requests you can make. The following limits apply to every account,
        regardless of account status or balance.
      </p>

      <H2 id="personal-allowance">Personal daily allowance</H2>
      <p>
        For a complimentary model — any id ending in <code>-free</code>, plus <code>jev</code>:
      </p>
      <DocTable head={["Model id", "Requests per day"]}>
        {PERSONAL.map(([id, n]) => (
          <DocRow key={id}>
            <DocCell>
              <code>{id}</code>
            </DocCell>
            <DocCell mono>{n}</DocCell>
          </DocRow>
        ))}
        <DocRow>
          <DocCell>
            <code>jev</code>
          </DocCell>
          <DocCell>
            <Pill tone="ok">Unlimited</Pill>
          </DocCell>
        </DocRow>
      </DocTable>
      <p>
        Personal allowances reset daily at <strong>00:00 (UTC+8)</strong>.
      </p>

      <H2 id="platform-capacity">Platform-wide daily capacity</H2>
      <p>
        On top of your personal allowance, the platform provides a limited total capacity for complimentary
        models each day, first come first served. It exists because complimentary models are billed at a 99%
        promotional discount as a limited daily offer rather than as a permanent free tier.
      </p>
      <DocTable head={["Complimentary lane", "Daily capacity"]}>
        {CAPACITY.map(([lane, cap]) => (
          <DocRow key={lane}>
            <DocCell>{lane}</DocCell>
            <DocCell mono>{cap}</DocCell>
          </DocRow>
        ))}
        <DocRow>
          <DocCell>TypeSafe lane, jev</DocCell>
          <DocCell>
            <Pill tone="ok">Unlimited</Pill>
          </DocCell>
        </DocRow>
      </DocTable>

      <H3 id="how-both-apply">How the two limits interact</H3>
      <ul>
        <li>
          Your personal allowance and the platform-wide capacity apply at the same time. Reaching either one
          pauses complimentary access for the rest of the day.
        </li>
        <li>
          <code>jev</code> has no personal daily allowance and does not count toward the platform-wide
          capacity — its usage is unlimited.
        </li>
        <li>
          During peak hours the daily capacity can run out early. It is not replenished within the same day
          and resets alongside personal allowances at 00:00 (UTC+8), so off-peak usage is recommended.
        </li>
        <li>Any change to the daily capacity is announced on this page in advance.</li>
      </ul>

      <Callout kind="info" title="When the complimentary allowance runs out">
        <p>
          Switch to the paid counterpart of the same family: <code>deepseek-flash</code>,{" "}
          <code>deepseek-v4-flash</code> or <code>glm-5.3-flash</code>. Paid models are not subject to the
          daily capacity. <Ref slug="/docs/models">Models &amp; routing</Ref> has the rates.
        </p>
      </Callout>

      <CtaPanel
        title="Need more headroom?"
        text="Set a budget ceiling in the dashboard so a long run cannot quietly drain the balance, then move to a paid lane."
        primary={{ label: "Open the dashboard", href: "/dashboard" }}
        secondary={{ label: "See model pricing", href: "/docs/models" }}
      />
    </>
  );
}
