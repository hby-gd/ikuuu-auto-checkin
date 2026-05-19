import assert from "node:assert/strict";
import test from "node:test";

import {
  createFailureResult,
  createSuccessResult,
  summarizeResults,
} from "../../src/domain/result.js";

test("summarizeResults formats success and failure lines", () => {
  const results = [
    createSuccessResult({ name: "a", uid: "1" }, "已经签到"),
    createFailureResult({ name: "b", uid: "2" }, new Error("登录态已失效")),
  ];

  const summary = summarizeResults(results, false);

  assert.equal(summary.hasError, true);
  assert.match(summary.text, /a\(uid=1\): ✅ 已经签到/);
  assert.match(summary.text, /b\(uid=2\): ❌ 登录态已失效/);
});
