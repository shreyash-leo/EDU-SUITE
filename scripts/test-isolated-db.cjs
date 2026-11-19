// Always use a generated schema. Never run integration/browser mutations against
// the configured application's schema, users, sessions or platform settings.
const { spawn, spawnSync } = require("node:child_process");
const { randomUUID, randomBytes } = require("node:crypto");
const { rmSync, readFileSync, writeFileSync } = require("node:fs");
const { PrismaClient } = require("@prisma/client");
const schema = "portal_test_" + randomUUID().replaceAll("-", "");
const url = new URL(process.env.DATABASE_URL);
url.searchParams.set("schema", schema);
const env = { ...process.env, DATABASE_URL: url.toString(), RUN_DB_TESTS: "1", NODE_ENV: "test" };
const processes = [];
const webDist = ".next-check-" + schema;
const browser = process.argv.includes("--browser");
const http = process.argv.includes("--http");
const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
function run(args, extra = {}) {
  const result = spawnSync(process.execPath, args, { env: { ...env, ...extra }, stdio: "inherit" });
  if (result.status !== 0) throw Error(`Check failed: ${args[0]} (exit ${result.status})`);
}
async function ready(address) {
  const until = Date.now() + 60000;
  while (Date.now() < until) {
    if (processes.some((child) => child.exitCode !== null)) throw Error("An isolated test server exited before becoming ready");
    try { if ((await fetch(address, { signal: AbortSignal.timeout(2000) })).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw Error("Isolated test server did not become ready");
}
(async () => {
  try {
    run(["node_modules/prisma/build/index.js", "migrate", "deploy"]);
    if (!browser && !http) run(["node_modules/vitest/vitest.mjs", "run", "tests/integration.test.ts"]);
    else {
      const password = randomBytes(24).toString("base64url") + "Aa1!";
      const email = "isolated-admin@example.com";
      const { hash } = require("../apps/api/dist/apps/api/src/password.js");
      await db.user.create({ data: { email, name: "Isolated Administrator", role: "PLATFORM_ADMIN", passwordHash: await hash(password), mustChangePassword: false } });
      const extra = { NODE_ENV: "development", API_PORT: "4401", WEB_ORIGIN: http ? "http://localhost:4401" : "http://localhost:3301", E2E_BASE_URL: "http://localhost:4401/api", API_INTERNAL_URL: "http://localhost:4401", PLAN_NEXT_DIST_DIR: webDist, E2E_WEB_URL: "http://localhost:3301", E2E_ADMIN_EMAIL: email, E2E_ADMIN_PASSWORD: password };
      if (browser) run(["node_modules/next/dist/bin/next", "build", "apps/web"], { ...extra, NODE_ENV: "production" });
      for (const args of [["apps/api/dist/apps/api/src/main.js"], ...(browser ? [["node_modules/next/dist/bin/next", "start", "apps/web", "--port", "3301", "--hostname", "127.0.0.1"]] : [])]) {
        const child = spawn(process.execPath, args, { env: { ...env, ...extra, NODE_ENV: args[0].includes("next") ? "production" : "development" }, stdio: ["ignore", "ignore", "inherit"] });
        processes.push(child);
      }
      await ready("http://localhost:4401/api/health");
      if (browser) { await ready("http://localhost:3301"); run(["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(process.argv.indexOf("--browser") + 1), "--max-failures=1"], extra); }
      else run(["--test", "tests/http.e2e.mjs"], extra);
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
  finally {
    await Promise.all(processes.map((child) => new Promise((resolve) => {
      if (child.exitCode !== null) return resolve();
      child.once("exit", resolve); child.kill("SIGTERM");
      const timeout = setTimeout(() => child.kill("SIGKILL"), 5000); timeout.unref();
    })));
    try { await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); console.log("Removed disposable test schema."); }
    catch (error) { console.error("Disposable schema cleanup unavailable: " + (error.code || "database unreachable") + ". No application schema was targeted."); process.exitCode=1; }
    finally {
      await db.$disconnect();
      if (browser) {
        rmSync("apps/web/" + webDist, { recursive: true, force: true });
        const file="apps/web/tsconfig.json", config=JSON.parse(readFileSync(file,"utf8"));
        config.include=config.include.filter((entry)=>!entry.startsWith(webDist + "/"));
        writeFileSync(file,JSON.stringify(config,null,2)+"\n");
      }
    }
  }
})();
