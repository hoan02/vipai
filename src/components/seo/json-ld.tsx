import type { Json } from "@/lib/schema";

/**
 * One JSON-LD block.
 *
 * React escapes text inside a normal element, so the payload goes through
 * `dangerouslySetInnerHTML`. `JSON.stringify` alone is not safe there — a
 * `</script>` inside a string would close the tag early — so every `<` is
 * replaced with `\u003c`, the escaping Next.js documents for exactly this.
 */
export function JsonLd({ data }: { data: Json | Json[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
