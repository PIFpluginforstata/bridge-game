# Bridge Duel 服务器部署指南

## 为什么需要自建服务器？

默认的Replit服务器位于美国，对于新加坡-中国之间的连接延迟较高。部署一个位于亚太地区（如香港、新加坡）的服务器可以显著降低延迟。

## 快速部署方案

### 方案1：Railway（推荐，最简单）

1. 访问 [Railway](https://railway.app)
2. 使用GitHub登录
3. 创建新项目 → "Deploy from GitHub repo"
4. 选择此仓库的 `server` 目录
5. Railway会自动检测Node.js项目并部署
6. 部署完成后，复制提供的URL（如 `https://xxx.railway.app`）
7. 在游戏中的"服务器设置"里粘贴此URL

### 方案2：Render

1. 访问 [Render](https://render.com)
2. 创建新的 Web Service
3. 连接GitHub仓库
4. 设置：
   - Root Directory: `server`
   - Build Command: `npm install`
   - Start Command: `npm start`
5. 部署后使用提供的URL

### 方案3：Fly.io（最低延迟）

```bash
# 安装 flyctl
curl -L https://fly.io/install.sh | sh

# 登录
flyctl auth login

# 在 server 目录中初始化
cd server
flyctl launch

# 选择香港或新加坡区域
# 部署
flyctl deploy
```

### 方案4：自建VPS

推荐香港或新加坡的VPS提供商：
- 阿里云（香港/新加坡）
- 腾讯云（香港/新加坡）
- Vultr（新加坡）
- DigitalOcean（新加坡）

```bash
# 在服务器上
git clone <your-repo>
cd bridge-game/server
npm install
npm start

# 或使用 PM2 保持运行
npm install -g pm2
pm2 start index.js --name bridge-server
pm2 save
pm2 startup
```

## 本地测试

```bash
cd server
npm install
npm start
```

服务器将在 `http://localhost:3000` 启动。

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| PORT | 服务器端口 | 3000 |

## 健康检查

访问 `http://your-server/health` 查看服务器状态。

## 注意事项

1. **CORS**: 生产环境建议在 `index.js` 中限制 `cors.origin`
2. **HTTPS**: 云平台通常自动提供HTTPS，自建VPS需要配置Nginx/Caddy
3. **防火墙**: 确保服务器端口对外开放

## 故障排查

1. **连接超时**: 检查服务器防火墙设置
2. **延迟高**: 尝试更靠近你位置的服务器区域
3. **连接不稳定**: 检查网络环境，VPN可能会影响连接
