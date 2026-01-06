// 不直接使用 Cookie 是因为 Cookie 过期时间较短。
import { appendFileSync } from "fs";
// 新增：Node.js 中显式导入 FormData（解决兼容性问题）
import { FormData } from "node:form-data";

const host = process.env.HOST || "ikuuu.one";

const logInUrl = `https://${host}/auth/login`;
const checkInUrl = `https://${host}/user/checkin`;

// 格式化 Cookie
function formatCookie(rawCookieArray) {
  const cookiePairs = new Map();

  for (const cookieString of rawCookieArray) {
    const match = cookieString.match(/^\s*([^=]+)=([^;]*)/);
    if (match) {
      cookiePairs.set(match[1].trim(), match[2].trim());
    }
  }

  return Array.from(cookiePairs)
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
}

// 登录获取 Cookie
async function logIn(account) {
  console.log(`${account.name}: 登录中...`);

  const formData = new FormData();
  formData.append("host", host);
  formData.append("email", account.email);
  formData.append("passwd", account.passwd);
  formData.append("code", "");
  formData.append("remember_me", "off");

  const response = await fetch(logInUrl, {
    method: "POST",
    body: formData,
    // 新增：添加请求头，适配部分服务器的 FormData 解析
    headers: formData.getHeaders()
  });

  if (!response.ok) {
    throw new Error(`网络请求出错 - ${response.status}`);
  }

  const responseJson = await response.json();

  if (responseJson.ret !== 1) {
    throw new Error(`登录失败: ${responseJson.msg}`);
  } else {
    console.log(`${account.name}: ${responseJson.msg}`);
  }

  let rawCookieArray = response.headers.getSetCookie();
  if (!rawCookieArray || rawCookieArray.length === 0) {
    throw new Error(`获取 Cookie 失败`);
  }

  return { ...account, cookie: formatCookie(rawCookieArray) };
}

// 签到
async function checkIn(account) {
  const response = await fetch(checkInUrl, {
    method: "POST",
    headers: {
      Cookie: account.cookie,
      // 新增：添加默认请求头，避免接口拒绝
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    },
  });

  if (!response.ok) {
    throw new Error(`网络请求出错 - ${response.status}`);
  }

  const data = await response.json();
  console.log(`${account.name}: ${data.msg}`);

  return data.msg;
}

// 处理单账户
async function processSingleAccount(account) {
  const cookedAccount = await logIn(account);
  const checkInResult = await checkIn(cookedAccount);
  return checkInResult;
}

// 输出结果到 GitHub Actions
function setGitHubOutput(name, value) {
  // 兼容：若 GITHUB_OUTPUT 不存在（本地测试），则不写入
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `${name}<<EOF\n${value}\nEOF\n`);
  }
}

// 入口函数
async function main() {
  let accounts;

  try {
    if (!process.env.ACCOUNTS) {
      throw new Error("❌ 未配置账户信息。");
    }

    accounts = JSON.parse(process.env.ACCOUNTS);
  } catch (error) {
    const message = `❌ ${
      error.message.includes("JSON") ? "账户信息配置格式错误。" : error.message
    }`;
    console.error(message);
    setGitHubOutput("result", message);
    process.exit(1);
  }

  const allPromises = accounts.map((account) => processSingleAccount(account));
  const results = await Promise.allSettled(allPromises);

  const msgHeader = "\n======== 签到结果 ========\n\n";
  console.log(msgHeader);

  let hasError = false;

  const resultLines = results.map((result, index) => {
    const accountName = accounts[index].name;
    const isSuccess = result.status === "fulfilled";

    if (!isSuccess) hasError = true;

    const icon = isSuccess ? "✅" : "❌";
    const message = isSuccess ? result.value : result.reason.message;
    const line = `${accountName}: ${icon} ${message}`;

    isSuccess ? console.log(line) : console.error(line);
    return line;
  });

  const resultMsg = resultLines.join("\n");
  setGitHubOutput("result", resultMsg);

  if (hasError) process.exit(1);
}

// 执行入口
main().catch((error) => {
  console.error("❌ 脚本执行异常：", error.message);
  setGitHubOutput("result", `脚本执行异常：${error.message}`);
  process.exit(1);
});
