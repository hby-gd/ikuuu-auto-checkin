import { ConfigError } from "./errors.js";

function defaultNowSeconds() {
  return Math.floor(Date.now() / 1000);
}

export function parseExpireIn(expireIn) {
  const expireAt = Number(expireIn);
  if (!Number.isFinite(expireAt) || expireAt <= 0) {
    throw new ConfigError("expire_in 无效，请填写 Unix 时间戳（秒）。");
  }
  return expireAt;
}

export function isExpired(expireIn, nowSeconds = defaultNowSeconds) {
  return parseExpireIn(expireIn) <= nowSeconds();
}

export function formatExpireTime(expireIn, nowSeconds = defaultNowSeconds) {
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
