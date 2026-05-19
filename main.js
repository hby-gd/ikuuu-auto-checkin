import { appendFileSync } from "fs";

function normalizeHost(rawHost) {
  let value = String(rawHost || "ikuuu.fyi").trim();

  // Allow copied values like "https://example.com/user" or quoted secrets.
  value = value.replace(/^['"]+|['"]+$/g, "");
  value = value.replace(/\/+(user|auth\/login|user\/checkin).*$/i, "");

  const candidates = [];
  if (/^https?:\/\//i.test(value)) {
    candidates.push(value);
  } else if (value.startsWith("//")) {
    candidates.push(`https:${value}`);
  } else {
    candidates.push(`https://${value.replace(/^\/+/, "")}`);
    candidates.push(value);
  }

  for (const candidate of candidates) {
    try {
      const parsed = new URL(candidate);
      if (!parsed.hostname) {
        continue;
      }
      return new URL(parsed.origin);
    } catch {
      // Try the next candidate.
    }
  }

  throw new Error(
    `HOST 配置无效，请填写域名或完整站点地址，例如 ikuuu.one 或 https://ikuuu.one`
  );
}

const hostUrl = normalizeHost(process.env.HOST);
const checkOnly = String(process.env.CHECK_ONLY || "").toLowerCase() === "true";

const userUrl = new URL("/user", hostUrl).toString();
const checkInUrl = new URL("/user/checkin", hostUrl).toString();
const loginHint = "登录态已失效，请更新 ACCOUNT_SESSIONS 中对应 uid 的 key/expire_in。";

function parseJsonEnv(name, required = false) {
  const raw = process.env[name];
  if (!raw) {
    if (required) {
      throw new Error(`${name} 未配置。`);
    }
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`${name} 配置格式错误。`);
  }
}

function buildCookie(account, session) {
  return [
    ["uid", account.uid],
    ["email", account.email],
    ["key", session.key],
    ["expire_in", session.exp_in || session.expire_in],
  ]
    .map(([key, value]) => `${key}=${String(value).trim()}`)
    .join("; ");
}

function getExpireIn(session) {
  return session.exp_in || session.expire_in;
}

function parseExpireIn(expireIn) {
  const expireAt = Number(expireIn);
  if (!Number.isFinite(expireAt) || expireAt <= 0) {
    throw new Error("expire_in 无效，请填写 Unix 时间戳（秒）。");
  }
  return expireAt;
}

function formatExpireTime(expireIn) {
  const expireAt = parseExpireIn(expireIn);
  const expireDate = new Date(expireAt * 1000);
  const remainingSeconds = Math.max(0, expireAt - Math.floor(Date.now() / 1000));
  const days = Math.floor(remainingSeconds / 86400);
  const hours = Math.floor((remainingSeconds % 86400) / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);

  return {
    expireAt,
    expireDate,
    remainingText: `${days}天 ${hours}小时 ${minutes}分钟`,
  };
}

function isExpired(expireIn) {
  return parseExpireIn(expireIn) <= Math.floor(Date.now() / 1000);
}

function validateAccount(account) {
  if (!account || typeof account !== "object") {
    throw new Error("账户信息格式错误。");
  }
  if (!account.name || !account.uid || !account.email) {
    throw new Error("ACCOUNTS 中每个账号都必须包含 name、uid、email。");
  }
}

function getSessionForAccount(account, accountSessions) {
  const session = accountSessions?.[String(account.uid)];
  if (!session || typeof session !== "object") {
    throw new Error(`${account.name}(uid=${account.uid}): ACCOUNT_SESSIONS 缺少该 uid 的 key/expire_in。`);
  }
  if (!session.key || !getExpireIn(session)) {
    throw new Error(`${account.name}(uid=${account.uid}): ACCOUNT_SESSIONS 缺少 key/expire_in。`);
  }
  return {
    key: session.key,
    expire_in: getExpireIn(session),
  };
}

async function parseJsonResponse(response) {
  const rawText = await response.text();
  try {
    return JSON.parse(rawText);
  } catch {
    throw new Error(rawText.includes("/auth/login") ? loginHint : `站点响应异常: ${rawText.slice(0, 120)}`);
  }
}

async function checkSession(account, session) {
  const response = await fetch(userUrl, {
    method: "GET",
    headers: {
      Cookie: buildCookie(account, session),
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    redirect: "manual",
  });

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location") || "";
    if (location.includes("/auth/login")) {
      throw new Error(loginHint);
    }
  }

  if (!response.ok) {
    throw new Error(`网络请求出错 - ${response.status}`);
  }

  const text = await response.text();
  if (text.includes("/auth/login")) {
    throw new Error(loginHint);
  }

  const { expireDate, remainingText } = formatExpireTime(session.expire_in);
  const sessionInfo = `登录态有效，过期时间 ${expireDate.toLocaleString("zh-CN", { hour12: false })}，剩余 ${remainingText}`;
  console.log(`${account.name}(uid=${account.uid}): ${sessionInfo}`);
  return sessionInfo;
}

async function checkIn(account, session) {
  const response = await fetch(checkInUrl, {
    method: "POST",
    headers: {
      Cookie: buildCookie(account, session),
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    redirect: "manual",
  });

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location") || "";
    if (location.includes("/auth/login")) {
      throw new Error(loginHint);
    }
  }

  if (!response.ok) {
    throw new Error(`网络请求出错 - ${response.status}`);
  }

  const data = await parseJsonResponse(response);
  if (!data || typeof data.ret !== "number" || typeof data.msg !== "string") {
    throw new Error("站点响应异常: 缺少 ret/msg 字段。");
  }

  if (data.ret === 1) {
    console.log(`${account.name}(uid=${account.uid}): ${data.msg}`);
    return data.msg;
  }

  if (data.ret === 0 && data.msg.includes("已经签到")) {
    console.log(`${account.name}(uid=${account.uid}): ${data.msg}`);
    return data.msg;
  }

  throw new Error(data.msg || "签到失败。");
}

async function processSingleAccount(account, accountSessions) {
  validateAccount(account);
  const session = getSessionForAccount(account, accountSessions);

  if (isExpired(session.expire_in)) {
    throw new Error(`${account.name}(uid=${account.uid}): 登录态已过期，请更新 ACCOUNT_SESSIONS。`);
  }

  const sessionInfo = await checkSession(account, session);
  if (checkOnly) {
    return sessionInfo;
  }

  return await checkIn(account, session);
}

function setGitHubOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `${name}<<EOF\n${value}\nEOF\n`);
  }
}

