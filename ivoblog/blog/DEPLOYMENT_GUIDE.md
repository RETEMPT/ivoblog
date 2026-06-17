# 部署与本地预览指南

本文档对应前台博客目录：

```text
E:\iV0Blogs-main\ivoblog\blog
```

## 本地预览

```powershell
cd E:\iV0Blogs-main\ivoblog\blog
npm install
npm run dev
```

打开：

```text
http://127.0.0.1:3000
```

如果 3000 端口被占用，可以使用：

```powershell
npm run dev -- --hostname 127.0.0.1 --port 3001
```

## 生产构建检查

```powershell
npm run build
npm run start
```

部署前至少跑一次 `npm run build`。构建通过后再上线，能提前发现 JSX、路由、配置和静态生成问题。

## 环境变量

本地创建 `.env.local`：

```env
DEEPSEEK_API_KEY=your_api_key
QWEATHER_KEY=your_weather_key
```

线上部署时，在 Vercel 或你的服务器环境变量面板里添加同名变量。

不要把真实密钥写进 `siteConfig.ts`。

## AI 设置

管理端设置页可以调整：

- API Key
- Prompt
- 模型名称
- 思考强度
- 最大输出 tokens
- temperature

保存 API Key 后，需要重启本地 Next.js 服务或重新部署线上环境，环境变量才会生效。

## Vercel 部署

1. 推送代码到你的 Git 仓库。
2. 在 Vercel 新建项目并导入仓库。
3. Root Directory 设置为 `ivoblog/blog`。
4. Build Command 设置为 `npm run build`。
5. 添加 `DEEPSEEK_API_KEY`、`QWEATHER_KEY` 等环境变量。
6. 部署后测试首页、文章页、音乐页、AI 接口和天气接口。

## 自定义域名

旧模板的 `public/CNAME` 已删除，避免误绑旧域名。

如需绑定自己的域名，请在 Vercel 的 Project Settings -> Domains 中添加，再按平台提示配置 DNS。

## 运行稳定性建议

- 修改 `siteConfig.ts` 后先运行 `npm run build`。
- 修改环境变量后重启开发服务器。
- 图片链接建议使用稳定图床或放入 `public/`。
- Gitalk 评论配置为空时评论组件不会正常登录，需要填入自己的 OAuth 配置。
- API Key、图床 token 等密钥只放 `.env.local` 或部署平台环境变量。
