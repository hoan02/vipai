import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { isLocale, routing } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/site/PageShell";
import { JsonLd } from "@/components/seo/json-ld";
import { CodeBlock } from "@/components/docs/code-block";
import { DocCell, DocRow, DocTable, Pill } from "@/components/docs/doc-table";
import { getCatalogue } from "@/server/pricing";
import { translatedPageMeta } from "@/lib/seo";
import { breadcrumbs, productSchema } from "@/lib/schema";
import { modelBySlug, modelSlug, type Model } from "@/lib/data";

/** Static with a 60s revalidate, matching the pricing fetch (`pricing/page.tsx`). */
export const revalidate = 60;

type Params = { params: Promise<{ locale: string; id: string }> };

/**
 * Prerenders one page per model at build time, so a crawler or a first-time
 * visitor gets HTML from the edge instead of waiting on an on-demand render.
 * Slugs come from the same catalogue the page resolves against, so a model that
 * is not listed here still works — it is simply rendered on first request and
 * cached.
 */
export async function generateStaticParams() {
  const models = await getCatalogue();
  return models.map((model) => ({ id: modelSlug(model.id) }));
}

/**
 * Whose surface each `supported_endpoint_types` value maps to. The vocabulary
 * is new-api's (`relaykit/types/endpoint_type.go`); anything unmapped is shown
 * under its raw type rather than hidden, so a new lane is visible, not silent.
 *
 * These labels are protocol names, not prose, so they are the same in every
 * locale.
 */
const PROTOCOLS: Record<string, { label: string; method: string; path: string }> = {
  openai: { label: "OpenAI Chat Completions", method: "POST", path: "/v1/chat/completions" },
  "openai-response": { label: "OpenAI Responses", method: "POST", path: "/v1/responses" },
  anthropic: { label: "Anthropic Messages", method: "POST", path: "/v1/messages" },
  gemini: { label: "Gemini native", method: "POST", path: "/v1beta/models/{model}:generateContent" },
  embeddings: { label: "Embeddings", method: "POST", path: "/v1/embeddings" },
  "image-generation": { label: "Image generation", method: "POST", path: "/v1/images/generations" },
  "jina-rerank": { label: "Rerank", method: "POST", path: "/v1/rerank" },
};

async function findModel(slug: string): Promise<Model | undefined> {
  return modelBySlug(await getCatalogue(), slug);
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, id } = await params;

  const model = await findModel(id);
  if (!model) {
    const t = await getTranslations({
      locale: isLocale(locale) ? locale : routing.defaultLocale,
      namespace: "meta",
    });
    return { title: t("modelNotFoundTitle"), robots: { index: false, follow: true } };
  }

  const t = await getTranslations({
    locale: isLocale(locale) ? locale : routing.defaultLocale,
    namespace: "meta",
  });
  const values = { name: model.name, in: model.inNow, out: model.outNow };
  const description =
    model.discPct > 0
      ? t("modelDescriptionDiscounted", { ...values, pct: model.discPct })
      : t("modelDescription", values);

  return translatedPageMeta({
    locale: isLocale(locale) ? locale : routing.defaultLocale,
    path: `/models/${id}`,
    title: t("modelTitle", { name: model.name }),
    description,
  });
}

