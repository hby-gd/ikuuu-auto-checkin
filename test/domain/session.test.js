import assert from "node:assert/strict";
import test from "node:test";

import { formatExpireTime, isExpired, parseExpireIn } from "../../src/domain/session.js";

test("parseExpireIn accepts valid timestamp", () => {
  assert.equal(parseExpireIn("1779589183"), 1779589183);
});

test("parseExpireIn rejects invalid timestamp", () => {
  assert.throws(() => parseExpireIn("abc"), /Unix 时间戳/);
});

test("isExpired detects past timestamp", () => {
  assert.equal(isExpired("1", () => 2), true);
});

test("formatExpireTime returns remaining text", () => {
  const info = formatExpireTime("3600", () => 0);
  assert.match(info.remainingText, /0天 1小时 0分钟/);
});
