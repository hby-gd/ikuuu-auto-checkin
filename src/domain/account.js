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

  if (!session || typeof session !== "object") {
    throw new ConfigError(`${account.name}(uid=${account.uid}): ACCOUNT_SESSIONS 缺少该 uid 的 key/expire_in。`);
  }

  if (!session.key || !expireIn) {
    throw new ConfigError(`${account.name}(uid=${account.uid}): ACCOUNT_SESSIONS 缺少 key/expire_in。`);
  }

  return {
    key: String(session.key).trim(),
    expire_in: String(expireIn).trim(),
  };
}
