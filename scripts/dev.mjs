// Start the Next.js dev server with a known NODE_ENV.
//
// Some shells/IDEs export NODE_ENV=production globally. `next dev` does not
// override an existing NODE_ENV, so it warns "non-standard NODE_ENV" and then
// skips the Tailwind/PostCSS step, which surfaces as:
//   ./app/globals.css  Module parse failed: Unexpected character '@'
// Forcing NODE_ENV=development here keeps `npm run dev` correct no matter what
// the surrounding environment sets. Build/start still run as production.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

let nextBin;
try {
  nextBin = path.join(path.dirname(require.resolve("next/package.json")), "dist", "bin", "next");
} catch {
  nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
}

const child = spawn(process.execPath, [nextBin, "dev", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: "development" },
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
