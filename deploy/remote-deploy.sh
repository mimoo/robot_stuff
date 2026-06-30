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
#   DEPLOY_KEY  path to the deploy private key        (default ~/.ssh/robot_deploy)
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/robot-game}"
REPO="${REPO:?REPO is required}"
BRANCH="${BRANCH:-main}"
PUBLIC_HOST="${PUBLIC_HOST:-localhost}"
DEPLOY_KEY="${DEPLOY_KEY:-$HOME/.ssh/robot_deploy}"

export GIT_SSH_COMMAND="ssh -i $DEPLOY_KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
export DEBIAN_FRONTEND=noninteractive

log() { printf '\n\033[1;35m▶ %s\033[0m\n' "$*"; }

# ---- 1. system dependencies (idempotent) ----------------------------------
log "Checking system dependencies"
if command -v apt-get >/dev/null; then
  apt-get update -qq
  apt-get install -y -qq git curl ca-certificates >/dev/null
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
export NEXT_PUBLIC_API_URL="http://$PUBLIC_HOST:3001"
export NEXT_PUBLIC_WS_URL="ws://$PUBLIC_HOST:3001"
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
Environment=NEXT_PUBLIC_API_URL=http://$PUBLIC_HOST:3001
Environment=NEXT_PUBLIC_WS_URL=ws://$PUBLIC_HOST:3001
ExecStart=$NODE_BIN node_modules/.bin/next start -p 3000
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now robot-server robot-web >/dev/null 2>&1 || true
systemctl restart robot-server robot-web

# ---- 5. open the firewall if ufw is managing it ---------------------------
if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow 3000/tcp >/dev/null || true
  ufw allow 3001/tcp >/dev/null || true
fi

log "Done"
echo "Web:  http://$PUBLIC_HOST:3000"
echo "WS:   http://$PUBLIC_HOST:3001/health"
systemctl --no-pager --lines=0 status robot-server robot-web | grep -E "robot-(server|web)|Active:" || true
