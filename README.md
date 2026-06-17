# iV0 Blog

iV0 Blog 是一个基于 Next.js 16、React 19、Tailwind CSS 4 的个人博客项目，包含公开博客前台和本地管理端。项目以本地内容管理为主：文章、随笔、图集、友链、项目、音乐配置和站点设置都优先从本地文件同步，图片和音乐封面等资源建议使用本地上传后的路径，避免依赖外链长期读取。

## 项目结构

```text
E:\iV0Blogs-main\
  README.md              # 顶层说明、部署和 GitHub 推送指南
  start-blog.bat         # 启动公开博客
  start-manager.bat      # 启动本地管理端
  check-data-sync.bat    # 检查/同步前后端数据文件
  ivoblog/
    blog/                # 公开博客前台，部署到 Vercel 或静态站点
    my-blog-manager/     # 本地管理端，包含 Next.js 管理界面和 Python CMS 后端
    picture/             # 文档图片
    scripts/             # 数据同步脚本
    README_en.md         # 英文说明
    LICENSE
```

## 环境要求

- Node.js 18 或更高版本，推荐 LTS。
- npm。
- Python 3.10 或更高版本，管理端后端需要。
- Git，推送 GitHub、源码同步和部署需要。

## 本地启动

在项目第一层目录可以直接双击脚本：

```text
start-blog.bat      # http://127.0.0.1:3000
start-manager.bat   # http://127.0.0.1:3001/settings，后端 http://127.0.0.1:52560
```

也可以手动启动公开博客：

```powershell
cd E:\iV0Blogs-main\ivoblog\blog
npm install
npm run dev
```

手动启动管理端：

```powershell
cd E:\iV0Blogs-main\ivoblog\my-blog-manager
npm install
python run_me.py
```

管理端是本地工具，不建议直接公开部署到公网。它会读写本地文章、配置、图集和同步数据；如果必须让局域网访问，请先确认 CMS API Key、CORS 和访问边界已经配置好。

## 数据同步

管理端是图集、友链、项目等结构化数据的主要编辑入口。编辑后建议在项目第一层运行：

```powershell
cd E:\iV0Blogs-main
.\check-data-sync.bat
```

如果脚本提示前后台数据不同步，并且确认以管理端数据为准：

```powershell
.\check-data-sync.bat --write
```

图片、头像、专辑封面和文章插图建议通过管理端上传到本地 `public/uploads/` 或对应内容目录，再由配置文件引用本地路径。这样 Vercel、GitHub Pages 或静态托管读取的都是仓库里的资源，不依赖外链是否可用。

## 推送到 GitHub

第一次把顶层项目推送到 GitHub：

```powershell
cd E:\iV0Blogs-main
git init
git branch -M main
git add .
git commit -m "Initial iV0 blog"
git remote add origin git@github.com:<owner>/<repo>.git
git push -u origin main
```

如果已经设置过远程仓库，日常更新使用：

```powershell
cd E:\iV0Blogs-main
git status
git add .
git commit -m "Update blog"
git push
```

推送前重点检查：

- 不要提交 `.env.local`、真实 API Key、网易云 Cookie、私钥和本地缓存。
- 不要提交 `.next/`、`node_modules/`、`logs/`、`.music-cache.json` 等运行产物。
- 本地上传并希望随站点部署的图片、封面和文章内容可以提交。
- 如果误把敏感文件加入暂存区，先执行 `git restore --staged <file>`，已经推送过的密钥要立即轮换。

本仓库顶层 `.gitignore` 已覆盖常见构建产物、缓存、日志、本地环境变量和管理端本地配置。

## Vercel 部署公开博客

推荐用 Vercel 部署完整的 Next.js 博客，因为它能正常运行 Next API Route，例如音乐、AI、天气、GitHub 信息等接口。

1. 先按上面的步骤把项目推送到 GitHub。
2. 在 Vercel 新建项目并导入这个 GitHub 仓库。
3. Root Directory 填写：

```text
ivoblog/blog
```

4. Build Command 保持：

```text
npm run build
```

5. 需要时在 Vercel Environment Variables 配置：

