/**
 * Checks the message catalogue before a build does.
 *
 * Two things go wrong quietly otherwise, and both surface as a 500 on one route
 * in one language rather than as a build failure:
 *
 *  1. A locale is missing a key. `next-intl` throws when the key is looked up.
 *  2. An ICU message is malformed — an unclosed brace, a bad plural. It throws
 *     when the message is *formatted*, which can be behind a login wall the
 *     build never renders.
 *
 * Compiling every message here turns both into a check that runs in CI.
 *
 * Usage: node scripts/check-i18n.mjs
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { IntlMessageFormat } from "intl-messageformat";

const here = dirname(fileURLToPath(import.meta.url));
const messagesDir = join(here, "..", "messages");

/** `{ a: { b: "x" } }` -> `["a.b"]`, so nesting style is not part of the check. */
function flatten(value, prefix = "") {
  return Object.entries(value).flatMap(([key, child]) =>
    child && typeof child === "object" && !Array.isArray(child)
      ? flatten(child, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

/** Walks a flattened key back out of the message object. */
function at(value, key) {
  return key.split(".").reduce((node, part) => (node == null ? node : node[part]), value);
}

const files = readdirSync(messagesDir).filter((name) => name.endsWith(".json"));
if (files.length < 2) {
  console.error(`check-i18n: expected at least two locale files in ${messagesDir}`);
  process.exit(1);
}

const locales = files.map((name) => {
  const locale = name.replace(/\.json$/, "");
  const json = JSON.parse(readFileSync(join(messagesDir, name), "utf8"));
  return { locale, json, keys: new Set(flatten(json)) };
});

const [reference, ...rest] = locales;
let failed = false;

for (const { locale, keys } of rest) {
  const missing = [...reference.keys].filter((key) => !keys.has(key));
  const extra = [...keys].filter((key) => !reference.keys.has(key));

  if (missing.length === 0 && extra.length === 0) {
    console.log(`check-i18n: ${locale} matches ${reference.locale} (${keys.size} keys)`);
    continue;
  }

  failed = true;
  console.error(`check-i18n: ${locale} does not match ${reference.locale}`);
  if (missing.length) console.error(`  missing: ${missing.join(", ")}`);
  if (extra.length) console.error(`  not in ${reference.locale}: ${extra.join(", ")}`);
}

let compiled = 0;
for (const { locale, json, keys } of locales) {
  for (const key of keys) {
    const message = at(json, key);
    try {
      // eslint-disable-next-line no-new
      new IntlMessageFormat(String(message), locale);
      compiled++;
    } catch (error) {
      failed = true;
      console.error(`check-i18n: ${locale} ${key}: ${error.message}`);
    }
  }
}
console.log(`check-i18n: compiled ${compiled} messages`);

process.exit(failed ? 1 : 0);
