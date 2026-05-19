function formatPrefix(account) {
  return `${account.name}(uid=${account.uid})`;
}

export function createSuccessResult(account, message) {
  return {
    account,
    ok: true,
    message,
    line: `${formatPrefix(account)}: ✅ ${message}`,
  };
}

export function createFailureResult(account, error) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    account,
    ok: false,
    message,
    line: `${formatPrefix(account)}: ❌ ${message}`,
  };
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
