import { ConfigError } from "../../domain/errors.js";

function parseJsonEnv(source, name, required = false) {
  const raw = source[name];
  if (!raw) {
    if (required) {
      throw new ConfigError(`${name} 未配置。`);
    }
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
      if (parsed.hostname) {
        return new URL(parsed.origin);
      }
    } catch {
      // Try the next candidate.
    }
  }

  return new URL("https://ikuuu.fyi");
}

export function loadEnvConfig(source = process.env) {
  const accounts = parseJsonEnv(source, "ACCOUNTS", true);
  const accountSessions = parseJsonEnv(source, "ACCOUNT_SESSIONS", true);

  if (!Array.isArray(accounts)) {
    throw new ConfigError("ACCOUNTS 必须是数组。");
  }

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
