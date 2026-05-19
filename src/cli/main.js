import { runCheckin } from "../app/run-checkin.js";

try {
  const exitCode = await runCheckin();
  process.exitCode = exitCode;
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`❌ 脚本执行异常：${message}`);
  process.exitCode = 1;
}
