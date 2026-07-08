import { readWranglerConfig } from "./wrangler-config.mjs";
import { fail, runWrangler } from "./wrangler-run.mjs";

const args = process.argv.slice(2);
const command = args[0] ?? "create";
const options = parseOptions(args.slice(1));
const wranglerConfig = readWranglerConfig(options.config);

const bucket = options.bucket ?? process.env.R2_BUCKET ?? wranglerConfig.bucket;
const queue = options.queue ?? process.env.R2_QUEUE ?? wranglerConfig.queue;
const prefix = options.prefix ?? process.env.R2_PREFIX ?? "packages/";
const dryRun = options["dry-run"] === true || process.env.DRY_RUN === "1";
const skipMissing = options["skip-missing"] === true;

if (!bucket) {
  if (skipMissing) {
    console.log("Skipping notifications: no R2 bucket configured.");
    process.exit(0);
  }
  fail(
    "Missing bucket. Set R2_BUCKET, pass --bucket <name>, or set [[r2_buckets]].bucket_name in wrangler.toml.",
  );
}

if (command !== "list" && !queue) {
  if (skipMissing) {
    console.log("Skipping notifications: no Queue consumer configured.");
    process.exit(0);
  }
  fail(
    "Missing queue. Set R2_QUEUE, pass --queue <name>, or set [[queues.consumers]].queue in wrangler.toml.",
  );
}

if (command === "create") {
  ensureNotification(
    "object-create",
    "PutObject",
    `Rebuild Python index when package objects are created under ${prefix}`,
  );
  ensureNotification(
    "object-delete",
    "DeleteObject",
    `Rebuild Python index when package objects are deleted under ${prefix}`,
  );
} else if (command === "delete") {
  const deleteArgs = [
    "r2",
    "bucket",
    "notification",
    "delete",
    bucket,
    "--queue",
    queue,
  ];
  if (options.rule) {
    deleteArgs.push("--rule", options.rule);
  }
  if (options.force === true) {
    deleteArgs.push("--force");
  }
  runNotificationWrangler(deleteArgs);
} else if (command === "list") {
  runNotificationWrangler(["r2", "bucket", "notification", "list", bucket]);
} else {
  fail(`Unsupported command: ${command}`);
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

function ensureNotification(eventType, outputMarker, description) {
  if (dryRun) {
    runNotificationWrangler(createNotificationArgs(eventType, description));
    return;
  }

  const listed = runWrangler(["r2", "bucket", "notification", "list", bucket], {
    allowFailure: true,
  });
  const output = `${listed.stdout ?? ""}\n${listed.stderr ?? ""}`;
  if (listed.status === 0 && hasNotification(output, queue, prefix, outputMarker)) {
    console.log(`Notification exists: ${eventType} ${bucket} -> ${queue} (${prefix})`);
    return;
  }

  runNotificationWrangler(createNotificationArgs(eventType, description));
}

function hasNotification(output, expectedQueue, expectedPrefix, expectedEventMarker) {
  const rules = output.split(/\n\s*\n/);
  return rules.some((rule) => {
    const fields = {};
    for (const line of rule.split(/\r?\n/)) {
      const match = line.match(/^([a-z_]+):\s*(.+)$/);
      if (match) {
        fields[match[1]] = match[2].trim();
      }
    }
    return (
      fields.queue_name === expectedQueue &&
      fields.prefix === expectedPrefix &&
      typeof fields.event_type === "string" &&
      fields.event_type.includes(expectedEventMarker)
    );
  });
}

function createNotificationArgs(eventType, description) {
  return [
    "r2",
    "bucket",
    "notification",
    "create",
    bucket,
    "--event-type",
    eventType,
    "--queue",
    queue,
    "--prefix",
    prefix,
    "--description",
    description,
  ];
}

function runNotificationWrangler(wranglerArgs) {
  runWrangler(wranglerArgs, { dryRun });
}
