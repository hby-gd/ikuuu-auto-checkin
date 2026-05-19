# Node App Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the single-file GitHub Actions script into a small Node application with tests and ServerChan-only notification support.

**Architecture:** Move orchestration into `src/app`, pure rules into `src/domain`, external integrations into `src/infra`, and keep `src/cli/main.js` as the only process entrypoint. Preserve current check-in behavior while removing Telegram and moving ServerChan delivery into application code.

**Tech Stack:** Node.js ESM, built-in `fetch`, built-in `node:test`, built-in `assert`, GitHub Actions

---

## File Map

### New files

- `src/cli/main.js`
- `src/app/run-checkin.js`
- `src/domain/account.js`
- `src/domain/session.js`
- `src/domain/result.js`
- `src/domain/errors.js`
- `src/infra/config/env.js`
- `src/infra/http/ikuuu-client.js`
- `src/infra/notify/server-chan.js`
- `src/infra/output/github-output.js`
- `test/domain/account.test.js`
- `test/domain/session.test.js`
- `test/domain/result.test.js`
- `test/infra/config/env.test.js`

### Modified files

- `package.json`
- `.github/workflows/Checkin.yml`
- `README.md`
- `main.js`

### Responsibilities

- `src/cli/main.js`: top-level process runner and unexpected error handling
- `src/app/run-checkin.js`: main application flow and dependency wiring
- `src/domain/*.js`: validation, session logic, result aggregation, typed errors
- `src/infra/config/env.js`: all environment parsing and host resolution
- `src/infra/http/ikuuu-client.js`: iKuuu HTTP and response parsing
- `src/infra/notify/server-chan.js`: summary notification delivery
- `src/infra/output/github-output.js`: `GITHUB_OUTPUT` writes
- `main.js`: compatibility shim that imports `src/cli/main.js`

### Task 1: Add test runner and CLI entrypoint scaffold

**Files:**
- Modify: `package.json`
- Create: `src/cli/main.js`
- Modify: `main.js`

- [ ] **Step 1: Add test and start scripts to `package.json`**

```json
{
  "name": "ikuuu-auto-checkin",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node src/cli/main.js",
    "test": "node --test"
  }
}
```

- [ ] **Step 2: Run package script check**

Run: `npm run`
Expected: output lists `start` and `test`

- [ ] **Step 3: Create CLI entrypoint**

```js
import { runCheckin } from "../app/run-checkin.js";

try {
  const exitCode = await runCheckin();
  process.exitCode = exitCode;
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`❌ 脚本执行异常：${message}`);
  process.exitCode = 1;
}
```

- [ ] **Step 4: Convert root `main.js` into compatibility shim**

```js
import "./src/cli/main.js";
```

- [ ] **Step 5: Run syntax verification for entrypoints**

Run: `node -c main.js`  
Run: `node -c src/cli/main.js`  
Expected: both commands exit with code `0`

- [ ] **Step 6: Commit scaffold**

```bash
git add package.json main.js src/cli/main.js
git commit -m "refactor: add cli entrypoint and test script"
```

### Task 2: Extract and test domain logic

**Files:**
- Create: `src/domain/account.js`
- Create: `src/domain/session.js`
- Create: `src/domain/result.js`
- Create: `src/domain/errors.js`
- Create: `test/domain/account.test.js`
- Create: `test/domain/session.test.js`
- Create: `test/domain/result.test.js`

- [ ] **Step 1: Write failing account validation tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAccount, getSessionForAccount } from "../../src/domain/account.js";

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
```

- [ ] **Step 2: Write failing session tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
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
```

