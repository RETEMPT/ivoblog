# 云服务器部署指南 — vilatileno.xyz

本文档说明如何将 iV0 Blog 通过 Docker 部署到云服务器，并绑定域名 `vilatileno.xyz`。

使用 Nginx 反向代理 + Let's Encrypt 自动 SSL。

---

## 目录结构

部署相关文件均位于项目根目录下的 `deploy/`：

```
deploy/
├── docker-compose.yml          # 服务编排（blog + nginx + certbot）
├── deploy.sh                   # 一键部署/管理脚本
├── nginx/
│   ├── nginx.conf              # Nginx 主配置
│   └── conf.d/
│       └── vilatileno.xyz.conf # 域名虚拟主机配置
```

另外：
```
ivoblog/blog/
├── Dockerfile                  # Blog 容器镜像
├── .dockerignore               # Docker 构建忽略文件
├── .env.production             # 生产环境变量（需填写真实密钥）
└── next.config.ts              # 已配置 output: "standalone"
```

---

## 前置条件

### 1. 云服务器

- **系统**：Ubuntu 22.04 / 24.04（推荐），Debian 12，或其他 Linux 发行版
- **配置**：至少 1 核 1GB RAM（推荐 2 核 2GB）
- **已安装**：Docker、Docker Compose v2

安装 Docker（如果尚未安装）：

```bash
# Ubuntu / Debian
sudo apt update
sudo apt install -y docker.io docker-compose-v2
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
# 重新登录使权限生效
```

### 2. 域名 DNS

在域名管理面板（Cloudflare / 阿里云 / DNSPod 等）添加 DNS 记录：

| 类型 | 名称 | 值 |
|------|------|-----|
| A    | @    | `<你的服务器IP>` |
| A    | www  | `<你的服务器IP>` |

DNS 生效通常需要几分钟到几小时。

### 3. 防火墙 / 安全组

确保云服务器防火墙允许以下端口：

| 端口 | 协议 | 用途 |
|------|------|------|
| 80   | TCP  | HTTP（Let's Encrypt 验证） |
| 443  | TCP  | HTTPS（网站访问） |
| 22   | TCP  | SSH（远程管理） |

**不要放开 3000 端口** — blog 容器只在 Docker 内网监听，不直接暴露。

---

## 快速开始（全新部署）

### 第 1 步：上传项目到服务器

在本地打包项目（排除 node_modules）：

```powershell
# 从项目根目录
tar --exclude='node_modules' --exclude='.next' --exclude='.git' -czf ../iv0blog.tar.gz .
```

上传到服务器：

```bash
scp ../iv0blog.tar.gz root@<你的服务器IP>:/root/
```

在服务器上解压：

```bash
ssh root@<你的服务器IP>
mkdir -p /opt/iv0blog
cd /opt/iv0blog
tar -xzf /root/iv0blog.tar.gz
```

### 第 2 步：配置环境变量

```bash
cd /opt/iv0blog

# 编辑生产环境变量
nano ivoblog/blog/.env.production
```

必须填写的内容：

```env
# 必填：DeepSeek AI 聊天（不填则 AI 功能不可用）
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxx

# 选填：天气（不填则天气功能不可用）
QWEATHER_KEY=your_qweather_key_here

# 选填：网易云音乐（不填则本地音乐 & 歌词获取可能受限）
NETEASE_MUSIC_COOKIE=your_netease_cookie_here
```

> **安全提醒**：`.env.production` 已加入 `.gitignore` / `.dockerignore`，不会被提交或打包进镜像。

### 第 3 步：首次签发 SSL 证书

```bash
cd /opt/iv0blog/deploy
chmod +x deploy.sh

# 设置 Let's Encrypt 通知邮箱
export EMAIL="your-email@example.com"

# 签发证书
./deploy.sh init-ssl
```

> 此步骤**仅需运行一次**。之后 certbot 容器会自动续期。

### 第 4 步：构建并启动

```bash
./deploy.sh deploy
```

首次构建约 3-5 分钟（取决于服务器性能）。之后更新代码只需要几十秒。

### 第 5 步：验证

```bash
# 检查服务状态
./deploy.sh status

# 浏览器访问
# https://vilatileno.xyz
```

---

## 常用管理命令

