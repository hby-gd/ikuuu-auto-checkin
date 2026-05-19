import assert from "node:assert/strict";
import test from "node:test";

import { getSessionForAccount, normalizeAccount } from "../../src/domain/account.js";

test("normalizeAccount accepts a valid account", () => {
  const account = normalizeAccount({ name: "hby", uid: "192782", email: "a%40163.com" });
  assert.deepEqual(account, { name: "hby", uid: "192782", email: "a%40163.com" });
});

test("normalizeAccount rejects missing fields", () => {
  assert.throws(() => normalizeAccount({ uid: "1" }), /name、uid、email/);
});

test("getSessionForAccount resolves key and expire_in by uid", () => {
  const session = getSessionForAccount(
    { name: "hby", uid: "192782", email: "a%40163.com" },
    { "192782": { key: "k", expire_in: "1779589183" } }
  );

  assert.deepEqual(session, { key: "k", expire_in: "1779589183" });
});
