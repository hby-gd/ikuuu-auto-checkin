import assert from "node:assert/strict";
import test from "node:test";

import { loadEnvConfig } from "../../../src/infra/config/env.js";

test("loadEnvConfig parses valid env values", () => {
  const config = loadEnvConfig({
    ACCOUNTS: '[{"name":"hby","uid":"1","email":"a%40163.com"}]',
    ACCOUNT_SESSIONS: '{"1":{"key":"k","expire_in":"1779589183"}}',
    IKUUU_HOST: "ikuuu.fyi",
    CHECK_ONLY: "true",
    SCKEY: "sct123",
  });

  assert.equal(config.checkOnly, true);
  assert.equal(config.serverChanKey, "sct123");
  assert.equal(config.userUrl, "https://ikuuu.fyi/user");
});

test("loadEnvConfig falls back to default host on invalid value", () => {
  const config = loadEnvConfig({
    ACCOUNTS: "[]",
    ACCOUNT_SESSIONS: "{}",
    IKUUU_HOST: "%%%%",
  });

  assert.equal(config.baseUrl, "https://ikuuu.fyi/");
});

test("loadEnvConfig rejects malformed accounts json", () => {
  assert.throws(
    () =>
      loadEnvConfig({
        ACCOUNTS: "not-json",
        ACCOUNT_SESSIONS: "{}",
      }),
    /ACCOUNTS 配置格式错误/
  );
});