```bash
cd /opt/iv0blog/deploy

# 查看状态
./deploy.sh status

# 查看 blog 日志（实时）
./deploy.sh logs

# 查看 nginx 日志
./deploy.sh logs nginx

# 重启 blog
./deploy.sh restart

# 停止所有服务
./deploy.sh stop

# 更新代码后重建
git pull                                    # 如果用 git 管理
./deploy.sh deploy                          # 重新构建 + 启动
```

### 直接用 Docker Compose：

```bash
cd /opt/iv0blog/deploy

docker compose ps                          # 查看服务状态
docker compose logs -f blog                # 查看日志
docker compose up -d --build blog           # 仅重建 blog
docker compose restart blog                 # 重启 blog
docker compose down                         # 停止所有服务
```

---

## 架构说明

```
Internet (HTTPS:443)
    │
    ▼
┌─────────────────┐
│   Nginx (:443)   │  SSL 终止、反向代理、静态缓存
│   nginx:alpine    │
└───────┬─────────┘
        │  proxy_pass http://blog:3000
        ▼
┌─────────────────┐
│   Blog (:3000)   │  Next.js 16 standalone
│   node:22-alpine │
└─────────────────┘
        │
        ├──► DeepSeek API (AI chat)
        ├──► NetEase API (music)
        └──► GitHub API (Gitalk comments)

┌─────────────────┐
│   Certbot        │  自动续期 SSL 证书（每12小时检查）
│   certbot/certbot │
└─────────────────┘
```

### 数据持久化

| 数据 | 持久化方式 |
|------|-----------|
| 上传文件（图片/音乐） | Docker volume `blog_uploads` |
| 博客文章 | 只读挂载 `posts/`、`chatters/`、`moments/` |
| SSL 证书 | Docker volume `certbot_certs` |

---

## 更新部署

当你修改了博客代码或文章后：

### 方式 A：重新构建（代码改动）

```bash
cd /opt/iv0blog/deploy
git pull                                    # 拉取最新代码
./deploy.sh deploy                          # 重建镜像并重启
```

### 方式 B：仅更新文章（无需重建镜像）

文章目录 `posts/`、`chatters/`、`moments/` 是只读挂载到容器的：

```bash
cd /opt/iv0blog/deploy
docker compose restart blog                 # 重启即可读取新文章
```

---

## 故障排查

### Blog 启动失败

```bash
# 查看完整日志
docker compose logs blog

# 常见原因：
# 1. .env.production 格式错误 — 检查是否有特殊字符
# 2. 构建失败 — 在本地先运行 npm run build 确认可构建
```

### SSL 证书问题

```bash
# 手动续期
docker compose run --rm certbot renew

# 查看证书状态
docker compose run --rm certbot certificates
```

### 端口被占用

```bash
# 检查 80/443 端口
sudo lsof -i :80
sudo lsof -i :443

# 如果系统自带 nginx/apache 占用了端口，先停掉：
sudo systemctl stop nginx
sudo systemctl disable nginx
```

### 内存不足

构建 Next.js 可能需要较多内存。如果服务器只有 1GB 内存：

```bash
# 创建 swap
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# 永久生效
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## DNS 配置示例

### Cloudflare（推荐，免费 CDN）

1. 添加 A 记录：`vilatileno.xyz` → 服务器 IP，关闭代理（灰云，SSL 已由 certbot 处理）
2. 添加 A 记录：`www.vilatileno.xyz` → 服务器 IP（或 CNAME 到 @）
3. SSL/TLS 模式：**Full** 或 **Full (strict)**

> ⚠️ 如果用 Cloudflare 代理（橙云），需要把 SSL 模式设为 "Full"，否则会出现重定向循环。推荐先关闭代理，确认部署成功后再开启。

### 阿里云 / DNSPod

添加两条 A 记录：

| 主机记录 | 记录类型 | 记录值 |
|----------|----------|--------|
| @        | A        | 服务器 IP |
| www      | A        | 服务器 IP |

---

## 安全建议

- [ ] 服务器开启防火墙（UFW）：`sudo ufw allow 22,80,443/tcp && sudo ufw enable`
- [ ] 禁用 root SSH 密码登录，使用 SSH Key
- [ ] 定期更新系统：`sudo apt update && sudo apt upgrade`
- [ ] `.env.production` 文件权限设为 600：`chmod 600 ivoblog/blog/.env.production`
- [ ] 不要将 `.env.production` 提交到 Git
