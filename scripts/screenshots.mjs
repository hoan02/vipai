// Headless screenshots of the running app, for visual review.
//
// Why it exists: this project has no desktop browser attached to the agent
// session, so `browser.screenshot` is unavailable. Chrome/Edge are installed on
// the machine, and playwright-core can drive them without downloading a browser
// of its own, so an agent (or a human) can capture a page and *look* at it.
//
// Usage:
//   npm run dev            # in one terminal
//   node scripts/screenshots.mjs                 # both schemes, default routes
//   node scripts/screenshots.mjs --scheme=dark
//   node scripts/screenshots.mjs --routes=/,/docs --out=.shots
//   BASE_URL=http://localhost:3000 node scripts/screenshots.mjs
//   DASH_USER=me DASH_PASSWORD=secret node scripts/screenshots.mjs
//     (with credentials the dashboard routes are captured too)
//
// Output goes to .shots/ by default (gitignored). Each run writes, per route
// and scheme, a `<name>-<scheme>-top.png` (above the fold) and a
// `<name>-<scheme>-full.png` (whole page, after a scroll pass so the
// scroll-reveal sections are visible).
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

function arg(name, fallback) {
  const hit = process.argv.find((value) => value.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = path.resolve(arg("out", ".shots"));
const SCHEMES = (arg("scheme", "light,dark") === "both" ? "light,dark" : arg("scheme", "light,dark"))
  .split(",")
  .map((value) => value.trim())
  .filter((value) => value === "light" || value === "dark");

// Dashboard routes need a session. Provide credentials in the environment to
// include them; without credentials only the public routes are captured.
const USER = process.env.DASH_USER || "";
const PASSWORD = process.env.DASH_PASSWORD || "";
const PUBLIC_ROUTES = "/,/docs,/download".split(",");
const DASH_ROUTES = [
  "/dashboard",
  "/dashboard/api-keys",
  "/dashboard/models",
  "/dashboard/usage-logs",
  "/dashboard/usage-logs/audit",
  "/dashboard/usage-logs/task",
  "/dashboard/wallet",
  "/dashboard/profile",
  "/dashboard/security",
];
const ROUTES = arg("routes", "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
if (ROUTES.length === 0) ROUTES.push(...PUBLIC_ROUTES, ...(USER ? DASH_ROUTES : []));

/** A human-ish file name for a route. */
function routeName(route) {
  if (route === "/") return "home";
  return route.replace(/^\/+|\/+$/g, "").replace(/[^a-z0-9]+/gi, "-") || "home";
}

/**
 * Launches a browser from what is already installed, in order of preference:
 * system Chrome, system Edge, then a CHROME_PATH override. No playwright
 * browser download is needed.
 */
async function launch() {
  const attempts = [
    { label: "chrome (channel)", options: { channel: "chrome" } },
    { label: "msedge (channel)", options: { channel: "msedge" } },
    process.env.CHROME_PATH
      ? { label: `CHROME_PATH=${process.env.CHROME_PATH}`, options: { executablePath: process.env.CHROME_PATH } }
      : null,
    {
      label: "bundled chromium",
      options: {
        executablePath: path.join(
          process.env.USERPROFILE || process.env.HOME || "",
          "AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe",
        ),
      },
    },
  ].filter(Boolean);

  const errors = [];
  for (const attempt of attempts) {
    try {
      const browser = await chromium.launch({ headless: true, ...attempt.options });
      console.log(`browser: ${attempt.label}`);
      return browser;
    } catch (error) {
      errors.push(`${attempt.label}: ${error.message.split("\n")[0]}`);
    }
  }
  throw new Error(`Could not launch a browser:\n  ${errors.join("\n  ")}`);
}

fs.mkdirSync(OUT, { recursive: true });
const browser = await launch();

// Walk the page so any IntersectionObserver scroll-reveal runs, then return
// to the top; a full-page shot of an un-walked page renders those sections at
// opacity 0.
async function settle(page) {
  await page.evaluate(async () => {
    const step = 700;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 90));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(700);
}

for (const scheme of SCHEMES) {
  const context = await browser.newContext({
    colorScheme: scheme,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  if (USER && PASSWORD) {
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
    const status = await page.evaluate(async ([user, pass]) => {
      const response = await fetch("/api/session/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: user, password: pass }),
      });
      return response.status;
    }, [USER, PASSWORD]);
    console.log(`login ${USER}: ${status}`);
  }
  for (const route of ROUTES) {
    const name = routeName(route);
    await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(1800);

    const theme = await page.evaluate(() => document.documentElement.dataset.theme);
    await page.screenshot({ path: path.join(OUT, `${name}-${scheme}-top.png`) });

    await settle(page);
    await page.screenshot({ path: path.join(OUT, `${name}-${scheme}-full.png`), fullPage: true });

    console.log(`${route} ${scheme}: data-theme=${theme}`);
  }
  await context.close();
}

await browser.close();
console.log(`screenshots written to ${OUT}`);
