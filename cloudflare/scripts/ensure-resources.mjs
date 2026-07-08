import { readWranglerConfig } from "./wrangler-config.mjs";
import { fail, runWrangler } from "./wrangler-run.mjs";

const args = process.argv.slice(2);
const options = parseOptions(args);
const config = readWranglerConfig(options.config);
const dryRun = options["dry-run"] === true || process.env.DRY_RUN === "1";

for (const queue of config.queues) {
  ensureQueue(queue);
}

function ensureQueue(queue) {
  const list = runWrangler(["queues", "list"], { allowFailure: true, dryRun });
  if (dryRun) return;

  const output = `${list.stdout ?? ""}\n${list.stderr ?? ""}`;
  if (list.status === 0 && output.includes(queue)) {
    console.log(`Queue exists: ${queue}`);
    return;
  }

  const created = runWrangler(["queues", "create", queue], { allowFailure: true });
  const createOutput = `${created.stdout ?? ""}\n${created.stderr ?? ""}`;
  if (created.status === 0 || createOutput.includes("already exists")) {
    console.log(`Queue ready: ${queue}`);
    return;
  }

  process.stdout.write(created.stdout ?? "");
  process.stderr.write(created.stderr ?? "");
  fail(`Failed to create queue: ${queue}`);
}

function parseOptions(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) {
      fail(`Unexpected argument: ${value}`);
    }
    const key = value.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}