async function main() {
  let accounts;
  let accountSessions;

  try {
    accounts = parseJsonEnv("ACCOUNTS", true);
    if (!Array.isArray(accounts)) {
      throw new Error("ACCOUNTS 必须是数组。");
    }

    accountSessions = parseJsonEnv("ACCOUNT_SESSIONS", true);
    if (!accountSessions || Array.isArray(accountSessions) || typeof accountSessions !== "object") {
      throw new Error("ACCOUNT_SESSIONS 必须是对象，且键为 uid。");
    }
  } catch (error) {
    const message = `❌ ${error.message}`;
    console.error(message);
    setGitHubOutput("result", message);
    process.exit(1);
  }

  const results = await Promise.allSettled(
    accounts.map((account) => processSingleAccount(account, accountSessions))
  );

  const header = checkOnly ? "\n======== 登录态检查结果 ========\n\n" : "\n======== 签到结果 ========\n\n";
  console.log(header);

  let hasError = false;
  const resultLines = results.map((result, index) => {
    const account = accounts[index];
    const prefix = `${account.name}(uid=${account.uid})`;
    const isSuccess = result.status === "fulfilled";

    if (!isSuccess) hasError = true;

    const icon = isSuccess ? "✅" : "❌";
    const message = isSuccess ? result.value : result.reason.message;
    const line = `${prefix}: ${icon} ${message}`;

    isSuccess ? console.log(line) : console.error(line);
    return line;
  });

  const resultMsg = resultLines.join("\n");
  setGitHubOutput("result", resultMsg);

  if (hasError) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("❌ 脚本执行异常：", error.message);
  setGitHubOutput("result", `脚本执行异常：${error.message}`);
  process.exit(1);
});
