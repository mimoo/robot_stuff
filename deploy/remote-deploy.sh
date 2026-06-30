#!/usr/bin/env bash
#
# Runs ON the server. Provisions deps (idempotent), pulls the repo with the
# deploy key, builds the web app, and (re)starts both services via systemd.
#
# Driven by env vars passed over SSH by the Makefile:
#   APP_DIR     where the repo lives on the server   (default /opt/robot-game)
#   REPO        git SSH url                           (required)
#   BRANCH      branch to deploy                      (default main)
#   PUBLIC_HOST host/IP browsers use to reach it      (default localhost)
#   DOMAIN      public HTTPS domain via Caddy proxy    (optional)
#   DEPLOY_KEY  path to the deploy private key        (default ~/.ssh/robot_deploy)
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/robot-game}"
REPO="${REPO:?REPO is required}"
BRANCH="${BRANCH:-main}"
PUBLIC_HOST="${PUBLIC_HOST:-localhost}"
DOMAIN="${DOMAIN:-}"
DEPLOY_KEY="${DEPLOY_KEY:-$HOME/.ssh/robot_deploy}"

# When DOMAIN is set, Caddy terminates TLS and the browser reaches both the web
# app and the websocket through that one HTTPS origin (no port, no mixed
# content). Otherwise fall back to hitting the services directly over plain HTTP.
if [ -n "$DOMAIN" ]; then
  PUBLIC_API_URL="https://$DOMAIN"
  PUBLIC_WS_URL="wss://$DOMAIN"
else
  PUBLIC_API_URL="http://$PUBLIC_HOST:3001"
  PUBLIC_WS_URL="ws://$PUBLIC_HOST:3001"
fi

export GIT_SSH_COMMAND="ssh -i $DEPLOY_KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
export DEBIAN_FRONTEND=noninteractive

log() { printf '\n\033[1;35m▶ %s\033[0m\n' "$*"; }

# ---- 1. system dependencies (idempotent) ----------------------------------
log "Checking system dependencies"
if command -v apt-get >/dev/null; then
  apt-get update -qq
  # unzip + xz-utils are required by the Bun installer
  apt-get install -y -qq git curl ca-certificates unzip xz-utils >/dev/null
fi

if ! command -v node >/dev/null; then
  log "Installing Node.js 22 (needed by the Next.js server)"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi

if [ ! -x "$HOME/.bun/bin/bun" ] && ! command -v bun >/dev/null; then
  log "Installing Bun"
  curl -fsSL https://bun.sh/install | bash >/dev/null
fi
export PATH="$HOME/.bun/bin:$PATH"
BUN_BIN="$(command -v bun)"
NODE_BIN="$(command -v node)"
echo "bun:  $BUN_BIN ($(bun --version))"
echo "node: $NODE_BIN ($(node --version))"

# ---- 2. fetch the code ----------------------------------------------------
if [ ! -d "$APP_DIR/.git" ]; then
  log "Cloning $REPO -> $APP_DIR"
  mkdir -p "$(dirname "$APP_DIR")"
  git clone --branch "$BRANCH" "$REPO" "$APP_DIR"
else
  log "Updating $APP_DIR (branch $BRANCH)"
  git -C "$APP_DIR" fetch --quiet origin "$BRANCH"
  git -C "$APP_DIR" reset --hard "origin/$BRANCH"
fi
cd "$APP_DIR"

# ---- 3. build -------------------------------------------------------------
log "Installing JS dependencies"
bun install

log "Building the web app"
export NEXT_PUBLIC_API_URL="$PUBLIC_API_URL"
export NEXT_PUBLIC_WS_URL="$PUBLIC_WS_URL"
( cd apps/web && "$NODE_BIN" node_modules/.bin/next build )

# ---- 4. systemd services --------------------------------------------------
log "Installing systemd services"
cat > /etc/systemd/system/robot-server.service <<UNIT
[Unit]
Description=Robot Rush — websocket game server
After=network.target

[Service]
Type=simple
WorkingDirectory=$APP_DIR
Environment=PORT=3001
ExecStart=$BUN_BIN apps/server/index.ts
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
UNIT

cat > /etc/systemd/system/robot-web.service <<UNIT
[Unit]
Description=Robot Rush — Next.js web app
After=network.target robot-server.service

[Service]
Type=simple
WorkingDirectory=$APP_DIR/apps/web
Environment=PORT=3000
Environment=NEXT_PUBLIC_API_URL=$PUBLIC_API_URL
Environment=NEXT_PUBLIC_WS_URL=$PUBLIC_WS_URL
ExecStart=$NODE_BIN node_modules/.bin/next start -p 3000
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now robot-server robot-web >/dev/null 2>&1 || true
systemctl restart robot-server robot-web

# ---- 5. reverse proxy (Caddy) for the public HTTPS domain -----------------
# Only when DOMAIN is set. Caddy listens on 80/443, serves TLS with its own
# internal cert, and routes the API/websocket to :3001 and everything else to
# :3000. Put Cloudflare in front with SSL/TLS mode "Full" (it trusts the
# internal cert without validating it); for "Full (strict)" install a
# Cloudflare Origin Certificate at /etc/caddy/ instead of using `tls internal`.
if [ -n "$DOMAIN" ]; then
  log "Configuring Caddy reverse proxy for $DOMAIN"
  if ! command -v caddy >/dev/null; then
    apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl >/dev/null
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
      | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
      > /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -qq
    apt-get install -y -qq caddy >/dev/null
  fi

  cat > /etc/caddy/Caddyfile <<CADDY
$DOMAIN {
	tls internal

	# API + websocket + health checks go to the game server on :3001.
	@backend path /api/* /ws /health
	handle @backend {
		reverse_proxy localhost:3001
	}

	# Everything else is the Next.js web app on :3000.
	handle {
		reverse_proxy localhost:3000
	}
}
CADDY

  systemctl enable caddy >/dev/null 2>&1 || true
  systemctl restart caddy
fi

# ---- 6. open the firewall if ufw is managing it ---------------------------
if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow 3000/tcp >/dev/null || true
  ufw allow 3001/tcp >/dev/null || true
  if [ -n "$DOMAIN" ]; then
    ufw allow 80/tcp >/dev/null || true
    ufw allow 443/tcp >/dev/null || true
  fi
fi

log "Done"
if [ -n "$DOMAIN" ]; then
  echo "Web:  https://$DOMAIN"
  echo "WS:   wss://$DOMAIN/ws"
else
  echo "Web:  http://$PUBLIC_HOST:3000"
  echo "WS:   http://$PUBLIC_HOST:3001/health"
fi
systemctl --no-pager --lines=0 status robot-server robot-web | grep -E "robot-(server|web)|Active:" || true
