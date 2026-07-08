import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function runWrangler(wranglerArgs, { dryRun = false, allowFailure = false } = {}) {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const wranglerBin = resolve(scriptDir, "..", "node_modules", "wrangler", "bin", "wrangler.js");
  const fullArgs = [wranglerBin, ...wranglerArgs];
  console.log(`$ wrangler ${wranglerArgs.join(" ")}`);

  if (dryRun) return { status: 0, stdout: "", stderr: "" };

  if (!existsSync(wranglerBin)) {
    fail("Wrangler is not installed. Run: npm --prefix cloudflare install");
  }

  const result = spawnSync(process.execPath, fullArgs, {
    encoding: "utf8",
    shell: false,
    stdio: allowFailure ? "pipe" : "inherit",
  });

  if (result.error) {
    fail(result.error.message);
  }
  if (!allowFailure && result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  return result;
}

export function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}
