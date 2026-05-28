## iKuuu 定时自动签到

> 本项目已停止维护。iKuuu 现有登录态有效期过短，且登录页接入 Geetest 验证码，纯 GitHub Actions + 静态 cookie 的自动签到方案已不再可靠。

[![IKUUU-Auto-Checkin](https://github.com/ewigl/ikuuu-auto-checkin/actions/workflows/Checkin.yml/badge.svg)](https://github.com/ewigl/ikuuu-auto-checkin/actions/workflows/Checkin.yml)

## 停止维护说明

- 站点当前登录态依赖 `key` 和 `expire_in`，其中 `expire_in` 已缩短到近似半天级别，无法长期复用。
- 当前登录页会向 `/auth/login` 提交 `captcha_result`，实际接入 Geetest V4 验证码，无法稳定通过 GitHub Actions 自动续签。
- 因此，本仓库基于静态 `ACCOUNT_SESSIONS` 的自动签到方案已失去长期无人值守意义。

结论：本项目不再适合作为自动签到方案，建议停止使用，也不再继续维护。
