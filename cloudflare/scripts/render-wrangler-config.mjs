import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fail } from "./wrangler-run.mjs";

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = parseOptions(process.argv.slice(2));
  const workerName = options["worker-name"] ?? process.env.WORKER_NAME;
  const bucketName = options.bucket ?? process.env.R2_BUCKET;
  const queueName = options.queue ?? process.env.R2_QUEUE;
  const compatibilityDate =
    options["compatibility-date"] ?? process.env.COMPATIBILITY_DATE ?? "2026-07-08";

  if (!workerName) fail("Missing worker name. Pass --worker-name or set WORKER_NAME.");
  if (!bucketName) fail("Missing bucket. Pass --bucket or set R2_BUCKET.");
  if (!queueName) fail("Missing queue. Pass --queue or set R2_QUEUE.");

  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const output = options.output
    ? resolve(process.cwd(), options.output)
    : resolve(scriptDir, "..", "wrangler.toml");

  writeFileSync(
    output,
    renderWranglerConfig({
      workerName,
      bucketName,
      queueName,
      compatibilityDate,
    }),
    "utf8",
  );
  console.log(`Wrote ${output}`);
}

export function renderWranglerConfig({
  workerName,
  bucketName,
  queueName,
  compatibilityDate,
}) {
  return `name = "${escapeToml(workerName)}"
main = "src/public-worker.ts"
compatibility_date = "${escapeToml(compatibilityDate)}"

[[r2_buckets]]
binding = "INDEX_BUCKET"
bucket_name = "${escapeToml(bucketName)}"

[[queues.consumers]]
queue = "${escapeToml(queueName)}"
max_batch_size = 10
max_batch_timeout = 5

[[durable_objects.bindings]]
name = "PROJECT_INDEX"
class_name = "ProjectIndexDO"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["ProjectIndexDO"]
`;
}

function parseOptions(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) fail(`Unexpected argument: ${value}`);
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

function escapeToml(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}
