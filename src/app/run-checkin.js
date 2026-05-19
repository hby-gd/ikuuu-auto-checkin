import { createFailureResult, createSuccessResult, summarizeResults } from "../domain/result.js";
import { getSessionForAccount, normalizeAccount } from "../domain/account.js";
import { formatExpireTime, isExpired } from "../domain/session.js";
import { loadEnvConfig } from "../infra/config/env.js";
import { createIkuuuClient } from "../infra/http/ikuuu-client.js";
import { createServerChanNotifier } from "../infra/notify/server-chan.js";
import { setGitHubOutput } from "../infra/output/github-output.js";

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export async function runCheckin({ env = process.env, fetchImpl = fetch } = {}) {
  let config;

  try {
    config = loadEnvConfig(env);
  } catch (error) {
    const message = `❌ ${getErrorMessage(error)}`;
    console.error(message);
    setGitHubOutput("result", message, env);
    return 1;
  }

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
        throw new Error("登录态已过期，请更新 ACCOUNT_SESSIONS。");
      }

      await client.checkSession(account, session);

      if (config.checkOnly) {
        const { expireDate, remainingText } = formatExpireTime(session.expire_in);
        const message = `登录态有效，过期时间 ${expireDate.toLocaleString("zh-CN", { hour12: false })}，剩余 ${remainingText}`;
        results.push(createSuccessResult(account, message));
        continue;
      }

      const data = await client.checkIn(account, session);
      if (data.ret === 1 || (data.ret === 0 && data.msg.includes("已经签到"))) {
        results.push(createSuccessResult(account, data.msg));
        continue;
      }

      throw new Error(data.msg || "签到失败。");
    } catch (error) {
      const fallbackAccount = account || {
        name: String(rawAccount?.name || "unknown"),
        uid: String(rawAccount?.uid || "unknown"),
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
    console.error(`通知发送失败：${getErrorMessage(error)}`);
  }

  return summary.hasError ? 1 : 0;
}
