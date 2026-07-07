---
name: zhimai-server-deploy
description: Deploy, restart, and troubleshoot the Zhimai web app on the user's VPS. Use when the user asks to publish Zhimai, restart the server app, inspect Docker deployment failures, diagnose ports 3010/3001, handle /opt/zhimai Git sync, or debug zhimai-web container logs.
---

# Zhimai Server Deploy

## Context

Zhimai is deployed from GitHub to a VPS with Docker Compose.

- Repository: `https://github.com/Selei1983/zhimai.git`
- Server project path: `/opt/zhimai`
- Production compose file: `docker-compose.prod.yml`
- Web container: `zhimai-web`
- Public app port: `3010`
- Internal Next.js port: `3000`
- Existing unrelated service on `3001`: `cj-atplist` ("好物推荐")
- InsForge base URL: `https://api.yuankun.cloud`

Do not store or repeat server passwords or API keys in files or final answers.

## SSH Boundary

First test whether direct SSH is available from the current Codex environment.

If SSH returns `Operation not permitted`, the sandbox blocks outbound SSH. In that case, do not keep retrying. Give the user exact commands to run on the server and continue from the pasted output.

Use `127.0.0.1:3010` only inside the server to test whether the container responds locally. The browser-facing URL is `http://103.56.113.192:3010`.

## Deploy Or Update

Ask the user to run these on the server when direct SSH is unavailable:

```bash
mkdir -p /opt/zhimai
cd /opt/zhimai

if [ -d .git ]; then
  git pull origin main
else
  git clone https://github.com/Selei1983/zhimai.git .
fi
```

Ensure `.env.production` exists:

```bash
cd /opt/zhimai
cp -n .env.production.example .env.production
nano .env.production
```

Production env should include InsForge config and encryption secret. Do not require model provider API keys in server env; each user enters their own model key in the Zhimai UI.

```bash
DATA_BACKEND="insforge"
INSFORGE_BASE_URL="https://api.yuankun.cloud"
INSFORGE_ANON_KEY="..."
NEXT_PUBLIC_INSFORGE_BASE_URL="https://api.yuankun.cloud"
NEXT_PUBLIC_INSFORGE_ANON_KEY="..."
AI_CONFIG_SECRET="..."
```

Generate `AI_CONFIG_SECRET` with:

```bash
openssl rand -hex 32
```

Build and start:

```bash
cd /opt/zhimai
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Use `--no-cache` after Dockerfile, dependency, Prisma, or build changes:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml build --no-cache web
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

## Restart

Use this for a normal restart without rebuilding:

```bash
cd /opt/zhimai
docker compose --env-file .env.production -f docker-compose.prod.yml restart web
docker ps | grep zhimai
docker logs --tail=100 zhimai-web
```

Use this after pulling code:

```bash
cd /opt/zhimai
git pull origin main
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker ps | grep zhimai
docker logs --tail=100 zhimai-web
curl -I http://127.0.0.1:3010
```

## Health Checks

Always ask for these outputs when the page fails:

```bash
cd /opt/zhimai
docker ps -a | grep zhimai
docker logs --tail=200 zhimai-web
curl -I http://127.0.0.1:3010
ss -tulpn | grep 3010
```

Interpretation:

- No `zhimai-web`: app was not started or build failed.
- `Exited` or `Restarting`: inspect `docker logs`.
- Local `curl` succeeds but public URL fails: port/security group/firewall issue.
- Public `:3001` shows "好物推荐": user is hitting old `cj-atplist`, not Zhimai.
- Browser `127.0.0.1:3010`: user is hitting their own computer, not the server.

## Known Issues

`couldn't find env file: /root/.env.production`

The user ran compose from `/root`. Run from `/opt/zhimai` or pass the correct env path.

`No such container: zhimai-web`

The container has not been created. Build/start first.

`Connection refused` on `127.0.0.1:3010`

No process is listening. Check build/start failure and logs.

`Recv failure: Connection reset by peer`

Container started but app reset the connection. Check `docker ps -a` and `docker logs --tail=200 zhimai-web`.

`Module '"@prisma/client"' has no exported member 'PrismaClient'`

Docker built in a clean environment without generated Prisma Client. Ensure `apps/web/Dockerfile` runs `npm run db:generate` before `npm run build`.

`seed.ts` TypeScript errors around `folder`

Use explicit `folderId` instead of relying on TypeScript narrowing of a possibly undefined folder object.

## Response Style

Keep user instructions short and sequential. The user may paste combined terminal output; identify the newest failing line and avoid asking them to rerun unrelated old checks.
