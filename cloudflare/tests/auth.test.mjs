import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  hashToken,
  tokenPrefix,
  verifyTokenHash,
} from "../src/auth.mjs";

describe("auth token helpers", () => {
  it("hashes and verifies generated account tokens", async () => {
    const token = "cfpi_0123456789abcdef";
    const hash = await hashToken(token);

    assert.equal(tokenPrefix(token), "cfpi_01234567");
    assert.equal(await verifyTokenHash(token, hash), true);
    assert.equal(await verifyTokenHash("cfpi_wrong", hash), false);
  });
});
