import createNextIntlPlugin from "next-intl/plugin";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },
  // Emits .next/standalone with a self-contained server.js and only the traced
  // node_modules. The Docker image in deploy/agr-fe/Dockerfile depends on this
  // being set: without it the build produces no standalone directory and the
  // COPY in the runtime stage fails. `next start` is unaffected and still works.
  output: "standalone",
};

// Wires `src/i18n/request.ts` in as the message loader. Locale routing itself is
// `src/i18n/routing.ts` plus the composition in `src/proxy.ts`.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
