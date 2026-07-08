import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function readWranglerConfig(configPath) {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const defaultPath = resolve(scriptDir, "..", "wrangler.toml");
  const path = configPath ? resolve(process.cwd(), configPath) : defaultPath;

  try {
    const contents = readFileSync(path, "utf8");
    return parseWranglerToml(contents);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return {};
    }
    throw new Error(`Failed to read ${path}: ${error.message}`);
  }
}

function parseWranglerToml(contents) {
  const result = { buckets: [], queues: [] };
  let section = "";

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    if (!line) continue;

    const sectionMatch = line.match(/^\[\[(.+)]]$/);
    if (sectionMatch) {
      section = sectionMatch[1].trim();
      continue;
    }

    const keyValue = line.match(/^([A-Za-z0-9_.-]+)\s*=\s*"([^"]*)"$/);
    if (!keyValue) continue;

    const [, key, value] = keyValue;
    if (section === "r2_buckets" && key === "bucket_name") {
      result.bucket = value;
      result.buckets.push(value);
    }
    if (section === "queues.consumers" && key === "queue") {
      result.queue = value;
      result.queues.push(value);
    }
  }

  return result;
}
