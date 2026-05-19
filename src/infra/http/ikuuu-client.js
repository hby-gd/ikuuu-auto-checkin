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
    if (response.status >= 300 && response.status < 400 && location.includes("/auth/login")) {
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

      if (text.includes("/auth/login")) {
        throw new AuthError(loginHint);
      }

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