export default async function ModelPage({ params }: Params) {
  const { id } = await params;
  const model = await findModel(id);
  if (!model) notFound();

  const t = await getTranslations("model");
  const tc = await getTranslations("common");

  const protocols = model.endpoints.map((type) => ({
    type,
    spec: PROTOCOLS[type] ?? { label: type, method: "POST", path: "/v1/chat/completions" },
  }));
  const primary = protocols[0]?.spec ?? PROTOCOLS.openai;

  return (
    <PageShell>
      <JsonLd
        data={[
          breadcrumbs([
            { name: "Home", path: "/" },
            { name: "Models", path: "/models" },
            { name: model.name, path: `/models/${id}` },
          ]),
          productSchema(model),
        ]}
      />

      <section className="section">
        <div className="prose-page">
          <p className="updated">
            <Link href="/models">{t("catalogue")}</Link> / {model.vendor}
          </p>
          <h1>{model.name}</h1>
          <p className="lede">
            {model.discPct > 0
              ? t.rich("ledeDiscounted", {
                  b: (chunks) => <b>{chunks}</b>,
                  name: model.name,
                  in: model.inNow,
                  out: model.outNow,
                  pct: model.discPct,
                })
              : t.rich("ledePlain", {
                  b: (chunks) => <b>{chunks}</b>,
                  name: model.name,
                  in: model.inNow,
                  out: model.outNow,
                })}
            {model.ctx ? ` ${t("ledeContext", { ctx: model.ctx })}` : null}
          </p>

          <div className="facts">
            <div className="f">
              <b>{model.inNow}</b>
              <span>{t("factsInput")}</span>
            </div>
            <div className="f">
              <b>{model.outNow}</b>
              <span>{t("factsOutput")}</span>
            </div>
            <div className="f">
              <b>{model.cache}</b>
              <span>{t("factsCache")}</span>
            </div>
            <div className="f">
              <b>{model.ctx ?? "—"}</b>
              <span>{t("factsContext")}</span>
            </div>
          </div>

          <h2>{t("priceTitle")}</h2>
          <p>{t("priceBody")}</p>
          <DocTable
            head={[t("colRate"), t("colList"), t("colVipai"), t("colDiscount")]}
          >
            <DocRow>
              <DocCell>{t("factsInput")}</DocCell>
              <DocCell mono>{model.listIn ?? "—"}</DocCell>
              <DocCell mono>{model.inNow}</DocCell>
              <DocCell mono>
                {model.discPct > 0 ? <Pill tone="ok">{tc("discountOff", { pct: model.discPct })}</Pill> : "—"}
              </DocCell>
            </DocRow>
            <DocRow>
              <DocCell>{t("factsOutput")}</DocCell>
              <DocCell mono>{model.listOut ?? "—"}</DocCell>
              <DocCell mono>{model.outNow}</DocCell>
              <DocCell mono>—</DocCell>
            </DocRow>
            <DocRow>
              <DocCell>{t("factsCache")}</DocCell>
              <DocCell mono>—</DocCell>
              <DocCell mono>{model.cache}</DocCell>
              <DocCell mono>—</DocCell>
            </DocRow>
          </DocTable>

          <h2>{t("endpointsTitle")}</h2>
          <p>{t.rich("endpointsBody", { link: (chunks) => <Link href="/docs/models">{chunks}</Link> })}</p>
          <DocTable head={[t("colProtocol"), t("colMethod"), t("colPath")]}>
            {protocols.map(({ type, spec }) => (
              <DocRow key={type}>
                <DocCell>{spec.label}</DocCell>
                <DocCell mono>{spec.method}</DocCell>
                <DocCell mono>
                  <code>{spec.path.replace("{model}", model.id)}</code>
                </DocCell>
              </DocRow>
            ))}
            {protocols.length === 0 ? (
              <DocRow>
                <DocCell>OpenAI Chat Completions</DocCell>
                <DocCell mono>POST</DocCell>
                <DocCell mono>
                  <code>/v1/chat/completions</code>
                </DocCell>
              </DocRow>
            ) : null}
          </DocTable>

          <h2>{t("callingTitle")}</h2>
          <CodeBlock
            tabs={[
              {
                label: "cURL",
                file: "request.sh",
                lang: "bash",
                code: `curl https://api.vipai.site${primary.path.replace("{model}", model.id)} \\
  -H "Authorization: Bearer $VIPAI_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "model": "${model.id}", "messages": [{ "role": "user", "content": "Ship it." }] }'`,
              },
              {
                label: "Python",
                file: "main.py",
                lang: "python",
                code: `from openai import OpenAI

client = OpenAI(base_url="https://api.vipai.site/v1", api_key="YOUR_API_KEY")

stream = client.chat.completions.create(
    model="${model.id}",
    messages=[{"role": "user", "content": "Ship it."}],
    stream=True,
)
for chunk in stream:
    print(chunk.choices[0].delta.content or "", end="")`,
              },
            ]}
          />

          <h2>{t("useTitle")}</h2>
          <ul>
            <li>{t.rich("useKey", { link: (c) => <Link href="/dashboard/api-keys">{c}</Link> })}</li>
            <li>{t.rich("useApi", { link: (c) => <Link href="/docs/api-integration">{c}</Link> })}</li>
            <li>{t.rich("useBilling", { link: (c) => <Link href="/docs/billing">{c}</Link> })}</li>
            <li>{t.rich("usePrices", { link: (c) => <Link href="/pricing">{c}</Link> })}</li>
          </ul>
          <p className="updated">{t("footnote")}</p>
        </div>
      </section>
    </PageShell>
  );
}
