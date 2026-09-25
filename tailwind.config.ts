import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";
import motion from "tailwindcss-motion";

const config: Config = {
  content: ["./src/app/**/*.{ts,tsx}", "./src/components/**/*.{ts,tsx}", "./src/lib/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  // Tailwind v4 removed the `corePlugins` option. Preflight is now disabled
  // simply by not importing `tailwindcss/preflight.css` in `app/globals.css`,
  // which keeps the ported design system's own reset in charge.
  //
  // `tailwindcss-animate` + `tailwindcss-motion` come from the reference site's
  // stack; they are loaded through the `@config` directive (v4 keeps legacy
  // JS-config support), which also keeps this file a valid v3-shaped config.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  plugins: [animate as any, motion as any],
};

export default config;
