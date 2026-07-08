import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { renderWranglerConfig } from "../scripts/render-wrangler-config.mjs";

describe("renderWranglerConfig", () => {
  it("renders project-specific worker, bucket, and queue settings", () => {
    const config = renderWranglerConfig({
      workerName: "nxlicense-python",
      bucketName: "nxlicense-python",
      queueName: "nxlicense-python-event-queue",
      compatibilityDate: "2026-07-08",
    });

    assert.match(config, /^name = "nxlicense-python"/m);
    assert.match(config, /bucket_name = "nxlicense-python"/);
    assert.match(config, /queue = "nxlicense-python-event-queue"/);
    assert.match(config, /binding = "INDEX_BUCKET"/);
    assert.match(config, /name = "PROJECT_INDEX"/);
    assert.match(config, /class_name = "ProjectIndexDO"/);
  });
});
