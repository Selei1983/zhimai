# 知脉服务器部署

这份部署方式适合先在服务器上调试产品 Demo：服务器拉取 GitHub 代码，用 Docker 构建并启动 Web 应用。

## 1. 准备目录

```bash
mkdir -p /opt/zhimai
cd /opt/zhimai
```

如果是第一次部署：

```bash
git clone git@github.com:Selei1983/zhimai.git .
```

如果已经部署过：

```bash
git pull origin main
```

## 2. 配置环境变量

```bash
cp .env.production.example .env.production
```

编辑 `.env.production`，至少补齐：

```bash
INSFORGE_ANON_KEY="..."
NEXT_PUBLIC_INSFORGE_ANON_KEY="..."
AI_CONFIG_SECRET="一段足够长的随机字符串"
```

这里不需要配置 OpenAI、Claude 或其他模型 API Key。每个用户的模型 Key 在知脉的「配置」里自行填写，服务端只用 `AI_CONFIG_SECRET` 对这些用户 Key 做加密保存。

`INSFORGE_BASE_URL` 和 `NEXT_PUBLIC_INSFORGE_BASE_URL` 默认指向 `https://api.yuankun.cloud`。

## 3. 启动

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

默认会把应用发布到服务器的 `3010` 端口。

## 4. 检查

```bash
docker ps
docker logs --tail=100 zhimai-web
curl http://127.0.0.1:3010
```

如果服务器安全组放行了 `3010`，可以用浏览器访问：

```text
http://服务器 IP:3010
```

## 5. 更新

```bash
cd /opt/zhimai
git pull origin main
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```