```text
DEEPSEEK_API_KEY
QWEATHER_KEY
MUSIC_BACKEND_BASE
NETEASE_MUSIC_COOKIE
```

6. 部署完成后检查首页、文章页、图集、音乐页、AI 路由和天气路由。

如果只想部署公开博客，不部署管理端，Vercel 的 Root Directory 一定要指向 `ivoblog/blog`。管理端仍然在本地用 `start-manager.bat` 启动。

## GitHub Pages 静态部署

GitHub Pages 只适合静态站点。使用它时，动态 API Route 不会在 Pages 上运行；音乐接口、AI 接口、天气接口等服务端能力建议改用 Vercel。

如果确认只发布静态页面，可以使用管理端的部署设置：

1. 打开 `start-manager.bat`。
2. 进入部署或仓库设置区域。
3. 配置静态仓库地址，例如：

```text
git@github.com:<owner>/<pages-repo>.git
```

4. 静态分支通常使用：

```text
gh-pages
```

5. 在 GitHub 仓库 Settings -> Deploy keys 中添加管理端生成的静态部署公钥，并勾选写入权限。
6. 先执行初始化，再执行发布。

手动方式：

```powershell
cd E:\iV0Blogs-main\ivoblog\blog
npm install
npm run build
npm run deploy
```

如果 `npm run deploy` 提示找不到 `out` 目录，需要确认 Next.js 已配置静态导出。未配置静态导出时，请优先使用 Vercel。

## 管理端源码同步到 GitHub

管理端支持把源码推送到 GitHub，常用于触发 Vercel 自动部署。推荐准备一个源码仓库，例如 `iv0-blog-source`。

1. 在 GitHub 创建源码仓库。
2. 打开本地管理端。
3. 在部署设置中生成 Source/B 线 SSH 公钥。
4. 到 GitHub 仓库 Settings -> Deploy keys 添加该公钥，并勾选写入权限。
5. Source Repo URL 推荐使用管理端生成的 host 别名：

```text
git@github-source:<owner>/<repo>.git
```

6. Source Branch 通常填写：

```text
main
```

7. 点击源码同步。同步成功后，Vercel 会根据 GitHub 推送自动部署。

如果用普通 SSH 地址 `git@github.com:<owner>/<repo>.git`，要确认当前机器的默认 GitHub SSH Key 对该仓库有写入权限。

## 推荐发布流程

每次准备发布前按这个顺序走，逻辑最清楚：

1. 在管理端完成文章、图集、音乐、配置等编辑。
2. 确认图片、封面、头像等资源使用本地上传路径。
3. 运行 `.\check-data-sync.bat`，必要时运行 `.\check-data-sync.bat --write`。
4. 在 `ivoblog\blog` 运行 `npm run build` 做部署前检查。
5. 提交到 GitHub：

```powershell
cd E:\iV0Blogs-main
git status
git add .
git commit -m "Update content and config"
git push
```

6. 如果使用 Vercel，等待自动部署完成。
7. 如果使用管理端源码同步，点击管理端的源码同步按钮。
8. 如果使用 GitHub Pages，点击管理端的静态发布按钮，或执行 `npm run deploy`。

## 常见问题

### Local Python backend is not connected

先确认 `start-manager.bat` 仍在运行，并能访问：

```text
http://127.0.0.1:52560/api/status
```

如果前端端口显示被占用，关闭旧的 Next dev 进程后重新启动管理端。

### 专辑封面或图片不显示

优先确认配置里保存的是本地路径，并且文件已经提交到仓库。常见路径形如：

```text
/uploads/...
/albums/...
/images/...
```

不建议依赖第三方外链作为长期封面来源。

### GitHub 推送提示 Permission denied

检查远程地址和 SSH Key：

```powershell
git remote -v
ssh -T git@github.com
```

如果使用管理端 Source/B 线生成的 key，源码仓库地址建议使用 `git@github-source:<owner>/<repo>.git`。

### GitHub Pages 上接口不可用

这是平台限制。GitHub Pages 只能托管静态文件，不能运行 Next.js API Route。需要完整功能时使用 Vercel。

## 许可证

许可证见 `ivoblog/LICENSE`。部署前请确认文章、图片、音乐、字体和第三方服务配置都有合法使用权限。
