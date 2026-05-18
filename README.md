## iKuuu 定时自动签到

> 利用 Github Actions 实现自动签到，支持多账户，支持 Telegram 通知。

[![IKUUU-Auto-Checkin](https://github.com/ewigl/ikuuu-auto-checkin/actions/workflows/Checkin.yml/badge.svg)](https://github.com/ewigl/ikuuu-auto-checkin/actions/workflows/Checkin.yml)

### 仓库变量

- `ACCOUNTS`：必填。固定为账号数组，每项必须包含 `name`、`uid`、`email`。

```json
[
  {
    "name": "test",
    "uid": "192782",
    "email": "hby_gd%40163.com"
  }
]
```

- `ACCOUNT_SESSIONS`：必填。固定为对象，键为 `uid`，值中填写 `key` 和 `expire_in`。

```json
{
  "192782": {
    "key": "这里填写 key",
    "expire_in": "1779589183"
  }
}
```

- `HOST`：iKuuu 的域名，不设置时默认为 `ikuuu.fyi`。
- `CHECK_ONLY`：可选。设为 `true` 时只检查登录态是否有效，不执行签到。
- `TELEGRAM_TOKEN`：可选。Telegram Bot Token。
- `TELEGRAM_TO`：可选。Telegram Chat ID。

### 使用方式

1. Fork 此仓库。
2. 在 fork 后的仓库中启用 Actions。
3. 配置 `ACCOUNTS` 和 `ACCOUNT_SESSIONS`。
4. 登录态更新时，只手动修改 `ACCOUNT_SESSIONS` 中对应 `uid` 的 `key` 和 `expire_in`。

### 输出说明

- 正常模式会先检查登录态，再执行签到。
- `CHECK_ONLY=true` 时只输出登录态有效性、过期时间和剩余时长。
- 当前最小有效登录态字段为：
  - `uid`
  - `email`
  - `key`
  - `expire_in`

### 注意事项

- 账号密码自动登录已不再支持。当前登录页接入 Geetest 验证，自动化稳定性差。
- `ACCOUNT_SESSIONS` 必须按 `uid` 配置，不再按 `name` 匹配。
- `expire_in` 是 Unix 时间戳，单位为秒。
- 当 `expire_in` 已过期或站点返回未登录状态时，脚本会提示你更新 `ACCOUNT_SESSIONS`。

根据 Github 的政策，当 60 天内未发生仓库活动时，将自动禁用定时 Workflow，需要再次手动启用。
