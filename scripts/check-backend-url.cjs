// Transpiles the real src/server/http.ts to CommonJS, stubs the two framework
// imports, then reports which backend URLs the module accepts. Testing the
// shipped file rather than a copy is the point: the bug this guards against was
// a load-order mistake invisible to a hand-written reproduction.
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

// This file lives in scripts/, so the project root is one level up.
const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "src/server/http.ts"), "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: "http.ts",
}).outputText;

// Written inside the project so that `zod` and the other real dependencies
// resolve through the normal node_modules lookup.
const outFile = path.join(root, ".http-check-" + process.pid + ".cjs");
fs.writeFileSync(outFile, js);

const Module = require("module");
const orig = Module._load;
Module._load = function (request, ...rest) {
  if (request === "server-only") return {};
  if (request === "next/headers") return { cookies: async () => ({}), headers: async () => ({}), };
  return orig.call(this, request, ...rest);
};

const accept = [
  ["http://new-api:3000", "compose network, production value"],
  ["http://caddy:80", "the front door"],
  ["http://127.0.0.1:8080", "loopback, local dev"],
  ["http://host.docker.internal:4000", "docker host alias"],
  ["http://localhost:4000", "loopback by name"],
  ["http://192.168.10.211:8080", "private RFC1918"],
  ["http://172.20.0.4:8080", "private 172.16/12"],
  ["https://api.vipai.site", "public over https"],
];

const refuse = [
  ["http://vipai.site/_vipai", "public over plain http"],
  ["http://api.example.com/v1", "public over plain http"],
  ["http://169.254.169.254/latest/meta-data", "link-local metadata"],
];

let failures = 0;

function loadWith(value) {
  process.env.BACKEND_API_URL = value;
  delete require.cache[outFile];
  return require(outFile);
}

console.log("--- must be ACCEPTED ---");
for (const [value, note] of accept) {
  try {
    const mod = loadWith(value);
    console.log("  ok   " + value.padEnd(34) + " -> " + String(mod.BACKEND_URL).padEnd(32) + " (" + note + ")");
  } catch (error) {
    failures++;
    console.log("  FAIL " + value.padEnd(34) + " -> " + (error?.issues?.[0]?.message ?? error.message) + "  (" + note + ")");
  }
}

console.log("");
console.log("--- must be REFUSED ---");
for (const [value, note] of refuse) {
  try {
    loadWith(value);
    failures++;
    console.log("  LEAK " + value.padEnd(34) + " accepted, should have been refused  (" + note + ")");
  } catch (error) {
    const message = error?.issues?.[0]?.message ?? error.message;
    const ok = /must be https/.test(message);
    if (!ok) failures++;
    console.log((ok ? "  ok   " : "  WRONG") + " " + value.padEnd(34) + " refused: " + message + "  (" + note + ")");
  }
}

fs.unlinkSync(outFile);
console.log("");
console.log(failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED");
process.exit(failures ? 1 : 0);