- [ ] **Step 3: Write failing result aggregation tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  createSuccessResult,
  createFailureResult,
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
```

- [ ] **Step 4: Run domain tests to confirm failure**

Run: `node --test test/domain/*.test.js`
Expected: FAIL with module-not-found or missing export errors

- [ ] **Step 5: Implement domain modules**

```js
// src/domain/errors.js
export class AppError extends Error {}
export class ConfigError extends AppError {}
export class AuthError extends AppError {}
export class RemoteError extends AppError {}
```

```js
// src/domain/account.js
import { ConfigError } from "./errors.js";

export function normalizeAccount(account) {
  if (!account || typeof account !== "object") {
    throw new ConfigError("账户信息格式错误。");
  }
  const normalized = {
    name: String(account.name || "").trim(),
    uid: String(account.uid || "").trim(),
    email: String(account.email || "").trim(),
  };
  if (!normalized.name || !normalized.uid || !normalized.email) {
    throw new ConfigError("ACCOUNTS 中每个账号都必须包含 name、uid、email。");
  }
  return normalized;
}

export function getSessionForAccount(account, accountSessions) {
  const session = accountSessions?.[account.uid];
  const expireIn = session?.exp_in || session?.expire_in;
  if (!session || typeof session !== "object" || !session.key || !expireIn) {
    throw new ConfigError(`${account.name}(uid=${account.uid}): ACCOUNT_SESSIONS 缺少 key/expire_in。`);
  }
  return { key: session.key, expire_in: String(expireIn).trim() };
}
```

```js
// src/domain/session.js
import { ConfigError } from "./errors.js";

export function parseExpireIn(expireIn) {
  const expireAt = Number(expireIn);
  if (!Number.isFinite(expireAt) || expireAt <= 0) {
    throw new ConfigError("expire_in 无效，请填写 Unix 时间戳（秒）。");
  }
  return expireAt;
}

export function isExpired(expireIn, nowSeconds = () => Math.floor(Date.now() / 1000)) {
  return parseExpireIn(expireIn) <= nowSeconds();
}

export function formatExpireTime(expireIn, nowSeconds = () => Math.floor(Date.now() / 1000)) {
  const expireAt = parseExpireIn(expireIn);
  const remainingSeconds = Math.max(0, expireAt - nowSeconds());
  const days = Math.floor(remainingSeconds / 86400);
  const hours = Math.floor((remainingSeconds % 86400) / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  return {
    expireAt,
    expireDate: new Date(expireAt * 1000),
    remainingText: `${days}天 ${hours}小时 ${minutes}分钟`,
  };
}
```

```js
// src/domain/result.js
function formatPrefix(account) {
  return `${account.name}(uid=${account.uid})`;
}

export function createSuccessResult(account, message) {
  return { account, ok: true, message, line: `${formatPrefix(account)}: ✅ ${message}` };
}

export function createFailureResult(account, error) {
  const message = error instanceof Error ? error.message : String(error);
  return { account, ok: false, message, line: `${formatPrefix(account)}: ❌ ${message}` };
}

export function summarizeResults(results, checkOnly) {
  const header = checkOnly ? "======== 登录态检查结果 ========" : "======== 签到结果 ========";
  const text = [header, "", ...results.map((result) => result.line)].join("\n");
  return {
    header,
    text,
    hasError: results.some((result) => !result.ok),
  };
}
```

- [ ] **Step 6: Re-run domain tests**

Run: `node --test test/domain/*.test.js`
Expected: PASS

- [ ] **Step 7: Commit domain extraction**

```bash
git add src/domain test/domain
git commit -m "refactor: extract domain logic with tests"
```

### Task 3: Extract configuration, output, and iKuuu client modules

**Files:**
- Create: `src/infra/config/env.js`
- Create: `src/infra/output/github-output.js`
- Create: `src/infra/http/ikuuu-client.js`
- Create: `test/infra/config/env.test.js`

- [ ] **Step 1: Write failing env parsing tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
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
```

- [ ] **Step 2: Run env tests to confirm failure**

Run: `node --test test/infra/config/env.test.js`
Expected: FAIL with module-not-found or missing export errors

- [ ] **Step 3: Implement env, output, and HTTP modules**

```js
// src/infra/config/env.js
import { ConfigError } from "../../domain/errors.js";

function parseJsonEnv(source, name, required = false) {
  const raw = source[name];
  if (!raw) {
    if (required) throw new ConfigError(`${name} 未配置。`);
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new ConfigError(`${name} 配置格式错误。`);
  }
}

function normalizeHost(rawHost) {
  let value = String(rawHost || "ikuuu.fyi").trim();
  value = value.replace(/^['"]+|['"]+$/g, "");
  value = value.replace(/\/+(user|auth\/login|user\/checkin).*$/i, "");
  const candidates = /^https?:\/\//i.test(value)
    ? [value]
    : value.startsWith("//")
      ? [`https:${value}`]
      : [`https://${value.replace(/^\/+/, "")}`, value];
  for (const candidate of candidates) {
    try {
      const parsed = new URL(candidate);
      if (parsed.hostname) return new URL(parsed.origin);
    } catch {}
  }
  return new URL("https://ikuuu.fyi");
}

export function loadEnvConfig(source = process.env) {
  const accounts = parseJsonEnv(source, "ACCOUNTS", true);
  const accountSessions = parseJsonEnv(source, "ACCOUNT_SESSIONS", true);
  if (!Array.isArray(accounts)) throw new ConfigError("ACCOUNTS 必须是数组。");
  if (!accountSessions || Array.isArray(accountSessions) || typeof accountSessions !== "object") {
    throw new ConfigError("ACCOUNT_SESSIONS 必须是对象，且键为 uid。");
  }
  const hostUrl = normalizeHost(source.IKUUU_HOST || source.HOST || "ikuuu.fyi");
  return {
    accounts,
    accountSessions,
    checkOnly: String(source.CHECK_ONLY || "").toLowerCase() === "true",
    serverChanKey: String(source.SCKEY || "").trim(),
    baseUrl: hostUrl.toString(),
    userUrl: new URL("/user", hostUrl).toString(),
    checkInUrl: new URL("/user/checkin", hostUrl).toString(),
  };
}
```

```js
// src/infra/output/github-output.js
import { appendFileSync } from "node:fs";

export function setGitHubOutput(name, value, source = process.env) {
  if (!source.GITHUB_OUTPUT) return;
  appendFileSync(source.GITHUB_OUTPUT, `${name}<<EOF\n${value}\nEOF\n`);
}
```

```js
// src/infra/http/ikuuu-client.js
import { AuthError, RemoteError } from "../../domain/errors.js";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function buildCookie(account, session) {
  return [
    ["uid", account.uid],
    ["email", account.email],
    ["key", session.key],
    ["expire_in", session.expire_in],
  ]
    .map(([key, value]) => `${key}=${String(value).trim()}`)
    .join("; ");
}

async function parseJsonResponse(response, loginHint) {
  const rawText = await response.text();
  try {
    return JSON.parse(rawText);
  } catch {
    throw new RemoteError(rawText.includes("/auth/login") ? loginHint : `站点响应异常: ${rawText.slice(0, 120)}`);
  }
}

export function createIkuuuClient({ userUrl, checkInUrl, fetchImpl = fetch }) {
  const loginHint = "登录态已失效，请更新 ACCOUNT_SESSIONS 中对应 uid 的 key/expire_in。";

  async function request(url, method, account, session) {
    const response = await fetchImpl(url, {
      method,
      headers: {
        Cookie: buildCookie(account, session),
        "User-Agent": USER_AGENT,
      },
      redirect: "manual",
    });
    const location = response.headers.get("location") || "";
    if ((response.status >= 300 && response.status < 400 && location.includes("/auth/login"))) {
      throw new AuthError(loginHint);
    }
    if (!response.ok) {
      throw new RemoteError(`网络请求出错 - ${response.status}`);
    }
    return response;
  }

  return {
    async checkSession(account, session) {
      const response = await request(userUrl, "GET", account, session);
      const text = await response.text();
      if (text.includes("/auth/login")) throw new AuthError(loginHint);
      return text;
    },
    async checkIn(account, session) {
      const response = await request(checkInUrl, "POST", account, session);
      const data = await parseJsonResponse(response, loginHint);
      if (!data || typeof data.ret !== "number" || typeof data.msg !== "string") {
        throw new RemoteError("站点响应异常: 缺少 ret/msg 字段。");
      }
      return data;
    },
  };
}
```

- [ ] **Step 4: Re-run config tests**

Run: `node --test test/infra/config/env.test.js`
Expected: PASS

- [ ] **Step 5: Commit infra extraction**

```bash
git add src/infra test/infra
git commit -m "refactor: extract config output and http modules"
```

### Task 4: Build the application runner and ServerChan notifier

**Files:**
- Create: `src/app/run-checkin.js`
- Create: `src/infra/notify/server-chan.js`
- Modify: `src/cli/main.js`

- [ ] **Step 1: Implement ServerChan notifier**

```js
export function createServerChanNotifier({ sendKey, fetchImpl = fetch }) {
  return {
    async notify({ title, desp }) {
      if (!sendKey) return { sent: false };
      const body = new URLSearchParams({ title, desp });
      const response = await fetchImpl(`https://sctapi.ftqq.com/${sendKey}.send`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      if (!response.ok) {
        throw new Error(`ServerChan 通知失败 - ${response.status}`);
      }
      return { sent: true };
    },
  };
}
```

- [ ] **Step 2: Implement the application runner**

```js
import { normalizeAccount, getSessionForAccount } from "../domain/account.js";
import { isExpired, formatExpireTime } from "../domain/session.js";
import { createFailureResult, createSuccessResult, summarizeResults } from "../domain/result.js";
import { loadEnvConfig } from "../infra/config/env.js";
import { createIkuuuClient } from "../infra/http/ikuuu-client.js";
import { createServerChanNotifier } from "../infra/notify/server-chan.js";
import { setGitHubOutput } from "../infra/output/github-output.js";

export async function runCheckin({ env = process.env, fetchImpl = fetch } = {}) {
  const config = loadEnvConfig(env);
  const client = createIkuuuClient({
    userUrl: config.userUrl,
    checkInUrl: config.checkInUrl,
    fetchImpl,
  });
  const notifier = createServerChanNotifier({
    sendKey: config.serverChanKey,
    fetchImpl,
  });

  const results = [];

  for (const rawAccount of config.accounts) {
    let account;
    try {
      account = normalizeAccount(rawAccount);
      const session = getSessionForAccount(account, config.accountSessions);
      if (isExpired(session.expire_in)) {
        throw new Error(`${account.name}(uid=${account.uid}): 登录态已过期，请更新 ACCOUNT_SESSIONS。`);
      }
      await client.checkSession(account, session);
      const successMessage = config.checkOnly
        ? (() => {
            const { expireDate, remainingText } = formatExpireTime(session.expire_in);
            return `登录态有效，过期时间 ${expireDate.toLocaleString("zh-CN", { hour12: false })}，剩余 ${remainingText}`;
          })()
        : (() => null)();

      if (config.checkOnly) {
        results.push(createSuccessResult(account, successMessage));
        continue;
      }

      const data = await client.checkIn(account, session);
      if (data.ret === 1 || (data.ret === 0 && data.msg.includes("已经签到"))) {
        results.push(createSuccessResult(account, data.msg));
      } else {
        throw new Error(data.msg || "签到失败。");
      }
    } catch (error) {
      const fallbackAccount = account || {
        name: rawAccount?.name || "unknown",
        uid: rawAccount?.uid || "unknown",
      };
      results.push(createFailureResult(fallbackAccount, error));
    }
  }

  const summary = summarizeResults(results, config.checkOnly);
  console.log(`\n${summary.text}\n`);
  setGitHubOutput("result", summary.text, env);

  try {
    await notifier.notify({
      title: config.checkOnly ? "iKuuu 登录态检查结果" : "iKuuu 签到结果",
      desp: summary.text,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`通知发送失败：${message}`);
  }

  return summary.hasError ? 1 : 0;
}
```

- [ ] **Step 3: Run a local smoke check**

Run: `node src/cli/main.js`
Expected: exits with config error because env vars are absent, but no module-not-found or syntax errors occur

- [ ] **Step 4: Commit application runner**

```bash
git add src/app src/cli src/infra/notify
git commit -m "refactor: add application runner and serverchan notifier"
```

### Task 5: Thin the workflow, remove Telegram, and refresh docs

**Files:**
- Modify: `.github/workflows/Checkin.yml`
- Modify: `README.md`

- [ ] **Step 1: Replace workflow with thin runner**

```yaml
name: IKUUU-Auto-Checkin

on:
  workflow_dispatch:
  schedule:
    - cron: "33 23 * * *"

jobs:
  checkin:
    name: Checkin
    runs-on: ubuntu-latest
    env:
      ACCOUNTS: ${{ secrets.ACCOUNTS }}
      ACCOUNT_SESSIONS: ${{ secrets.ACCOUNT_SESSIONS }}
      IKUUU_HOST: ${{ secrets.HOST }}
      CHECK_ONLY: ${{ vars.CHECK_ONLY }}
      SCKEY: ${{ secrets.SCKEY }}

    steps:
      - uses: actions/checkout@v5

      - name: Set up Node.js
        uses: actions/setup-node@v5
        with:
          node-version: 18

      - name: Install dependencies
        run: npm install

      - name: Run checkin app
        run: npm start
```

- [ ] **Step 2: Update README to match the new architecture**

```md
- `HOST`：可选。iKuuu 域名，支持 `ikuuu.fyi` 或完整 URL；实际运行时会映射到 `IKUUU_HOST`。
- `SCKEY`：可选。ServerChan SendKey。配置后会在脚本内部发送汇总通知。
- Telegram 通知已移除。
- GitHub Actions workflow 只负责运行 Node 应用。
```

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 4: Run package smoke check**

Run: `npm start`
Expected: exits with `ACCOUNTS 未配置。` when local env is absent

- [ ] **Step 5: Commit workflow and docs cleanup**

```bash
git add .github/workflows/Checkin.yml README.md package.json
git commit -m "refactor: simplify workflow and docs"
```

### Task 6: Final verification

**Files:**
- Verify only

- [ ] **Step 1: Inspect git status**

Run: `git status --short`
Expected: clean working tree

- [ ] **Step 2: Verify tests**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: Verify application startup**

Run: `npm start`
Expected: exits with a readable config error in a local env without secrets

- [ ] **Step 4: Summarize final migration impact**

Expected summary points:
- root script is now only a compatibility entrypoint
- notification moved from workflow to app
- Telegram support removed
- tests added for domain and env parsing logic
