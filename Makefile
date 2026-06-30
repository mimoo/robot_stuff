# Robot Rush — deploy helpers
#
#   make deploy     first-time setup: create a deploy key on the server, print it,
#                   and (once the key is added to GitHub) clone + build + start.
#   make redeploy   git push, then pull + rebuild + restart on the server.
#   make logs       tail the running services' logs.
#   make status     show service status.   make restart   restart services.
#   make ssh        open a shell on the server.

HOST        ?= robot-game
PUBLIC_HOST ?= 91.98.36.131
# Public domain served over HTTPS by Caddy (reverse proxy on the server).
# Leave empty to serve plain HTTP on :3000/:3001 via PUBLIC_HOST instead.
DOMAIN      ?= robots.davidwong.fr
REPO        ?= git@github.com:mimoo/robot_stuff.git
BRANCH      ?= main
APP_DIR     ?= /opt/robot-game

# read-only deploy key generated on the server, and its GitHub settings page
GH_KEYS_URL := https://github.com/mimoo/robot_stuff/settings/keys/new

.PHONY: deploy redeploy _remote logs status restart ssh help

help:
	@echo "make deploy    - provision the server + create a deploy key, then deploy"
	@echo "make redeploy  - git push, then pull + rebuild + restart on the server"
	@echo "make logs      - tail service logs    make status / restart"
	@echo "make ssh       - shell into $(HOST)"

deploy:
	@echo "==> Ensuring a deploy key exists on $(HOST)"
	@ssh $(HOST) 'test -f ~/.ssh/robot_deploy || ssh-keygen -t ed25519 -N "" -C "robot-game-deploy" -f ~/.ssh/robot_deploy'
	@echo ""
	@echo "=============== GitHub deploy key (server public key) ==============="
	@ssh $(HOST) 'cat ~/.ssh/robot_deploy.pub'
	@echo "===================================================================="
	@echo "==> Testing GitHub access from the server"
	@if ssh $(HOST) 'GIT_SSH_COMMAND="ssh -i ~/.ssh/robot_deploy -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new" git ls-remote $(REPO) >/dev/null 2>&1'; then \
		echo "    OK — the server can read the repo. Deploying..."; \
		$(MAKE) _remote; \
	else \
		echo ""; \
		echo "    The server can't read the repo yet. To finish setup:"; \
		echo "      1. Copy the deploy key printed above."; \
		echo "      2. Add it at $(GH_KEYS_URL)"; \
		echo "         (read-only is enough; you do NOT need to allow write access)."; \
		echo "      3. Run 'make deploy' again."; \
		exit 1; \
	fi

redeploy:
	@echo "==> Pushing $(BRANCH) to origin"
	git push origin $(BRANCH)
	@$(MAKE) _remote

# internal: run the remote provisioning/build/restart script over SSH
_remote:
	@echo "==> Deploying on $(HOST)"
	@ssh $(HOST) "APP_DIR='$(APP_DIR)' REPO='$(REPO)' BRANCH='$(BRANCH)' PUBLIC_HOST='$(PUBLIC_HOST)' DOMAIN='$(DOMAIN)' bash -s" < deploy/remote-deploy.sh
	@if [ -n "$(DOMAIN)" ]; then echo "==> Live at https://$(DOMAIN)"; else echo "==> Live at http://$(PUBLIC_HOST):3000"; fi

logs:
	@ssh $(HOST) 'journalctl -u robot-web -u robot-server -n 150 -f'

status:
	@ssh $(HOST) 'systemctl --no-pager status robot-server robot-web'

restart:
	@ssh $(HOST) 'systemctl restart robot-server robot-web && systemctl --no-pager status robot-server robot-web | grep Active'

ssh:
	@ssh $(HOST)
