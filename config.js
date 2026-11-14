/* AMC 前端配置：部署时只改这里 */
window.MCW_CONFIG = {
  /* 实时数据服务基址（Cloudflare Pages Functions）；留空 = 未连接 */
  api: "https://amc-world.pages.dev",
  /* 公网连接地址由 /api/link/start 返回，前端不再保存静态地址 */
  port: 25565,
  /* 服务器支持的最低版本（ViaVersion 协议翻译，1.21.11 ~ 26.3 都能进） */
  version: "1.21.11 ~ 26.3",
  /* Cloudflare Turnstile 公开 sitekey（managed 模式） */
  turnstileSiteKey: "0x4AAAAAAF8pZyOllpMEJe5F",
  /* 账号页地址；留空 = 暂未开放 */
  accountUrl: "",
  /* 内部来源白名单：只按 URL.hostname 精确匹配，禁止字符串前缀判断 */
  internalHosts: [
    "amazing-minecraft.pages.dev",
    "amc-world.pages.dev",
    "omc-world.github.io",
    "omc-studio.github.io",
    "127.0.0.1",
    "localhost"
  ],
  /* 访问门模式：on-demand（默认，只在敏感动作前验证）| all（全站强制） */
  gateMode: "on-demand",
  /* 轮询间隔（毫秒） */
  pollMs: 5000
};